# Tối ưu trọng số xếp hạng gợi ý người nhận việc

- Khoảng dữ liệu: 2026-02-02 → 2026-09-20
- Số quyết định giao việc tái dựng được: 2769 (1938 để dò trọng số, 831 giữ lại để kiểm chứng)
- Không gian tìm kiếm: lưới bước 0.05 trên đơn hình 4 chiều (1540 bộ trọng số), không áp sàn cho tín hiệu nào
- Hàm mục tiêu dùng để chọn: **điểm tổng hợp đa mục tiêu** — phân tách kết quả, trừ vi phạm nghỉ phép, lệch tải so với lead thật và tỉ lệ bỏ rơi người mới
- Trọng số nghiệp vụ (đặt tay, không tune): phân tách 1 · vi phạm nghỉ phép 0.5 · lệch tải 0.3 · bỏ rơi người mới 0.2

## 1. Trọng số hiện tại so với trọng số học được

*Điểm tổng hợp* là hàm mục tiêu thật sự dùng để chọn; bốn cột sau là các thành phần của nó. Phân tách càng cao càng tốt, ba cột còn lại càng thấp càng tốt. Mọi con số đều đo trên thứ hạng SAU khi đã áp cân tải, tức là đúng thứ người dùng nhìn thấy.

| Bộ trọng số (kỹ năng / tải việc / lịch nghỉ / lịch sử) | Tập | Điểm tổng hợp | Phân tách | Vi phạm nghỉ | Lệch tải | Bỏ rơi người mới |
|---|---|---|---|---|---|---|
| 0.1 / 0.15 / 0.1 / 0.65 | dò | **0.044** | 0.138 | 0.5% | 0.305 | 0.0% |
| 0.1 / 0.15 / 0.1 / 0.65 | kiểm chứng | **0.126** | 0.197 | 0.4% | 0.228 | 0.0% |
| 0.6 / 0 / 0.2 / 0.2 | dò | **0.070** | 0.093 | 0.3% | 0.062 | 1.4% |
| 0.6 / 0 / 0.2 / 0.2 | kiểm chứng | **0.033** | 0.078 | 0.3% | 0.146 | 0.0% |

Chênh lệch trên tập kiểm chứng: **-0.094** điểm tổng hợp (dựa trên 313 task đúng hạn và 429 task trễ).

## 2. Năm bộ trọng số tốt nhất trên tập dò

| Kỹ năng | Tải việc | Lịch nghỉ | Lịch sử | Điểm tổng hợp | Phân tách | Vi phạm nghỉ |
|---|---|---|---|---|---|---|
| 0.6 | 0 | 0.2 | 0.2 | 0.070 | 0.093 | 0.3% |
| 0.7 | 0.15 | 0.05 | 0.1 | 0.070 | 0.098 | 0.4% |
| 0.6 | 0.1 | 0.25 | 0.05 | 0.069 | 0.090 | 0.3% |
| 0.65 | 0.1 | 0.15 | 0.1 | 0.068 | 0.097 | 0.3% |
| 0.6 | 0.05 | 0.3 | 0.05 | 0.067 | 0.083 | 0.2% |

Mặt mục tiêu phẳng quanh đỉnh nghĩa là kết quả không phụ thuộc một điểm may mắn.

## 3. Bỏ từng tín hiệu (ablation)

Mỗi dòng là bộ trọng số đang dùng với đúng một tín hiệu bị đặt về 0; phần còn lại được chuẩn hoá lại. Cột *Δ* cho biết bỏ tín hiệu đó thì mất bao nhiêu điểm phân tách kết quả trên tập kiểm chứng — càng âm thì tín hiệu càng quan trọng.

| Cấu hình | Điểm tổng hợp | Phân tách | Δ phân tách | Vi phạm nghỉ |
|---|---|---|---|---|
| Đủ bốn tín hiệu (0.1 / 0.15 / 0.1 / 0.65) | 0.126 | 0.197 | — | 0.4% |
| Bỏ kỹ năng | 0.120 | 0.198 | +0.001 | 0.5% |
| Bỏ tải việc | 0.105 | 0.187 | -0.009 | 0.4% |
| Bỏ lịch nghỉ | 0.116 | 0.192 | -0.005 | 0.5% |
| Bỏ lịch sử làm việc | 0.043 | 0.107 | -0.090 | 0.3% |

Và nếu chỉ dùng duy nhất một tín hiệu:

| Cấu hình | Phân tách kết quả | Tương quan | Chọn đúng người giỏi nhất |
|---|---|---|---|
| Chỉ kỹ năng | 0.037 | 0.140 | 21.5% |
| Chỉ tải việc | 0.122 | 0.203 | 27.3% |
| Chỉ lịch nghỉ | 0.036 | -0.233 | 20.2% |
| Chỉ lịch sử làm việc | 0.204 | 0.786 | 37.5% |

**Cách đọc bảng này.** Phân tách kết quả chỉ biết task có xong đúng hạn hay không, nên nó đo được giá trị của tín hiệu lịch sử rất rõ và gần như không đo được ba tín hiệu còn lại. Điều đó *không* có nghĩa là nên bỏ chúng:

- **Kỹ năng** đã phát huy tác dụng ở ràng buộc cứng trước khi chấm điểm: ứng viên thiếu kỹ năng bắt buộc bị xếp sau bất kể trọng số. Phần đóng góp còn lại của nó là phân biệt giữa những người *đã* đủ điều kiện, nên nhỏ là đúng chứ không phải vô dụng.
- **Lịch nghỉ** chặn một lỗi mà thước đo không nhìn thấy: gợi ý một người nghỉ phép nguyên kỳ task vẫn có thể cho ra task đúng hạn trong dữ liệu (người khác gánh), nhưng là gợi ý sai trước mặt quản lý.
- **Tải việc** phục vụ mục tiêu dàn đều công việc, vốn không nằm trong hàm mục tiêu này.

Trước đây bộ dò phải giữ một sàn tối thiểu cho mỗi tín hiệu để dữ liệu không đưa trọng số lịch nghỉ về 0. Sàn đó đã bỏ: nghỉ phép nay được bảo vệ ở hai chỗ đúng hơn — một số hạng riêng trong hàm mục tiêu (tỉ lệ vi phạm nghỉ phép) và một tầng ràng buộc cứng xếp sau người nghỉ quá nửa kỳ task. Trọng số vì vậy được tự do dò theo dữ liệu.

## 4. Phản hồi từ quản lý

Mới có 0 lượt quản lý chọn từ gợi ý (cần tối thiểu 20 để tỉ lệ đồng thuận có ý nghĩa). Mỗi lần quản lý bấm chọn một ứng viên, hệ thống đã lưu lại điểm thành phần của toàn bộ danh sách, nên chỉ cần dùng tính năng đủ nhiều là mục này tự có số liệu và trọng số học được từ chính quyết định thật thay vì từ dữ liệu mô phỏng.

## 5. Kết luận

**Giữ nguyên bộ trọng số hiện tại** — bộ trọng số tìm được chỉ hơn bộ hiện tại -0.094 điểm tổng hợp trên tập kiểm chứng (ngưỡng 0.05), chưa đủ để kết luận là tốt hơn thật.

## Ghi chú

- Năng lực ẩn là biến do simulator sinh ra, không phải dữ liệu công ty thật; nó là thước đo để so sánh các bộ trọng số với nhau, không phải bằng chứng về hiệu quả thực tế.
- Trọng số không cần cộng lại bằng 1: hàm chấm điểm tự chuẩn hoá theo các tín hiệu mà ứng viên thực sự có, nên ứng viên thiếu dữ liệu không bị phạt oan.
- Ràng buộc cứng (thiếu kỹ năng bắt buộc) không nằm trong phần tối ưu này: ứng viên không đủ điều kiện luôn bị xếp sau, bất kể trọng số.
