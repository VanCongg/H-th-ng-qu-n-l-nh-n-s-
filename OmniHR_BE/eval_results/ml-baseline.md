# So sánh mô hình đa tiêu chí với baseline học máy

- Khoảng dữ liệu: 2026-02-02 → 2026-09-20
- Quyết định giao việc tái dựng được: 2769 (1938 huấn luyện, 831 kiểm chứng, chia theo thời gian)
- Trong tập huấn luyện có 1919 task đã kết thúc (nhãn cho mô hình pointwise)
- Cả ba mô hình đều bị ràng buộc cứng như nhau: ứng viên thiếu kỹ năng bắt buộc luôn xếp sau.

## 1. Kết quả trên tập kiểm chứng

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất | Trùng lựa chọn của lead |
|---|---|---|---|---|
| MCDM (đang chạy, trọng số 0.1/0.15/0.1/0.65) | 0.206 | 0.857 | 47.1% | 31.8% |
| ML pointwise — 4 đặc trưng (dự đoán đúng hạn) | 0.189 | 0.710 | 43.6% | 33.0% |
| ML pointwise — 10 đặc trưng (dự đoán đúng hạn) | 0.170 | 0.739 | 40.6% | 30.7% |
| ML pairwise — 4 đặc trưng (học lựa chọn của lead) | 0.094 | 0.299 | 29.2% | 34.4% |
| ML pairwise — 10 đặc trưng (học lựa chọn của lead) | 0.101 | 0.184 | 22.9% | 41.9% |

Baseline ML tốt nhất là **ML pointwise — 4 đặc trưng (dự đoán đúng hạn)**, kém mô hình đang chạy 0.016 điểm phân tách kết quả (dựa trên 313 task đúng hạn và 429 task trễ).

## 2. Cùng chỉ số nhưng trên tập huấn luyện

Chênh lệch giữa hai bảng cho thấy mô hình có học thuộc dữ liệu hay không.

| Mô hình | Phân tách kết quả | Tương quan năng lực | Trùng lựa chọn của lead |
|---|---|---|---|
| MCDM (đang chạy, trọng số 0.1/0.15/0.1/0.65) | 0.161 | 0.529 | 33.7% |
| ML pointwise — 4 đặc trưng (dự đoán đúng hạn) | 0.157 | 0.460 | 33.0% |
| ML pointwise — 10 đặc trưng (dự đoán đúng hạn) | 0.149 | 0.522 | 31.7% |
| ML pairwise — 4 đặc trưng (học lựa chọn của lead) | 0.104 | 0.251 | 34.0% |
| ML pairwise — 10 đặc trưng (học lựa chọn của lead) | 0.088 | 0.120 | 43.2% |

## 3. Trọng số mà mô hình học được

**pointwiseBase** (log loss huấn luyện 0.6240):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| history | 0.469 |
| workload | 0.455 |
| skill | 0.216 |
| availability | 0.127 |

**pointwiseWide** (log loss huấn luyện 0.6101):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| workload | 0.486 |
| history | 0.443 |
| careerLevel | 0.362 |
| doneCount | 0.270 |
| seniorityYears | -0.154 |
| availability | 0.129 |
| skill | 0.070 |
| projectFamiliarity | 0.058 |
| taskHours | 0.024 |
| historyMissing | 0.000 |

**pairwiseBase** (log loss huấn luyện 0.5803):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| skill | 1.011 |
| workload | 0.314 |
| availability | 0.056 |
| history | 0.013 |

**pairwiseWide** (log loss huấn luyện 0.5375):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| skill | 1.336 |
| careerLevel | -0.569 |
| workload | 0.417 |
| doneCount | 0.247 |
| availability | 0.086 |
| seniorityYears | -0.068 |
| projectFamiliarity | 0.056 |
| history | -0.014 |
| historyMissing | 0.000 |
| taskHours | 0.000 |

## Ghi chú

- **Phân tách kết quả**: hạng trung bình mà mô hình dành cho người thực sự được giao, ở nhóm task trễ trừ nhóm task đúng hạn (thang 0-1). Dương nghĩa là mô hình đã xếp thấp đúng những lần giao việc về sau hỏng. Đây là chỉ số dùng dữ liệu thật, không dùng biến nội bộ.
- **Sai lệch chọn mẫu**: mô hình pointwise chỉ học được từ người đã được chọn, vì chỉ họ mới có kết quả. Đây là hạn chế cố hữu của dữ liệu quan sát, không phải lỗi cài đặt.
- **Trùng lựa chọn của lead** đo mức bắt chước người giao việc, không phải mức đúng: một mô hình trùng 100% cũng chỉ giỏi bằng chính các lead.
- Toàn bộ dữ liệu là mô phỏng, và năng lực ẩn là biến do bộ mô phỏng sinh ra.
