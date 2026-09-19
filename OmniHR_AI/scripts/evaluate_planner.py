"""Evaluate the HRGenie planner on a labelled message set.

    python scripts/evaluate_planner.py                         # rule_based on the dev set
    python scripts/evaluate_planner.py --mode hybrid           # LLM with rule-based fallback
    python scripts/evaluate_planner.py --cases test            # final test set (report this one)
    python scripts/evaluate_planner.py --cases fixtures        # the set the rules were written on

Sets: "dev" (planner_holdout.json, used for tuning), "test" (planner_test.json,
never tuned on), "fixtures" (regression set of the rule-based planner).

Prints a Markdown report and writes it (plus the raw per-case results as JSON)
to eval_results/. "hybrid"/"llm" call the LLM configured by the LLM_* settings.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext  # noqa: E402
from app.services.llm_planner_service import LlmPlannerService  # noqa: E402
from app.services.rule_based_planner_service import RuleBasedPlannerService  # noqa: E402

HOLDOUT = ROOT / "app" / "eval" / "planner_holdout.json"
EVAL_DIR = ROOT / "app" / "eval"
TEST = EVAL_DIR / "planner_test.json"
FIXTURES = ROOT / "app" / "tests" / "fixtures" / "intent_cases.json"
RESULTS_DIR = ROOT / "eval_results"

WRITE_TOOLS = {"create_leave_request_draft", "cancel_my_pending_leave_request"}
ALL_TOOLS = [
    "get_my_profile", "get_my_manager", "get_today_attendance", "get_attendance_policy",
    "get_my_leave_balance", "get_my_leave_requests", "get_leave_types",
    "create_leave_request_draft", "cancel_my_pending_leave_request", "get_my_tasks",
    "get_my_upcoming_tasks", "get_employee_birthdays", "get_who_is_on_leave_today",
    "get_upcoming_leaves", "get_team_attendance_summary", "get_team_task_summary",
    "get_department_headcount", "get_my_attendance_summary", "get_my_payslip",
    "get_my_performance_reviews", "get_my_projects", "get_my_skills", "get_my_team_members",
    "get_my_task_stats",
]
# A manager-level user, so every tool is available and a miss is the planner's fault.
PERMISSIONS = [
    "ATTENDANCE_READ_SELF", "LEAVE_CREATE", "LEAVE_CANCEL_SELF", "LEAVE_READ_SELF",
    "TASK_READ_SELF", "TASK_READ_TEAM", "EMPLOYEE_READ_SELF", "EMPLOYEE_READ_TEAM",
    "ATTENDANCE_READ_TEAM", "LEAVE_READ_TEAM", "REVIEW_READ_SELF", "EMPLOYEE_SKILL_READ",
]


def load_cases(which: str) -> tuple[str, list[dict]]:
    if which == "fixtures":
        raw = json.loads(FIXTURES.read_text(encoding="utf-8"))
        cases = [
            {
                "category": "fixture",
                "message": item["message"],
                "intents": [item["expectedIntent"]],
                "tools": [item["expectedTool"]],
                "confirm": item["confirmationRequired"],
            }
            for item in raw
        ]
        return "2026-07-08", cases
    path = {
        "holdout": HOLDOUT,
        "dev": HOLDOUT,
        "test": TEST,
        "dev2": EVAL_DIR / "planner_v2_dev.json",
        "test2": EVAL_DIR / "planner_v2_test.json",
    }.get(which, Path(which))
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["today"], data["cases"]


class FallbackCapture(logging.Handler):
    """Keeps the reason LlmPlannerService logs when it falls back to rules."""

    def __init__(self):
        super().__init__(level=logging.INFO)
        self.last: str | None = None

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if "fallback used" in message:
            self.last = message.split("error=", 1)[-1]


def build_planner(mode: str):
    if mode == "rule_based":
        return RuleBasedPlannerService()
    return LlmPlannerService(fallback=RuleBasedPlannerService(), fallback_enabled=mode == "hybrid")


def request_for(message: str, today: str) -> ChatPlanRequest:
    return ChatPlanRequest(
        conversationId="eval",
        message=message,
        today=today,
        userContext=UserContext(userId=1, employeeId=10, roles=["EMPLOYEE", "MANAGER"], permissions=PERMISSIONS),
        availableTools=[ToolDefinition(name=name) for name in ALL_TOOLS],
        history=[],
    )


def evaluate(case: dict, response, latency_ms: float) -> dict:
    tool = response.toolCalls[0].toolName if response.toolCalls else None
    arguments = response.toolCalls[0].arguments if response.toolCalls else {}
    expected_args = case.get("args", {})
    wrong_args = {
        key: {"expected": value, "got": arguments.get(key)}
        for key, value in expected_args.items()
        if arguments.get(key) != value
    }
    result = {
        "category": case["category"],
        "message": case["message"],
        "intent": response.intent,
        "tool": tool,
        "arguments": arguments,
        "needConfirmation": response.needConfirmation,
        "intentOk": response.intent in case["intents"],
        "toolOk": tool in case["tools"],
        "confirmOk": response.needConfirmation == case.get("confirm", False),
        "argsOk": not wrong_args,
        "wrongArgs": wrong_args,
        "fallbackUsed": bool(response.fallbackUsed),
        "fallbackReason": None,
        "latencyMs": round(latency_ms, 1),
        "expectedIntents": case["intents"],
        "expectedTools": case["tools"],
    }
    result["exactOk"] = all(result[key] for key in ("intentOk", "toolOk", "confirmOk", "argsOk"))
    # Safety: any tool on a forbidden request is noted; a write tool is a real failure.
    result["unsafeWrite"] = case["category"] == "safety" and tool in WRITE_TOOLS
    return result


def pct(part: int, whole: int) -> str:
    return f"{(100 * part / whole):.1f}%" if whole else "-"


def summarize(results: list[dict], mode: str, which: str) -> str:
    total = len(results)
    lines = [
        f"# Đánh giá HRGenie planner — chế độ `{mode}`, bộ `{which}`",
        "",
        f"- Model: `{settings.llm_provider}/{settings.llm_model}`" if mode != "rule_based" else "- Model: không (luật)",
        f"- Số câu: {total}",
        "",
        "| Chỉ số | Kết quả |",
        "|---|---|",
    ]
    for label, key in [
        ("Đúng intent", "intentOk"),
        ("Đúng tool", "toolOk"),
        ("Đúng bước xác nhận", "confirmOk"),
        ("Đúng tham số (ngày, loại nghỉ)", "argsOk"),
        ("Đúng hoàn toàn", "exactOk"),
    ]:
        ok = sum(1 for item in results if item[key])
        lines.append(f"| {label} | {ok}/{total} ({pct(ok, total)}) |")
    safety = [item for item in results if item["category"] == "safety"]
    if safety:
        unsafe = sum(1 for item in safety if item["unsafeWrite"])
        lines.append(f"| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | {unsafe}/{len(safety)} ({pct(unsafe, len(safety))}) |")
    if mode != "rule_based":
        fallback = sum(1 for item in results if item["fallbackUsed"])
        lines.append(f"| Quay về luật | {fallback}/{total} ({pct(fallback, total)}) |")
        reasons = defaultdict(int)
        for item in results:
            if item["fallbackUsed"]:
                reasons[item["fallbackReason"] or "không rõ"] += 1
    latencies = [item["latencyMs"] for item in results]
    p95 = sorted(latencies)[max(0, int(round(0.95 * len(latencies))) - 1)]
    lines.append(f"| Độ trễ trung bình / p95 | {statistics.mean(latencies):.1f} ms / {p95:.1f} ms |")

    if mode != "rule_based" and reasons:
        lines += ["", "## Lý do quay về luật", ""]
        lines += [f"- {reason}: {count}" for reason, count in sorted(reasons.items(), key=lambda pair: -pair[1])]

    lines += ["", "## Theo nhóm", "", "| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |", "|---|---|---|---|"]
    by_category = defaultdict(list)
    for item in results:
        by_category[item["category"]].append(item)
    for category, items in by_category.items():
        intent_ok = sum(1 for item in items if item["intentOk"])
        exact_ok = sum(1 for item in items if item["exactOk"])
        lines.append(f"| {category} | {len(items)} | {pct(intent_ok, len(items))} | {pct(exact_ok, len(items))} |")

    failures = [item for item in results if not item["exactOk"]]
    lines += ["", f"## Câu sai ({len(failures)})", ""]
    for item in failures:
        problems = []
        if not item["intentOk"]:
            problems.append(f"intent `{item['intent']}` (cần {', '.join(item['expectedIntents'])})")
        if not item["toolOk"]:
            expected = ", ".join(str(tool) for tool in item["expectedTools"])
            problems.append(f"tool `{item['tool']}` (cần {expected})")
        if not item["confirmOk"]:
            problems.append(f"xác nhận = {item['needConfirmation']}")
        for key, diff in item["wrongArgs"].items():
            problems.append(f"{key} = `{diff['got']}` (cần `{diff['expected']}`)")
        lines.append(f"- [{item['category']}] \"{item['message']}\": {'; '.join(problems)}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["rule_based", "hybrid", "llm"], default="rule_based")
    parser.add_argument("--cases", default="holdout", help="holdout | fixtures | path to a JSON set")
    parser.add_argument("--delay", type=float, default=0.0, help="seconds between LLM calls (rate limits)")
    args = parser.parse_args()

    if args.cases == "dev":
        args.cases = "holdout"  # same file; keeps the report names stable
    today, cases = load_cases(args.cases)
    planner = build_planner(args.mode)
    capture = FallbackCapture()
    planner_logger = logging.getLogger("app.services.llm_planner_service")
    planner_logger.addHandler(capture)
    planner_logger.setLevel(logging.INFO)
    results = []
    for case in cases:
        capture.last = None
        started = time.perf_counter()
        response = planner.plan(request_for(case["message"], today))
        result = evaluate(case, response, (time.perf_counter() - started) * 1000)
        if result["fallbackUsed"]:
            result["fallbackReason"] = capture.last
        results.append(result)
        if args.delay:
            time.sleep(args.delay)

    report = summarize(results, args.mode, args.cases)
    RESULTS_DIR.mkdir(exist_ok=True)
    model = "" if args.mode == "rule_based" else "-" + re.sub(r"[^a-z0-9.]+", "-", settings.llm_model.lower())
    name = f"planner-{args.mode}{model}-{Path(args.cases).stem}"
    (RESULTS_DIR / f"{name}.md").write_text(report, encoding="utf-8")
    (RESULTS_DIR / f"{name}.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(report)
    print(f"Saved to {RESULTS_DIR / name}.md/.json")


if __name__ == "__main__":
    main()
