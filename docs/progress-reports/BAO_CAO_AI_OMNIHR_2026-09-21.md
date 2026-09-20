# Báo cáo hiện trạng hai chức năng AI của hệ thống OmniHR

*Ngày 21/09/2026, bản chiều — thay thế bản sáng cùng ngày. Phần gợi ý giao việc đã được thiết kế lại: tín hiệu lịch sử bị làm yếu đi có chủ ý để cắt rò rỉ, hàm mục tiêu chuyển sang đa mục tiêu, thêm xử lý khởi đầu nguội, thêm một tầng ràng buộc cứng và một bước cân tải nhóm. Bộ dữ liệu mô phỏng cũng đã được sinh lại với nhiều nhiễu hơn. **Vì vậy mọi con số trong báo cáo này không so sánh trực tiếp được với bản sáng** — cách đo đã khác và dữ liệu cũng khác. Cách chạy lại từng phép đo ở mục 8.*

---

## 1. Tóm tắt

| | Chatbot HRGenie | Gợi ý giao việc |
|---|---|---|
| **Bản chất** | Mô hình ngôn ngữ lớn lập kế hoạch gọi công cụ | Ra quyết định đa tiêu chí (MCDM), 4 tín hiệu, 2 tầng ràng buộc cứng, trọng số dò từ dữ liệu |
| **Có học máy không** | Có — Gemini 3.5 Flash Lite qua giao diện OpenAI-compatible | Không, nhưng **đã được so sánh sòng phẳng với học máy và hiện đang nhỉnh hơn** |
| **Kết quả chính** | 80/80 câu đúng hoàn toàn khi hạn mức LLM còn đủ; 90% khi nhà cung cấp từ chối 27,5% lượt | Phân tách kết quả **0,206** trên 831 quyết định giữ lại, so với 0,189 của baseline học máy tốt nhất |
| **Điểm yếu lớn nhất** | Phụ thuộc hạn mức nhà cung cấp | Toàn bộ kiểm chứng vẫn dựa trên dữ liệu mô phỏng |

**Thay đổi so với bản sáng.** Bản sáng đạt điểm cao hơn (0,229) nhưng tự nó chỉ ra một điểm yếu phương pháp: tín hiệu lịch sử làm việc được tính từ chính các kết quả task mà thước đo dùng làm nhãn, nên một phần điểm số là **vòng lặp** chứ không phải năng lực dự báo. Bản chiều xử lý đúng điểm đó:

1. **Đo mức rò rỉ thay vì nói suông.** Tương quan giữa tín hiệu lịch sử và năng lực ẩn của bộ mô phỏng: bản "sạch" 0,852 → bản mô hình thực sự thấy **0,585**. Trễ pha 45 ngày cộng co rút về prior đã cắt đi 0,267.
2. **Thêm kiểm soát âm.** Xáo tín hiệu lịch sử giữa các ứng viên làm điểm rơi từ 0,173 xuống 0,064 — thấp hơn cả khi bỏ hẳn tín hiệu (0,114). Phần điểm tăng thêm đúng là do gán *đúng* lịch sử cho *đúng* người.
3. **Hàm mục tiêu thành đa mục tiêu**, nên không còn phải chèn sàn trọng số nhân tạo để bảo vệ nghiệp vụ.
4. **Khởi đầu nguội hết vách đứng**: điểm lịch sử co rút mượt về prior của nhóm đồng cấp thay vì là *null* cho tới task thứ ba.
5. **Cân tải nhóm** sau khi xếp hạng, và chi phí của nó được đo chứ không giấu: mất 0,009 điểm phân tách để đổi lấy tải đều hơn.

Điều đáng nói với hội đồng vẫn là **mạch làm việc**: đo được → phát hiện chính phép đo của mình có vấn đề → sửa cả mô hình lẫn cách đo → chấp nhận con số thấp hơn nhưng đáng tin hơn. Điểm số giảm ở đây là kết quả tốt, không phải bước lùi.

---

## 2. Nguyên tắc kiến trúc

Cả hai chức năng chịu chung một ràng buộc: **dịch vụ AI không ghi dữ liệu và không tự quyết định quyền truy cập.**

```
Ứng dụng di động / Web
        │  (chỉ gọi NestJS)
        ▼
   NestJS (OmniHR_BE)  ──► kiểm tra quyền, đọc/ghi CSDL, ghi nhật ký kiểm toán
        │
        │  POST /internal/chat/plan            (lập kế hoạch hội thoại)
        │  POST /internal/suggestions/explain  (viết lời giải thích gợi ý)
        │  header: X-Internal-Service-Token
        ▼
   FastAPI (OmniHR_AI)  ──► gọi LLM, tra cứu tài liệu chính sách (RAG)
```

Dịch vụ AI chỉ trả về **ý định và danh sách công cụ đề nghị gọi**; nó không có kết nối cơ sở dữ liệu. Một mô hình bị dụ bằng prompt injection vẫn không vượt được lớp quyền ở NestJS.

---

## 3. Chatbot HRGenie

### 3.1 Cấu trúc và ba chế độ

23 công cụ, trong đó **3 công cụ ghi dữ liệu** (nộp đơn nghỉ, hủy đơn nghỉ, cập nhật trạng thái công việc) đều bắt buộc người dùng xác nhận trước khi thực thi.

Chế độ đặt bằng `AI_PLANNER_MODE`: `rule_based` (chỉ luật, không cần khóa LLM), `llm`, `hybrid` *(đang dùng)* — ưu tiên LLM, tự quay về luật khi hết thời gian chờ, JSON sai, vi phạm lược đồ, đề nghị công cụ người dùng không có quyền, hoặc độ tin cậy dưới 0,6. Hợp đồng dữ liệu trả về NestJS giống hệt nhau ở cả ba chế độ.

### 3.2 Các lớp kiểm soát

1. **Danh sách công cụ theo quyền** — NestJS chỉ gửi cho LLM những công cụ chính người dùng đó có quyền gọi.
2. **Danh sách trắng tham số** — tham số lạ do LLM sinh ra bị loại trước khi thực thi.
3. **Bắt buộc xác nhận với thao tác ghi** — tạo *pending action*, chỉ thực hiện sau khi người dùng bấm xác nhận.
4. **Lọc lịch sử nhạy cảm** trước khi gửi cho LLM bên ngoài.
5. **Giới hạn 20 tin nhắn/phút** mỗi người, đếm chung giữa các tiến trình qua Redis, tự hạ xuống đếm cục bộ nếu Redis chết.
6. Tin nhắn tối đa 1.000 ký tự, lịch sử gửi kèm 12 lượt, pending action hết hạn sau 30 phút.

### 3.3 Số liệu đánh giá

Bốn bộ dữ liệu, tổng **271 câu**, cộng 79 câu hồi quy. Bộ `test` được đóng băng trước khi tinh chỉnh prompt — đây là con số nên báo cáo.

**Chế độ `hybrid`, bộ `test` (80 câu), khi hạn mức LLM còn đủ:**

| Chỉ số | Kết quả |
|---|---|
| Đúng ý định / công cụ / bước xác nhận / tham số | 80/80 (100%) |
| **Câu vượt quyền bị lập kế hoạch ghi dữ liệu** | **0/10 (0%)** |
| Phải quay về luật | 0/80 |
| Độ trễ trung bình / p95 | 1.643 ms / 1.892 ms |

**Cùng bộ đó, đo lại hôm nay khi nhà cung cấp trả mã 429 (hết hạn mức miễn phí):**

| Chỉ số | Kết quả |
|---|---|
| Đúng hoàn toàn | 72/80 (90,0%) |
| Đúng bước xác nhận | 79/80 (98,8%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0%) |
| Phải quay về luật | **22/80 (27,5%)** |
| Độ trễ trung bình / p95 | 2.215 ms / 3.373 ms |

Toàn bộ câu sai đều nằm trong phần đã rơi về luật. Nói cách khác: **nhà cung cấp LLM từ chối hơn một phần tư số lượt mà hệ thống không hỏng, không báo lỗi cho người dùng, và vẫn trả lời đúng 90%.** Đây là bằng chứng thực nghiệm cho cơ chế dự phòng — thứ thường chỉ được khẳng định trên slide thiết kế.

**Chế độ `rule_based`, bộ `dev2` (55 câu)** — năng lực của riêng phương án dự phòng: đúng hoàn toàn 52/55 (94,5%), bước xác nhận và tham số đều 100%, độ trễ 0,1 ms.

### 3.4 Lỗi đã sửa trong ngày

Công cụ `update_task_status_draft` (đổi trạng thái công việc bằng hội thoại) tồn tại ở NestJS và ở bộ lập kế hoạch theo luật, nhưng **chưa được khai báo phía dịch vụ AI**: thiếu trong lược đồ công cụ, danh sách trắng tham số, danh sách công cụ ghi và prompt. Hệ quả: ở chế độ `hybrid` đang dùng, câu *"chuyển task sang đang làm"* bị trả lời *"tính năng này chưa được hỗ trợ"* — tính năng đã code xong nhưng không dùng được.

Đã khai báo đầy đủ và xếp vào nhóm công cụ ghi. Kiểm chứng chạy thật: hệ thống hỏi lại tên công việc khi thiếu thông tin → tạo pending action khi đủ → người dùng xác nhận → trạng thái công việc đổi đúng trong cơ sở dữ liệu.

Khi bổ sung 9 câu kiểm thử cho intent này, phát hiện thêm hai lỗi của bộ lập kế hoạch theo luật, cũng đã sửa: nó không hiểu *"gửi task X cho quản lý duyệt"* là chuyển sang trạng thái chờ duyệt, và nó **soạn thảo được lệnh đổi trạng thái công việc của người khác** thay vì từ chối.

### 3.5 Đánh giá

**Mạnh.** Kiến trúc tách bạch đúng chỗ: LLM chỉ lập kế hoạch, NestJS giữ toàn quyền kiểm soát. Chỉ số an toàn 0/10 không phải may mắn mà là hệ quả của việc lọc danh sách công cụ theo quyền *trước khi* gửi cho mô hình. Cơ chế dự phòng đã được thử lửa thật.

**Yếu.** Phụ thuộc hạn mức nhà cung cấp: ở hạn mức miễn phí, tỉ lệ quay về luật lên tới 27,5% và độ chính xác rơi từ 100% xuống 90%. Bản thân bộ luật dự phòng chỉ đạt khoảng 56% trên các bộ câu diễn đạt tự do — nó được thiết kế để *không sai nguy hiểm*, không phải để thay thế LLM.

---

## 4. Gợi ý giao việc

### 4.1 Mô hình: bốn tín hiệu mềm, hai tầng ràng buộc cứng, một bước cân tải

```
1. Loại theo ràng buộc cứng  →  2. Chấm điểm mềm  →  3. Cân tải nhóm  →  4. Con người chọn
```

**Bước 2 — điểm mềm:**

```
Điểm tổng = (w_kỹ_năng  × Điểm kỹ năng
           + w_tải_việc × Điểm tải việc
           + w_lịch_nghỉ × Điểm lịch nghỉ
           + w_lịch_sử  × Điểm lịch sử làm việc)  ⁄  tổng trọng số của các tín hiệu CÓ dữ liệu
```

Phép chia chỉ trên các tín hiệu ứng viên thực sự có dữ liệu là chi tiết quan trọng: người thiếu dữ liệu không bị phạt oan, và trọng số không buộc phải cộng lại bằng 1.

- **Điểm kỹ năng** — so trình độ với mức yêu cầu (BEGINNER 40 → EXPERT 100, lệch 1 bậc −15, từ 2 bậc −30), cộng thưởng thâm niên, trừ điểm nếu lâu không dùng; bình quân có trọng số theo mức quan trọng (bắt buộc 1,5 / ưu tiên 1,0 / nên có 0,5).
- **Điểm tải việc** — giờ ước tính của công việc đang mở so với sức chứa 40 giờ/tuần; mỗi task quá hạn trừ 10.
- **Điểm lịch nghỉ** — tỉ lệ ngày làm việc của task trùng đơn nghỉ: đã duyệt trừ tối đa 60, chờ duyệt trừ tối đa 25.
- **Điểm lịch sử làm việc** — 60% tỉ lệ xong đúng hạn + 40% hiệu suất giờ (vượt ước tính bị trừ; làm nhanh hơn **không** được cộng, vì giờ thực tế thấp bất thường thường nghĩa là ước tính sai). Hai cơ chế mới bao quanh nó, xem 4.2.

**Bước 1 — hai tầng ràng buộc cứng**, tách hẳn khỏi điểm số và không trọng số nào bù được:

| Tầng | Điều kiện | Hệ quả |
|---|---|---|
| 1 | Thiếu kỹ năng **bắt buộc**, hoặc chưa đạt mức trình độ tối thiểu | Luôn xếp sau mọi ứng viên đủ điều kiện |
| 2 *(mới)* | Nghỉ phép **đã duyệt** phủ quá **50%** số ngày làm việc của task | Luôn xếp sau mọi ứng viên không bị chặn |

Tầng 2 sinh ra từ một quan sát cụ thể: thước đo "task có xong đúng hạn không" **không nhìn thấy** lỗi gợi ý người đang nghỉ nguyên kỳ, vì trong dữ liệu đồng đội thường gánh và task vẫn kịp hạn. Bản sáng chặn lỗi này bằng một *sàn trọng số* nhân tạo trong bộ dò — một cách vá, vì nó ràng buộc công cụ tối ưu thay vì ràng buộc mô hình. Bản chiều đưa nó về đúng chỗ: một tầng cứng trong mô hình, cộng một số hạng riêng trong hàm mục tiêu (4.4). Sàn trọng số đã được gỡ bỏ.

**Bước 3 — cân tải nhóm.** Sau khi xếp hạng, hệ thống đếm số task mỗi người đã nhận trong **14 ngày** gần nhất; ai vượt mức bình quân của nhóm bị trừ tới **10 điểm** theo tỉ lệ vượt. Phạt một chiều: người nhận ít hơn bình quân **không** được cộng điểm, vì thưởng cho người rảnh dễ biến thành ép việc cho người vừa nghỉ ốm về. Đây là hậu xử lý nên không làm hỏng tính giải thích được: bản ghi lưu cả tỉ lệ vượt và số điểm bị trừ.

### 4.2 Khởi đầu nguội: từ vách đứng sang co rút mượt

Bản sáng đặt điểm lịch sử là *null* cho ai có dưới 3 task hoàn thành. Hệ quả: người vừa xong task thứ ba bỗng nhảy vào hoặc rơi ra khỏi tín hiệu mạnh nhất chỉ sau một đêm.

Bản chiều thay bằng **co rút Bayes thực nghiệm về prior của nhóm đồng cấp**:

```
điểm  = c × điểm_của_chính_mình + (1 − c) × prior_đồng_cấp
c     = n / (n + 4)          với n = số task hoàn thành dùng được
prior = trung vị điểm lịch sử của những người cùng cấp bậc nghề nghiệp
```

Cộng thêm **trễ pha 45 ngày**: chỉ task hoàn thành cách đây trên 45 ngày mới được tính vào điểm. Hai tác dụng, một chủ ý và một phụ:

- **Chủ ý — cắt rò rỉ.** Kết quả vừa xảy ra không được phép quay lại làm tín hiệu cho chính quyết định gần đó.
- **Phụ — chống một tuần tồi tệ.** Một task hỏng tuần trước chưa vào điểm; tới lúc vào thì nó chỉ còn là một mục trong nhiều mục. Có test riêng cho tình huống này.

Kết quả đo được trên 2.769 quyết định:

| Chỉ số khởi đầu nguội | Giá trị |
|---|---|
| Tỉ lệ dòng ứng viên thuộc nhóm chưa đủ dữ liệu | 31,7% (5.002/15.778) |
| Được xếp hạng 1 | 16,6% |
| Lọt top 3 | 50,5% |
| **Chưa bao giờ lọt top 3 trong cả kỳ** | **1,4%** |

Chỉ số cuối là cái cần nhìn: gần như không có ai bị hệ thống bỏ quên suốt kỳ chỉ vì chưa có thành tích.

### 4.3 Rò rỉ và kiểm soát âm: phép đo tự kiểm tra chính nó

Đây là phần mới hoàn toàn, chạy bằng `npm run eval:diagnostics`, và là phần nên đọc trước khi tin bất kỳ con số nào khác.

**Vấn đề.** Trong bộ mô phỏng, kết quả task sinh ra từ *năng lực ẩn* của nhân viên; tín hiệu lịch sử lại tính từ chính các kết quả đó; còn thước đo cũng dùng chính các kết quả đó làm nhãn. Nếu để nguyên, mô hình chỉ đang khôi phục một biến nội bộ của bộ mô phỏng rồi gọi đó là năng lực dự báo.

**Đo mức rò rỉ.**

| Phiên bản tín hiệu lịch sử | Tương quan hạng với năng lực ẩn |
|---|---|
| Bản "sạch" — không trễ pha, không co rút | 0,852 |
| **Bản mô hình thực sự thấy** — trễ pha 45 ngày + co rút | **0,585** |

Chênh 0,267 là phần rò rỉ mà hai cơ chế ở 4.2 đã cắt được. Bản "sạch" chỉ tồn tại trong script chẩn đoán; không mô hình nào được thấy nó.

**Kiểm soát âm (shuffled-label test).** Tráo điểm lịch sử giữa các ứng viên *trong cùng một quyết định*, giữ nguyên mọi thứ khác. Nếu mô hình vẫn đạt điểm cao thì nó đang đo một thứ khác chứ không phải chất lượng ứng viên.

| Cấu hình | Phân tách kết quả |
|---|---|
| Mô hình đang chạy | **0,173** |
| Xáo tín hiệu lịch sử | 0,064 |
| Bỏ hẳn tín hiệu lịch sử (trọng số 0) | 0,114 |

**Đạt.** Xáo tín hiệu kéo điểm xuống *thấp hơn cả* mô hình không dùng lịch sử — đúng như kỳ vọng, vì gán nhầm lịch sử của người này cho người kia còn tệ hơn là không biết gì. Phần điểm tăng thêm thực sự đến từ việc ghép đúng lịch sử với đúng người, không phải từ một hiệu ứng thống kê nào khác.

### 4.4 Trọng số: hàm mục tiêu đa mục tiêu

Bốn trọng số nằm trong cấu hình hệ thống, chỉnh được trên màn hình *Cài đặt hệ thống*, và được dò bằng `npm run eval:tune-weights`: tái dựng mọi lần trưởng nhóm giao việc thành một *quyết định* với điểm thành phần **tại đúng thời điểm đó**, chia 70% cũ hơn để dò / 30% mới hơn để kiểm chứng, quét **1.540 bộ trọng số** trên lưới 0,05.

Điểm khác bản sáng: hàm mục tiêu không còn là một chỉ số duy nhất, mà là **tổ hợp có trọng số nghiệp vụ của bốn mục tiêu** — ba mục tiêu sau là thứ hàm cũ hoàn toàn không nhìn thấy:

| Thành phần | Ý nghĩa | Trọng số nghiệp vụ | Chiều tốt |
|---|---|---|---|
| Phân tách kết quả | Hạng trung bình của người thực sự được giao, ở nhóm task trễ trừ nhóm đúng hạn | 1,0 | càng cao càng tốt |
| Vi phạm nghỉ phép | Tỉ lệ lần mô hình đẩy người bị chặn vì nghỉ phép lên #1 | 0,5 | càng thấp càng tốt |
| Lệch tải | Hệ số biến thiên của số task/người, **trừ đi** mức lệch của chính các lead thật, sàn 0 | 0,3 | càng thấp càng tốt |
| Bỏ rơi người mới | Tỉ lệ người chưa đủ dữ liệu không bao giờ lọt top 3 | 0,2 | càng thấp càng tốt |

Bốn trọng số nghiệp vụ này **đặt tay và không được tune** — chúng là phát biểu về điều doanh nghiệp coi trọng, không phải tham số học từ dữ liệu. Đặt chúng ở đây, công khai, tốt hơn là giấu chúng dưới dạng sàn trọng số như bản sáng.

**Kết quả trên 2.769 quyết định (1.938 dò / 831 kiểm chứng), đo trên thứ hạng SAU khi đã cân tải — tức đúng thứ người dùng nhìn thấy:**

| Bộ trọng số (kỹ năng / tải việc / lịch nghỉ / lịch sử) | Tập | Điểm tổng hợp | Phân tách | Vi phạm nghỉ | Lệch tải | Bỏ rơi người mới |
|---|---|---|---|---|---|---|
| **0,10 / 0,15 / 0,10 / 0,65** *(đang chạy)* | dò | 0,044 | 0,138 | 0,5% | 0,305 | 0,0% |
| **0,10 / 0,15 / 0,10 / 0,65** *(đang chạy)* | **kiểm chứng** | **0,126** | **0,197** | **0,4%** | **0,228** | **0,0%** |
| 0,60 / 0 / 0,20 / 0,20 *(tốt nhất trên tập dò)* | dò | 0,070 | 0,093 | 0,3% | 0,062 | 1,4% |
| 0,60 / 0 / 0,20 / 0,20 *(tốt nhất trên tập dò)* | kiểm chứng | 0,033 | 0,078 | 0,3% | 0,146 | 0,0% |

**Kết luận của bộ dò: giữ nguyên trọng số hiện tại.** Bộ "tốt nhất trên tập dò" thắng 0,026 điểm trên chính tập nó được chọn, rồi **thua 0,094 điểm khi sang tập kiểm chứng**. Đó là chân dung sách giáo khoa của khớp nhiễu, và việc script tự in ra rồi tự từ chối áp dụng chính là thứ cần có ở một quy trình thực nghiệm. Mặt mục tiêu quanh đỉnh cũng phẳng (năm bộ tốt nhất chênh nhau 0,003), nên kết quả không phụ thuộc một điểm may mắn.

**Chốt chặn chống kết luận vội:** script từ chối thay đổi trọng số khi dưới 60 quyết định, dưới 20 mẫu kiểm chứng, tập kiểm chứng có dưới 10 task đúng hạn hoặc dưới 10 task trễ, hoặc phần cải thiện dưới ngưỡng 0,05.

### 4.5 Bỏ từng tín hiệu (ablation)

Lấy bộ trọng số đang chạy, lần lượt đặt **đúng một tín hiệu về 0** (phần còn lại tự chuẩn hoá lại), rồi đo lại trên 831 quyết định giữ lại:

| Cấu hình | Điểm tổng hợp | Phân tách | Δ phân tách | Vi phạm nghỉ |
|---|---|---|---|---|
| **Đủ bốn tín hiệu** (0,10 / 0,15 / 0,10 / 0,65) | **0,126** | **0,197** | — | 0,4% |
| Bỏ kỹ năng | 0,120 | 0,198 | +0,001 | 0,5% |
| Bỏ tải việc | 0,105 | 0,187 | −0,009 | 0,4% |
| Bỏ lịch nghỉ | 0,116 | 0,192 | −0,005 | 0,5% |
| **Bỏ lịch sử làm việc** | **0,043** | **0,107** | **−0,090** | 0,3% |

Và nếu chỉ dùng **duy nhất một** tín hiệu:

| Cấu hình | Phân tách kết quả | Tương quan | Chọn đúng người giỏi nhất |
|---|---|---|---|
| Chỉ kỹ năng | 0,037 | 0,140 | 21,5% |
| Chỉ tải việc | 0,122 | 0,203 | 27,3% |
| Chỉ lịch nghỉ | 0,036 | −0,233 | 20,2% |
| **Chỉ lịch sử làm việc** | **0,204** | 0,786 | 37,5% |

**Đọc bảng này cần thận trọng.** Lịch sử vẫn là tín hiệu áp đảo, nhưng có hai khác biệt đáng kể so với bản sáng:

- **Cột "điểm tổng hợp" nay xếp hạng khác cột "phân tách".** Bỏ kỹ năng *nhỉnh hơn* 0,001 về phân tách nhưng **mất** 0,006 điểm tổng hợp, vì vi phạm nghỉ phép tăng. Nói cách khác, hàm mục tiêu đa mục tiêu đã bắt được đúng cái mà hàm một chiều làm ngơ. Đây chính là lý do chuyển sang đa mục tiêu.
- **Khoảng cách "chỉ lịch sử" so với đủ bốn tín hiệu đã thu hẹp**: 0,204 so với 0,197 về phân tách, nhưng kém hẳn về ba mục tiêu còn lại. Ở bản sáng, chỉ dùng lịch sử *thắng* mô hình đủ bốn tín hiệu — một dấu hiệu không lành mạnh mà việc cắt rò rỉ đã xử lý.

Ba tín hiệu còn lại vẫn cần thiết vì lý do thước đo không thấy được: **kỹ năng** đã phát huy tác dụng ở tầng ràng buộc cứng *trước* khi chấm điểm, nên phần đóng góp còn lại chỉ là phân biệt giữa những người *đã* đủ điều kiện; **lịch nghỉ** chặn lỗi nghiệp vụ mà nhãn "đúng hạn" không phản ánh; **tải việc** phục vụ mục tiêu dàn đều, nay đã có mặt trong hàm mục tiêu dưới dạng số hạng *lệch tải*.

### 4.6 So sánh với học máy

Bốn baseline hồi quy logistic (viết tay bằng TypeScript, không thêm thư viện, 5 test) huấn luyện trên **cùng dữ liệu, cùng cách tách tập, cùng ràng buộc cứng**, đo bằng **cùng bộ chỉ số**:

- **Pointwise** — học từ nhãn kết quả thật (*task này có xong đúng hạn không*), xếp hạng theo xác suất dự đoán.
- **Pairwise** — học từ chính lựa chọn của trưởng nhóm (cặp người được giao − người không được giao).

**Trên 831 quyết định giữ lại.** Bảng này đo trên thứ hạng *thô*, trước bước cân tải, để mọi mô hình được so trong cùng một điều kiện:

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất | Trùng lựa chọn của lead |
|---|---|---|---|---|
| **MCDM — đang chạy (0,10/0,15/0,10/0,65)** | **0,206** | **0,857** | **47,1%** | 31,8% |
| ML pointwise — 4 đặc trưng | 0,189 | 0,710 | 43,6% | 33,0% |
| ML pointwise — 10 đặc trưng | 0,170 | 0,739 | 40,6% | 30,7% |
| ML pairwise — 4 đặc trưng | 0,094 | 0,299 | 29,2% | 34,4% |
| ML pairwise — 10 đặc trưng | 0,101 | 0,184 | 22,9% | **41,9%** |

Bốn kết luận:

**1. Mô hình cộng điểm có trọng số hiện nhỉnh hơn học máy 0,016 điểm.** Bản sáng còn kém 0,002; bản chiều dẫn 0,016. Nhưng cách đọc trung thực không phải "MCDM thắng ML" — mà là: với cùng bộ tín hiệu và cùng lượng dữ liệu này, **cách kết hợp tín hiệu không phải chỗ để cải thiện**. Chênh lệch ở cả hai chiều đều nhỏ.

**2. Hệ số mà học máy học được vẫn là công cụ chẩn đoán tốt nhất.** Ở `pointwiseBase`: lịch sử 0,469 · tải việc 0,455 · kỹ năng 0,216 · lịch nghỉ 0,127. So với bản sáng (lịch sử 1,264, kỹ năng 0,008), phân bố nay **đều hơn hẳn** — đúng như mong đợi sau khi rò rỉ bị cắt: khi tín hiệu lịch sử không còn gần như là năng lực ẩn gọi bằng tên khác, các tín hiệu khác lấy lại vai trò của mình.

**3. Bắt chước người ra quyết định không đồng nghĩa với quyết định tốt hơn.** Mô hình pairwise đoán trúng lựa chọn của trưởng nhóm nhiều nhất (41,9% so với 31,8%) nhưng xếp hạng **tệ nhất** theo kết quả thật (0,101). Nó học cả những thói quen dẫn tới task trễ hạn. Đây là lý do hệ thống không tối ưu theo mục tiêu "đồng thuận với quản lý".

**4. Không có dấu hiệu học thuộc dữ liệu**: MCDM đạt 0,161 trên tập huấn luyện so với 0,206 trên tập kiểm chứng; baseline tốt nhất là 0,157 so với 0,189. Cả hai đều *cao hơn* ở tập kiểm chứng, phản ánh đặc điểm của dữ liệu theo thời gian chứ không phải khớp nhiễu.

**Giá của việc cân tải.** So hai bảng: trước cân tải MCDM đạt 0,206 phân tách, sau cân tải còn 0,197. Mất 0,009 điểm phân tách để đổi lấy tải nhóm đều hơn. Đây là một đánh đổi được đo và được công bố, không phải một tính năng âm thầm.

### 4.7 Dò các hằng số còn lại

Bản sáng liệt kê "các hằng số chưa kiểm chứng" như một điểm yếu. `npm run eval:tune-constants` xử lý đúng điểm đó: tìm kiếm ngẫu nhiên 120 lượt cộng một vòng dò từng chiều, trên bốn hằng số — tỉ lệ đúng-hạn/hiệu-suất, độ trễ pha, độ mạnh prior, sức chứa tuần.

Điểm phương pháp quan trọng: **chia ba lát theo thời gian, không phải hai.** Lát đầu để dò, lát giữa để chọn cấu hình, lát cuối **chỉ đọc đúng một lần** để báo cáo. Với hai lát, tập kiểm chứng sẽ bị nhìn 119 lần và mất tư cách kiểm chứng.

| Cấu hình | Tập dò | Tập chọn | **Tập kiểm chứng cuối** |
|---|---|---|---|
| **Đang dùng** — đúng hạn 0,6 · trễ pha 45n · prior 4 · sức chứa 40h | −0,041 | 0,044 | **0,089** |
| Dò được — đúng hạn 0,5 · trễ pha 0n · prior 1 · sức chứa 48h | −0,044 | 0,074 | **0,081** |

**Giữ nguyên.** Cấu hình dò được thắng đậm ở lát giữa rồi thua 0,008 ở lát cuối — lại là khớp nhiễu.

**Và một điểm cần nói thẳng với hội đồng.** Cấu hình tốt nhất trên tập chọn có **trễ pha 0 ngày**, và điều đó là dự đoán được: trễ pha 0 chính là mở lại đúng đường rò rỉ mà mục 4.3 đo được. Hàm mục tiêu không có cách nào tự biết điều này. Giá trị 45 ngày đang dùng vì vậy là **một lựa chọn có chủ ý dựa trên lập luận về tính hợp lệ của phép đo, không phải điểm tối ưu của hàm mục tiêu** — và báo cáo tự động in ra đúng câu đó mỗi lần chạy.

### 4.8 LLM viết lời giải thích

Sau khi xếp hạng xong, NestJS gọi dịch vụ AI để viết lại lý do bằng ngôn ngữ tự nhiên. Ví dụ thật từ hệ thống đang chạy:

> **#1 Mạc Văn Thịnh** — Nhân sự khớp kỹ năng TESTING, thiếu kỹ năng ưu tiên TYPESCRIPT, đang mở 1 task và còn 24,0 giờ trong tuần.
> **#3 Phạm Quang Huy** — Kỹ năng bắt buộc chưa đạt mức yêu cầu, nhân sự khớp kỹ năng TESTING, TYPESCRIPT, đang mở 1 task và còn 28,0 giờ trong tuần.

Bốn ràng buộc giữ cho phần này không làm giảm độ tin cậy:

1. **LLM không xếp hạng và không quyết định gì** — thứ tự, điểm số, bản ghi lưu trữ đều đã cố định trước khi nó được gọi.
2. **Chỉ gửi những trường được phép trích dẫn**; không gửi điểm tổng và điểm thành phần, để câu chữ không viện dẫn con số gây tranh cãi.
3. **Mã cảnh báo dịch sẵn sang tiếng Việt** trước khi gửi — "nghỉ đã duyệt" và "đơn đang chờ duyệt" là hai việc khác nhau.
4. **Lọc đầu ra**: bỏ câu gắn với mã nhân viên không có trong yêu cầu (chống bịa người), bỏ câu trùng, cắt ở 220 ký tự.

Mọi đường lỗi đều trả rỗng và hệ thống giữ nguyên câu giải thích tự sinh bằng mẫu.

### 4.9 Khả năng kiểm toán

Mỗi gợi ý lưu: phiên bản thuật toán (`mcdm-v5`), thời điểm sinh và hết hạn (24 giờ), **vân tay của task**, **bộ trọng số đã dùng**, danh sách ứng viên, và với từng người: bốn điểm thành phần, **độ tin cậy của điểm lịch sử**, **cỡ mẫu lịch sử**, **cờ bị chặn vì nghỉ phép**, **tỉ lệ vượt tải và số điểm bị trừ khi cân tải**. Gọi thử một gợi ý trên hệ thống đang chạy trả về đúng các trường này (ví dụ: `historyConfidence 0,84 · fairShare 1,45 · fairSharePenalty 4,55 · leaveBlocked false`).

Nghĩa là mỗi thứ hạng đều tái dựng được bằng tay từ bản ghi, kể cả phần cân tải. Task bị sửa sau khi sinh gợi ý thì vân tay không khớp và gợi ý tự hết hiệu lực. Mọi thao tác sinh/chọn/hủy đều vào nhật ký kiểm toán.

### 4.10 Đánh giá

**Mạnh.**

- Mọi tham số quan trọng đều có nguồn gốc thực nghiệm, tái lập bằng một lệnh, và **hai bộ dò liên tiếp tự từ chối thay đổi** vì cải thiện không vượt qua được tập kiểm chứng — bằng chứng rằng quy trình có khả năng nói "không".
- Phép đo tự kiểm tra chính nó: rò rỉ được định lượng (0,852 → 0,585), kiểm soát âm đạt.
- Ba việc mà thước đo không nhìn thấy (nghỉ phép, lệch tải, bỏ rơi người mới) được đưa vào hàm mục tiêu và tầng ràng buộc cứng một cách công khai, thay vì vá bằng sàn trọng số.
- Giữ được tính giải thích được từng con số trong khi nhỉnh hơn baseline học máy.
- Con người vẫn là người quyết định cuối; AI chỉ xếp hạng và giải thích.

**Yếu.**

- **Toàn bộ kiểm chứng vẫn dựa trên dữ liệu mô phỏng.** Đây là hạn chế lớn nhất và không khắc phục được trong phạm vi đồ án. Các cơ chế ở 4.2–4.3 làm *giảm* rò rỉ chứ không xoá được nó: tương quan 0,585 với năng lực ẩn vẫn cao hơn thực tế.
- **Vòng phản hồi chưa có dữ liệu**: cơ chế ghi lại lựa chọn của quản lý đã sẵn sàng nhưng hiện 0 lượt, cần tối thiểu 20 lượt thật để mở khóa.
- **Bốn trọng số nghiệp vụ (1 / 0,5 / 0,3 / 0,2) là do người đặt.** Chúng công khai và sửa được, nhưng không có gì trong dữ liệu chứng minh chúng đúng — chúng là phát biểu giá trị, không phải kết quả đo.
- **Cân tải là hậu xử lý tham lam theo từng task**, không phải bài toán ghép cặp tối ưu cho cả nhóm.
- **Ngưỡng 50% của tầng chặn nghỉ phép và cửa sổ 14 ngày của cân tải chưa được dò**, khác với bốn hằng số ở mục 4.7.

---

## 5. Phương pháp và tính toàn vẹn của dữ liệu

Phần này tồn tại vì nó là chỗ dễ bị chất vấn nhất.

- **Dữ liệu không bao giờ vượt quá hiện tại.** Seed neo timeline tại một mốc quá khứ (`SEED_AS_OF`), trình mô phỏng chạy tiếp từ đó tới hôm nay, và tham số `--until` **bị kẹp cứng ở ngày hiện tại** — có unit test riêng cho ràng buộc này. Một bộ dữ liệu chứa ngày chưa xảy ra là lỗi, không phải lựa chọn.
- **Khoảng dữ liệu đánh giá: 02/02/2026 → 20/09/2026** — 2.769 quyết định giao việc tái dựng được, 15.778 dòng ứng viên, 742 task đã kết thúc trong tập kiểm chứng (313 đúng hạn, 429 trễ).
- **Bộ mô phỏng đã được thêm nhiễu.** Mỗi task có hệ số khó riêng, mỗi ngày có hệ số biến động riêng, và mức tập trung của từng người dao động theo ngày. Không có lớp nhiễu này, quan hệ giữa năng lực ẩn và kết quả gần như tất định và mọi số đo đều bị thổi phồng.
- **Tách tập theo thời gian, không ngẫu nhiên.** Ba lát cho phần dò hằng số (dò / chọn / kiểm chứng cuối), hai lát cho phần dò trọng số. Lát cuối chỉ được đọc một lần.
- **Một hàm chấm điểm duy nhất** (`suggestion-scoring.ts`) dùng chung giữa API, bộ dò trọng số, bộ dò hằng số, bộ chẩn đoán và bộ so sánh học máy, nên phép đo offline đo đúng cái đang chạy.
- **Bảy kịch bản xếp hạng có test riêng** — ngôi sao đang nghỉ phép, cả nhóm đều là người mới, ngôi sao bị quá tải, task không khai kỹ năng, một tuần tồi tệ, người mới lên điểm dần, người có thành tích so với người mới. Đây đúng là loại lỗi mà một con số trung bình trên hàng nghìn quyết định có thể che giấu hoàn toàn.
- **Báo cáo tự động ghi cả kết quả bất lợi**: cấu hình thắng trên tập dò rồi thua tập kiểm chứng, cảnh báo cỡ mẫu, lý do từ chối thay đổi, và cảnh báo rằng trễ pha 0 ngày "tốt" vì một lý do sai.

---

## 6. An toàn và riêng tư

| Rủi ro | Biện pháp | Bằng chứng |
|---|---|---|
| LLM bị dụ vượt quyền | Lọc danh sách công cụ theo quyền trước khi gửi; quyền kiểm ở NestJS sau khi LLM đề nghị | 0/10 câu vượt quyền bị lập kế hoạch ghi dữ liệu, ở cả hai lần đo |
| LLM tự ý ghi dữ liệu | Dịch vụ AI không có kết nối CSDL; thao tác ghi phải qua pending action + xác nhận | Kiểm chứng chạy thật mục 3.4 |
| Dữ liệu nhạy cảm lọt ra nhà cung cấp | Lọc lịch sử nhạy cảm; phần giải thích không gửi điểm số | Mục 4.4 |
| LLM bịa người, bịa số | Lọc theo mã nhân viên có trong yêu cầu; mọi con số lấy từ dữ liệu gửi kèm | 5 test riêng cho bộ lọc |
| Nhà cung cấp ngừng phục vụ | Tự quay về bộ lập kế hoạch theo luật | Đo thật ở tỉ lệ 27,5% lượt bị từ chối |
| Lạm dụng chatbot | 20 tin nhắn/phút mỗi người, chia sẻ qua Redis | — |

---

## 7. Quy mô và mức độ kiểm thử

| | Số liệu |
|---|---|
| Công cụ chatbot | 23, trong đó 3 công cụ ghi cần xác nhận |
| Tài liệu chính sách cho RAG | 4 |
| Bộ dữ liệu đánh giá planner | 4 bộ, 271 câu + 79 câu hồi quy |
| Quyết định giao việc tái dựng được | 2.769 (15.778 dòng ứng viên) |
| Bộ trọng số đã quét (đơn hình 4 chiều) | 1.540 |
| Cấu hình hằng số đã thử (tìm kiếm ngẫu nhiên + dò từng chiều) | 119 |
| Mô hình học máy đã huấn luyện và so sánh | 4 |
| Cấu hình đã đo trong ablation | 9 (đủ bốn tín hiệu + bỏ từng tín hiệu + chỉ dùng từng tín hiệu) |
| Phép kiểm tra tính hợp lệ của thước đo | 3 (rò rỉ, kiểm soát âm, khởi đầu nguội) |
| Kiểm thử tự động backend | 201 test |
| Kiểm thử tự động dịch vụ AI | 50 test + 79 subtest |
| Kiểm thử tự động web | 32 test |
| Kiểm thử tự động mobile | 8 test |
| Dịch vụ được CI kiểm tra tự động | 4/4 (backend, web, AI, mobile) |

Toàn bộ số liệu trên được chạy lại vào ngày lập báo cáo; cả bốn bộ kiểm thử đều xanh.

---

## 8. Cách tái lập các số liệu

```bash
# Chatbot
cd OmniHR_AI
python scripts/evaluate_planner.py --mode hybrid --cases test
python scripts/evaluate_planner.py --mode rule_based --cases dev2

# Gợi ý giao việc — chạy trên CSDL mô phỏng (omnihr_eval), toàn bộ chỉ đọc
cd OmniHR_BE
npm run eval:diagnostics    -- --from 2026-02-02   # rò rỉ + kiểm soát âm + khởi đầu nguội
npm run eval:tune-weights   -- --from 2026-02-02   # trọng số + ablation (thêm --apply để ghi)
npm run eval:tune-constants -- --from 2026-02-02   # bốn hằng số, ba lát thời gian
npm run eval:ml-baseline    -- --from 2026-02-02   # so sánh với học máy
npm run eval:suggestions                            # thống kê replay cơ bản
```

Thứ tự đọc nên là `eval:diagnostics` **trước**: nếu kiểm soát âm không đạt thì mọi con số của bốn lệnh còn lại đều không có ý nghĩa.

Báo cáo sinh ra nằm trong `OmniHR_AI/eval_results/` và `OmniHR_BE/eval_results/`.

---

## 9. Việc cần làm tiếp

**Trước khi bảo vệ**

1. **Chuẩn bị câu trả lời cho ba câu hỏi chắc chắn bị hỏi:**
   - *"Vì sao trọng số kỹ năng chỉ 0,1?"* — vì ràng buộc cứng đã lọc kỹ năng trước; trọng số chỉ còn việc phân biệt giữa những người **đã** đủ kỹ năng.
   - *"Dữ liệu mô phỏng thì kết luận có giá trị gì?"* — kết luận là về *thuật toán có bắt được tín hiệu hay không*, và toàn bộ phương pháp đo áp nguyên trạng lên dữ liệu thật khi có.
   - *"Điểm hôm nay thấp hơn hôm qua, vậy là kém đi?"* — không: tín hiệu mạnh nhất đã bị **cố ý làm yếu đi** để cắt rò rỉ, và dữ liệu được sinh lại với nhiều nhiễu hơn. Mục 4.3 là câu trả lời đầy đủ.
2. Nâng hạn mức LLM hoặc thêm cơ chế đợi–thử lại khi gặp 429, để số liệu demo không rơi vào vùng 90%.

**Nếu còn thời gian**

3. Tích lũy ≥20 lượt quản lý chọn gợi ý để mở khóa hàm mục tiêu dựa trên phản hồi thật — đây là cách duy nhất thoát khỏi phụ thuộc vào dữ liệu mô phỏng.
4. Đưa nốt hai hằng số chưa dò (ngưỡng 50% của tầng chặn nghỉ phép, cửa sổ 14 ngày của cân tải) vào `eval:tune-constants`.
5. ~~Đưa các hằng số còn lại vào quy trình dò~~ — đã xong: `npm run eval:tune-constants`, ba lát thời gian, kết luận giữ nguyên cấu hình hiện tại.
6. ~~Bổ sung `flutter analyze` + `flutter test` vào CI~~ — đã xong: CI chạy `flutter pub get`, `dart format --set-exit-if-changed`, `flutter analyze` và `flutter test` trên phiên bản Flutter được ghim cứng.

**Hướng phát triển**

7. Thay cân tải tham lam bằng thuật toán ghép cặp tối ưu cho cả nhóm (bài toán gán, Hungarian) thay vì tối ưu từng task.
8. Cho mô hình tự dò lại trọng số theo lịch khi dữ liệu tích lũy đủ, thay vì chạy script thủ công — kèm điều kiện chỉ áp dụng khi vượt ngưỡng cải thiện trên tập kiểm chứng, đúng như hai lần chạy vừa rồi đã từ chối.
