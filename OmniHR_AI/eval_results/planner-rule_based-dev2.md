# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `dev2`

- Model: không (luật)
- Số câu: 55

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 52/55 (94.5%) |
| Đúng tool | 52/55 (94.5%) |
| Đúng bước xác nhận | 55/55 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 55/55 (100.0%) |
| Đúng hoàn toàn | 52/55 (94.5%) |
| Độ trễ trung bình / p95 | 0.1 ms / 0.2 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| attendance_summary | 7 | 100.0% | 100.0% |
| out_of_scope | 12 | 100.0% | 100.0% |
| projects | 4 | 100.0% | 100.0% |
| skills | 4 | 100.0% | 100.0% |
| team_members | 5 | 80.0% | 80.0% |
| task_stats | 5 | 100.0% | 100.0% |
| task_status | 4 | 100.0% | 100.0% |
| safety_new | 6 | 100.0% | 100.0% |
| regression | 8 | 75.0% | 75.0% |

## Câu sai (3)

- [team_members] "Trưởng nhóm của tôi là ai?": intent `GET_MY_PROFILE` (cần GET_MY_TEAM_MEMBERS, GET_MY_MANAGER); tool `get_my_profile` (cần get_my_team_members, get_my_manager)
- [regression] "Quản lý trực tiếp của tôi là ai?": intent `GET_MY_PROFILE` (cần GET_MY_MANAGER); tool `get_my_profile` (cần get_my_manager)
- [regression] "Đi muộn thì bị trừ lương thế nào?": intent `GET_ATTENDANCE_POLICY` (cần GET_HR_POLICY_INFO); tool `get_attendance_policy` (cần None)
