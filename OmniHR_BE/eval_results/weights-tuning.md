# Tối ưu trọng số xếp hạng gợi ý người nhận việc

- Khoảng dữ liệu: 2026-02-02 → 2026-09-27
- Số quyết định giao việc tái dựng được: 3343 (2340 để dò trọng số, 1003 giữ lại để kiểm chứng)
- Không gian tìm kiếm: lưới bước 0.05 trên đơn hình 4 chiều (1540 bộ trọng số), mỗi tín hiệu giữ sàn tối thiểu 0.1; luật sản phẩm: lịch sử tối đa 0.4, kỹ năng tối thiểu 0.2; trên từng task, lịch sử chỉ tính 25% / 60% / 100% trọng số với task dễ / trung bình / khó
- Hàm mục tiêu dùng để chọn: **điểm tổng hợp đa mục tiêu** — phân tách kết quả, trừ vi phạm nghỉ phép, lệch tải so với lead thật và tỉ lệ bỏ rơi người mới
- Trọng số nghiệp vụ (đặt tay, không tune): phân tách 1 · vi phạm nghỉ phép 0.5 · lệch tải 0.3 · bỏ rơi người mới 0.2

## 1. Trọng số hiện tại so với trọng số học được

*Điểm tổng hợp* là hàm mục tiêu thật sự dùng để chọn; bốn cột sau là các thành phần của nó. Phân tách càng cao càng tốt, ba cột còn lại càng thấp càng tốt. Mọi con số đều đo trên thứ hạng SAU khi đã áp cân tải, tức là đúng thứ người dùng nhìn thấy.

| Bộ trọng số (kỹ năng / tải việc / lịch nghỉ / lịch sử) | Tập | Điểm tổng hợp | Phân tách | Vi phạm nghỉ | Lệch tải | Bỏ rơi người mới |
|---|---|---|---|---|---|---|
| 0.3 / 0.2 / 0.1 / 0.4 | dò | **0.048** | 0.150 | 0.5% | 0.335 | 0.0% |
| 0.3 / 0.2 / 0.1 / 0.4 | kiểm chứng | **0.112** | 0.214 | 0.5% | 0.331 | 0.0% |
| 0.2 / 0.35 / 0.1 / 0.35 | dò | **0.061** | 0.163 | 0.5% | 0.333 | 0.0% |
| 0.2 / 0.35 / 0.1 / 0.35 | kiểm chứng | **0.106** | 0.210 | 0.4% | 0.338 | 0.0% |

Chênh lệch trên tập kiểm chứng: **-0.006** điểm tổng hợp (dựa trên 697 task đúng hạn và 189 task trễ).

## 2. Năm bộ trọng số tốt nhất trên tập dò

| Kỹ năng | Tải việc | Lịch nghỉ | Lịch sử | Điểm tổng hợp | Phân tách | Vi phạm nghỉ |
|---|---|---|---|---|---|---|
| 0.2 | 0.35 | 0.1 | 0.35 | 0.061 | 0.163 | 0.5% |
| 0.2 | 0.3 | 0.1 | 0.4 | 0.059 | 0.162 | 0.5% |
| 0.2 | 0.45 | 0.1 | 0.25 | 0.059 | 0.155 | 0.5% |
| 0.2 | 0.5 | 0.1 | 0.2 | 0.059 | 0.152 | 0.5% |
| 0.25 | 0.35 | 0.1 | 0.3 | 0.058 | 0.153 | 0.5% |

Mặt mục tiêu phẳng quanh đỉnh nghĩa là kết quả không phụ thuộc một điểm may mắn.

## 3. Bỏ từng tín hiệu (ablation)

Mỗi dòng là bộ trọng số đang dùng với đúng một tín hiệu bị đặt về 0; phần còn lại được chuẩn hoá lại. Cột *Δ* cho biết bỏ tín hiệu đó thì mất bao nhiêu điểm phân tách kết quả trên tập kiểm chứng — càng âm thì tín hiệu càng quan trọng.

| Cấu hình | Điểm tổng hợp | Phân tách | Δ phân tách | Vi phạm nghỉ |
|---|---|---|---|---|
| Đủ bốn tín hiệu (0.3 / 0.2 / 0.1 / 0.4) | 0.112 | 0.214 | — | 0.5% |
| Bỏ kỹ năng | 0.159 | 0.246 | +0.032 | 0.4% |
| Bỏ tải việc | 0.131 | 0.226 | +0.012 | 0.5% |
| Bỏ lịch nghỉ | 0.123 | 0.228 | +0.014 | 0.5% |
| Bỏ lịch sử làm việc | 0.034 | 0.127 | -0.087 | 0.4% |

Và nếu chỉ dùng duy nhất một tín hiệu:

| Cấu hình | Phân tách kết quả | Tương quan | Chọn đúng người giỏi nhất |
|---|---|---|---|
| Chỉ kỹ năng | 0.089 | 0.059 | 15.3% |
| Chỉ tải việc | 0.159 | 0.191 | 23.1% |
| Chỉ lịch nghỉ | 0.084 | -0.082 | 18.4% |
| Chỉ lịch sử làm việc | 0.295 | 0.633 | 31.1% |

**Cách đọc bảng này.** Phân tách kết quả chỉ biết task có xong đúng hạn hay không, nên nó đo được giá trị của tín hiệu lịch sử rất rõ và gần như không đo được ba tín hiệu còn lại. Điều đó *không* có nghĩa là nên bỏ chúng:

- **Kỹ năng** đã phát huy tác dụng ở ràng buộc cứng trước khi chấm điểm: ứng viên thiếu kỹ năng bắt buộc bị xếp sau bất kể trọng số. Phần đóng góp còn lại của nó là phân biệt giữa những người *đã* đủ điều kiện, nên nhỏ là đúng chứ không phải vô dụng.
- **Lịch nghỉ** chặn một lỗi mà thước đo không nhìn thấy: gợi ý một người nghỉ phép nguyên kỳ task vẫn có thể cho ra task đúng hạn trong dữ liệu (người khác gánh), nhưng là gợi ý sai trước mặt quản lý.
- **Tải việc** phục vụ mục tiêu dàn đều công việc, vốn không nằm trong hàm mục tiêu này.

Nghỉ phép được bảo vệ ở ba chỗ: sàn tối thiểu 0.1 cho mỗi tín hiệu khi dò (đổi bằng --floor), một số hạng riêng trong hàm mục tiêu (tỉ lệ vi phạm nghỉ phép) và một tầng ràng buộc cứng xếp sau người nghỉ quá nửa kỳ task.

Lưu ý khi đọc cột Δ của kỹ năng: trong bộ mô phỏng, thời gian và chất lượng hoàn thành task chỉ phụ thuộc năng lực ẩn và độ khó task, không phụ thuộc độ khớp kỹ năng (`hoursNeeded` trong prisma/simulate-day.ts). Thước đo này vì vậy không thể thấy giá trị của tín hiệu kỹ năng; bỏ kỹ năng mà điểm tăng là giới hạn của dữ liệu, không phải bằng chứng kỹ năng vô ích.

## 4. Phản hồi từ quản lý

| Bộ trọng số | Tỉ lệ xếp đúng người quản lý đã chọn lên #1 |
|---|---|
| 0.3 / 0.2 / 0.1 / 0.4 (hiện tại) | 41.7% |
| 0.2 / 0.35 / 0.1 / 0.35 (học được) | 41.3% |

Dựa trên 2158 lượt chọn thật.

Không áp luật sản phẩm thì điểm tối ưu rơi vào **0.05 / 0.35 / 0.1 / 0.5** (0.197 trên tập dò). Luật giới hạn lịch sử và giữ phần cho kỹ năng được áp có chủ đích: để lịch sử quyết định gần hết thì người có thành tích tốt nhất nhận mọi việc, người mới không bao giờ có cơ hội xây thành tích.

## 5. Kết luận

**Giữ nguyên bộ trọng số hiện tại** — bộ trọng số tìm được chỉ hơn bộ hiện tại -0.006 điểm tổng hợp trên tập kiểm chứng (ngưỡng 0.05), chưa đủ để kết luận là tốt hơn thật.

## Ghi chú

- Năng lực ẩn là biến do simulator sinh ra, không phải dữ liệu công ty thật; nó là thước đo để so sánh các bộ trọng số với nhau, không phải bằng chứng về hiệu quả thực tế.
- Trọng số không cần cộng lại bằng 1: hàm chấm điểm tự chuẩn hoá theo các tín hiệu mà ứng viên thực sự có, nên ứng viên thiếu dữ liệu không bị phạt oan.
- Ràng buộc cứng (thiếu kỹ năng bắt buộc) không nằm trong phần tối ưu này: ứng viên không đủ điều kiện luôn bị xếp sau, bất kể trọng số.
