# AI gợi ý người nhận việc trong OmniHR

> Tài liệu mô tả thiết kế, thuật toán, cách đánh giá và kết quả của thành phần gợi ý người nhận task.
> Số liệu cập nhật ngày 30/09/2026 (chạy lại toàn bộ script đánh giá), đo trên dữ liệu mô phỏng 02/2026 – 09/2026 (mọi thao tác sinh qua API, xem mục 7.1).

## 1. Bài toán

Khi một trưởng nhóm hoặc trưởng phòng cần giao một task nhỏ (subtask), họ phải cân nhắc cùng lúc nhiều yếu tố: ai có kỹ năng phù hợp, ai đang rảnh, ai sắp nghỉ phép, ai thường làm tốt. OmniHR hỗ trợ bước này bằng cách **xếp hạng các thành viên trong nhóm** và giải thích lý do cho từng người.

AI chỉ **gợi ý**. Người quản lý vẫn là người chọn; task chỉ được giao khi quản lý bấm chọn một ứng viên.

## 2. Cách tiếp cận: ra quyết định đa tiêu chí (MCDM)

Hệ thống dùng **mô hình chấm điểm có trọng số** chứ không dùng mô hình học máy huấn luyện sẵn, vì ba lý do:

1. **Dữ liệu ít.** Một công ty vừa và nhỏ chỉ có vài nghìn lượt giao việc, không đủ để huấn luyện một mô hình đáng tin.
2. **Cần giải thích được.** Quản lý phải hiểu vì sao một người được xếp đầu; điểm theo từng tiêu chí trả lời trực tiếp câu hỏi đó.
3. **Cần áp được luật của công ty.** Mục tiêu không chỉ là "ai làm xong đúng hạn nhất", mà còn là giao việc đúng trình độ và để người mới có cơ hội. Với mô hình có trọng số, các luật này viết thẳng vào công thức (mục 4.1, 4.5). Mô hình học máy chỉ tối ưu một mục tiêu và dồn việc cho người có thành tích tốt nhất (mục 8.3).

Trọng số **không đặt tay**: chúng được tinh chỉnh trên lịch sử giao việc, trong giới hạn do luật sản phẩm đặt ra, và kiểm tra trên dữ liệu mới hơn (mục 7).

## 3. Luồng xử lý

```mermaid
flowchart LR
  A[Quản lý bấm "Gợi ý AI"<br/>trên một subtask] --> B[Lọc ứng viên<br/>theo quyền và theo nhóm]
  B --> C[Tính 4 tín hiệu<br/>cho từng người]
  C --> D[Ghép điểm có trọng số<br/>theo độ khó của task]
  D --> E[Xếp hạng theo tầng:<br/>đủ kỹ năng → không nghỉ dài → điểm]
  E --> F[Cân bằng tải:<br/>trừ điểm người nhận quá nhiều]
  F --> G[Viết lời giải thích<br/>+ lưu snapshot]
  G --> H[Quản lý chọn người<br/>→ task được giao]
```

1. **Ứng viên** là thành viên đang làm việc trong nhóm của task, trong phạm vi người dùng được quản lý. Mặc định không gợi ý chính người đang tạo gợi ý.
2. Mỗi ứng viên được tính **bốn tín hiệu** trên thang 0–100 (mục 4).
3. Điểm tổng là **trung bình có trọng số** của các tín hiệu mà ứng viên có dữ liệu. Tín hiệu thiếu dữ liệu được bỏ qua và phần trọng số còn lại tự chuẩn hóa, nên người thiếu dữ liệu không bị phạt oan.
4. Thứ hạng áp **các tầng ràng buộc** trước khi so điểm (mục 5).
5. Sau khi xếp hạng, **cân bằng tải** trừ điểm người đã nhận nhiều việc hơn mức trung bình của nhóm (mục 5).
6. Mỗi gợi ý lưu lại **snapshot** gồm dữ liệu đầu vào, trọng số đã dùng, độ khó của task và điểm từng thành phần của mọi ứng viên, để truy vết về sau.

## 4. Bốn tín hiệu

| Tín hiệu | Đo cái gì | Trọng số hiện tại |
|---|---|---|
| **Kỹ năng** | Mức khớp giữa trình độ task yêu cầu và trình độ nhân viên | 0,30 |
| **Tải việc** | Số giờ việc còn lại rơi vào tuần tới | 0,20 |
| **Lịch nghỉ** | Số ngày nghỉ trùng với thời gian thực hiện task | 0,10 |
| **Lịch sử** | Tỷ lệ hoàn thành đúng hạn và đúng giờ ước tính trước đây | 0,40 (nhân theo độ khó, mục 4.5) |

### 4.1. Kỹ năng: chấm theo độ khớp, không theo "càng giỏi càng tốt"

Mỗi kỹ năng của task có **mức quan trọng** (bắt buộc ×1,5; quan trọng ×1; nên có ×0,5) và **trình độ yêu cầu** (Beginner → Intermediate → Advanced → Expert). Điểm mỗi kỹ năng phụ thuộc vào **độ lệch** giữa trình độ của nhân viên và trình độ task cần:

| Trình độ nhân viên so với yêu cầu | Điểm |
|---|---|
| **Đúng bằng** | **100** |
| Cao hơn 1 / 2 / 3 bậc | 85 / 75 / 65 |
| Thấp hơn 1 / 2 / 3 bậc | 50 / 25 / 10 |

- **Thiếu bị trừ nặng hơn thừa:** thiếu trình độ thì có thể không làm được; thừa thì làm được, nhưng thời gian của người giỏi nên dành cho việc khó hơn. Nhờ vậy một task chỉ cần Beginner sẽ ưu tiên người đúng Beginner trước một Expert.
- Cộng thêm theo **số năm kinh nghiệm** với kỹ năng đó (tối đa +10), trừ đi nếu kỹ năng **lâu không dùng**.

**Cấp bậc phù hợp.** Task có thể khai báo khoảng cấp bậc phù hợp (ví dụ Fresher – Junior); task nhỏ để trống thì lấy theo task lớn. Nhân viên nằm ngoài khoảng bị trừ điểm kỹ năng:

- thấp hơn khoảng: −15 điểm mỗi bậc (tối đa −45);
- cao hơn khoảng: −8 điểm mỗi bậc (tối đa −24).

### 4.2. Tải việc

Chỉ tính **giờ còn lại** (giờ ước tính trừ giờ đã ghi nhận) của các task đang mở. Task đã nộp chờ duyệt không tính, vì phía người làm đã xong việc.

Giờ còn lại được **rải đều theo số tuần đến hạn**. Một task 80 giờ hạn sau 8 tuần chỉ chiếm 10 giờ của tuần này, chứ không làm người đó "quá tải" suốt hai tháng. Task quá hạn hoặc chưa có hạn được tính hết vào tuần này; task chưa đến ngày bắt đầu thì chưa tính.

Điểm được so với sức chứa 40 giờ/tuần, và trừ thêm cho mỗi task đang quá hạn.

### 4.3. Lịch nghỉ

Đếm số **ngày làm việc** của task trùng với đơn nghỉ phép. Ngày lễ và ngày cuối tuần không tính (dùng chung một hàm đếm ngày làm việc với toàn hệ thống).

- Nghỉ đã duyệt bị trừ tối đa 60 điểm; nghỉ đang chờ duyệt bị trừ tối đa 25 điểm.
- Nghỉ nửa ngày chỉ tính 0,5 ngày.
- Ngày đã có đơn được duyệt thì không bị trừ thêm từ đơn đang chờ.

### 4.4. Lịch sử làm việc

Điểm lịch sử = 60% tỷ lệ hoàn thành đúng hạn + 40% độ chính xác so với giờ ước tính, tính trên các task đã hoàn thành. Có hai cơ chế giữ cho tín hiệu này công bằng:

- **Trễ pha 45 ngày:** chỉ dùng task đã xong trước thời điểm giao ít nhất 45 ngày. Lý do: hình dung của quản lý về một người luôn đi sau thực tế, và việc này chặn hiện tượng "rò rỉ" khi đánh giá (task vừa xong hôm qua không được dùng để chấm kết quả hôm nay).
- **Co về mức của người cùng cấp:** người có ít lịch sử được kéo về điểm trung vị của những người cùng cấp bậc trong danh sách: `điểm = (n × điểm riêng + 4 × điểm nhóm) / (n + 4)`, với n là số task đã hoàn thành. Người mới vì vậy không bị mất hẳn tín hiệu này, và điểm riêng dần thay thế khi họ tích lũy thêm việc.

### 4.5. Lịch sử chỉ tính đủ ở task khó

Task được phân độ khó dựa trên trình độ cao nhất mà các kỹ năng *bắt buộc* yêu cầu và cấp bậc tối thiểu:

- **Khó:** Advanced/Expert, hoặc từ Senior trở lên;
- **Trung bình:** Intermediate, hoặc từ Middle trở lên;
- **Dễ:** các trường hợp còn lại.

Trọng số lịch sử được nhân theo độ khó: **task dễ chỉ dùng 25%, task trung bình 60%, task khó 100%**. Đây là luật cố định trong code, không phải tham số để chỉnh.

Lý do: nếu lịch sử tính như nhau trên mọi task, người có thành tích tốt nhất sẽ luôn đứng đầu, kể cả với việc đơn giản. Người mới không bao giờ được giao việc, nên cũng không bao giờ có thành tích. Việc dễ là nơi người mới xây thành tích, còn việc khó mới cần người đã chứng minh được năng lực. Kết quả đo được ở mục 8.4.

## 5. Ràng buộc cứng và cân bằng tải

Ba cơ chế nằm **ngoài** điểm có trọng số, có chủ đích:

| Cơ chế | Vai trò | Hoạt động |
|---|---|---|
| **Tầng kỹ năng** | Quyết định ai *có thể* làm | Thiếu kỹ năng bắt buộc, hoặc dưới trình độ tối thiểu, luôn bị xếp sau mọi người đủ điều kiện |
| **Tầng lịch nghỉ** | Quyết định ai *sẽ có mặt* | Nghỉ đã duyệt trên 50% số ngày làm việc của task thì bị xếp sau |
| **Cân bằng tải** | Quyết định ai *đã nhận đủ* | Sau khi xếp hạng, trừ điểm người nhận nhiều task hơn mức trung bình nhóm trong 14 ngày gần nhất (gấp đôi trung bình thì −10 điểm) |

Nói gọn: **trọng số quyết định ai tốt hơn; tầng quyết định ai có thể; cân bằng tải quyết định ai đã đủ việc.**

## 6. Giải thích và lưu vết

- Mỗi ứng viên có một câu giải thích sinh từ dữ liệu, nêu đủ các yếu tố quyết định thứ hạng, kể cả tín hiệu nặng nhất là lịch sử, ví dụ: *"Nguyễn Văn A: đủ điều kiện; khớp NODEJS, đạt 1/1 kỹ năng bắt buộc, đúng cấp bậc task cần; 3 task active, còn 12h khả dụng/tuần; không trùng lịch nghỉ trong khoảng task; lịch sử 78/100 từ 12 task đã xong; đã nhận gấp 2 lần mức trung bình nhóm trong 14 ngày qua (-10 điểm)."* Phần cân bằng tải chỉ xuất hiện khi người đó thực sự bị trừ điểm; người chưa có task đã xong được ghi "lịch sử lấy theo mức đồng nghiệp cùng cấp".
- Nếu có LLM, dịch vụ AI viết lại câu giải thích cho tự nhiên hơn (`POST /internal/suggestions/explain`). Bước này **chỉ đổi cách diễn đạt**: điểm và thứ hạng đã được tính và lưu từ trước. Nếu LLM không trả lời được, hệ thống giữ nguyên câu mẫu. Dữ liệu gửi cho LLM **không có họ tên** (tên đã hiển thị cạnh câu); lịch sử và cân bằng tải được gửi **dưới dạng lời** ("thành tích đúng hạn và đúng giờ cao trên 12 task đã hoàn thành"), không gửi con số điểm.
- Snapshot lưu lại **trọng số đã dùng**, **độ khó và khoảng cấp bậc thực sự dùng khi xếp hạng** (kể cả khi subtask kế thừa khoảng cấp bậc của task cha) cho từng gợi ý. Khi trọng số thay đổi sau này, gợi ý cũ vẫn giải thích được.
- Khi quản lý chọn một ứng viên, lượt giao được ghi là `AI_SUGGESTED` và nhân viên nhận thông báo như giao tay. Khi đủ phản hồi thật, bộ tinh chỉnh có thể học trọng số từ quyết định thực tế.

## 7. Phương pháp đánh giá

### 7.1. Dữ liệu

Do không có dữ liệu công ty thật, hệ thống dùng một **bộ mô phỏng** công ty 80 nhân viên, 5 phòng ban, 13 nhóm, chạy từng ngày làm việc từ 02/02/2026 đến 25/09/2026 (160 ngày làm việc).

- **Mọi thao tác đi qua chính API của hệ thống**, dưới tài khoản của đúng người làm: chấm công bằng GPS, xin và duyệt nghỉ, mở dự án, chia task, xin gợi ý AI rồi chọn người, nộp và duyệt task, hỏi HRGenie. Dữ liệu vì vậy có cùng kiểm tra quyền, audit log và thông báo như khi người dùng thao tác thật.
- **Nhịp làm việc gần thực tế:** mỗi dự án kéo dài 2–3 tháng và chia thành các sprint khoảng 2 tuần; trung bình một người xong một task nhỏ sau khoảng 3–4 ngày. Kết quả: 33 dự án, khoảng 3.800 task, 3.342 lượt giao việc (2.758 lần có xin gợi ý AI), 3.189 task hoàn thành.
- **Trễ hạn ít và tập trung ở task khó:** 34% task khó hoàn thành trễ, so với 13% ở task thường. Cuối kỳ có 17/147 task đang mở bị quá hạn, 11 trong số đó là task khó.
- Mỗi nhân viên có một **năng lực ẩn** (0–1) quyết định tốc độ và chất lượng công việc. **API gợi ý không bao giờ đọc được giá trị này**; nó chỉ được dùng làm "đáp án" khi chấm.
- Để phép đo không bị vòng tròn, trưởng nhóm mô phỏng **tự chọn người theo cách riêng** rồi mới xem gợi ý. Họ chỉ chọn trong danh sách gợi ý khi người họ định giao có mặt ở đó, **không bao giờ "nghe theo" AI**. Cách chọn của họ còn tính các yếu tố mô hình không thấy: độ quen giữa trưởng nhóm và thành viên, 10% số lần giao để kèm người mới, và 20% chọn ngẫu nhiên.

### 7.2. Cách chấm

Mỗi lượt giao việc được **dựng lại đúng thông tin tại thời điểm giao** (task đang ôm, lịch nghỉ đã biết, lịch sử đã có), chấm bằng **đúng hàm mà API dùng** (`suggestion-scoring.ts`), rồi so thứ hạng với:

- **năng lực ẩn:** mô hình có đưa người giỏi lên đầu không;
- **kết quả thực tế:** task giao cho người được xếp hạng cao có xong đúng hạn nhiều hơn không.

Tập đánh giá chính là 2.141 lượt giao từ 01/05 đến 27/09/2026. Phần đầu năm được dùng để lịch sử kịp tích lũy.

## 8. Kết quả

### 8.1. Chất lượng xếp hạng

| Cách chọn người | Năng lực TB người được chọn | Chọn trúng người giỏi nhất nhóm | Tương quan hạng – năng lực |
|---|---|---|---|
| Chọn ngẫu nhiên | 0,525 | 19,3% | 0 |
| Trưởng nhóm tự chọn (mô phỏng) | 0,571 | 22,3% | – |
| **Gợi ý của OmniHR** | **0,659** | **29,6%** | **0,381** |
| Trần lý thuyết (biết năng lực ẩn) | 0,739 | 50,3% | 1,000 |

Người được gợi ý đứng đầu có năng lực trung bình cao hơn hẳn người trưởng nhóm tự chọn (0,659 so với 0,571), và đi được khoảng 62% quãng đường từ chọn ngẫu nhiên tới trần lý thuyết.

### 8.2. Kết quả thực tế theo hạng gợi ý

| Hạng của người thực sự được giao | Số task | Xong đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa |
|---|---|---|---|---|
| **Hạng 1** | 679 | **89,4%** | 0,94 | 0,26 |
| Hạng 2–3 | 823 | 78,0% | 1,02 | 0,32 |
| Hạng 4 trở xuống | 514 | 65,2% | 1,17 | 0,49 |

Task giao cho người AI xếp hạng 1 **xong đúng hạn nhiều hơn 24 điểm phần trăm** so với người xếp hạng 4 trở xuống, ít vượt giờ hơn và bị trả về sửa chỉ bằng một nửa.

Với 2.158 lần trưởng nhóm chọn từ danh sách gợi ý, người được chọn nằm ở hạng 1 trong 42% số lần và trong top 3 ở 86% số lần.

### 8.3. So với học máy (tập kiểm chứng: 643 quyết định sau cùng; học trên 1.498 quyết định trước đó)

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất |
|---|---|---|---|
| **MCDM (đang dùng)** | 0,264 | 0,411 | 32,7% |
| Hồi quy logistic dự đoán đúng hạn, 4 đặc trưng | 0,308 | 0,724 | 43,7% |
| Hồi quy logistic dự đoán đúng hạn, 10 đặc trưng | 0,313 | 0,762 | 41,5% |
| Học theo lựa chọn của trưởng nhóm | 0,182 | 0,289 | 27,2% |

**Mô hình học máy dự đoán đúng hạn tốt hơn MCDM.** Đây là kết quả có chủ đích, không phải lỗi:

- Mô hình học máy chỉ tối ưu một mục tiêu là "ai xong đúng hạn nhất". Nó dồn gần hết trọng lượng vào lịch sử (hệ số chuẩn hóa: lịch sử 1,24; kỹ năng chỉ 0,02). Kết quả là việc nào cũng giao cho người có thành tích tốt nhất.
- MCDM cố ý **không** làm vậy: lịch sử bị giới hạn ở 0,4, chỉ tính 25% ở task dễ, và điểm kỹ năng ưu tiên người **đúng** trình độ thay vì người giỏi nhất. Phần chênh lệch độ chính xác là cái giá của việc giao việc đúng người, đúng tầm và cho người mới cơ hội (mục 8.4).
- Học theo lựa chọn của trưởng nhóm kém nhất, vì bắt chước cả thói quen và thiên vị của họ.

### 8.4. Hiệu quả của các luật cân bằng

**Người mới được ưu tiên đúng chỗ.** Tỷ lệ gợi ý hạng 1 là Intern/Fresher/Junior theo độ khó task:

| Độ khó task | Số lần gợi ý | Người mới được xếp hạng 1 | Tỷ lệ người mới trong danh sách ứng viên |
|---|---|---|---|
| Dễ | 61 | **85%** | 45% |
| Trung bình | 1.930 | 18% | 38% |
| Khó | 767 | **2%** | 32% |

**Cái giá về độ chính xác nhỏ.** So với cách tính lịch sử đủ 100% trên mọi task, việc giảm lịch sử ở task dễ chỉ làm năng lực trung bình của người đứng đầu giảm từ 0,665 xuống 0,659, và tỷ lệ chọn trúng người giỏi nhất giảm từ 30,5% xuống 29,6%.

| Thử nghiệm | Kết quả | Kết luận |
|---|---|---|
| Tinh chỉnh lại 4 trọng số (trong giới hạn: lịch sử ≤ 0,4, kỹ năng ≥ 0,2, mỗi tín hiệu ≥ 0,1) | Bộ tốt nhất không hơn bộ hiện tại trên tập kiểm chứng | Giữ nguyên 0,3 / 0,2 / 0,1 / 0,4 |
| Bỏ giới hạn, để dữ liệu tự chọn | Tối ưu rơi vào kỹ năng 0,05 / tải việc 0,35 / lịch nghỉ 0,1 / lịch sử 0,5 | Không dùng: bỏ qua kỹ năng là bỏ qua mục đích của tính năng (xem hạn chế về mô phỏng ở mục 9) |
| Bỏ cấp bậc phù hợp của task | Chọn trúng người giỏi nhất tăng nhẹ (31,8% so với 29,6%) | Giữ: cấp bậc là yêu cầu nghiệp vụ, không chỉ là tín hiệu dự đoán |

### 8.5. Kiểm tra độ tin cậy của phép đo

- **Kiểm soát âm:** tráo điểm lịch sử giữa các ứng viên trong cùng một quyết định thì điểm phân tách rơi từ 0,245 xuống 0,116, về đúng mức của mô hình không dùng lịch sử (0,127). Mô hình đo đúng chất lượng ứng viên, không đo một thứ khác.
- **Chống rò rỉ:** tương quan của lịch sử với năng lực ẩn là 0,713, so với 0,772 nếu không có trễ pha. Trễ pha và co về mức nhóm đã cắt được phần rò rỉ 0,059.

## 9. Hạn chế

- **Dữ liệu mô phỏng.** Các con số chứng minh thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay thế được đánh giá trên dữ liệu công ty thật.
- **Đánh đổi độ chính xác lấy công bằng.** Mô hình học máy dự đoán đúng hạn tốt hơn (mục 8.3). OmniHR chọn MCDM vì cần giải thích được và cần áp luật giao việc đúng tầm. Nếu một công ty chỉ quan tâm đúng hạn, có thể nâng giới hạn trọng số lịch sử, nhưng người mới sẽ ít được giao việc hơn.
- **Người mới ở task khó.** Người có dưới 3 task đã xong hiếm khi lọt top 3 ở task trung bình và khó. Đây là hành vi mong muốn: họ được ưu tiên ở task dễ (85% hạng 1) để xây thành tích trước.
- **Mô phỏng không đo được giá trị của kỹ năng.** Trong bộ mô phỏng, thời gian và chất lượng hoàn thành task chỉ phụ thuộc năng lực ẩn và độ khó task (`hoursNeeded` trong `prisma/simulate-day.ts`), không phụ thuộc độ khớp kỹ năng; năng lực ẩn cũng độc lập với kỹ năng khai báo. Vì vậy mọi thước đo ở mục 8 không thể thấy đóng góp của tín hiệu kỹ năng, và bỏ kỹ năng có thể làm điểm tăng (ablation trong `eval_results/weights-tuning.md`). Kỹ năng được giữ vì là yêu cầu nghiệp vụ; muốn đo được cần cho kết quả mô phỏng phụ thuộc độ khớp kỹ năng.
- **Người mới (cold-start).** Trong kỳ đánh giá, nhóm có dưới 3 task đã xong chỉ chiếm 1,9% dòng ứng viên; một nửa số người trong nhóm này chưa lần nào vào top 3 (`eval_results/diagnostics.md`).
- **Ít task dễ trong dữ liệu.** Chỉ 61/2.758 lần gợi ý là task dễ, vì phần lớn công việc mô phỏng yêu cầu trình độ Intermediate trở lên. Con số 85% ở mục 8.4 vì vậy dựa trên mẫu nhỏ.

## 10. Tham số cấu hình

Nằm trong **Cài đặt hệ thống** và được lưu kèm mỗi gợi ý:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `aiWeightSkill` / `Workload` / `Availability` / `History` | 0,30 / 0,20 / 0,10 / 0,40 | Trọng số bốn tín hiệu |

Các hằng số cố định trong code:
- Lịch sử theo độ khó: 25% / 60% / 100%.
- Điểm độ khớp trình độ: bảng ở mục 4.1.
- Ngưỡng chặn lịch nghỉ: 50%.
- Cửa sổ cân bằng tải: 14 ngày.
- Trễ pha lịch sử: 45 ngày.
- Độ mạnh prior: 4.
- Sức chứa: 40 giờ/tuần.
- Giới hạn khi tinh chỉnh: lịch sử ≤ 0,4, kỹ năng ≥ 0,2.

## 11. Mã nguồn liên quan

| File | Nội dung |
|---|---|
| `OmniHR_BE/src/ai-task-suggestions/suggestion-scoring.ts` | Toàn bộ hàm chấm điểm thuần, dùng chung cho API và đánh giá |
| `OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts` | Luồng tạo, lưu và chọn gợi ý |
| `OmniHR_BE/src/task-workload/task-workload.service.ts` | Tính tải việc theo tuần |
| `OmniHR_BE/prisma/simulate-day.ts`, `prisma/simulation/` | Bộ mô phỏng công ty, thao tác qua API |
| `OmniHR_BE/prisma/evaluate-suggestions.ts` | Dựng lại và chấm các lượt giao việc |
| `OmniHR_BE/prisma/tune-weights.ts`, `tune-constants.ts` | Tinh chỉnh trọng số và hằng số |
| `OmniHR_BE/prisma/diagnostics.ts`, `ml-baseline.ts` | Kiểm tra độ tin cậy, so với học máy |
| `OmniHR_BE/eval_results/*.md` | Báo cáo kết quả đầy đủ |

Chạy lại toàn bộ phép đo (trên cơ sở dữ liệu mô phỏng, không chạy trên dữ liệu thật):

```bash
cd OmniHR_BE
npm run eval:suggestions -- --from 2026-05-01
npm run eval:diagnostics -- --from 2026-05-01
npm run eval:ml-baseline -- --from 2026-05-01
npm run eval:tune-weights
```
