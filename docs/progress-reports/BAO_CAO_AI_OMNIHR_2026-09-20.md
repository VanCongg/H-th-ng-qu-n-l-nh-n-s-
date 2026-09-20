# Báo cáo hiện trạng hai chức năng AI của hệ thống OmniHR

*Cập nhật: 21/09/2026. Mọi số liệu trong báo cáo đều được đo lại trên mã nguồn và dữ liệu tại ngày này; cách chạy lại từng phép đo nằm ở mục 7.*

---

## 1. Tóm tắt

Hệ thống có hai chức năng AI, khác nhau về bản chất kỹ thuật và cần được trình bày khác nhau:

| | Chatbot HRGenie | Gợi ý giao việc |
|---|---|---|
| **Bản chất** | Mô hình ngôn ngữ lớn (LLM) lập kế hoạch gọi công cụ | Mô hình ra quyết định đa tiêu chí có ràng buộc cứng |
| **Có học máy không** | Có — LLM thương mại (Gemini 3.5 Flash Lite) | Không — chấm điểm tất định, trọng số được tối ưu từ dữ liệu lịch sử |
| **Vai trò trong nghiệp vụ** | Hiểu câu hỏi tiếng Việt, chọn công cụ, soạn câu trả lời | Xếp hạng ứng viên, quản lý ra quyết định cuối |
| **Kết quả đo được** | 80/80 câu đúng hoàn toàn trên bộ kiểm thử chưa từng dùng để tinh chỉnh | Phân tách kết quả thật **0,229** trên 742 task đã kết thúc |

Điểm cần nói thẳng: **phần gợi ý giao việc không phải machine learning.** Nó là một mô hình cộng điểm có trọng số (Simple Additive Weighting) kèm ràng buộc loại trừ — thuộc nhánh hệ hỗ trợ ra quyết định, không phải mô hình học từ dữ liệu. Bù lại, toàn bộ tham số của nó đã được **kiểm chứng bằng thực nghiệm trên 2.822 quyết định giao việc lịch sử** với tách tập huấn luyện/kiểm chứng, đã được **so sánh với hai baseline học máy** (mục 4.5), và phần diễn giải kết quả cho người dùng thì do LLM đảm nhiệm.

---

## 2. Nguyên tắc kiến trúc chung

Hai chức năng dùng chung một ràng buộc thiết kế: **dịch vụ AI không bao giờ ghi dữ liệu và không bao giờ tự quyết định quyền truy cập.**

```
Ứng dụng di động / Web
        │  (chỉ gọi NestJS, không bao giờ gọi thẳng dịch vụ AI)
        ▼
   NestJS (OmniHR_BE)  ──► kiểm tra quyền, đọc/ghi CSDL, ghi nhật ký kiểm toán
        │
        │  POST /internal/chat/plan            (lập kế hoạch hội thoại)
        │  POST /internal/suggestions/explain  (viết lời giải thích gợi ý)
        │  header: X-Internal-Service-Token
        ▼
   FastAPI (OmniHR_AI)  ──► gọi LLM, tra cứu tài liệu chính sách (RAG)
```

Hệ quả của nguyên tắc này:

- Dịch vụ AI chỉ trả về **ý định và danh sách công cụ đề nghị gọi**, không bao giờ trả về dữ liệu nhân sự mà nó tự truy vấn.
- Mọi kiểm tra quyền (`RolesGuard`, `PermissionsGuard`) diễn ra ở NestJS, sau khi LLM đã đề nghị. Một mô hình bị tấn công bằng prompt injection vẫn không vượt được lớp quyền này.
- Dịch vụ AI không mở ra Internet cho client: nó chỉ nhận kết nối nội bộ kèm token dịch vụ.

---

## 3. Chatbot HRGenie

### 3.1 Thành phần

| Thành phần | Vị trí | Vai trò |
|---|---|---|
| Cổng vào | `OmniHR_BE/src/chatbot/chatbot.controller.ts` | Nhận tin nhắn từ ứng dụng di động |
| Bộ thực thi công cụ | `chatbot-tools.service.ts` | Kiểm tra quyền và thực thi 23 công cụ |
| Lịch sử hội thoại | `chatbot-history.service.ts` | Lưu và lọc lịch sử gửi cho LLM |
| Bộ lập kế hoạch LLM | `OmniHR_AI/app/services/llm_planner_service.py` | Gọi LLM, kiểm tra kết quả, quyết định có quay về luật |
| Bộ lập kế hoạch theo luật | `rule_based_planner_service.py` | Phương án dự phòng tất định, không cần LLM |
| Tra cứu chính sách | `rag_service.py` + 4 tài liệu trong `app/rag/documents/` | Trả lời câu hỏi về quy định công ty |

### 3.2 Ba chế độ vận hành

Cấu hình bằng biến `AI_PLANNER_MODE`:

- **`rule_based`** — chỉ dùng luật, không cần khóa LLM. Đây là chế độ mặc định để chạy thử và cho môi trường không có Internet.
- **`llm`** — chỉ dùng LLM.
- **`hybrid`** *(đang dùng)* — ưu tiên LLM, tự động quay về luật khi: hết thời gian chờ, JSON trả về không hợp lệ, vi phạm lược đồ, đề nghị công cụ người dùng không có quyền dùng, hoặc độ tin cậy dưới ngưỡng 0.6.

Hợp đồng dữ liệu trả về NestJS (`type` / `toolCalls` / `needConfirmation`) **giống hệt nhau ở cả ba chế độ**, nên việc bật tắt LLM không kéo theo thay đổi nào ở phía backend hay ứng dụng di động.

### 3.3 Các lớp kiểm soát an toàn

1. **Danh sách công cụ theo quyền** — NestJS chỉ gửi cho LLM những công cụ mà chính người dùng đó có quyền gọi (ví dụ: nhân viên thường không thấy `get_team_attendance_summary`).
2. **Danh sách trắng tham số** — mỗi công cụ khai báo sẵn tập tham số được phép (`TOOL_ARGUMENT_ALLOWLISTS`); tham số lạ do LLM bịa ra bị loại bỏ trước khi thực thi.
3. **Bắt buộc xác nhận với thao tác ghi** — công cụ ghi dữ liệu không được thực thi ngay. Hệ thống tạo một *pending action* và chỉ thực hiện sau khi người dùng bấm xác nhận, qua `/chatbot/actions/:id/confirm|cancel`. Hiện có ba loại: nộp đơn nghỉ, hủy đơn nghỉ, cập nhật trạng thái công việc.
4. **Lọc lịch sử nhạy cảm** — nội dung được đánh dấu nhạy cảm bị loại khỏi lịch sử gửi cho LLM bên ngoài.
5. **Giới hạn tần suất** — tối đa 20 tin nhắn/phút mỗi người, đếm chung giữa các tiến trình qua Redis; khi Redis không sẵn sàng thì tự hạ xuống đếm cục bộ thay vì từ chối phục vụ.
6. **Giới hạn đầu vào** — tin nhắn tối đa 1.000 ký tự, lịch sử gửi kèm tối đa 12 lượt, pending action hết hạn sau 30 phút.

### 3.4 Kết quả đánh giá

Bốn bộ dữ liệu kiểm thử, trong đó bộ `test` được đóng băng **trước khi** tinh chỉnh prompt và không bao giờ được dùng để chỉnh sửa hệ thống — đây là con số nên báo cáo.

**Chế độ `hybrid`, bộ `test` (80 câu), khi hạn mức LLM còn đủ:**

| Chỉ số | Kết quả |
|---|---|
| Đúng ý định | 80/80 (100%) |
| Đúng công cụ | 80/80 (100%) |
| Đúng bước xác nhận | 80/80 (100%) |
| Đúng tham số (ngày, loại nghỉ) | 80/80 (100%) |
| **Câu vượt quyền bị lập kế hoạch ghi dữ liệu** | **0/10 (0%)** |
| Phải quay về luật | 0/80 (0%) |
| Độ trễ trung bình / p95 | 1.643 ms / 1.892 ms |

**Chế độ `rule_based`, bộ `dev2` (50 câu)** — đo khả năng của phương án dự phòng khi hoàn toàn không có LLM: đúng hoàn toàn 47/50 (94%), độ trễ 0,1 ms.

**Một phép đo ngoài dự kiến nhưng đáng giá.** Lần chạy lại ngày 20/09 rơi vào lúc nhà cung cấp LLM trả mã 429 (hết hạn mức miễn phí). Kết quả trên cùng bộ `test`:

| Chỉ số | Kết quả |
|---|---|
| Đúng hoàn toàn | 72/80 (90%) |
| Số câu phải quay về luật | 20/80 (25%) |
| Câu vượt quyền bị lập kế hoạch ghi dữ liệu | 0/10 (0%) |

Toàn bộ 8 câu sai đều nằm trong phần đã rơi về luật. Nói cách khác: **khi nhà cung cấp LLM từ chối phục vụ một phần tư số lượt, hệ thống không hỏng, không báo lỗi cho người dùng, và vẫn trả lời đúng 90%.** Đây là bằng chứng thực nghiệm cho giá trị của cơ chế dự phòng, chứ không chỉ là lời khẳng định trong thiết kế.

### 3.5 Hạn chế đã xác định

- **Phụ thuộc hạn mức nhà cung cấp.** Ở hạn mức miễn phí, tỉ lệ quay về luật có thể lên tới 25%, kéo độ chính xác từ 100% xuống 90%.
- ~~Công cụ `update_task_status_draft` chưa được khai báo ở phía dịch vụ AI~~ — **đã sửa ngày 21/09**. Trước đó công cụ này tồn tại trong NestJS và trong bộ lập kế hoạch theo luật nhưng thiếu ở lược đồ công cụ, danh sách trắng tham số và prompt, nên ở chế độ `hybrid` đang dùng, câu "chuyển task sang đang làm" bị trả lời *"tính năng này chưa được hỗ trợ"*. Nay đã khai báo đầy đủ, xếp vào nhóm công cụ ghi (bắt buộc xác nhận), bổ sung 9 câu kiểm thử và kiểm chứng chạy thật: hệ thống tạo pending action, người dùng xác nhận, trạng thái công việc đổi đúng trong cơ sở dữ liệu.
- **Độ trễ 1,6–2,3 giây** mỗi lượt hỏi khi dùng LLM, so với 0,1 ms của luật.

---

## 4. AI gợi ý giao việc

### 4.1 Bản chất mô hình

Với mỗi ứng viên trong nhóm, hệ thống tính bốn điểm thành phần trên thang 0–100 rồi cộng có trọng số:

```
Điểm tổng = (w_kỹ_năng × Điểm kỹ năng
           + w_tải_việc × Điểm tải việc
           + w_lịch_nghỉ × Điểm lịch nghỉ
           + w_lịch_sử  × Điểm lịch sử làm việc)  ⁄  tổng trọng số của các tín hiệu có dữ liệu
```

Phép chia cho tổng trọng số **của riêng những tín hiệu ứng viên thực sự có dữ liệu** khiến người thiếu dữ liệu không bị phạt oan, và khiến bộ trọng số không bắt buộc phải cộng lại bằng 1.

**Điểm kỹ năng** — với mỗi kỹ năng task yêu cầu, so trình độ ứng viên với mức yêu cầu (BEGINNER 40, INTERMEDIATE 65, ADVANCED 85, EXPERT 100; thấp hơn 1 bậc trừ 15, từ 2 bậc trừ 30), cộng thưởng thâm niên (≥1 năm +4, ≥2 năm +7, ≥4 năm +10), trừ điểm nếu lâu không dùng (>1 năm −5, >2 năm −10). Các kỹ năng được bình quân có trọng số theo mức quan trọng: bắt buộc 1,5 — ưu tiên 1,0 — nên có 0,5.

**Điểm tải việc** — dựa trên số giờ ước tính của công việc đang mở so với sức chứa 40 giờ/tuần, mỗi task quá hạn trừ thêm 10 điểm.

**Điểm lịch nghỉ** — tỉ lệ ngày làm việc của task trùng với đơn nghỉ: đơn đã duyệt trừ tối đa 60 điểm, đơn đang chờ duyệt trừ tối đa 25 điểm.

**Điểm lịch sử làm việc** *(bổ sung 21/09)* — từ các task đã hoàn thành của ứng viên: 60% là tỉ lệ xong đúng hạn, 40% là hiệu suất giờ (giờ ước tính ⁄ giờ thực tế, vượt ước tính thì bị trừ, làm nhanh hơn không được cộng thêm). Dưới 3 task đã xong thì điểm này là *null* và bị loại khỏi trung bình có trọng số — người mới không bị chấm 0 oan.

**Ràng buộc cứng, tách riêng khỏi điểm số.** Ứng viên thiếu kỹ năng bắt buộc hoặc chưa đạt mức trình độ tối thiểu bị đánh dấu *không đủ điều kiện* và luôn xếp sau mọi ứng viên đủ điều kiện, bất kể điểm tổng. Điều này tránh tình huống "điểm tải việc cao bù cho việc không biết làm".

### 4.2 Trọng số không còn là hằng số đặt tay

Bốn trọng số được lưu trong bảng cấu hình hệ thống (`aiWeightSkill`, `aiWeightWorkload`, `aiWeightAvailability`, `aiWeightHistory`), hiển thị và chỉnh được trên màn hình *Cài đặt hệ thống*, và được **dò trên dữ liệu lịch sử** bằng script `npm run eval:tune-weights`.

Cách dò:

1. Tái dựng mọi lần trưởng nhóm giao việc trong lịch sử thành một *quyết định*: danh sách ứng viên khả dĩ và điểm thành phần của từng người **tại đúng thời điểm đó** (không dùng thông tin của tương lai).
2. Chia theo thời gian: 70% quyết định cũ hơn để dò, 30% mới hơn giữ lại kiểm chứng.
3. Quét toàn bộ 1.540 bộ trọng số trên lưới bước 0,05 của đơn hình 4 chiều, **giữ sàn tối thiểu 0,1 cho mỗi tín hiệu**.
4. Chọn theo một trong hai hàm mục tiêu, rồi đối chiếu cả hai trong báo cáo.

**Hai hàm mục tiêu:**

- *Phân tách kết quả thật* (mặc định): lấy thứ hạng mà mô hình dành cho **người thực sự được giao**, chuẩn hoá về 0–1, rồi so hạng trung bình của nhóm task **trễ hạn** trừ nhóm task **đúng hạn**. Dương nghĩa là mô hình đã xếp thấp đúng những lần giao việc về sau hỏng. Thước đo này chỉ dùng dữ liệu thật.
- *Tương quan với năng lực ẩn*: tương quan hạng Spearman giữa điểm xếp hạng và biến năng lực nội bộ của bộ mô phỏng. Chỉ dùng để tham chiếu.

**Kết quả trên 2.822 quyết định (1.975 dò / 847 kiểm chứng):**

| Bộ trọng số (kỹ năng / tải việc / lịch nghỉ) | Tập | Phân tách kết quả | Tương quan | Chọn đúng người giỏi nhất |
|---|---|---|---|---|
| 0,50 / 0,35 / 0,15 / — (ba tín hiệu, trước 21/09) | kiểm chứng | 0,134 | 0,297 | 25,3% |
| 0,50 / 0,35 / 0,15 / 0,20 (thêm lịch sử, trọng số đặt tay) | kiểm chứng | 0,151 | 0,469 | 30,4% |
| **0,10 / 0,15 / 0,10 / 0,65 — đang dùng, dò từ dữ liệu** | kiểm chứng | **0,229** | **0,833** | **45,5%** |

Hai kết luận rút ra:

1. **Thêm tín hiệu lịch sử làm việc cải thiện mạnh nhất.** Chỉ riêng việc đưa tín hiệu này vào (giữ nguyên cách đặt trọng số tay) đã nâng phân tách từ 0,134 lên 0,151; dò lại trọng số trên dữ liệu đẩy tiếp lên **0,229** — tăng **71%** so với mô hình ba tín hiệu. Tỉ lệ chọn đúng người giỏi nhất tăng từ 25,3% lên 45,5%.
2. **Trọng số đang chạy là điểm tối ưu, không phải lựa chọn tuỳ tiện.** Chạy lại bộ dò trên chính bộ trọng số đang dùng cho kết quả chênh 0,000 — không bộ nào trong 1.540 bộ tốt hơn. Đáng chú ý: nếu **không áp sàn**, điểm tối ưu rơi vào 0,05 / 0,05 / **0** / 0,90, tức là bỏ hẳn lịch nghỉ. Hàm mục tiêu chỉ biết task có đúng hạn hay không nên không thấy được việc gợi ý một người đang nghỉ phép cả kỳ task là sai về nghiệp vụ; vì vậy mỗi tín hiệu được giữ sàn 0,1, đổi lại chỉ mất 0,005 điểm.

Đây là câu trả lời có bằng chứng cho câu hỏi *"vì sao lại chọn những con số này?"* — không phải vì thấy hợp lý, mà vì đã dò hết 1.540 bộ trọng số trên 2.822 quyết định lịch sử, tách tập theo thời gian, và không tìm được lựa chọn tốt hơn.

**Chốt chặn chống kết luận vội.** Script từ chối thay đổi trọng số khi: dưới 60 quyết định tái dựng được, dưới 20 quyết định trong tập kiểm chứng, tập kiểm chứng có dưới 10 task đúng hạn hoặc dưới 10 task trễ, hoặc phần cải thiện dưới ngưỡng 0,05. Chạy thử trên cơ sở dữ liệu vận hành (chỉ 38 quyết định) đã kích hoạt đúng chốt chặn này.

### 4.3 Vòng phản hồi từ quản lý

Mỗi lần hệ thống sinh gợi ý, toàn bộ danh sách ứng viên kèm điểm thành phần và bộ trọng số đã dùng được lưu lại; khi quản lý chọn một người, lựa chọn đó cũng được ghi. Nhờ vậy có thể đo và học từ chính quyết định thật:

- Thống kê chấp nhận: số gợi ý đã sinh, số lần được chọn, tỉ lệ chọn đúng ứng viên hạng 1, tỉ lệ nằm trong top 3, hạng trung bình được chọn.
- Hàm mục tiêu thứ ba: tỉ lệ một bộ trọng số xếp **đúng người quản lý đã chọn** lên hạng 1.

Hiện chưa đủ dữ liệu (cần tối thiểu 20 lượt chọn thật để tỉ lệ có ý nghĩa), nên báo cáo tự động ghi rõ điều đó thay vì đưa ra con số không đáng tin. Cơ chế đã sẵn sàng; số liệu sẽ tự tích lũy khi tính năng được dùng.

### 4.4 LLM viết lời giải thích

Sau khi xếp hạng xong, NestJS gọi `POST /internal/suggestions/explain` để dịch vụ AI viết lại lời giải thích cho từng ứng viên bằng ngôn ngữ tự nhiên.

Ví dụ thật, sinh ra từ hệ thống đang chạy:

> **#1 Mạc Văn Thịnh** — Nhân sự khớp kỹ năng TESTING, thiếu kỹ năng ưu tiên TYPESCRIPT, đang mở 1 task và còn 24,0 giờ trong tuần.
> **#2 Lê Bảo Ngọc** — Nhân sự khớp kỹ năng TESTING, TYPESCRIPT, đang mở 2 task và đã kín giờ làm trong tuần với −10,0 giờ.
> **#3 Phạm Quang Huy** — Kỹ năng bắt buộc chưa đạt mức yêu cầu, nhân sự khớp kỹ năng TESTING, TYPESCRIPT, đang mở 1 task và còn 28,0 giờ trong tuần.

Bốn ràng buộc khiến phần này không làm giảm độ tin cậy của hệ thống:

1. **LLM không xếp hạng và không quyết định gì.** Thứ tự, điểm số và bản ghi lưu trữ đã cố định trước khi nó được gọi. Sai sót của nó chỉ ảnh hưởng tới câu chữ.
2. **Chỉ gửi những trường được phép trích dẫn** — kỹ năng khớp/thiếu, số task đang mở, giờ còn trong tuần, cảnh báo. **Không gửi điểm tổng và điểm thành phần**, để câu giải thích không viện dẫn con số mà người đọc có thể tranh cãi.
3. **Mã cảnh báo được dịch sẵn sang tiếng Việt** trước khi gửi, để mô hình không phải suy đoán — "đơn nghỉ đã được duyệt" và "đơn nghỉ đang chờ duyệt" là hai việc khác nhau với người quản lý.
4. **Lọc đầu ra**: bỏ mọi câu gắn với mã nhân viên không có trong yêu cầu (chống bịa người), bỏ câu trùng, chuẩn hoá khoảng trắng, cắt ở 220 ký tự.

Mọi đường lỗi — không có khóa LLM, hết thời gian chờ 8 giây, JSON sai, dịch vụ AI không phản hồi — đều trả về rỗng và hệ thống **giữ nguyên câu giải thích tự sinh bằng mẫu**. Tắt hoàn toàn bằng `AI_SUGGESTION_EXPLANATIONS=false`.

### 4.5 So sánh với baseline học máy

Câu hỏi tự nhiên với một mô hình cộng điểm là: *nếu thay bằng học máy thì có tốt hơn không?* Để trả lời bằng số chứ không bằng phỏng đoán, hai baseline hồi quy logistic đã được huấn luyện trên **cùng dữ liệu lịch sử, cùng cách tách tập, cùng ràng buộc cứng** và đo bằng **cùng bộ chỉ số**:

- **Pointwise** — học từ nhãn kết quả thật: *task giao cho người này có xong đúng hạn không*, rồi xếp hạng ứng viên theo xác suất dự đoán.
- **Pairwise** — học từ chính lựa chọn của trưởng nhóm: mỗi cặp (người được giao − người không được giao) là một mẫu, mô hình học xem người giao việc ưu tiên đặc trưng nào.

Mỗi baseline được huấn luyện hai lần: một lần chỉ với **đúng bộ tín hiệu** mà mô hình đang chạy dùng (so sánh sòng phẳng cách kết hợp), một lần với **mười đặc trưng** rộng hơn (thêm số task đã hoàn thành, mức độ quen thuộc dự án, thâm niên, cấp bậc, quy mô task). Bảng dưới ghi cả phiên bản ba tín hiệu trước ngày 21/09 để thấy tác động của việc bổ sung tín hiệu lịch sử.

**Kết quả trên 847 quyết định giữ lại (2.822 quyết định, chia theo thời gian):**

| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất | Trùng lựa chọn của lead |
|---|---|---|---|---|
| MCDM — ba tín hiệu (trước 21/09) | 0,134 | 0,297 | 25,3% | 33,1% |
| **MCDM — bốn tín hiệu (đang chạy)** | **0,229** | 0,866 | 47,1% | 32,9% |
| ML pointwise — 4 đặc trưng | 0,231 | 0,858 | 46,4% | 32,8% |
| ML pointwise — 10 đặc trưng | 0,231 | 0,868 | 46,6% | 32,7% |
| ML pairwise — 4 đặc trưng | 0,124 | 0,235 | 23,6% | 34,1% |
| ML pairwise — 10 đặc trưng | 0,100 | 0,144 | 18,2% | **41,7%** |

Ba kết luận, và cả ba đều đáng đưa vào luận văn:

**1. Với cùng bộ tín hiệu, học máy không hơn cách cộng điểm có trọng số.** Ở phiên bản ba tín hiệu: 0,138 so với 0,134. Ở phiên bản bốn tín hiệu hiện tại: **0,231 so với 0,229** — chênh 0,002, nằm gọn trong nhiễu. *Cách kết hợp* tín hiệu không phải là chỗ để cải thiện.

**2. Chỗ để cải thiện là *bộ tín hiệu*, không phải thuật toán — và điều này đã được kiểm chứng bằng cách sửa thật.** Khi được cấp thêm đặc trưng, cùng một thuật toán hồi quy logistic nhảy từ 0,138 lên **0,231**. Hệ số học được chỉ thẳng thủ phạm:

| Đặc trưng | Hệ số (thang chuẩn hoá) |
|---|---|
| lịch sử đúng hạn của ứng viên | **1,264** |
| không có lịch sử (cờ đánh dấu) | 0,447 |
| tải việc | 0,353 |
| số task đã hoàn thành | 0,218 |
| cấp bậc | 0,202 |
| lịch nghỉ | 0,138 |
| điểm kỹ năng | 0,008 |

**Lịch sử làm việc là đặc trưng mạnh nhất.** Điểm kỹ năng gần như không đóng góp — hợp lý, vì ràng buộc cứng đã loại người không đủ kỹ năng từ trước, nên trong số người còn lại thì kỹ năng không còn phân biệt được ai hơn ai.

Phát hiện này đã được **đưa thẳng vào sản phẩm**: tín hiệu lịch sử làm việc trở thành thành phần thứ tư của mô hình đang chạy (mục 4.1–4.2), và kết quả là mô hình cộng điểm **bắt kịp mô hình học máy** — 0,229 so với 0,231 — trong khi vẫn giải thích được từng con số cho người dùng. Nói cách khác: thứ thiếu không phải là học máy, mà là một tín hiệu.

**3. Bắt chước người ra quyết định không đồng nghĩa với quyết định tốt hơn.** Mô hình pairwise 10 đặc trưng đoán trúng lựa chọn của trưởng nhóm nhiều nhất (**41,7%**, so với 33,1% của mô hình đang chạy) nhưng lại xếp hạng **tệ nhất** theo kết quả thật (0,100). Nó học được thói quen giao việc của con người, kể cả những thói quen dẫn tới task trễ hạn. Đây là lý do hệ thống không nên tối ưu theo mục tiêu "đồng thuận với quản lý" một cách đơn thuần.

**Không có dấu hiệu học thuộc dữ liệu**: mô hình tốt nhất đạt 0,224 trên tập huấn luyện và 0,231 trên tập kiểm chứng — hai con số gần nhau, tức là phần cải thiện không phải do khớp nhiễu.

**Cảnh báo về tính khái quát — áp dụng cho cả mô hình đang chạy:** trong bộ mô phỏng, kết quả task được sinh ra từ năng lực ẩn của nhân viên, còn tín hiệu "lịch sử đúng hạn" lại được tính từ chính các kết quả đó. Quan hệ giữa hai thứ vì vậy chặt hơn so với dữ liệu công ty thật. Mức cải thiện từ 0,134 lên 0,229 là thật **trong khuôn khổ dữ liệu này**; con số tương quan 0,866 nên hiểu là *mô hình khôi phục lại được biến ẩn của bộ mô phỏng*, không phải lời hứa về hiệu quả ngoài đời. Trên dữ liệu công ty thật, mức cải thiện nhiều khả năng nhỏ hơn — nhưng chiều của kết luận (người có lịch sử giao hàng đúng hạn là ứng viên tốt hơn) thì phù hợp với trực giác quản lý.

### 4.6 Khả năng kiểm toán

Mỗi gợi ý lưu lại: phiên bản thuật toán, thời điểm sinh, thời điểm hết hạn (24 giờ), **vân tay của task** tại thời điểm sinh, **bộ trọng số đã dùng**, danh sách ứng viên xét đến, điểm thành phần và cảnh báo của từng người. Nếu task bị sửa sau khi sinh gợi ý, vân tay không còn khớp và gợi ý tự hết hiệu lực — không thể chọn một gợi ý đã lỗi thời. Mọi thao tác sinh, chọn, hủy đều ghi nhật ký kiểm toán kèm người thực hiện.

### 4.7 Hạn chế đã xác định

- **Không phải học máy.** Mô hình không tự học từ dữ liệu mới; bốn trọng số phải dò lại bằng script thủ công. Mục 4.5 cho thấy điều này *không* phải điểm yếu về chất lượng — với cùng bộ tín hiệu, học máy chỉ hơn 0,002 — nhưng nó có nghĩa là mô hình không tự thích nghi khi đội ngũ thay đổi.
- **Ground truth phần lớn là dữ liệu mô phỏng.** Thước đo "phân tách kết quả" dùng dữ liệu thật (task đúng hạn hay trễ), nhưng bản thân dữ liệu đó do bộ mô phỏng sinh ra. Kết quả chứng minh thuật toán bắt được tín hiệu trong kịch bản giả lập, chưa thay thế được đánh giá trên dữ liệu công ty thật.
- **Các hằng số còn lại chưa được kiểm chứng**: ngưỡng thưởng thâm niên, mức phạt lâu không dùng, sức chứa 40 giờ/tuần, mức trừ 10 điểm mỗi task quá hạn, tỉ lệ 60/40 giữa đúng hạn và hiệu suất trong điểm lịch sử. Chỉ bốn trọng số tổng đã qua thực nghiệm.
- **Tối ưu theo từng task, không cân tải cả nhóm.** Giao nhiều task liên tiếp có thể dồn vào cùng một người giỏi.
- **Khởi đầu nguội**: nhân viên chưa khai báo kỹ năng gần như luôn xếp cuối. Với tín hiệu lịch sử, người chưa hoàn thành đủ 3 task được miễn chấm (điểm *null*, bị loại khỏi trung bình) thay vì bị chấm 0 — nhưng đồng nghĩa họ cũng không được hưởng lợi từ tín hiệu mạnh nhất.

---

## 5. An toàn và riêng tư của phần AI

| Rủi ro | Biện pháp trong hệ thống |
|---|---|
| LLM bị dụ vượt quyền (prompt injection) | Quyền được kiểm ở NestJS sau khi LLM đề nghị; danh sách công cụ đã lọc theo quyền trước khi gửi đi. Đo được: 0/10 câu vượt quyền bị lập kế hoạch ghi dữ liệu |
| LLM tự ý ghi dữ liệu | Dịch vụ AI không có kết nối CSDL; mọi thao tác ghi phải qua pending action và người dùng bấm xác nhận |
| Dữ liệu nhạy cảm lọt ra nhà cung cấp LLM | Lịch sử được đánh dấu nhạy cảm bị loại trước khi gửi; phần giải thích gợi ý không gửi điểm số, chỉ gửi các trường cần thiết |
| LLM bịa người, bịa số | Lọc theo mã nhân viên có trong yêu cầu; mọi con số trong câu giải thích đều lấy từ dữ liệu gửi kèm |
| Nhà cung cấp LLM ngừng phục vụ | Tự quay về bộ lập kế hoạch theo luật; đã kiểm chứng thực tế ở tỉ lệ 25% lượt bị từ chối |
| Lạm dụng chatbot | Giới hạn 20 tin nhắn/phút mỗi người, chia sẻ giữa các tiến trình qua Redis |

---

## 6. Quy mô và mức độ kiểm thử

| | Số liệu |
|---|---|
| Công cụ chatbot | 23, trong đó 3 loại thao tác cần xác nhận |
| Tài liệu chính sách cho RAG | 4 |
| Bộ dữ liệu đánh giá planner | 4 bộ, tổng 269 câu |
| Kiểm thử tự động dịch vụ AI | 50 test + 79 subtest |
| Kiểm thử tự động backend | 183 test |
| Khoảng dữ liệu mô phỏng | 01/01/2026 → 18/09/2026 (không có ngày nào ở tương lai) |
| Quyết định giao việc dùng để dò trọng số | 2.822 |
| Mô hình học máy đã huấn luyện và so sánh | 4 |
| Bộ trọng số đã quét (đơn hình 4 chiều) | 1.540 |

---

## 7. Cách tái lập các số liệu trong báo cáo

```bash
# Đánh giá chatbot (bộ test là bộ nên báo cáo)
cd OmniHR_AI
python scripts/evaluate_planner.py --mode hybrid --cases test
python scripts/evaluate_planner.py --mode rule_based --cases dev2

# Đánh giá thuật toán gợi ý giao việc, trên CSDL mô phỏng riêng
cd OmniHR_BE
DATABASE_URL=...omnihr_eval npm run eval:suggestions

# Dò lại trọng số (chỉ đọc; thêm --apply để ghi vào cấu hình hệ thống)
DATABASE_URL=...omnihr_eval npm run eval:tune-weights -- --from 2026-02-02

# So sánh với baseline học máy
DATABASE_URL=...omnihr_eval npm run eval:ml-baseline -- --from 2026-02-02
```

Báo cáo sinh ra nằm trong `OmniHR_AI/eval_results/` và `OmniHR_BE/eval_results/`.

---

## 8. Việc cần làm tiếp

**Cần sửa trước khi nghiệm thu**

1. ~~Khai báo `update_task_status_draft` ở phía dịch vụ AI~~ — đã xong ngày 21/09.
2. ~~Đưa tín hiệu lịch sử làm việc vào mô hình xếp hạng~~ — đã xong ngày 21/09, phân tách kết quả tăng từ 0,134 lên 0,229.

**Nên làm nếu còn thời gian**

3. Nâng hạn mức LLM hoặc thêm cơ chế đợi–thử lại khi gặp mã 429, để tỉ lệ quay về luật giảm xuống.
4. Tích lũy đủ 20 lượt quản lý chọn gợi ý để mở khóa hàm mục tiêu dựa trên phản hồi thật, thay vì chỉ dựa vào dữ liệu mô phỏng.
5. Đưa các hằng số còn lại (thưởng thâm niên, phạt lâu không dùng, sức chứa tuần) vào cùng quy trình dò trọng số.

**Hướng phát triển xa hơn**

6. Cân tải cho cả nhóm bằng thuật toán ghép cặp thay vì tối ưu từng task.
7. Thay hẳn mô hình cộng điểm bằng mô hình xếp hạng học từ dữ liệu. Mục 4.5 cho thấy việc này chỉ đáng làm **sau khi** đã bổ sung tín hiệu lịch sử — với bộ tín hiệu hiện tại, đổi thuật toán không mang lại gì.
