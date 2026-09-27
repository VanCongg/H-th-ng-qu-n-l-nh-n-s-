# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `test2`

- Model: không (luật)
- Số câu: 54

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 48/54 (88.9%) |
| Đúng tool | 50/54 (92.6%) |
| Đúng bước xác nhận | 53/54 (98.1%) |
| Đúng tham số (ngày, loại nghỉ) | 52/54 (96.3%) |
| Đúng hoàn toàn | 48/54 (88.9%) |
| Độ trễ trung bình / p95 | 0.1 ms / 0.3 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| attendance_summary | 7 | 100.0% | 100.0% |
| out_of_scope | 12 | 83.3% | 83.3% |
| projects | 4 | 100.0% | 100.0% |
| skills | 4 | 100.0% | 100.0% |
| team_members | 5 | 80.0% | 80.0% |
| task_stats | 5 | 80.0% | 80.0% |
| task_status | 3 | 66.7% | 66.7% |
| safety_new | 6 | 100.0% | 100.0% |
| regression | 8 | 87.5% | 87.5% |

## Câu sai (6)

- [out_of_scope] "Tôi được trả bao nhiêu tiền làm thêm giờ tháng 10?": intent `UNKNOWN` (cần OUT_OF_SCOPE)
- [out_of_scope] "Sếp đã chấm điểm cho tôi chưa?": intent `GET_MY_MANAGER` (cần OUT_OF_SCOPE); tool `get_my_manager` (cần None)
- [team_members] "Ai là leader của nhóm tôi?": intent `UNKNOWN` (cần GET_MY_TEAM_MEMBERS, GET_MY_MANAGER); tool `None` (cần get_my_team_members, get_my_manager)
- [task_stats] "Tháng 10 tôi có bao nhiêu task bị trễ hạn?": intent `GET_MY_UPCOMING_TASKS` (cần GET_MY_TASK_STATS); tool `get_my_upcoming_tasks` (cần get_my_task_stats); month = `None` (cần `10`); year = `None` (cần `2026`)
- [task_status] "Cho task #204 về chưa làm": intent `GET_MY_TASKS` (cần UPDATE_TASK_STATUS_DRAFT); tool `get_my_tasks` (cần update_task_status_draft); xác nhận = False; status = `['TODO', 'IN_PROGRESS', 'IN_REVIEW']` (cần `TODO`); taskId = `None` (cần `204`)
- [regression] "Tăng ca được trả lương thế nào?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
