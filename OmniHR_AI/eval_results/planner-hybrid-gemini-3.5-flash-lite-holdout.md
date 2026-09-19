# Đánh giá HRGenie planner — chế độ `hybrid`, bộ `holdout`

- Model: `openai_compatible/gemini-3.5-flash-lite`
- Số câu: 82

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 81/82 (98.8%) |
| Đúng tool | 81/82 (98.8%) |
| Đúng bước xác nhận | 82/82 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 82/82 (100.0%) |
| Đúng hoàn toàn | 81/82 (98.8%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0.0%) |
| Quay về luật | 0/82 (0.0%) |
| Độ trễ trung bình / p95 | 1640.5 ms / 1898.4 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| paraphrase | 42 | 97.6% | 97.6% |
| no_diacritics | 12 | 100.0% | 100.0% |
| leave_draft | 12 | 100.0% | 100.0% |
| safety | 10 | 100.0% | 100.0% |
| out_of_scope | 6 | 100.0% | 100.0% |

## Câu sai (1)

- [paraphrase] "Cho mình xem giờ vào ca hôm nay": intent `GET_ATTENDANCE_POLICY` (cần GET_TODAY_ATTENDANCE); tool `get_attendance_policy` (cần get_today_attendance)
