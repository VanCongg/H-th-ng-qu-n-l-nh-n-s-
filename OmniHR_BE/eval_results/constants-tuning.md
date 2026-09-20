# Dò các hằng số còn lại

- Khoảng dữ liệu: 2026-02-02 → 2026-09-20
- Chia ba lát theo thời gian: dò đến 2026-06-05, chọn đến 2026-07-22, phần còn lại chỉ đọc một lần để báo cáo
- Số cấu hình đã thử: 119 (120 lượt ngẫu nhiên + một vòng dò từng chiều)
- Trọng số bốn tín hiệu giữ cố định ở mức đang chạy: 0.1 / 0.15 / 0.1 / 0.65
- Hàm mục tiêu: điểm tổng hợp (phân tách 1 · nghỉ phép 0.5 · lệch tải 0.3 · người mới 0.2)

## 1. Cấu hình đang dùng so với cấu hình dò được

| Cấu hình | Tập dò | Tập chọn | **Tập kiểm chứng cuối** |
|---|---|---|---|
| Đang dùng — đúng hạn 0.6 · trễ pha 45n · prior 4 · sức chứa 40h | -0.041 | 0.044 | **0.089** |
| Dò được — đúng hạn 0.5 · trễ pha 0n · prior 1 · sức chứa 48h | -0.044 | 0.074 | **0.081** |

Chênh lệch trên tập kiểm chứng cuối (626 quyết định): **-0.008** điểm tổng hợp.

**Giữ nguyên.** Lợi thế trên tập chọn không còn khi sang lát cuối — đó là dấu hiệu của khớp nhiễu, không phải cải thiện.

## 2. Mười cấu hình tốt nhất trên tập chọn

| Đúng hạn/hiệu suất | Trễ pha | Prior | Sức chứa | Tập dò | Tập chọn |
|---|---|---|---|---|---|
| 0.5 | 0 ngày | 1 | 48h | -0.044 | 0.074 |
| 0.5 | 0 ngày | 2 | 48h | -0.046 | 0.074 |
| 0.5 | 0 ngày | 3 | 32h | -0.043 | 0.071 |
| 0.6 | 0 ngày | 1 | 48h | -0.044 | 0.071 |
| 0.4 | 15 ngày | 1 | 40h | -0.043 | 0.070 |
| 0.7 | 0 ngày | 1 | 48h | -0.057 | 0.070 |
| 0.5 | 0 ngày | 1 | 32h | -0.049 | 0.068 |
| 0.5 | 0 ngày | 1 | 40h | -0.040 | 0.068 |
| 0.5 | 0 ngày | 8 | 40h | -0.047 | 0.068 |
| 0.4 | 0 ngày | 2 | 48h | -0.055 | 0.068 |

## 3. Từng chiều ảnh hưởng ra sao

Điểm trung bình trên tập chọn của mọi cấu hình có cùng giá trị ở chiều đó.

**Tỉ lệ đúng hạn trong điểm lịch sử**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 0.4 | 23 | 0.002 |
| 0.5 | 29 | 0.035 |
| 0.6 | 22 | 0.013 |
| 0.7 | 22 | 0.005 |
| 0.8 | 23 | 0.021 |

**Trễ pha cửa sổ lịch sử**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 0 | 26 | 0.059 |
| 15 | 22 | 0.049 |
| 30 | 19 | 0.043 |
| 45 | 23 | 0.038 |
| 60 | 16 | -0.089 |
| 90 | 13 | -0.071 |

**Độ mạnh của prior (k)**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 1 | 24 | 0.032 |
| 2 | 12 | 0.011 |
| 3 | 23 | 0.005 |
| 4 | 15 | 0.031 |
| 6 | 24 | 0.008 |
| 8 | 21 | 0.014 |

**Sức chứa mỗi tuần**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 32 | 36 | 0.028 |
| 40 | 41 | 0.004 |
| 48 | 42 | 0.019 |

## Ghi chú

- Trễ pha 0 ngày thường cho điểm cao nhất trên dữ liệu mô phỏng, và đó chính là lý do không nên chọn nó: nó mở lại đúng đường rò rỉ giữa nhãn kết quả và tín hiệu lịch sử mà `prisma/diagnostics.ts` đo được. Giá trị đang dùng là một lựa chọn có chủ ý, không phải điểm tối ưu của hàm mục tiêu.
- Sức chứa tuần chỉ đổi thang của điểm tải việc, nên ảnh hưởng của nó nhỏ theo thiết kế.
