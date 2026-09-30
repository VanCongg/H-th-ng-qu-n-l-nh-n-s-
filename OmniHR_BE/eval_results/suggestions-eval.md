# Đánh giá gợi ý người nhận task trên dữ liệu mô phỏng

- Khoảng thời gian: 2026-05-01 → 2026-09-27
- Số lần giao việc được dựng lại: 2141 (đã có kết quả: 2016)
- Số ứng viên trung bình mỗi lần: 5.7
- "Năng lực ẩn" (0–1) là tham số bộ mô phỏng gán cho từng người; API không đọc được giá trị này.

## 1. Xếp hạng có chọn đúng người giỏi không

| Cách chọn | Năng lực TB của người được chọn | Chọn trúng người giỏi nhất nhóm | Tương quan hạng–năng lực (Spearman) |
|---|---|---|---|
| Chọn ngẫu nhiên (mốc so sánh) | 0.525 | 19.3% | 0 |
| Trưởng nhóm giao thực tế (trong mô phỏng) | 0.571 | 22.3% | – |
| Đang chạy (kỹ năng 0.3 / tải việc 0.2 / lịch nghỉ 0.1 / lịch sử 0.4) | 0.659 | 29.6% | 0.381 |
| Như đang chạy nhưng lịch sử tính đủ trên mọi task (không giảm cho task dễ) | 0.665 | 30.5% | 0.423 |
| Như đang chạy nhưng bỏ cấp bậc phù hợp của task | 0.663 | 31.8% | 0.404 |
| Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ) | 0.594 | 22.5% | 0.179 |
| Chỉ kỹ năng | 0.525 | 15.9% | 0.043 |
| Trần lý thuyết (xếp theo năng lực ẩn - không mô hình nào thấy được) | 0.739 | 50.3% | 1.000 |

## 2. Kết quả thực tế theo hạng AI của người được giao

Người nhận do trưởng nhóm (mô phỏng) chọn, không phải do AI, nên mỗi mức hạng đều có dữ liệu. Nếu thuật toán tốt, task giao cho người AI xếp hạng cao phải xong đúng hạn nhiều hơn.

### Đang chạy (kỹ năng 0.3 / tải việc 0.2 / lịch nghỉ 0.1 / lịch sử 0.4)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 679 | 89.4% | 0.94 | 0.26 |
| Hạng 2–3 | 823 | 78.0% | 1.02 | 0.32 |
| Hạng 4 trở xuống | 514 | 65.2% | 1.17 | 0.49 |

### Như đang chạy nhưng lịch sử tính đủ trên mọi task (không giảm cho task dễ)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 679 | 90.1% | 0.93 | 0.25 |
| Hạng 2–3 | 825 | 78.2% | 1.01 | 0.31 |
| Hạng 4 trở xuống | 512 | 63.9% | 1.19 | 0.52 |

### Như đang chạy nhưng bỏ cấp bậc phù hợp của task

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 681 | 90.2% | 0.93 | 0.24 |
| Hạng 2–3 | 822 | 77.5% | 1.03 | 0.33 |
| Hạng 4 trở xuống | 513 | 64.9% | 1.17 | 0.49 |

### Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 704 | 84.2% | 0.98 | 0.29 |
| Hạng 2–3 | 799 | 76.8% | 1.05 | 0.35 |
| Hạng 4 trở xuống | 513 | 73.5% | 1.07 | 0.41 |

### Chỉ kỹ năng

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 661 | 79.7% | 1.01 | 0.30 |
| Hạng 2–3 | 790 | 78.9% | 1.03 | 0.36 |
| Hạng 4 trở xuống | 565 | 76.8% | 1.05 | 0.37 |

### Trần lý thuyết (xếp theo năng lực ẩn - không mô hình nào thấy được)

| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |
|---|---|---|---|---|
| Hạng 1 | 615 | 91.7% | 0.90 | 0.25 |
| Hạng 2–3 | 832 | 78.5% | 1.02 | 0.30 |
| Hạng 4 trở xuống | 569 | 64.5% | 1.18 | 0.50 |

## Ghi chú

- Ứng viên có đủ 3 task đã xong để tính lịch sử: 100.0%.
- Bộ đang chạy cố ý cân nhắc khối lượng việc và lịch nghỉ, nên không nhắm chọn người giỏi nhất tuyệt đối; bảng 1 chỉ đo riêng khả năng nhận ra năng lực.
- Thứ hạng ở đây đã áp ràng buộc cứng (thiếu kỹ năng bắt buộc, nghỉ quá nửa kỳ task) nhưng chưa trừ điểm cân tải; báo cáo tune-weights đo cả phần đó.
- Dữ liệu là mô phỏng: kết quả kiểm chứng thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay cho đánh giá trên dữ liệu công ty thật.
- Trưởng nhóm mô phỏng cũng nhìn kỹ năng và tải việc, nên thước đo ở đây là năng lực ẩn và kết quả thực tế, không phải mức trùng với lựa chọn của trưởng nhóm; bộ mô phỏng còn có độ quen giữa trưởng nhóm và thành viên và việc giao để kèm người mới, những yếu tố API không thấy (xem README).
- Tải việc tính như API: giờ còn lại rải theo số tuần tới hạn; giờ đã log tại thời điểm giao không có trong dữ liệu nên dùng toàn bộ ước tính.
