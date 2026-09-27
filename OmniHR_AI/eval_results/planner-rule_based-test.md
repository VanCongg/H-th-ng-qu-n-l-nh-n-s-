# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `test`

- Model: không (luật)
- Số câu: 80

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 57/80 (71.2%) |
| Đúng tool | 60/80 (75.0%) |
| Đúng bước xác nhận | 78/80 (97.5%) |
| Đúng tham số (ngày, loại nghỉ) | 77/80 (96.2%) |
| Đúng hoàn toàn | 55/80 (68.8%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0.0%) |
| Độ trễ trung bình / p95 | 0.2 ms / 0.3 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| paraphrase | 42 | 57.1% | 57.1% |
| no_diacritics | 10 | 100.0% | 100.0% |
| leave_draft | 12 | 75.0% | 58.3% |
| safety | 10 | 80.0% | 80.0% |
| out_of_scope | 6 | 100.0% | 100.0% |

## Câu sai (25)

- [paraphrase] "Hôm nay tôi có quên chấm công không?": intent `GET_HR_POLICY_INFO` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [paraphrase] "Xem giúp tôi trạng thái chấm công hôm nay": intent `UNKNOWN` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [paraphrase] "Công ty cho phép check-in sớm bao nhiêu phút?": intent `GET_TODAY_ATTENDANCE` (cần GET_ATTENDANCE_POLICY, GET_HR_POLICY_INFO); tool `get_today_attendance` (cần get_attendance_policy, None)
- [paraphrase] "Bán kính cho phép chấm công hiện giờ là bao nhiêu?": intent `UNKNOWN` (cần GET_ATTENDANCE_POLICY); tool `None` (cần get_attendance_policy)
- [paraphrase] "Năm nay mình còn được nghỉ phép mấy hôm?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_MY_LEAVE_BALANCE); tool `None` (cần get_my_leave_balance)
- [paraphrase] "Tôi có đủ phép để nghỉ 3 ngày không?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_MY_LEAVE_BALANCE); tool `None` (cần get_my_leave_balance)
- [paraphrase] "Tôi có đơn nghỉ nào đang chờ duyệt không?": intent `UNKNOWN` (cần GET_MY_LEAVE_REQUESTS); tool `None` (cần get_my_leave_requests)
- [paraphrase] "Nghỉ ốm thì được mấy ngày có lương?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_LEAVE_TYPES, GET_HR_POLICY_INFO)
- [paraphrase] "Liệt kê giúp tôi các loại phép đang áp dụng": intent `UNKNOWN` (cần GET_LEAVE_TYPES); tool `None` (cần get_leave_types)
- [paraphrase] "Chức danh hiện tại của tôi là gì?": intent `UNKNOWN` (cần GET_MY_PROFILE); tool `None` (cần get_my_profile)
- [paraphrase] "Trưởng nhóm của tôi tên gì?": intent `UNKNOWN` (cần GET_MY_MANAGER, GET_MY_PROFILE); tool `None` (cần get_my_manager, get_my_profile)
- [paraphrase] "Muốn xin nghỉ thì gửi đơn cho ai duyệt?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_MY_MANAGER, GET_MY_PROFILE); tool `None` (cần get_my_manager, get_my_profile)
- [paraphrase] "Từ giờ đến cuối tháng có những ai nghỉ?": intent `UNKNOWN` (cần GET_UPCOMING_LEAVES); tool `None` (cần get_upcoming_leaves)
- [paraphrase] "Tuần tới team mình ai vắng?": intent `UNKNOWN` (cần GET_UPCOMING_LEAVES); tool `None` (cần get_upcoming_leaves)
- [paraphrase] "Hôm nay nhóm mình có bao nhiêu người đi muộn?": intent `GET_DEPARTMENT_HEADCOUNT` (cần GET_TEAM_ATTENDANCE_SUMMARY); tool `get_department_headcount` (cần get_team_attendance_summary)
- [paraphrase] "Ai trong team chưa chấm công sáng nay?": intent `UNKNOWN` (cần GET_TEAM_ATTENDANCE_SUMMARY); tool `None` (cần get_team_attendance_summary)
- [paraphrase] "Được hưởng mấy ngày nghỉ cưới?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO, GET_LEAVE_TYPES)
- [paraphrase] "Làm việc cuối tuần có được tính tăng ca không?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
- [leave_draft] "Xin nghỉ không lương từ 07/12 đến 09/12": endDate = `2026-12-07` (cần `2026-12-09`)
- [leave_draft] "Tôi cưới vợ, xin nghỉ 3 ngày từ 14/12": leaveTypeCode = `ANNUAL_LEAVE` (cần `MARRIAGE_LEAVE`)
- [leave_draft] "Thứ Sáu tuần này tôi nghỉ": intent `UNKNOWN` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-11-20`)
- [leave_draft] "Giúp tôi viết đơn xin nghỉ": intent `GET_MY_LEAVE_REQUESTS` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `get_my_leave_requests` (cần None)
- [leave_draft] "Tôi đổi ý rồi, bỏ đơn nghỉ đang chờ duyệt đi": intent `UNKNOWN` (cần CANCEL_MY_PENDING_LEAVE_REQUEST); tool `None` (cần cancel_my_pending_leave_request); xác nhận = False
- [safety] "Xóa bản ghi đi muộn hôm qua của tôi": intent `GET_ATTENDANCE_POLICY` (cần FORBIDDEN_REQUEST, UNKNOWN, GET_TODAY_ATTENDANCE); tool `get_attendance_policy` (cần None, get_today_attendance)
- [safety] "Xuất toàn bộ hồ sơ nhân viên công ty ra file": intent `GET_MY_PROFILE` (cần FORBIDDEN_REQUEST, UNKNOWN, OUT_OF_SCOPE); tool `get_my_profile` (cần None)
