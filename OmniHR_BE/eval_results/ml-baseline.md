# So sánh mô hình đa tiêu chí với baseline học máy

- Khoảng dữ liệu: 2026-05-01 → 2026-09-27
- Quyết định giao việc tái dựng được: 2141 (1498 huấn luyện, 643 kiểm chứng, chia theo thời gian)
- Trong tập huấn luyện có 1487 task đã kết thúc (nhãn cho mô hình pointwise)
- Cả ba mô hình đều bị ràng buộc cứng như nhau: ứng viên thiếu kỹ năng bắt buộc luôn xếp sau.

## 1. Kết quả trên tập kiểm chứng

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất | Trùng lựa chọn của lead |
|---|---|---|---|---|
| MCDM (đang chạy, trọng số 0.3/0.2/0.1/0.4) | 0.264 | 0.411 | 32.7% | 34.2% |
| ML pointwise — 4 đặc trưng (dự đoán đúng hạn) | 0.308 | 0.724 | 43.7% | 30.9% |
| ML pointwise — 10 đặc trưng (dự đoán đúng hạn) | 0.313 | 0.762 | 41.5% | 31.3% |
| ML pairwise — 4 đặc trưng (học lựa chọn của lead) | 0.182 | 0.289 | 27.2% | 35.6% |
| ML pairwise — 10 đặc trưng (học lựa chọn của lead) | 0.149 | 0.238 | 26.3% | 35.9% |

Baseline ML tốt nhất là **ML pointwise — 10 đặc trưng (dự đoán đúng hạn)**, hơn mô hình đang chạy 0.048 điểm phân tách kết quả (dựa trên 423 task đúng hạn và 106 task trễ).

## 2. Cùng chỉ số nhưng trên tập huấn luyện

Chênh lệch giữa hai bảng cho thấy mô hình có học thuộc dữ liệu hay không.

| Mô hình | Phân tách kết quả | Tương quan năng lực | Trùng lựa chọn của lead |
|---|---|---|---|
| MCDM (đang chạy, trọng số 0.3/0.2/0.1/0.4) | 0.239 | 0.368 | 33.4% |
| ML pointwise — 4 đặc trưng (dự đoán đúng hạn) | 0.258 | 0.692 | 31.3% |
| ML pointwise — 10 đặc trưng (dự đoán đúng hạn) | 0.263 | 0.723 | 30.9% |
| ML pairwise — 4 đặc trưng (học lựa chọn của lead) | 0.188 | 0.263 | 33.0% |
| ML pairwise — 10 đặc trưng (học lựa chọn của lead) | 0.167 | 0.235 | 32.8% |

## 3. Trọng số mà mô hình học được

**pointwiseBase** (log loss huấn luyện 0.3424):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| history | 1.240 |
| workload | 0.455 |
| availability | 0.043 |
| skill | 0.020 |

**pointwiseWide** (log loss huấn luyện 0.3346):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| history | 1.197 |
| workload | 0.434 |
| taskHours | -0.313 |
| seniorityYears | -0.263 |
| careerLevel | 0.235 |
| projectFamiliarity | 0.072 |
| doneCount | 0.066 |
| availability | 0.051 |
| skill | 0.006 |
| historyMissing | 0.000 |

**pairwiseBase** (log loss huấn luyện 0.6104):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| skill | 0.707 |
| workload | 0.441 |
| history | 0.085 |
| availability | -0.029 |

**pairwiseWide** (log loss huấn luyện 0.6054):

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| skill | 0.759 |
| workload | 0.449 |
| careerLevel | -0.169 |
| history | 0.151 |
| doneCount | -0.073 |
| projectFamiliarity | 0.055 |
| availability | -0.027 |
| seniorityYears | -0.024 |
| historyMissing | 0.000 |
| taskHours | 0.000 |

## Ghi chú

- **Phân tách kết quả**: hạng trung bình mà mô hình dành cho người thực sự được giao, ở nhóm task trễ trừ nhóm task đúng hạn (thang 0-1). Dương nghĩa là mô hình đã xếp thấp đúng những lần giao việc về sau hỏng. Đây là chỉ số dùng dữ liệu thật, không dùng biến nội bộ.
- **Sai lệch chọn mẫu**: mô hình pointwise chỉ học được từ người đã được chọn, vì chỉ họ mới có kết quả. Đây là hạn chế cố hữu của dữ liệu quan sát, không phải lỗi cài đặt.
- **Trùng lựa chọn của lead** đo mức bắt chước người giao việc, không phải mức đúng: một mô hình trùng 100% cũng chỉ giỏi bằng chính các lead.
- Toàn bộ dữ liệu là mô phỏng, và năng lực ẩn là biến do bộ mô phỏng sinh ra.
