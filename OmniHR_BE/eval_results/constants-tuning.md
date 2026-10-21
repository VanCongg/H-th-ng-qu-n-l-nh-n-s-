# Dò các hằng số còn lại

- Khoảng dữ liệu: 2026-02-01 → 2026-09-27
- Chia ba lát theo thời gian: dò đến 2026-06-12, chọn đến 2026-07-28, phần còn lại chỉ đọc một lần để báo cáo
- Số cấu hình đã thử: 241 (300 lượt ngẫu nhiên + một vòng dò từng chiều)
- Trọng số bốn tín hiệu giữ cố định ở mức đang chạy: 0.3 / 0.2 / 0.1 / 0.4
- Hàm mục tiêu: điểm tổng hợp (phân tách 1 · nghỉ phép 0.5 · lệch tải 0.3 · người mới 0.2)

## 1. Cấu hình đang dùng so với cấu hình dò được

| Cấu hình | Tập dò | Tập chọn | **Tập kiểm chứng cuối** |
|---|---|---|---|
| Đang dùng — đúng hạn 0.6 · trễ pha 45n · prior 4 · sức chứa 40h | 0.050 | 0.091 | **0.117** |
| Dò được — đúng hạn 0.8 · trễ pha 0n · prior 1 · sức chứa 32h | 0.089 | 0.123 | **0.123** |

Chênh lệch trên tập kiểm chứng cuối (835 quyết định): **+0.006** điểm tổng hợp.

**Giữ nguyên.** Lợi thế trên tập chọn không còn khi sang lát cuối — đó là dấu hiệu của khớp nhiễu, không phải cải thiện.

## 2. Mười cấu hình tốt nhất trên tập chọn

| Đúng hạn/hiệu suất | Trễ pha | Prior | Sức chứa | Tập dò | Tập chọn |
|---|---|---|---|---|---|
| 0.8 | 0 ngày | 1 | 32h | 0.089 | 0.123 |
| 0.8 | 0 ngày | 3 | 32h | 0.083 | 0.121 |
| 0.8 | 0 ngày | 2 | 32h | 0.090 | 0.121 |
| 0.7 | 60 ngày | 2 | 32h | 0.065 | 0.118 |
| 0.8 | 0 ngày | 4 | 32h | 0.081 | 0.117 |
| 0.5 | 60 ngày | 2 | 32h | 0.065 | 0.116 |
| 0.7 | 0 ngày | 3 | 32h | 0.083 | 0.116 |
| 0.5 | 60 ngày | 1 | 32h | 0.065 | 0.113 |
| 0.7 | 0 ngày | 4 | 32h | 0.084 | 0.113 |
| 0.7 | 60 ngày | 3 | 32h | 0.067 | 0.113 |

## 3. Từng chiều ảnh hưởng ra sao

Điểm trung bình trên tập chọn của mọi cấu hình có cùng giá trị ở chiều đó.

**Tỉ lệ đúng hạn trong điểm lịch sử**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 0.4 | 50 | 0.061 |
| 0.5 | 46 | 0.066 |
| 0.6 | 48 | 0.072 |
| 0.7 | 47 | 0.075 |
| 0.8 | 50 | 0.073 |

**Trễ pha cửa sổ lịch sử**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 0 | 44 | 0.084 |
| 15 | 48 | 0.079 |
| 30 | 32 | 0.078 |
| 45 | 41 | 0.085 |
| 60 | 37 | 0.089 |
| 90 | 39 | -0.003 |

**Độ mạnh của prior (k)**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 1 | 35 | 0.067 |
| 2 | 34 | 0.081 |
| 3 | 46 | 0.069 |
| 4 | 45 | 0.074 |
| 6 | 37 | 0.065 |
| 8 | 44 | 0.059 |

**Sức chứa mỗi tuần**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 32 | 88 | 0.091 |
| 40 | 76 | 0.051 |
| 48 | 77 | 0.061 |

## Ghi chú

- Trễ pha 0 ngày thường cho điểm cao nhất trên dữ liệu mô phỏng, và đó chính là lý do không nên chọn nó: nó mở lại đúng đường rò rỉ giữa nhãn kết quả và tín hiệu lịch sử mà `prisma/diagnostics.ts` đo được. Giá trị đang dùng là một lựa chọn có chủ ý, không phải điểm tối ưu của hàm mục tiêu.
- Sức chứa tuần đổi thang của điểm tải việc. Bảng trên cho biết giá trị nào khớp dữ liệu mô phỏng tốt hơn, nhưng đây là thông số chính sách (giờ làm chuẩn mỗi tuần của công ty), nên được đặt theo hợp đồng lao động chứ không chọn theo điểm.
