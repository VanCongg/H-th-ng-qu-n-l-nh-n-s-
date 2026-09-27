# Đánh giá gợi ý người nhận task trên dữ liệu mô phỏng

- Khoảng thời gian: 2026-02-01 → 2026-09-26
- Số lần giao việc được dựng lại: 2621 (đã có kết quả: 2517)
- Số ứng viên trung bình mỗi lần: 5.7
- "Năng lực ẩn" (0–1) là tham số bộ mô phỏng gán cho từng người; API không đọc được giá trị này.

## 1. Xếp hạng có chọn đúng người giỏi không

| Cách chọn | Năng lực TB của người được chọn | Chọn trúng người giỏi nhất nhóm | Tương quan hạng–năng lực (Spearman) |
|---|---|---|---|
| Chọn ngẫu nhiên (mốc so sánh) | 0.527 | 19.3% | 0 |
| Trưởng nhóm giao thực tế (trong mô phỏng) | 0.561 | 20.1% | – |
| Đang chạy (kỹ năng 0.1 / tải việc 0.15 / lịch nghỉ 0.1 / lịch sử 0.65) | 0.685 | 38.3% | 0.611 |
| Trọng số kỹ năng theo độ khó ×1 / ×2 / ×4 | 0.683 | 37.3% | 0.544 |
| Như đang chạy nhưng trọng số kỹ năng cố định (không theo độ khó) | 0.685 | 38.3% | 0.611 |
| Như đang chạy nhưng bỏ cấp bậc phù hợp của task | 0.685 | 38.4% | 0.614 |
| Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ) | 0.605 | 24.3% | 0.217 |
| Chỉ kỹ năng | 0.565 | 18.5% | 0.102 |
| Trần lý thuyết (xếp theo năng lực ẩn - không mô hình nào thấy được) | 0.746 | 50.4% | 1.000 |

## 2. Kết quả thực tế theo hạng AI của người được giao

Người nhận do trưởng nhóm (mô phỏng) chọn, không phải do AI, nên mỗi mức hạng đều có dữ liệu. Nếu thuật toán tốt, task giao cho người AI xếp hạng cao phải xong đúng hạn nhiều hơn.

### Đang chạy (kỹ năng 0.1 / tải việc 0.15 / lịch nghỉ 0.1 / lịch sử 0.65)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 837 | 58.4% | 1.07 | 0.38 |
| Hạng 2–3 | 1053 | 42.4% | 1.20 | 0.48 |
| Hạng 4 trở xuống | 627 | 28.7% | 1.34 | 0.58 |

### Trọng số kỹ năng theo độ khó ×1 / ×2 / ×4

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 852 | 58.0% | 1.08 | 0.38 |
| Hạng 2–3 | 1055 | 41.9% | 1.20 | 0.48 |
| Hạng 4 trở xuống | 610 | 29.3% | 1.34 | 0.58 |

### Như đang chạy nhưng trọng số kỹ năng cố định (không theo độ khó)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 837 | 58.4% | 1.07 | 0.38 |
| Hạng 2–3 | 1053 | 42.4% | 1.20 | 0.48 |
| Hạng 4 trở xuống | 627 | 28.7% | 1.34 | 0.58 |

### Như đang chạy nhưng bỏ cấp bậc phù hợp của task

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 835 | 58.6% | 1.07 | 0.37 |
| Hạng 2–3 | 1051 | 42.0% | 1.20 | 0.48 |
| Hạng 4 trở xuống | 631 | 29.3% | 1.34 | 0.58 |

### Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 820 | 53.7% | 1.13 | 0.45 |
| Hạng 2–3 | 1108 | 42.6% | 1.18 | 0.43 |
| Hạng 4 trở xuống | 589 | 34.5% | 1.29 | 0.57 |

### Chỉ kỹ năng

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 877 | 47.7% | 1.15 | 0.46 |
| Hạng 2–3 | 1045 | 44.3% | 1.18 | 0.44 |
| Hạng 4 trở xuống | 595 | 39.3% | 1.27 | 0.54 |

### Trần lý thuyết (xếp theo năng lực ẩn - không mô hình nào thấy được)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 786 | 60.4% | 1.03 | 0.32 |
| Hạng 2–3 | 1092 | 43.6% | 1.19 | 0.50 |
| Hạng 4 trở xuống | 639 | 25.7% | 1.38 | 0.60 |

## Ghi chú

- Ứng viên có đủ 3 task đã xong để tính lịch sử: 100.0%.
- Bộ đang chạy cố ý cân nhắc khối lượng việc và lịch nghỉ, nên không nhắm chọn người giỏi nhất tuyệt đối; bảng 1 chỉ đo riêng khả năng nhận ra năng lực.
- Thứ hạng ở đây đã áp ràng buộc cứng (thiếu kỹ năng bắt buộc, nghỉ quá nửa kỳ task) nhưng chưa trừ điểm cân tải; báo cáo tune-weights đo cả phần đó.
- Dữ liệu là mô phỏng: kết quả kiểm chứng thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay cho đánh giá trên dữ liệu công ty thật.
- Trưởng nhóm mô phỏng cũng nhìn kỹ năng và tải việc, nên thước đo ở đây là năng lực ẩn và kết quả thực tế, không phải mức trùng với lựa chọn của trưởng nhóm; bộ mô phỏng còn có độ quen giữa trưởng nhóm và thành viên và việc giao để kèm người mới, những yếu tố API không thấy (xem README).
- Tải việc tính như API: giờ còn lại rải theo số tuần tới hạn; giờ đã log tại thời điểm giao không có trong dữ liệu nên dùng toàn bộ ước tính.
