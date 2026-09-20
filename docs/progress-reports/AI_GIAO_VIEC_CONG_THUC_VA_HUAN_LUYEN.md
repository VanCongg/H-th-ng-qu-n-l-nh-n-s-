# AI gợi ý giao việc: công thức chấm điểm và cách huấn luyện trọng số

*Phần dành cho báo cáo. Số liệu đo trên mã nguồn và cơ sở dữ liệu mô phỏng tại ngày 21/09/2026.*

## 1. Bài toán và nguyên tắc thiết kế

Khi trưởng nhóm tạo một công việc, hệ thống xếp hạng các nhân sự có thể nhận việc đó và đề xuất tối đa 5 người, kèm lý do. Đây **không** phải mô hình học sâu mà là **mô hình ra quyết định đa tiêu chí (MCDM)**: bốn tín hiệu được chấm điểm độc lập trên thang 0–100, rồi cộng lại theo trọng số. Ba nguyên tắc chi phối thiết kế:

- **Giải thích được.** Mỗi con số hiển thị cho người dùng đều truy được về một công thức tường minh, không phải đầu ra của một hộp đen.
- **Tách ràng buộc cứng khỏi điểm mềm.** Ứng viên thiếu kỹ năng *bắt buộc* hoặc chưa đạt mức trình độ tối thiểu luôn bị xếp sau mọi ứng viên đủ điều kiện, bất kể điểm tổng cao đến đâu. Không có chuyện "điểm cao bù cho việc không biết làm".
- **Con người quyết định cuối.** Hệ thống chỉ gợi ý; quyền chọn và ghi dữ liệu nằm ở người quản lý.

Toàn bộ phần chấm điểm là hàm thuần khiết trong `OmniHR_BE/src/ai-task-suggestions/suggestion-scoring.ts`, được dùng chung giữa API đang chạy và các script đánh giá ngoại tuyến — nên phép đo offline đo đúng cái mà hệ thống thật đang xếp hạng.

## 2. Công thức chấm điểm

### 2.1 Điểm tổng

```
                 w_kn × S_kn  +  w_tv × S_tv  +  w_ln × S_ln  +  w_ls × S_ls
Điểm tổng  =  ───────────────────────────────────────────────────────────────
                   tổng trọng số của những tín hiệu ứng viên CÓ dữ liệu
```

trong đó `S_kn` = điểm kỹ năng, `S_tv` = điểm tải việc, `S_ln` = điểm lịch nghỉ, `S_ls` = điểm lịch sử làm việc (mỗi điểm thuộc thang 0–100).

Chi tiết quan trọng nằm ở **mẫu số**: chỉ những tín hiệu mà ứng viên thực sự có dữ liệu được đưa vào trung bình. Nhân sự mới chưa đủ lịch sử làm việc bị **loại tín hiệu đó khỏi phép chia**, chứ không bị chấm 0 điểm oan. Hệ quả kỹ thuật: bốn trọng số không buộc phải cộng lại bằng 1, và tắt hẳn một tín hiệu (đặt trọng số 0) không làm lệch thang điểm.

### 2.2 Bốn điểm thành phần

**a) Điểm kỹ năng** — bình quân có trọng số theo mức quan trọng của từng kỹ năng mà công việc yêu cầu:

```
S_kn = Σ (điểm_kỹ_năng_i × trọng_số_mức_quan_trọng_i) / Σ trọng_số_mức_quan_trọng_i
```

| Tham số | Giá trị |
|---|---|
| Trọng số mức quan trọng | bắt buộc 1,5 · ưu tiên 1,0 · nên có 0,5 |
| Điểm theo trình độ | BEGINNER 40 · INTERMEDIATE 65 · ADVANCED 85 · EXPERT 100 |
| Thiếu 1 bậc so với yêu cầu | −15 điểm (từ 2 bậc trở lên: −30) |
| Thưởng thâm niên | ≥1 năm +4 · ≥2 năm +7 · ≥4 năm +10 |
| Trừ do lâu không dùng | >1 năm −5 · >2 năm −10 |
| Không có kỹ năng đó | bắt buộc 0 · ưu tiên 30 · nên có 60 |

Công việc không khai kỹ năng nào thì `S_kn = 70` (điểm trung tính) và mọi ứng viên đều đủ điều kiện.

**b) Điểm tải việc** — giờ ước tính của các công việc đang mở so với sức chứa 40 giờ/tuần:

```
giờ_còn_lại = 40 − Σ giờ ước tính các task đang mở
S_tv = f(giờ_còn_lại) − 10 × số_task_quá_hạn        (không âm)
```

với `f`: ≥20 giờ → 100 · ≥10 → 80 · ≥5 → 60 · >0 → 40 · ≤0 → 20.

**c) Điểm lịch nghỉ** — tỉ lệ ngày làm việc của công việc trùng với đơn nghỉ phép:

```
S_ln = 100 − min(60; 60 × ngày_nghỉ_đã_duyệt / ngày_làm_việc_của_task)
           − min(25; 25 × ngày_nghỉ_chờ_duyệt / ngày_làm_việc_của_task)
```

Nghỉ đã duyệt và đơn đang chờ duyệt bị phạt khác nhau (tối đa 60 so với 25) vì mức độ chắc chắn khác nhau.

**d) Điểm lịch sử làm việc** — kết quả thực tế của các công việc đã hoàn thành:

```
S_ls = 100 × (0,6 × tỉ_lệ_xong_đúng_hạn + 0,4 × hiệu_suất_giờ)
hiệu_suất_giờ = min(1; Σ giờ ước tính / Σ giờ thực tế)
```

Vượt giờ ước tính bị trừ điểm, nhưng làm nhanh hơn ước tính **không** được cộng thêm — vì giờ thực tế thấp bất thường thường có nghĩa là bản ước tính sai, chứ không phải người làm giỏi hơn. Dưới **3 công việc đã hoàn thành**, điểm này là `null` và bị loại khỏi trung bình ở mục 2.1.

### 2.3 Thứ tự xếp hạng

Ứng viên đủ điều kiện trước → điểm tổng giảm dần → điểm kỹ năng giảm dần (dùng để phá thế hoà).

## 3. Cách huấn luyện: dò trọng số từ dữ liệu lịch sử

Bốn trọng số **không phải hằng số do người viết chọn**. Chúng nằm trong cấu hình hệ thống (`aiWeightSkill`, `aiWeightWorkload`, `aiWeightAvailability`, `aiWeightHistory`, sửa được trên màn hình *Cài đặt hệ thống*) và được dò bằng script `npm run eval:tune-weights` (`OmniHR_BE/prisma/tune-weights.ts`). Quy trình gồm năm bước.

**Bước 1 — Tái dựng dữ liệu huấn luyện.** Mỗi lần trưởng nhóm từng giao việc trong quá khứ được tái dựng thành một *quyết định*: danh sách ứng viên khả dụng lúc đó, bốn điểm thành phần tính lại **tại đúng thời điểm giao việc** (tải việc, đơn nghỉ, lịch sử chỉ tính đến ngày đó — không dùng thông tin tương lai), người thực sự được giao, và kết quả về sau (đúng hạn hay trễ). Thu được **2.822 quyết định**.

**Bước 2 — Tách tập theo thời gian.** 70% quyết định cũ hơn dùng để dò (**1.975**), 30% mới hơn giữ lại để kiểm chứng (**847**). Tách theo thời gian chứ không ngẫu nhiên, để mô hình không học từ tương lai.

**Bước 3 — Quét toàn bộ không gian trọng số.** Lưới bước 0,05 trên đơn hình 4 chiều cho **1.540 bộ trọng số**; mỗi bộ được chấm lại trên toàn bộ tập dò. Đây là tìm kiếm vét cạn, không phải gradient descent — không gian đủ nhỏ để làm được, và đổi lại có bảo đảm tìm ra cực trị toàn cục trên lưới.

**Bước 4 — Hàm mục tiêu: phân tách kết quả thật.** Với mỗi quyết định, lấy hạng mà mô hình dành cho người *thực sự* được giao. Chỉ số = hạng trung bình ở nhóm công việc **trễ hạn** trừ hạng trung bình ở nhóm **đúng hạn**. Dương nghĩa là mô hình đã xếp thấp đúng những lần giao việc về sau hỏng việc. Chỉ số này chỉ dùng kết quả quan sát được (đúng hạn/trễ), không dùng bất kỳ biến nội bộ nào của bộ mô phỏng. (Tuỳ chọn `--objective correlation` đổi sang hàm mục tiêu tương quan với năng lực.)

**Bước 5 — Sàn nghiệp vụ và chốt chặn an toàn.** Bộ dò chỉ nhận những bộ trọng số giữ **sàn tối thiểu 0,1 cho mỗi tín hiệu**. Lý do: nếu để tự do, điểm tối ưu rơi vào `0,05 / 0,05 / 0 / 0,90` — tức bỏ hẳn tín hiệu lịch nghỉ, vì hàm mục tiêu chỉ biết công việc có đúng hạn hay không nên không "thấy" rằng gợi ý một người đang nghỉ phép cả kỳ là sai về nghiệp vụ. Áp sàn chỉ mất 0,005 điểm, và báo cáo tự động vẫn in ra điểm tối ưu không sàn để người đọc tự đánh giá lựa chọn này.

Script **từ chối ghi** trọng số mới khi: dưới 60 quyết định, dưới 20 mẫu kiểm chứng, tập kiểm chứng có dưới 10 công việc đúng hạn hoặc dưới 10 công việc trễ, hoặc phần cải thiện trên tập kiểm chứng dưới ngưỡng 0,05. Không có `--apply` thì script chỉ đọc và in báo cáo.

## 4. Kết quả

Đo trên **847 quyết định giữ lại** (chưa từng dùng để dò):

| Bộ trọng số (kỹ năng / tải việc / lịch nghỉ / lịch sử) | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất |
|---|---|---|---|
| 0,50 / 0,35 / 0,15 / — *(ba tín hiệu, bản trước)* | 0,134 | 0,297 | 25,3% |
| 0,50 / 0,35 / 0,15 / 0,20 *(thêm lịch sử, trọng số đặt tay)* | 0,151 | 0,469 | 30,4% |
| **0,10 / 0,15 / 0,10 / 0,65** *(dò từ dữ liệu — đang chạy)* | **0,229** | **0,833** | **45,5%** |

Tăng **71%** so với mô hình ba tín hiệu. Chạy lại bộ dò trên chính bộ trọng số đang dùng cho chênh lệch 0,000 — không bộ nào trong 1.540 bộ tốt hơn.

Hai điểm nên nói rõ khi trình bày:

- **Trọng số kỹ năng thấp (0,10) không có nghĩa kỹ năng không quan trọng.** Kỹ năng đã phát huy tác dụng ở *ràng buộc cứng* trước khi chấm điểm: người thiếu kỹ năng bắt buộc bị xếp sau bất kể trọng số. Phần đóng góp còn lại của điểm kỹ năng chỉ là phân biệt giữa những người **đã** đủ điều kiện, nên nhỏ là hợp lý.
- **Lịch sử làm việc là tín hiệu mạnh nhất** (0,65). Bỏ riêng tín hiệu này làm chỉ số tụt từ 0,229 xuống 0,101; bỏ bất kỳ tín hiệu nào khác gần như không đổi. Ba tín hiệu kia vẫn được giữ vì chúng phục vụ những mục tiêu mà hàm mục tiêu này không đo: đúng kỹ năng, không giao việc cho người đang nghỉ, và dàn đều tải việc.

Mỗi gợi ý sinh ra đều **lưu lại bộ trọng số đã dùng** cùng bốn điểm thành phần của từng ứng viên và vân tay của công việc, nên một gợi ý cũ vẫn giải thích được kể cả sau khi trọng số đã được dò lại.

## 5. Hạn chế

- **Toàn bộ kiểm chứng dựa trên dữ liệu mô phỏng** — đây là hạn chế lớn nhất và không khắc phục được trong phạm vi đồ án.
- **Có yếu tố vòng lặp trong thước đo**: trong bộ mô phỏng, kết quả công việc sinh ra từ năng lực ẩn, còn tín hiệu lịch sử lại tính từ chính các kết quả đó, nên quan hệ giữa hai thứ chặt hơn thực tế. Mức cải thiện 0,134 → 0,229 là thật *trong khuôn khổ dữ liệu này*.
- **Các hằng số còn lại chưa được dò**: tỉ lệ 60/40 trong điểm lịch sử, ngưỡng thưởng thâm niên, sức chứa 40 giờ/tuần, mức trừ 10 điểm mỗi công việc quá hạn.
- **Khởi đầu nguội**: người chưa đủ 3 công việc hoàn thành không được hưởng tín hiệu mạnh nhất (dù cũng không bị phạt).
- **Tối ưu từng công việc, chưa cân tải cả nhóm.**

## 6. Cách chạy lại

```bash
cd OmniHR_BE
npm run eval:suggestions                          # chấm lại chất lượng xếp hạng (chỉ đọc)
npm run eval:tune-weights -- --from 2026-02-02     # dò trọng số; thêm --apply để ghi
npm run eval:ml-baseline                           # so sánh với hồi quy logistic
```

Luôn chạy trên cơ sở dữ liệu mô phỏng (`DATABASE_URL=...omnihr_eval`), không chạy trên dữ liệu thật.
