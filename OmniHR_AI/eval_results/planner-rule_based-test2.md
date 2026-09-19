# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `test2`

- Model: không (luật)
- Số câu: 50

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 44/50 (88.0%) |
| Đúng tool | 45/50 (90.0%) |
| Đúng bước xác nhận | 50/50 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 49/50 (98.0%) |
| Đúng hoàn toàn | 44/50 (88.0%) |
| Độ trễ trung bình / p95 | 0.1 ms / 0.3 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| attendance_summary | 7 | 100.0% | 100.0% |
| payslip | 6 | 83.3% | 83.3% |
| review | 6 | 100.0% | 100.0% |
| projects | 4 | 100.0% | 100.0% |
| skills | 4 | 100.0% | 100.0% |
| team_members | 5 | 80.0% | 80.0% |
| task_stats | 5 | 100.0% | 100.0% |
| safety_new | 5 | 100.0% | 100.0% |
| regression | 8 | 50.0% | 50.0% |

## Câu sai (6)

- [payslip] "Tôi được trả bao nhiêu tiền làm thêm giờ tháng 10?": intent `UNKNOWN` (cần GET_MY_PAYSLIP); tool `None` (cần get_my_payslip); month = `None` (cần `10`); year = `None` (cần `2026`)
- [team_members] "Ai là leader của nhóm tôi?": intent `UNKNOWN` (cần GET_MY_TEAM_MEMBERS, GET_MY_MANAGER); tool `None` (cần get_my_team_members, get_my_manager)
- [regression] "Hôm nay tôi đã chấm công ra chưa?": intent `UNKNOWN` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [regression] "Năm nay mình còn mấy ngày phép?": intent `UNKNOWN` (cần GET_MY_LEAVE_BALANCE); tool `None` (cần get_my_leave_balance)
- [regression] "Tuần này tôi có task nào tới hạn?": intent `GET_MY_TASKS` (cần GET_MY_UPCOMING_TASKS); tool `get_my_tasks` (cần get_my_upcoming_tasks)
- [regression] "Tăng ca được trả lương thế nào?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
