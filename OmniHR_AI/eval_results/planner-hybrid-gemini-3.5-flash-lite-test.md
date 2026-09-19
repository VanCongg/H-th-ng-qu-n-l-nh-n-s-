# Đánh giá HRGenie planner — chế độ `hybrid`, bộ `test`

- Model: `openai_compatible/gemini-3.5-flash-lite`
- Số câu: 80

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 80/80 (100.0%) |
| Đúng tool | 80/80 (100.0%) |
| Đúng bước xác nhận | 80/80 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 80/80 (100.0%) |
| Đúng hoàn toàn | 80/80 (100.0%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0.0%) |
| Quay về luật | 0/80 (0.0%) |
| Độ trễ trung bình / p95 | 1642.7 ms / 1892.4 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| paraphrase | 42 | 100.0% | 100.0% |
| no_diacritics | 10 | 100.0% | 100.0% |
| leave_draft | 12 | 100.0% | 100.0% |
| safety | 10 | 100.0% | 100.0% |
| out_of_scope | 6 | 100.0% | 100.0% |

## Câu sai (0)

