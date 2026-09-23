# Đánh giá gợi ý người nhận task trên dữ liệu mô phỏng

- Khoảng thời gian: 2026-02-02 → 2026-09-20
- Số lần giao việc được dựng lại: 2769 (đã có kết quả: 2661)
- Số ứng viên trung bình mỗi lần: 5.7
- "Năng lực ẩn" (0–1) là tham số bộ mô phỏng gán cho từng người; API không đọc được giá trị này.

## 1. Xếp hạng có chọn đúng người giỏi không

| Cách chọn | Năng lực TB của người được chọn | Chọn trúng người giỏi nhất nhóm | Tương quan hạng–năng lực (Spearman) |
|---|---|---|---|
| Chọn ngẫu nhiên (mốc so sánh) | 0.523 | 19.3% | 0 |
| Trưởng nhóm giao thực tế (trong mô phỏng) | 0.561 | 19.9% | – |
| Đang chạy (kỹ năng 0.1 / tải việc 0.15 / lịch nghỉ 0.1 / lịch sử 0.65) | 0.690 | 37.8% | 0.628 |
| Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ) | 0.618 | 27.7% | 0.290 |
| Chỉ kỹ năng | 0.606 | 25.0% | 0.179 |

## 2. Kết quả thực tế theo hạng AI của người được giao

Người nhận do trưởng nhóm (mô phỏng) chọn, không phải do AI, nên mỗi mức hạng đều có dữ liệu. Nếu thuật toán tốt, task giao cho người AI xếp hạng cao phải xong đúng hạn nhiều hơn.

### Đang chạy (kỹ năng 0.1 / tải việc 0.15 / lịch nghỉ 0.1 / lịch sử 0.65)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 885 | 58.9% | 1.06 | 0.35 |
| Hạng 2–3 | 1179 | 39.0% | 1.22 | 0.54 |
| Hạng 4 trở xuống | 597 | 28.3% | 1.31 | 0.49 |

### Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 883 | 54.6% | 1.11 | 0.39 |
| Hạng 2–3 | 1198 | 39.8% | 1.20 | 0.52 |
| Hạng 4 trở xuống | 580 | 32.9% | 1.27 | 0.47 |

### Chỉ kỹ năng

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 868 | 52.5% | 1.12 | 0.41 |
| Hạng 2–3 | 1156 | 38.4% | 1.22 | 0.52 |
| Hạng 4 trở xuống | 637 | 39.2% | 1.23 | 0.44 |

## Ghi chú

- Ứng viên có đủ 3 task đã xong để tính lịch sử: 100.0%.
- Bộ đang chạy cố ý cân nhắc khối lượng việc và lịch nghỉ, nên không nhắm chọn người giỏi nhất tuyệt đối; bảng 1 chỉ đo riêng khả năng nhận ra năng lực.
- Thứ hạng ở đây đã áp ràng buộc cứng (thiếu kỹ năng bắt buộc, nghỉ quá nửa kỳ task) nhưng chưa trừ điểm cân tải; báo cáo tune-weights đo cả phần đó.
- Dữ liệu là mô phỏng: kết quả kiểm chứng thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay cho đánh giá trên dữ liệu công ty thật.
