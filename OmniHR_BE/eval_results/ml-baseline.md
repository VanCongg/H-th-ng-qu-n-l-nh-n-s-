# So sánh mô hình đa tiêu chí với baseline học máy

- Khoảng dữ liệu: 2026-02-01 → 2026-09-26
- Quyết định giao việc tái dựng được: 2621 (1834 huấn luyện, 787 kiểm chứng, chia theo thời gian)
- Trong tập huấn luyện có 1816 task đã kết thúc (nhãn cho mô hình pointwise)
- Cả ba mô hình đều bị ràng buộc cứng như nhau: ứng viên thiếu kỹ năng bắt buộc luôn xếp sau.

## 1. Kết quả trên tập kiểm chứng

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất | Trùng lựa chọn của lead |
|---|---|---|---|---|
| MCDM (đang chạy, trọng số 0.1/0.15/0.1/0.65) | 0.207 | 0.819 | 45.7% | 32.8% |
| ML pointwise — 4 đặc trưng (dự đoán đúng hạn) | 0.187 | 0.593 | 40.3% | 31.8% |
| ML pointwise — 10 đặc trưng (dự đoán đúng hạn) | 0.179 | 0.626 | 39.3% | 31.9% |
| ML pairwise — 4 đặc trưng (học lựa chọn của lead) | 0.073 | 0.093 | 18.8% | 33.3% |
| ML pairwise — 10 đặc trưng (học lựa chọn của lead) | 0.065 | 0.033 | 18.6% | 40.0% |

Baseline ML tốt nhất là **ML pointwise — 4 đặc trưng (dự đoán đúng hạn)**, kém mô hình đang chạy 0.020 điểm phân tách kết quả (dựa trên 316 task đúng hạn và 385 task trễ).

## 2. Cùng chỉ số nhưng trên tập huấn luyện

Chênh lệch giữa hai bảng cho thấy mô hình có học thuộc dữ liệu hay không.

| Mô hình | Phân tách kết quả | Tương quan năng lực | Trùng lựa chọn của lead |
|---|---|---|---|
| MCDM (đang chạy, trọng số 0.1/0.15/0.1/0.65) | 0.159 | 0.521 | 32.8% |
| ML pointwise — 4 đặc trưng (dự đoán đúng hạn) | 0.148 | 0.421 | 32.0% |
| ML pointwise — 10 đặc trưng (dự đoán đúng hạn) | 0.154 | 0.484 | 30.7% |
| ML pairwise — 4 đặc trưng (học lựa chọn của lead) | 0.048 | 0.111 | 33.7% |
| ML pairwise — 10 đặc trưng (học lựa chọn của lead) | 0.028 | 0.073 | 40.0% |

## 3. Trọng số mà mô hình học được

**pointwiseBase** (log loss huấn luyện 0.6195):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| workload | 0.573 |
| history | 0.473 |
| skill | 0.139 |
| availability | 0.127 |

**pointwiseWide** (log loss huấn luyện 0.6105):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| workload | 0.608 |
| history | 0.451 |
| careerLevel | 0.178 |
| projectFamiliarity | 0.173 |
| availability | 0.110 |
| doneCount | 0.106 |
| skill | 0.040 |
| taskHours | 0.023 |
| seniorityYears | -0.012 |
| historyMissing | 0.000 |

**pairwiseBase** (log loss huấn luyện 0.5982):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| skill | 0.921 |
| workload | 0.174 |
| history | -0.060 |
| availability | 0.028 |

**pairwiseWide** (log loss huấn luyện 0.5601):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| skill | 1.126 |
| careerLevel | -0.402 |
| doneCount | 0.308 |
| workload | 0.257 |
| seniorityYears | -0.169 |
| history | -0.110 |
| projectFamiliarity | 0.060 |
| availability | 0.021 |
| historyMissing | 0.000 |
| taskHours | 0.000 |

## Ghi chú

- **Phân tách kết quả**: hạng trung bình mà mô hình dành cho người thực sự được giao, ở nhóm task trễ trừ nhóm task đúng hạn (thang 0-1). Dương nghĩa là mô hình đã xếp thấp đúng những lần giao việc về sau hỏng. Đây là chỉ số dùng dữ liệu thật, không dùng biến nội bộ.
- **Sai lệch chọn mẫu**: mô hình pointwise chỉ học được từ người đã được chọn, vì chỉ họ mới có kết quả. Đây là hạn chế cố hữu của dữ liệu quan sát, không phải lỗi cài đặt.
- **Trùng lựa chọn của lead** đo mức bắt chước người giao việc, không phải mức đúng: một mô hình trùng 100% cũng chỉ giỏi bằng chính các lead.
- Toàn bộ dữ liệu là mô phỏng, và năng lực ẩn là biến do bộ mô phỏng sinh ra.
