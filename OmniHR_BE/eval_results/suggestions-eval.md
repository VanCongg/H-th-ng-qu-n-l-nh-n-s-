# Đánh giá gợi ý người nhận task trên dữ liệu mô phỏng

- Khoảng thời gian: 2026-09-17 → 2026-12-31
- Số lần giao việc được dựng lại: 1311 (đã có kết quả: 1213)
- Số ứng viên trung bình mỗi lần: 5.8
- "Năng lực ẩn" (0–1) là tham số bộ mô phỏng gán cho từng người; API không đọc được giá trị này.

## 1. Xếp hạng có chọn đúng người giỏi không

| Cách chọn | Năng lực TB của người được chọn | Chọn trúng người giỏi nhất nhóm | Tương quan hạng–năng lực (Spearman) |
|---|---|---|---|
| Chọn ngẫu nhiên (mốc so sánh) | 0.588 | 19.1% | 0 |
| Trưởng nhóm giao thực tế (trong mô phỏng) | 0.610 | 20.0% | – |
| v4 hiện tại (kỹ năng + khối lượng + lịch nghỉ + điểm đánh giá) | 0.720 | 33.6% | 0.364 |
| v4 bỏ điểm đánh giá | 0.694 | 26.6% | 0.255 |
| Chỉ kỹ năng | 0.693 | 24.9% | 0.224 |
| v5 thử nghiệm (thay điểm đánh giá bằng lịch sử task) | 0.709 | 28.8% | 0.353 |

## 2. Kết quả thực tế theo hạng AI của người được giao

Người nhận do trưởng nhóm (mô phỏng) chọn, không phải do AI, nên mỗi mức hạng đều có dữ liệu. Nếu thuật toán tốt, task giao cho người AI xếp hạng cao phải xong đúng hạn nhiều hơn.

### v4 hiện tại (kỹ năng + khối lượng + lịch nghỉ + điểm đánh giá)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 430 | 69.8% | 0.98 | 0.23 |
| Hạng 2–3 | 505 | 55.0% | 1.09 | 0.30 |
| Hạng 4 trở xuống | 278 | 44.2% | 1.18 | 0.31 |

### v4 bỏ điểm đánh giá

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 415 | 70.1% | 0.99 | 0.25 |
| Hạng 2–3 | 528 | 53.4% | 1.10 | 0.29 |
| Hạng 4 trở xuống | 270 | 47.4% | 1.15 | 0.29 |

### Chỉ kỹ năng

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 400 | 69.3% | 0.99 | 0.24 |
| Hạng 2–3 | 538 | 54.6% | 1.10 | 0.30 |
| Hạng 4 trở xuống | 275 | 47.3% | 1.15 | 0.29 |

### v5 thử nghiệm (thay điểm đánh giá bằng lịch sử task)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 409 | 71.1% | 0.99 | 0.23 |
| Hạng 2–3 | 536 | 53.9% | 1.09 | 0.30 |
| Hạng 4 trở xuống | 268 | 45.1% | 1.17 | 0.29 |

## Ghi chú

- Ứng viên có điểm đánh giá đã chốt tại thời điểm giao: 99.7%; có đủ 3 task đã xong để tính lịch sử: 76.3%.
- v4 cố ý cân nhắc khối lượng việc và lịch nghỉ, nên không nhắm chọn người giỏi nhất tuyệt đối; bảng 1 chỉ đo riêng khả năng nhận ra năng lực.
- Năng lực ẩn được tạo một phần (35%) từ điểm đánh giá kỳ gốc (6 tháng đầu năm), và chính điểm đó cũng nằm trong tín hiệu hiệu suất của v4; phần v4 hơn "v4 bỏ điểm đánh giá" vì vậy có thể bị thổi phồng một phần. Kết quả thực tế (bảng 2) không chịu ảnh hưởng này.
- Dữ liệu là mô phỏng: kết quả kiểm chứng thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay cho đánh giá trên dữ liệu công ty thật.
