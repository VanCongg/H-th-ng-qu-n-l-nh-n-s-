# Dò các hằng số còn lại

- Khoảng dữ liệu: 2026-02-01 → 2026-09-26
- Chia ba lát theo thời gian: dò đến 2026-06-16, chọn đến 2026-07-29, phần còn lại chỉ đọc một lần để báo cáo
- Số cấu hình đã thử: 238 (300 lượt ngẫu nhiên + một vòng dò từng chiều)
- Trọng số bốn tín hiệu giữ cố định ở mức đang chạy: 0.1 / 0.15 / 0.1 / 0.65
- Hàm mục tiêu: điểm tổng hợp (phân tách 1 · nghỉ phép 0.5 · lệch tải 0.3 · người mới 0.2)

## 1. Cấu hình đang dùng so với cấu hình dò được

| Cấu hình | Tập dò | Tập chọn | **Tập kiểm chứng cuối** |
|---|---|---|---|
| Đang dùng — đúng hạn 0.6 · trễ pha 45n · prior 4 · sức chứa 40h | 0.067 | 0.106 | **0.170** |
| Dò được — đúng hạn 0.4 · trễ pha 15n · prior 1 · sức chứa 40h | 0.083 | 0.158 | **0.155** |

Chênh lệch trên tập kiểm chứng cuối (654 quyết định): **-0.015** điểm tổng hợp.

**Giữ nguyên.** Lợi thế trên tập chọn không còn khi sang lát cuối — đó là dấu hiệu của khớp nhiễu, không phải cải thiện.

## 2. Mười cấu hình tốt nhất trên tập chọn

| Đúng hạn/hiệu suất | Trễ pha | Prior | Sức chứa | Tập dò | Tập chọn |
|---|---|---|---|---|---|
| 0.4 | 15 ngày | 1 | 40h | 0.083 | 0.158 |
| 0.4 | 15 ngày | 2 | 40h | 0.083 | 0.148 |
| 0.4 | 0 ngày | 1 | 40h | 0.085 | 0.146 |
| 0.4 | 0 ngày | 2 | 32h | 0.082 | 0.146 |
| 0.6 | 0 ngày | 1 | 48h | 0.075 | 0.145 |
| 0.5 | 15 ngày | 1 | 40h | 0.082 | 0.144 |
| 0.4 | 30 ngày | 1 | 40h | 0.080 | 0.144 |
| 0.4 | 15 ngày | 1 | 32h | 0.081 | 0.144 |
| 0.8 | 0 ngày | 4 | 48h | 0.090 | 0.142 |
| 0.5 | 0 ngày | 1 | 32h | 0.091 | 0.142 |

## 3. Từng chiều ảnh hưởng ra sao

Điểm trung bình trên tập chọn của mọi cấu hình có cùng giá trị ở chiều đó.

**Tỉ lệ đúng hạn trong điểm lịch sử**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 0.4 | 54 | 0.106 |
| 0.5 | 47 | 0.106 |
| 0.6 | 47 | 0.105 |
| 0.7 | 47 | 0.097 |
| 0.8 | 43 | 0.094 |

**Trễ pha cửa sổ lịch sử**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 0 | 37 | 0.128 |
| 15 | 53 | 0.127 |
| 30 | 32 | 0.116 |
| 45 | 41 | 0.108 |
| 60 | 36 | 0.104 |
| 90 | 39 | 0.023 |

**Độ mạnh của prior (k)**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 1 | 39 | 0.109 |
| 2 | 34 | 0.112 |
| 3 | 40 | 0.097 |
| 4 | 44 | 0.106 |
| 6 | 37 | 0.100 |
| 8 | 44 | 0.090 |

**Sức chứa mỗi tuần**

| Giá trị | Số cấu hình | Điểm trung bình |
|---|---|---|
| 32 | 80 | 0.107 |
| 40 | 81 | 0.100 |
| 48 | 77 | 0.098 |

## Ghi chú

- Trễ pha 0 ngày thường cho điểm cao nhất trên dữ liệu mô phỏng, và đó chính là lý do không nên chọn nó: nó mở lại đúng đường rò rỉ giữa nhãn kết quả và tín hiệu lịch sử mà `prisma/diagnostics.ts` đo được. Giá trị đang dùng là một lựa chọn có chủ ý, không phải điểm tối ưu của hàm mục tiêu.
- Sức chứa tuần chỉ đổi thang của điểm tải việc, nên ảnh hưởng của nó nhỏ theo thiết kế.
