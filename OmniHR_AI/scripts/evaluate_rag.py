# Đánh giá tìm kiếm tài liệu chính sách: Recall@3, Top-1, tỉ lệ trả lời bừa với câu ngoài tài liệu.
# Ngưỡng chỉ chọn trên tập dev, tập test chấm một lần. Ghi báo cáo vào eval_results/.

"""Evaluate policy retrieval (RAG) on a labelled question set.

    python scripts/evaluate_rag.py                 # keyword only, plus hybrid if EMBEDDING_* is set
    python scripts/evaluate_rag.py --tune          # also pick the embedding thresholds on "dev"

Metrics, per split:
  - Recall@3: an answerable question has an expected section among the top 3.
  - Top-1: the first section is an expected one.
  - False positives: an unanswerable question returns any section at all.
Thresholds are only ever chosen on "dev"; "test" is reported with whatever was
chosen there. Query embeddings are memoised, so a threshold sweep costs one
embedding call per question. Writes eval_results/rag-*.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.schemas.rag import RagSearchRequest  # noqa: E402
from app.services.rag_service import RagService  # noqa: E402

CASES = ROOT / "app" / "eval" / "rag_cases.json"
RESULTS_DIR = ROOT / "eval_results"
TOP_K = 3


def memoise_similarities(rag: RagService) -> None:
    original = rag._embedding_similarities
    cache: dict[str, dict[str, float]] = {}

    def cached(query: str) -> dict[str, float]:
        if query not in cache:
            cache[query] = original(query)
        return cache[query]

    rag._embedding_similarities = cached  # type: ignore[method-assign]


def score(rag: RagService, cases: list[dict]) -> dict:
    answerable = [case for case in cases if case["expected"]]
    unanswerable = [case for case in cases if not case["expected"]]
    recall = top1 = false_pos = 0
    misses = []
    for case in cases:
        titles = [item.title for item in rag.search(RagSearchRequest(query=case["query"], topK=TOP_K)).items]
        if case["expected"]:
            hit = any(title in case["expected"] for title in titles)
            recall += hit
            top1 += bool(titles) and titles[0] in case["expected"]
            if not hit:
                misses.append((case["query"], titles))
        elif titles:
            false_pos += 1
            misses.append((case["query"], titles))
    return {
        "recall": recall / len(answerable),
        "top1": top1 / len(answerable),
        "falsePositive": false_pos / len(unanswerable) if unanswerable else 0.0,
        "answerable": len(answerable),
        "unanswerable": len(unanswerable),
        "misses": misses,
    }


def objective(metrics: dict) -> float:
    # A wrong policy quoted with confidence is worse than "no document on that",
    # so a false positive costs as much as a missed answer.
    return metrics["recall"] - metrics["falsePositive"]


def configure(rag: RagService, min_score: float, min_gap: float) -> None:
    rag._min_embedding_score = min_score
    rag._min_embedding_gap = min_gap


def tune(rag: RagService, dev: list[dict]) -> tuple[float, float, dict]:
    best: tuple[float, float, float, dict] | None = None
    for score_step in range(50, 86):
        for gap_step in range(0, 13):
            min_score, min_gap = score_step / 100, gap_step / 100
            configure(rag, min_score, min_gap)
            metrics = score(rag, dev)
            value = objective(metrics)
            # Ties go to the stricter setting: the one less likely to answer off-topic.
            key = (value, min_score, min_gap)
            if best is None or key > best[:3]:
                best = (value, min_score, min_gap, metrics)
    assert best is not None
    return best[1], best[2], best[3]


def row(label: str, metrics: dict) -> str:
    return (
        f"| {label} | {metrics['recall']:.0%} | {metrics['top1']:.0%} | "
        f"{metrics['falsePositive']:.0%} ({round(metrics['falsePositive'] * metrics['unanswerable'])}/{metrics['unanswerable']}) |"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true", help="choose the embedding thresholds on dev")
    args = parser.parse_args()

    data = json.loads(CASES.read_text(encoding="utf-8"))
    dev, test = data["dev"], data["test"]

    keyword = RagService(mode="keyword")
    lines = [
        "# Đánh giá truy xuất chính sách (RAG)",
        "",
        f"- Bộ câu: dev {len(dev)} câu, test {len(test)} câu (mỗi bộ có câu không có trong tài liệu)",
        f"- Top-k: {TOP_K}; ngưỡng chỉ được chọn trên dev, test chấm một lần",
        "",
        "| Cấu hình | Recall@3 | Top-1 | Trả lời bừa (câu lạc đề có kết quả) |",
        "|---|---|---|---|",
        row("Chỉ từ khóa — dev", score(keyword, dev)),
        row("Chỉ từ khóa — test", score(keyword, test)),
    ]

    hybrid = RagService(mode="hybrid")
    if hybrid.active_mode != "hybrid":
        lines += ["", "Embedding chưa cấu hình (EMBEDDING_PROVIDER), chỉ có kết quả từ khóa."]
    else:
        memoise_similarities(hybrid)
        default = (settings.rag_min_embedding_score, settings.rag_min_embedding_gap)
        configure(hybrid, *default)
        lines += [
            row(f"Lai, ngưỡng hiện tại {default[0]}/{default[1]} — dev", score(hybrid, dev)),
            row(f"Lai, ngưỡng hiện tại {default[0]}/{default[1]} — test", score(hybrid, test)),
        ]
        if args.tune:
            min_score, min_gap, dev_metrics = tune(hybrid, dev)
            configure(hybrid, min_score, min_gap)
            test_metrics = score(hybrid, test)
            lines += [
                row(f"Lai, ngưỡng chọn trên dev {min_score}/{min_gap} — dev", dev_metrics),
                row(f"Lai, ngưỡng chọn trên dev {min_score}/{min_gap} — test", test_metrics),
                "",
                f"Ngưỡng chọn: RAG_MIN_EMBEDDING_SCORE={min_score}, RAG_MIN_EMBEDDING_GAP={min_gap} "
                f"(model `{settings.embedding_model}`). Hàm mục tiêu: Recall@3 − tỉ lệ trả lời bừa; hoà thì chọn ngưỡng chặt hơn.",
                "",
                "## Câu sai trên test",
                "",
            ]
            lines += [f"- \"{query}\": {titles or 'không có kết quả'}" for query, titles in test_metrics["misses"]] or ["- (không có)"]

    report = "\n".join(lines) + "\n"
    RESULTS_DIR.mkdir(exist_ok=True)
    name = "rag-keyword" if hybrid.active_mode != "hybrid" else f"rag-{settings.embedding_model}"
    (RESULTS_DIR / f"{name}.md").write_text(report, encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(report)
    print(f"Saved to {RESULTS_DIR / name}.md")


if __name__ == "__main__":
    main()
