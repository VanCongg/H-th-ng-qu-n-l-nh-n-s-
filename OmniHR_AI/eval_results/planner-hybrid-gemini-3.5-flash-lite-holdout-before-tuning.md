# Đánh giá HRGenie planner — chế độ `hybrid`, bộ `holdout`

- Model: `openai_compatible/gemini-3.5-flash-lite`
- Số câu: 82

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 76/82 (92.7%) |
| Đúng tool | 75/82 (91.5%) |
| Đúng bước xác nhận | 80/82 (97.6%) |
| Đúng tham số (ngày, loại nghỉ) | 80/82 (97.6%) |
| Đúng hoàn toàn | 74/82 (90.2%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0.0%) |
| Quay về luật | 8/82 (9.8%) |
| Độ trễ trung bình / p95 | 1626.4 ms / 1797.7 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| paraphrase | 42 | 90.5% | 90.5% |
| no_diacritics | 12 | 100.0% | 91.7% |
| leave_draft | 12 | 83.3% | 75.0% |
| safety | 10 | 100.0% | 100.0% |
| out_of_scope | 6 | 100.0% | 100.0% |

## Câu sai (8)

- [paraphrase] "Ca sáng bắt đầu lúc mấy giờ?": intent `GET_HR_POLICY_INFO` (cần GET_ATTENDANCE_POLICY); tool `None` (cần get_attendance_policy)
- [paraphrase] "Phòng mình tổng cộng có mấy nhân viên?": intent `UNKNOWN` (cần GET_DEPARTMENT_HEADCOUNT); tool `None` (cần get_department_headcount)
- [paraphrase] "Làm thêm giờ buổi tối được trả bao nhiêu?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
- [paraphrase] "Muốn làm ở nhà vài hôm thì phải báo ai?": intent `GET_MY_MANAGER` (cần GET_HR_POLICY_INFO); tool `get_my_manager` (cần None)
- [no_diacritics] "huy don nghi dang cho duyet cua toi": tool `None` (cần cancel_my_pending_leave_request)
- [leave_draft] "Cho tôi nghỉ 3 ngày từ 15/07": intent `UNKNOWN` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-07-15`); endDate = `None` (cần `2026-07-17`)
- [leave_draft] "Ngày kia cho tôi nghỉ 2 ngày": intent `UNKNOWN` (cần CREATE_LEAVE_REQUEST_DRAFT); tool `None` (cần create_leave_request_draft); xác nhận = False; startDate = `None` (cần `2026-07-10`); endDate = `None` (cần `2026-07-11`)
- [leave_draft] "Không nghỉ nữa, hủy đơn giúp mình": tool `None` (cần cancel_my_pending_leave_request)
