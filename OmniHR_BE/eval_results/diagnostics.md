# Chẩn đoán sức khoẻ của phép đo

- Khoảng dữ liệu: 2026-02-02 → 2026-09-20
- Số quyết định: 2769
- Bộ trọng số đang chạy: 0.1 / 0.15 / 0.1 / 0.65

Ba câu hỏi ở đây không phải "mô hình tốt đến đâu" mà là "con số đo được có đáng tin không".

## 1. Rò rỉ: tín hiệu lịch sử gần với năng lực ẩn đến mức nào

Trong bộ mô phỏng, kết quả task được sinh ra từ năng lực ẩn của nhân viên, còn tín hiệu lịch sử lại tính từ chính các kết quả đó. Tương quan càng gần 1 thì tín hiệu càng chỉ là năng lực ẩn gọi bằng tên khác — và điểm số của mô hình càng ít nói lên điều gì về dữ liệu thật.

| Phiên bản tín hiệu | Tương quan hạng với năng lực ẩn | Số dòng |
|---|---|---|
| Bản sạch (không trễ pha, không co rút) | 0.852 | 14973 |
| **Bản mô hình thực sự thấy** (trễ pha + co rút) | **0.585** | 15778 |

Chênh lệch 0.267 là phần rò rỉ mà trễ pha và co rút về prior đã cắt được.

## 2. Kiểm soát âm: xáo tín hiệu lịch sử

Tráo điểm lịch sử giữa các ứng viên trong cùng một quyết định, giữ nguyên mọi thứ khác. Nếu mô hình vẫn đạt điểm cao thì nó đang đo một thứ khác chứ không phải chất lượng ứng viên, và toàn bộ con số phía trên là vô nghĩa.

| Cấu hình | Phân tách kết quả |
|---|---|
| Mô hình đang chạy | **0.173** |
| Xáo tín hiệu lịch sử | 0.064 |
| Bỏ hẳn tín hiệu lịch sử (trọng số 0) | 0.114 |

**Đạt.** Xáo tín hiệu kéo điểm xuống tới mức của mô hình không dùng lịch sử và còn thấp hơn 0.050 — đúng như kỳ vọng, vì gán sai lịch sử cho người khác thì tệ hơn là không biết gì về lịch sử. Phần điểm tăng thêm thực sự đến từ việc gán đúng lịch sử cho đúng người.

## 3. Nhóm chưa đủ dữ liệu (cold-start)

Người có dưới 3 task đã hoàn thành (tính theo cửa sổ đã trễ pha).

| Chỉ số | Giá trị |
|---|---|
| Tỉ lệ dòng ứng viên thuộc nhóm cold-start | 31.7% (5002/15778) |
| Được xếp hạng 1 | 16.6% |
| Lọt top 3 | 50.5% |
| **Chưa bao giờ lọt top 3 trong cả kỳ** | **1.4%** |
| Phân tách kết quả trên riêng các quyết định giao cho người cold-start | 0.109 |

Chỉ số cuối cần đọc cùng cỡ mẫu: nhóm này ít quyết định nên dao động mạnh.

## Ghi chú

- Cả ba phép kiểm tra đều chạy trên bộ trọng số **đang chạy thật**, không phải bộ tối ưu lý thuyết.
- Bản lịch sử "sạch" chỉ tồn tại trong script này; không mô hình nào được thấy nó.
