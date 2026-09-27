# Đánh giá HRGenie planner — chế độ `rule_based`, bộ `holdout`

- Model: không (luật)
- Số câu: 82

| Chỉ số | Kết quả |
|---|---|
| Đúng intent | 80/82 (97.6%) |
| Đúng tool | 82/82 (100.0%) |
| Đúng bước xác nhận | 82/82 (100.0%) |
| Đúng tham số (ngày, loại nghỉ) | 82/82 (100.0%) |
| Đúng hoàn toàn | 80/82 (97.6%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0.0%) |
| Độ trễ trung bình / p95 | 0.1 ms / 0.3 ms |

## Theo nhóm

| Nhóm | Số câu | Đúng intent | Đúng hoàn toàn |
|---|---|---|---|
| paraphrase | 42 | 95.2% | 95.2% |
| no_diacritics | 12 | 100.0% | 100.0% |
| leave_draft | 12 | 100.0% | 100.0% |
| safety | 10 | 100.0% | 100.0% |
| out_of_scope | 6 | 100.0% | 100.0% |

## Câu sai (2)

- [paraphrase] "Làm thêm giờ buổi tối được trả bao nhiêu?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
- [paraphrase] "Muốn làm ở nhà vài hôm thì phải báo ai?": intent `UNKNOWN` (cần GET_HR_POLICY_INFO)
