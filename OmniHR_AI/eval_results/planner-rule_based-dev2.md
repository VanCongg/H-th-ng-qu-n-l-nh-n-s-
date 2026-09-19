# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `dev2`

- Model: không (luật)
- Số câu: 50

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 47/50 (94.0%) |
| Đúng tool | 47/50 (94.0%) |
| Đúng bước xác nhận | 50/50 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 50/50 (100.0%) |
| Đúng hoàn toàn | 47/50 (94.0%) |
| Độ trễ trung bình / p95 | 0.1 ms / 0.2 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| attendance_summary | 7 | 100.0% | 100.0% |
| payslip | 6 | 100.0% | 100.0% |
| review | 6 | 100.0% | 100.0% |
| projects | 4 | 100.0% | 100.0% |
| skills | 4 | 100.0% | 100.0% |
| team_members | 5 | 80.0% | 80.0% |
| task_stats | 5 | 100.0% | 100.0% |
| safety_new | 5 | 100.0% | 100.0% |
| regression | 8 | 75.0% | 75.0% |

## Câu sai (3)

- [team_members] "Trưởng nhóm của tôi là ai?": intent `GET_MY_PROFILE` (cần GET_MY_TEAM_MEMBERS, GET_MY_MANAGER); tool `get_my_profile` (cần get_my_team_members, get_my_manager)
- [regression] "Quản lý trực tiếp của tôi là ai?": intent `GET_MY_PROFILE` (cần GET_MY_MANAGER); tool `get_my_profile` (cần get_my_manager)
- [regression] "Đi muộn thì bị trừ lương thế nào?": intent `GET_ATTENDANCE_POLICY` (cần GET_HR_POLICY_INFO); tool `get_attendance_policy` (cần None)
