# AI gợi ý người nhận việc trong OmniHR

> Tài liệu mô tả thiết kế, thuật toán, cách đánh giá và kết quả của thành phần gợi ý người nhận task.
> Số liệu cập nhật ngày 27/09/2026, đo trên cơ sở dữ liệu mô phỏng `omnihr_eval_v2`.

## 1. Bài toán

Khi một trưởng nhóm hoặc trưởng phòng cần giao một task nhỏ (subtask), họ phải cân nhắc cùng lúc nhiều yếu tố: ai có kỹ năng phù hợp, ai đang rảnh, ai sắp nghỉ phép, ai thường làm tốt. OmniHR hỗ trợ bước này bằng cách **xếp hạng các thành viên trong nhóm** và giải thích lý do cho từng người.

AI chỉ **gợi ý**. Người quản lý vẫn là người chọn; task chỉ được giao khi quản lý bấm chọn một ứng viên.

## 2. Cách tiếp cận: ra quyết định đa tiêu chí (MCDM)

Hệ thống dùng **mô hình chấm điểm có trọng số** chứ không dùng mô hình học máy huấn luyện sẵn, vì ba lý do:

1. **Dữ liệu ít.** Một công ty vừa và nhỏ chỉ có vài nghìn lượt giao việc, không đủ để huấn luyện một mô hình đáng tin.
2. **Cần giải thích được.** Quản lý phải hiểu vì sao một người được xếp đầu; điểm theo từng tiêu chí trả lời trực tiếp câu hỏi đó.
3. **Đã kiểm chứng bằng số.** Trên cùng dữ liệu, mô hình đa tiêu chí vượt các mô hình học máy đối chứng (mục 8.3).

Trọng số **không đặt tay**: chúng được tinh chỉnh trên lịch sử giao việc và kiểm tra trên dữ liệu mới hơn (mục 7).

## 3. Luồng xử lý

```mermaid
flowchart LR
  A[Quản lý bấm "Gợi ý AI"<br/>trên một subtask] --> B[Lọc ứng viên<br/>theo quyền và theo nhóm]
  B --> C[Tính 4 tín hiệu<br/>cho từng người]
  C --> D[Ghép điểm có trọng số]
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
| **Kỹ năng** | Mức khớp giữa kỹ năng task yêu cầu và kỹ năng nhân viên | 0,10 |
| **Tải việc** | Số giờ việc còn lại rơi vào tuần tới | 0,15 |
| **Lịch nghỉ** | Số ngày nghỉ trùng với thời gian thực hiện task | 0,10 |
| **Lịch sử** | Tỷ lệ hoàn thành đúng hạn và đúng giờ ước tính trước đây | 0,65 |

### 4.1. Kỹ năng

Mỗi kỹ năng của task có **mức quan trọng** (bắt buộc ×1,5; quan trọng ×1; nên có ×0,5) và **trình độ tối thiểu** (Beginner → Expert). Điểm từng kỹ năng gồm:

- điểm theo trình độ thực tế của nhân viên, bị trừ nếu thấp hơn mức yêu cầu;
- cộng thêm theo **số năm kinh nghiệm** với kỹ năng đó (tối đa +10);
- trừ đi nếu kỹ năng **lâu không dùng**.

**Cấp bậc phù hợp.** Task có thể khai báo khoảng cấp bậc phù hợp (ví dụ Fresher – Junior); task nhỏ để trống thì lấy theo task lớn. Nhân viên nằm ngoài khoảng bị trừ điểm kỹ năng:

- thấp hơn khoảng: −15 điểm mỗi bậc (tối đa −45), vì có thể không làm được;
- cao hơn khoảng: −8 điểm mỗi bậc (tối đa −24), vì thời gian của người giỏi nên dành cho việc khó hơn.

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
- **Co về mức của người cùng cấp:** người có ít lịch sử được kéo về điểm trung vị của những người cùng cấp bậc trong danh sách: `điểm = (n × điểm riêng + 4 × điểm nhóm) / (n + 4)`, với n là số task đã hoàn thành. Người mới vì vậy không bị mất hẳn tín hiệu quan trọng nhất, và điểm riêng dần thay thế khi họ tích lũy thêm việc.

### 4.5. Trọng số kỹ năng theo độ khó (tùy chọn)

Task được phân độ khó dựa trên trình độ cao nhất mà các kỹ năng *bắt buộc* yêu cầu và cấp bậc tối thiểu:

- **Khó:** Advanced/Expert, hoặc từ Senior trở lên;
- **Trung bình:** Intermediate, hoặc từ Middle trở lên;
- **Dễ:** các trường hợp còn lại.

Trọng số kỹ năng có thể nhân theo độ khó (ví dụ ×1/×2/×4). Tuy nhiên đo trên dữ liệu mô phỏng cho thấy cách này **làm giảm chất lượng** (mục 8.4), nên hệ số hiện được đặt ×1 cho cả ba mức. Tham số vẫn giữ trong cài đặt để tinh chỉnh lại khi có dữ liệu thật.

## 5. Ràng buộc cứng và cân bằng tải

Ba cơ chế nằm **ngoài** điểm có trọng số, có chủ đích:

| Cơ chế | Vai trò | Hoạt động |
|---|---|---|
| **Tầng kỹ năng** | Quyết định ai *có thể* làm | Thiếu kỹ năng bắt buộc, hoặc dưới trình độ tối thiểu, luôn bị xếp sau mọi người đủ điều kiện |
| **Tầng lịch nghỉ** | Quyết định ai *sẽ có mặt* | Nghỉ đã duyệt trên 50% số ngày làm việc của task thì bị xếp sau |
| **Cân bằng tải** | Quyết định ai *đã nhận đủ* | Sau khi xếp hạng, trừ điểm người nhận nhiều task hơn mức trung bình nhóm trong 14 ngày gần nhất (gấp đôi trung bình thì −10 điểm) |

Nói gọn: **trọng số quyết định ai tốt hơn; tầng quyết định ai có thể; cân bằng tải quyết định ai đã đủ việc.**

## 6. Giải thích và lưu vết

- Mỗi ứng viên có một câu giải thích sinh từ dữ liệu, ví dụ: *"Nguyễn Văn A: đủ điều kiện; khớp NODEJS, đạt 1/1 kỹ năng bắt buộc, đúng cấp bậc task cần; 3 task đang làm, còn 12 giờ khả dụng/tuần; không trùng lịch nghỉ."*
- Nếu có LLM, dịch vụ AI viết lại câu giải thích cho tự nhiên hơn (`POST /internal/suggestions/explain`). Bước này **chỉ đổi cách diễn đạt**: điểm và thứ hạng đã được tính và lưu từ trước. Nếu LLM không trả lời được, hệ thống giữ nguyên câu mẫu.
- Snapshot lưu lại **trọng số đã dùng** cho từng gợi ý. Khi trọng số thay đổi sau này, gợi ý cũ vẫn giải thích được.
- Mỗi lần quản lý chọn một ứng viên, hệ thống ghi lại lựa chọn đó. Khi đủ phản hồi thật, bộ tinh chỉnh có thể học trọng số từ quyết định thực tế.

## 7. Phương pháp đánh giá

### 7.1. Dữ liệu

Do không có dữ liệu công ty thật, hệ thống dùng một **bộ mô phỏng** công ty 80 nhân viên, chạy từng ngày làm việc từ 01/2026 đến 09/2026: khoảng 2.600 lượt giao việc, có đủ chấm công, nghỉ phép (kể cả nửa ngày, xin hủy), ngày lễ và các lần trả việc về sửa.

- Mỗi nhân viên có một **năng lực ẩn** (0–1) quyết định tốc độ và chất lượng công việc. **API gợi ý không bao giờ đọc được giá trị này**; nó chỉ được dùng làm "đáp án" khi chấm.
- Để phép đo không bị vòng tròn (mô hình chỉ giống cách bộ mô phỏng chọn người), trưởng nhóm mô phỏng còn chọn người theo các yếu tố mô hình không thấy: độ quen giữa trưởng nhóm và thành viên, 10% số lần giao việc để kèm người mới, và 20% chọn ngẫu nhiên.

### 7.2. Cách chấm

Mỗi lượt giao việc được **dựng lại đúng thông tin tại thời điểm giao** (task đang ôm, lịch nghỉ đã biết, lịch sử đã có), chấm bằng **đúng hàm mà API dùng** (`suggestion-scoring.ts`), rồi so thứ hạng với:

- **năng lực ẩn:** mô hình có đưa người giỏi lên đầu không;
- **kết quả thực tế:** task giao cho người được xếp hạng cao có xong đúng hạn nhiều hơn không.

Dữ liệu được chia theo thời gian: tinh chỉnh trên giai đoạn trước, kiểm chứng trên giai đoạn sau.

## 8. Kết quả

### 8.1. Chất lượng xếp hạng (toàn kỳ 02–09/2026)

| Cách chọn người | Chọn trúng người giỏi nhất nhóm | Tương quan hạng – năng lực |
|---|---|---|
| Chọn ngẫu nhiên | 19,3% | 0 |
| Trưởng nhóm tự chọn (mô phỏng) | 20,1% | – |
| **Gợi ý của OmniHR** | **38,3%** | **0,611** |
| Trần lý thuyết (biết năng lực ẩn) | 50,4% | 1,000 |

### 8.2. Kết quả thực tế theo hạng gợi ý

| Hạng của người thực sự được giao | Xong đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa |
|---|---|---|---|
| **Hạng 1** | **58,4%** | 1,07 | 0,38 |
| Hạng 2–3 | 42,4% | 1,20 | 0,48 |
| Hạng 4 trở xuống | 28,7% | 1,34 | 0,58 |
| *Trần lý thuyết – hạng 1* | *60,4%* | – | – |

- Người được xếp hạng 1 **xong đúng hạn gấp đôi** người xếp hạng 4 trở xuống, ít vượt giờ hơn và ít bị trả về sửa hơn.
- Con số 58,4% đạt **khoảng 97% mức trần**. Trần chỉ là 60% vì trong dữ liệu này 56% số task trễ hạn do độ khó và yếu tố ngẫu nhiên; ngay cả khi biết chính xác năng lực của từng người cũng không vượt được mức đó.

### 8.3. So với học máy (tập kiểm chứng, 787 quyết định)

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất |
|---|---|---|---|
| **MCDM (đang dùng)** | **0,207** | **0,819** | **45,7%** |
| Hồi quy logistic, 4 đặc trưng | 0,187 | 0,593 | 40,3% |
| Hồi quy logistic, 10 đặc trưng | 0,179 | 0,626 | 39,3% |
| Học theo lựa chọn của trưởng nhóm | 0,073 | 0,093 | 18,8% |

Thêm đặc trưng (độ quen dự án, thâm niên, cấp bậc, số task đã làm) **không giúp** mô hình học máy vượt được mô hình hiện tại.

### 8.4. Các thử nghiệm không cải thiện được, và vì sao

| Thử nghiệm | Kết quả | Kết luận |
|---|---|---|
| Tinh chỉnh lại 4 trọng số | Bộ tốt nhất kém bộ hiện tại 0,007 trên tập kiểm chứng | Giữ nguyên |
| Dò 238 cấu hình hằng số (trễ pha, prior, sức chứa) | Cấu hình tốt nhất trên tập chọn lại kém hơn ở tập cuối (−0,015) | Dấu hiệu khớp nhiễu; giữ nguyên |
| Trọng số kỹ năng theo độ khó ×1/×2/×4 | Task khó: đúng hạn ở hạng 1 giảm từ 69,6% xuống 67,5%; tương quan giảm từ 0,611 xuống 0,544 | Trình độ ghi trên hồ sơ phản ánh thâm niên hơn là năng lực thực tế; để hệ số ×1 |
| Trừ điểm cấp bậc thẳng vào điểm tổng | Tương quan giảm còn 0,480 | Bỏ; giữ mức trừ trong điểm kỹ năng |

### 8.5. Kiểm tra độ tin cậy của phép đo

- **Kiểm soát âm:** tráo điểm lịch sử giữa các ứng viên trong cùng một quyết định thì điểm phân tách rơi về mức của mô hình không dùng lịch sử. Mô hình đo đúng chất lượng ứng viên, không đo một thứ khác.
- **Chống rò rỉ:** so với lịch sử "sạch" (không trễ pha), phần chênh lệch do rò rỉ chỉ khoảng 0,01. Trễ pha đã chặn được phần lớn.

## 9. Hạn chế

- **Dữ liệu mô phỏng.** Các con số chứng minh thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay thế được đánh giá trên dữ liệu công ty thật.
- **Người mới.** 50% người mới vẫn chưa từng lọt top 3. Nguyên nhân chính là họ thiếu kỹ năng bắt buộc cho phần lớn task; tầng kỹ năng xếp họ sau là đúng. Hệ thống giải quyết bằng các "việc cho người mới" (yêu cầu Beginner, cấp Intern – Junior), chứ không bằng cách hạ ràng buộc.
- **Lịch sử chiếm trọng số lớn (0,65).** Điều này đúng với dữ liệu mô phỏng, nơi lịch sử phản ánh năng lực tốt nhất. Ở công ty thật, trình độ kỹ năng trên hồ sơ có thể đáng tin hơn, và trọng số cần được tinh chỉnh lại.

## 10. Tham số cấu hình

Tất cả nằm trong **Cài đặt hệ thống** và được lưu kèm mỗi gợi ý:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `aiWeightSkill` / `Workload` / `Availability` / `History` | 0,10 / 0,15 / 0,10 / 0,65 | Trọng số bốn tín hiệu |
| `aiSkillMultiplierEasy` / `Medium` / `Hard` | 1 / 1 / 1 | Hệ số trọng số kỹ năng theo độ khó |

Các hằng số cố định trong code: ngưỡng chặn lịch nghỉ 50%, cửa sổ cân bằng tải 14 ngày, trễ pha lịch sử 45 ngày, độ mạnh prior 4, sức chứa 40 giờ/tuần.

## 11. Mã nguồn liên quan

| File | Nội dung |
|---|---|
| `OmniHR_BE/src/ai-task-suggestions/suggestion-scoring.ts` | Toàn bộ hàm chấm điểm thuần, dùng chung cho API và đánh giá |
| `OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts` | Luồng tạo, lưu và chọn gợi ý |
| `OmniHR_BE/src/task-workload/task-workload.service.ts` | Tính tải việc theo tuần |
| `OmniHR_BE/prisma/simulate-day.ts` | Bộ mô phỏng công ty |
| `OmniHR_BE/prisma/evaluate-suggestions.ts` | Dựng lại và chấm các lượt giao việc |
| `OmniHR_BE/prisma/tune-weights.ts`, `tune-constants.ts` | Tinh chỉnh trọng số và hằng số |
| `OmniHR_BE/prisma/diagnostics.ts`, `ml-baseline.ts` | Kiểm tra độ tin cậy, so với học máy |
| `OmniHR_BE/eval_results/*.md` | Báo cáo kết quả đầy đủ |

Chạy lại toàn bộ phép đo (trên cơ sở dữ liệu mô phỏng, không chạy trên dữ liệu thật):

```bash
cd OmniHR_BE
DATABASE_URL=postgresql://.../omnihr_eval_v2 npm run eval:suggestions -- --from 2026-02-01
DATABASE_URL=postgresql://.../omnihr_eval_v2 npm run eval:diagnostics
DATABASE_URL=postgresql://.../omnihr_eval_v2 npm run eval:ml-baseline -- --from 2026-02-01
DATABASE_URL=postgresql://.../omnihr_eval_v2 npm run eval:tune-weights -- --from 2026-02-01
```
