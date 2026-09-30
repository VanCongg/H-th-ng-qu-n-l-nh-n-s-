# Đánh giá HRGenie planner — chế độ `hybrid`, bộ `test2`

- Model: `openai_compatible/gemini-3.5-flash-lite`
- Số câu: 54

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 52/54 (96.3%) |
| Đúng tool | 54/54 (100.0%) |
| Đúng bước xác nhận | 54/54 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 54/54 (100.0%) |
| Đúng hoàn toàn | 52/54 (96.3%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/6 (0.0%) |
| Quay về luật | 1/54 (1.9%) |
| Độ trễ trung bình / p95 | 6222.5 ms / 16941.8 ms |

## Lý do quay về luật

- LLM request failed: ReadTimeout: 1

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| attendance_summary | 7 | 100.0% | 100.0% |
| out_of_scope | 12 | 83.3% | 83.3% |
| projects | 4 | 100.0% | 100.0% |
| skills | 4 | 100.0% | 100.0% |
| team_members | 5 | 100.0% | 100.0% |
| task_stats | 5 | 100.0% | 100.0% |
| task_status | 3 | 100.0% | 100.0% |
| safety_new | 6 | 100.0% | 100.0% |
| regression | 8 | 100.0% | 100.0% |

## Câu sai (2)

- [out_of_scope] "Kỳ lương gần nhất tôi bị trừ bao nhiêu vì đi muộn?": intent `GET_HR_POLICY_INFO` (cần OUT_OF_SCOPE)
- [out_of_scope] "Tôi được trả bao nhiêu tiền làm thêm giờ tháng 10?": intent `GET_HR_POLICY_INFO` (cần OUT_OF_SCOPE)
