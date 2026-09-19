# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `holdout`

- Model: không (luật)
- Số câu: 82

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 44/82 (53.7%) |
| Đúng tool | 46/82 (56.1%) |
| Đúng bước xác nhận | 74/82 (90.2%) |
| Đúng tham số (ngày, loại nghỉ) | 77/82 (93.9%) |
| Đúng hoàn toàn | 42/82 (51.2%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 1/10 (10.0%) |
| Độ trễ trung bình / p95 | 0.1 ms / 0.3 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| paraphrase | 42 | 28.6% | 28.6% |
| no_diacritics | 12 | 83.3% | 83.3% |
| leave_draft | 12 | 58.3% | 41.7% |
| safety | 10 | 90.0% | 90.0% |
| out_of_scope | 6 | 100.0% | 100.0% |

## Câu sai (40)

- [paraphrase] "Sáng nay tôi đã quẹt vân tay vào ca chưa nhỉ?": intent `UNKNOWN` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [paraphrase] "Cho mình xem giờ vào ca hôm nay": intent `UNKNOWN` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [paraphrase] "Hôm nay mình có bị tính đi trễ không?": intent `UNKNOWN` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [paraphrase] "Tôi đã check out chưa?": intent `GET_HR_POLICY_INFO` (cần GET_TODAY_ATTENDANCE); tool `None` (cần get_today_attendance)
- [paraphrase] "Ca sáng bắt đầu lúc mấy giờ?": intent `GET_HR_POLICY_INFO` (cần GET_ATTENDANCE_POLICY); tool `None` (cần get_attendance_policy)
- [paraphrase] "Mấy giờ thì được tan làm?": intent `UNKNOWN` (cần GET_ATTENDANCE_POLICY); tool `None` (cần get_attendance_policy)
- [paraphrase] "Phải đứng cách văn phòng bao xa mới chấm công được?": intent `UNKNOWN` (cần GET_ATTENDANCE_POLICY); tool `None` (cần get_attendance_policy)
- [paraphrase] "Mình còn mấy ngày nghỉ phép nữa?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_MY_LEAVE_BALANCE); tool `None` (cần get_my_leave_balance)
- [paraphrase] "Quỹ phép năm nay của tôi còn lại bao nhiêu ngày?": intent `GET_HR_POLICY_INFO` (cần GET_MY_LEAVE_BALANCE); tool `None` (cần get_my_leave_balance)
- [paraphrase] "Tôi đã dùng bao nhiêu ngày phép rồi?": intent `GET_HR_POLICY_INFO` (cần GET_MY_LEAVE_BALANCE); tool `None` (cần get_my_leave_balance)
- [paraphrase] "Liệt kê các đơn nghỉ mình đã gửi": intent `UNKNOWN` (cần GET_MY_LEAVE_REQUESTS); tool `None` (cần get_my_leave_requests)
- [paraphrase] "Tôi đang được giao những việc gì?": intent `UNKNOWN` (cần GET_MY_TASKS, GET_MY_UPCOMING_TASKS); tool `None` (cần get_my_tasks, get_my_upcoming_tasks)
- [paraphrase] "Tuần này tôi có việc nào tới hạn không?": intent `UNKNOWN` (cần GET_MY_UPCOMING_TASKS); tool `None` (cần get_my_upcoming_tasks)
- [paraphrase] "Có task nào mình đang trễ deadline không?": intent `GET_MY_TASKS` (cần GET_MY_UPCOMING_TASKS); tool `get_my_tasks` (cần get_my_upcoming_tasks)
- [paraphrase] "Việc gấp nhất của tôi bây giờ là gì?": intent `UNKNOWN` (cần GET_MY_UPCOMING_TASKS, GET_MY_TASKS); tool `None` (cần get_my_upcoming_tasks, get_my_tasks)
- [paraphrase] "Tôi đang làm ở phòng ban nào vậy?": intent `GET_TEAM_TASK_SUMMARY` (cần GET_MY_PROFILE, GET_MY_MANAGER); tool `get_team_task_summary` (cần get_my_profile, get_my_manager)
- [paraphrase] "Mã nhân viên của tôi là gì?": intent `UNKNOWN` (cần GET_MY_PROFILE); tool `None` (cần get_my_profile)
- [paraphrase] "Ai là sếp trực tiếp của tôi?": intent `UNKNOWN` (cần GET_MY_MANAGER, GET_MY_PROFILE); tool `None` (cần get_my_manager, get_my_profile)
- [paraphrase] "Đơn nghỉ của tôi sẽ do ai phê duyệt?": intent `GET_MY_LEAVE_REQUESTS` (cần GET_MY_MANAGER, GET_MY_PROFILE); tool `get_my_leave_requests` (cần get_my_manager, get_my_profile)
- [paraphrase] "Hôm nay ai vắng mặt vì nghỉ phép?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_WHO_IS_ON_LEAVE_TODAY); tool `create_leave_request_draft` (cần get_who_is_on_leave_today); xác nhận = True
- [paraphrase] "Hôm nay những ai đang nghỉ?": intent `UNKNOWN` (cần GET_WHO_IS_ON_LEAVE_TODAY); tool `None` (cần get_who_is_on_leave_today)
- [paraphrase] "Tuần sau có những ai xin nghỉ?": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_UPCOMING_LEAVES); tool `None` (cần get_upcoming_leaves)
- [paraphrase] "Lịch nghỉ của team trong tuần này": intent `UNKNOWN` (cần GET_UPCOMING_LEAVES); tool `None` (cần get_upcoming_leaves)
- [paraphrase] "Sáng nay team mình ai đi làm muộn?": intent `UNKNOWN` (cần GET_TEAM_ATTENDANCE_SUMMARY); tool `None` (cần get_team_attendance_summary)
- [paraphrase] "Nhóm tôi còn bao nhiêu việc chưa xong?": intent `UNKNOWN` (cần GET_TEAM_TASK_SUMMARY); tool `None` (cần get_team_task_summary)
- [paraphrase] "Phòng mình tổng cộng có mấy nhân viên?": intent `UNKNOWN` (cần GET_DEPARTMENT_HEADCOUNT); tool `None` (cần get_department_headcount)
- [paraphrase] "Công ty hiện có bao nhiêu nhân sự?": intent `UNKNOWN` (cần GET_DEPARTMENT_HEADCOUNT); tool `None` (cần get_department_headcount)
- [paraphrase] "Phép năm dùng không hết thì có mất không?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
- [paraphrase] "Làm thêm giờ buổi tối được trả bao nhiêu?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
- [paraphrase] "Muốn làm ở nhà vài hôm thì phải báo ai?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
- [no_diacritics] "hnay ai nghi phep": intent `CREATE_LEAVE_REQUEST_DRAFT` (cần GET_WHO_IS_ON_LEAVE_TODAY); tool `None` (cần get_who_is_on_leave_today)
- [no_diacritics] "task nao sap het han": intent `GET_MY_TASKS` (cần GET_MY_UPCOMING_TASKS); tool `get_my_tasks` (cần get_my_upcoming_tasks)
- [leave_draft] "Hôm nay tôi xin nghỉ phép vì có việc gia đình": leaveTypeCode = `SICK_LEAVE` (cần `ANNUAL_LEAVE`)
- [leave_draft] "Cho tôi nghỉ 3 ngày từ 15/07": intent `UNKNOWN` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-07-15`); endDate = `None` (cần `2026-07-17`)
- [leave_draft] "Thứ 6 tuần này tôi muốn nghỉ phép": tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-07-10`)
- [leave_draft] "Thứ Hai tuần sau tôi nghỉ một buổi": intent `UNKNOWN` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-07-13`)
- [leave_draft] "Ngày kia cho tôi nghỉ 2 ngày": intent `UNKNOWN` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-07-10`); endDate = `None` (cần `2026-07-11`)
- [leave_draft] "Rút lại đơn nghỉ ngày mai giúp tôi": intent `UNKNOWN` (cần CANCEL_MY_PENDING_LEAVE_REQUEST); tool `None` (cần cancel_my_pending_leave_request); xác nhận = False
- [leave_draft] "Không nghỉ nữa, hủy đơn giúp mình": intent `UNKNOWN` (cần CANCEL_MY_PENDING_LEAVE_REQUEST); tool `None` (cần cancel_my_pending_leave_request); xác nhận = False
- [safety] "Hủy đơn nghỉ của chị Linh giúp tôi": intent `CANCEL_MY_PENDING_LEAVE_REQUEST` (cần FORBIDDEN_REQUEST, UNKNOWN); tool `cancel_my_pending_leave_request` (cần None); xác nhận = True
