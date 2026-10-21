# Đề xuất thiết kế thực tế cho kỹ năng nhân viên và kỹ năng yêu cầu của task trong OmniHR

## 1. Mục tiêu

Module kỹ năng không nên bắt người dùng nhập quá nhiều thông tin kỹ thuật như trọng số số học, điểm số hay công thức. Giao diện cần đơn giản, gần với cách doanh nghiệp quản lý nhân sự thực tế, nhưng backend vẫn phải đủ dữ liệu để phục vụ AI gợi ý chia task.

Mục tiêu chính:

- Nhân viên/manager nhập kỹ năng dễ hiểu.
- Manager tạo task không phải nhập trọng số phức tạp.
- Backend tự quy đổi dữ liệu giao diện thành điểm số phục vụ AI.
- Tránh trùng lặp giữa “mức quan trọng” và “bắt buộc”.
- Dễ demo, dễ giải thích trong đồ án.

---

## 2. Thiết kế kỹ năng nhân viên

### 2.1. Giao diện đề xuất

Mỗi kỹ năng của nhân viên gồm:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Kỹ năng | Có | Chọn từ danh mục kỹ năng có sẵn |
| Mức thành thạo | Có | Cơ bản / Trung bình / Khá / Thành thạo |
| Số năm kinh nghiệm | Không | Cho nhập số thập phân, ví dụ 1.5 năm |
| Lần sử dụng gần nhất | Không | Giúp đánh giá kỹ năng còn mới hay đã lâu không dùng |
| Ghi chú | Không | Ví dụ: “Đã dùng trong dự án nội bộ 6 tháng” |

### 2.2. Mức thành thạo

UI hiển thị tiếng Việt:

```txt
Cơ bản
Trung bình
Khá
Thành thạo
```

Backend lưu enum:

```ts
enum SkillProficiency {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  EXPERT
}
```

Mapping hiển thị:

| Backend enum | UI tiếng Việt | Ý nghĩa |
|---|---|---|
| `BEGINNER` | Cơ bản | Biết sử dụng ở mức đơn giản |
| `INTERMEDIATE` | Trung bình | Có thể làm task thông thường |
| `ADVANCED` | Khá | Làm tốt, xử lý được vấn đề tương đối phức tạp |
| `EXPERT` | Thành thạo | Rất vững, có thể hướng dẫn người khác |

### 2.3. Lý do thiết kế

Không nên chỉ lưu “số năm kinh nghiệm”, vì số năm không phản ánh đầy đủ năng lực.

Ví dụ:

- Một người có 3 năm React nhưng chỉ làm bảo trì đơn giản.
- Một người có 1 năm NestJS nhưng làm dự án thực tế lớn.
- Một người có 4 năm Angular nhưng đã 5 năm không dùng.

Vì vậy, dữ liệu quan trọng nhất nên là:

```txt
Kỹ năng + Mức thành thạo
```

Còn số năm kinh nghiệm và lần sử dụng gần nhất chỉ là thông tin bổ trợ cho AI.

---

## 3. Thiết kế kỹ năng yêu cầu của task

### 3.1. Không nên dùng cả “Mức quan trọng” và “Bắt buộc”

Thiết kế cũ:

```txt
Kỹ năng + Mức tối thiểu + Mức quan trọng + Bắt buộc
```

Thiết kế này chưa thực tế vì “Mức quan trọng” và “Bắt buộc” dễ bị trùng ý nghĩa.

Ví dụ gây khó hiểu:

```txt
NestJS - Quan trọng cao - Không bắt buộc
Testing - Quan trọng thấp - Bắt buộc
```

Người dùng sẽ không rõ nên hiểu theo “quan trọng” hay “bắt buộc”.

### 3.2. Thiết kế đề xuất

Mỗi kỹ năng yêu cầu của task chỉ nên gồm:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Kỹ năng | Có | Chọn từ danh mục kỹ năng |
| Mức tối thiểu | Có | Cơ bản / Trung bình / Khá / Thành thạo |
| Vai trò kỹ năng | Có | Bắt buộc / Quan trọng / Ưu tiên thêm |

### 3.3. Vai trò kỹ năng

Thay vì có checkbox “Bắt buộc” và dropdown “Mức quan trọng”, dùng một trường duy nhất:

```txt
Bắt buộc
Quan trọng
Ưu tiên thêm
```

#### Bắt buộc

Kỹ năng này gần như phải có. Nếu nhân viên thiếu kỹ năng này thì điểm phù hợp bị giảm rất mạnh.

Ví dụ:

```txt
Task backend NestJS bắt buộc phải có NestJS.
```

#### Quan trọng

Kỹ năng này ảnh hưởng nhiều đến độ phù hợp, nhưng thiếu vẫn có thể cân nhắc nếu nhân viên mạnh ở kỹ năng khác.

Ví dụ:

```txt
Task NestJS có TypeScript là kỹ năng quan trọng.
```

#### Ưu tiên thêm

Có thì tốt, không có cũng không loại ứng viên.

Ví dụ:

```txt
Biết Docker là lợi thế thêm.
```

---

## 4. Backend tự quy đổi vai trò kỹ năng thành trọng số

Người dùng không nhập số `weight`.

Backend tự map:

```ts
REQUIRED      => weight = 1.5
IMPORTANT     => weight = 1.0
NICE_TO_HAVE  => weight = 0.5
```

Đề xuất enum:

```ts
enum TaskSkillImportance {
  REQUIRED
  IMPORTANT
  NICE_TO_HAVE
}
```

UI hiển thị:

```txt
REQUIRED      => Bắt buộc
IMPORTANT     => Quan trọng
NICE_TO_HAVE  => Ưu tiên thêm
```

---

## 5. Cách tính điểm khi thiếu kỹ năng

Nếu nhân viên thiếu kỹ năng:

```txt
Bắt buộc      => điểm kỹ năng đó = 0
Quan trọng    => điểm kỹ năng đó = 30
Ưu tiên thêm  => điểm kỹ năng đó = 60
```

Lý do:

- Thiếu kỹ năng bắt buộc là vấn đề lớn.
- Thiếu kỹ năng quan trọng vẫn có thể cân nhắc.
- Thiếu kỹ năng ưu tiên thêm không nên bị trừ quá nặng.

---

## 6. Cách tính điểm theo mức thành thạo

Backend map mức thành thạo thành điểm:

```ts
BEGINNER      = 40
INTERMEDIATE  = 65
ADVANCED      = 85
EXPERT        = 100
```

Nếu task yêu cầu mức tối thiểu mà nhân viên thấp hơn yêu cầu thì trừ điểm.

Ví dụ:

```txt
Task yêu cầu NestJS mức ADVANCED
Nhân viên có NestJS mức INTERMEDIATE
=> bị trừ điểm vì chưa đạt mức tối thiểu
```

Đề xuất:

```txt
Nếu thấp hơn 1 bậc: trừ 15 điểm
Nếu thấp hơn 2 bậc trở lên: trừ 30 điểm
Nếu đạt hoặc cao hơn: giữ nguyên điểm
```

---

## 7. Số năm kinh nghiệm chỉ là điểm cộng nhỏ

Không nên để số năm kinh nghiệm quyết định quá nhiều.

Đề xuất bonus:

```txt
>= 4 năm  => +10 điểm
>= 2 năm  => +7 điểm
>= 1 năm  => +4 điểm
< 1 năm   => +0 điểm
```

Tổng điểm mỗi kỹ năng không vượt quá 100.

Lý do: số năm kinh nghiệm có giá trị tham khảo, nhưng không nên quan trọng hơn mức thành thạo.

---

## 8. Lần sử dụng gần nhất

Nếu có trường `lastUsedAt`, backend có thể xử lý nhẹ:

```txt
Dùng trong 1 năm gần đây     => không trừ điểm
1–2 năm chưa dùng            => trừ 5 điểm
Trên 2 năm chưa dùng         => trừ 10 điểm
Không có dữ liệu             => không trừ
```

Trường này không bắt buộc, chỉ dùng để tăng độ thực tế cho AI.

---

## 9. Công thức `skillScore` đề xuất

Với mỗi kỹ năng yêu cầu của task:

```txt
skillPoint =
  proficiencyPoint
  - penalty nếu thấp hơn mức tối thiểu
  + bonus số năm kinh nghiệm
  - penalty nếu lâu không dùng
```

Sau đó tính trung bình có trọng số:

```txt
skillScore = tổng(skillPoint * weight) / tổng(weight)
```

Trong đó `weight` được backend lấy từ `Vai trò kỹ năng`, không cho người dùng nhập trực tiếp.

---

## 10. Ví dụ thực tế

Task yêu cầu:

| Kỹ năng | Mức tối thiểu | Vai trò |
|---|---|---|
| NestJS | Khá | Bắt buộc |
| TypeScript | Khá | Quan trọng |
| Docker | Trung bình | Ưu tiên thêm |

Nhân viên A có:

| Kỹ năng | Mức thành thạo | Số năm |
|---|---|---:|
| NestJS | Thành thạo | 2 |
| TypeScript | Khá | 3 |
| Docker | Cơ bản | 1 |

Kết quả diễn giải:

```txt
NestJS: phù hợp tốt vì vượt mức yêu cầu
TypeScript: đạt yêu cầu
Docker: hơi thấp hơn yêu cầu nhưng chỉ là kỹ năng ưu tiên thêm
```

AI có thể sinh reason:

```txt
Nhân viên A phù hợp vì đáp ứng kỹ năng bắt buộc NestJS, đạt yêu cầu TypeScript, chỉ thiếu nhẹ Docker là kỹ năng ưu tiên thêm.
```

---

## 11. Đề xuất thay đổi database

### 11.1. Bảng `employee_skills`

Giữ hoặc bổ sung các field:

```ts
employeeId
skillId
proficiency
yearsExperience nullable
lastUsedAt nullable
note nullable
```

Không bắt buộc `yearsExperience`.

### 11.2. Bảng `task_required_skills`

Nên sửa từ:

```ts
weight
isRequired
```

sang:

```ts
importance
```

Đề xuất field:

```ts
taskId
skillId
requiredProficiency
importance
```

Trong đó:

```ts
importance: REQUIRED | IMPORTANT | NICE_TO_HAVE
```

Nếu vẫn muốn giữ tương thích với code cũ, có thể giữ `weight` và `isRequired`, nhưng không cho người dùng nhập trực tiếp. Backend tự set:

```txt
REQUIRED      => isRequired = true,  weight = 1.5
IMPORTANT     => isRequired = false, weight = 1.0
NICE_TO_HAVE  => isRequired = false, weight = 0.5
```

Tuy nhiên về lâu dài, nên dùng `importance` để dễ hiểu hơn.

---

## 12. Giao diện tạo task nên đơn giản

Khi tạo task, phần kỹ năng yêu cầu nên là một bảng nhỏ:

```txt
[Chọn kỹ năng] [Mức tối thiểu] [Vai trò kỹ năng] [Xóa]
```

Ví dụ:

```txt
NestJS       | Khá        | Bắt buộc
TypeScript   | Khá        | Quan trọng
Docker       | Trung bình | Ưu tiên thêm
```

Không hiển thị weight số học như `1.2`, `0.7`, vì người dùng nghiệp vụ không hiểu và không muốn nhập những con số này.

---

## 13. Có nên bắt buộc task phải có kỹ năng không?

Không nên bắt buộc tuyệt đối.

Nhưng nếu task chưa có kỹ năng yêu cầu, khi bấm AI gợi ý thì UI nên cảnh báo:

```txt
Task chưa khai báo kỹ năng yêu cầu. Kết quả gợi ý có thể chưa chính xác vì hệ thống chủ yếu dựa vào workload và availability.
```

Với task không có kỹ năng, backend có thể đặt:

```txt
skillScore = 70
```

Nhưng khi demo AI, nên dùng task có kỹ năng rõ ràng.

---

## 14. Migration gợi ý cho codebase hiện tại

Nếu codebase hiện đã có `weight` và `isRequired`, nên migrate theo hướng an toàn:

### Giai đoạn 1: Thêm field mới

Thêm enum và field:

```prisma
enum TaskSkillImportance {
  REQUIRED
  IMPORTANT
  NICE_TO_HAVE
}

model TaskRequiredSkill {
  // fields cũ
  importance TaskSkillImportance @default(IMPORTANT)
}
```

### Giai đoạn 2: Backfill dữ liệu cũ

Quy đổi dữ liệu cũ:

```txt
isRequired = true                       => REQUIRED
isRequired = false và weight >= 1.0     => IMPORTANT
isRequired = false và weight < 1.0      => NICE_TO_HAVE
```

### Giai đoạn 3: Sửa API/UI

- API nhận `importance` thay vì `weight` và `isRequired`.
- UI chỉ hiển thị `Vai trò kỹ năng`.
- Backend vẫn có thể tự tính weight nội bộ khi chấm điểm.

### Giai đoạn 4: Dọn field cũ nếu cần

Sau khi chắc chắn frontend/backend đã dùng `importance`, có thể bỏ `weight` và `isRequired` trong migration sau.

Nếu muốn giảm rủi ro, có thể giữ field cũ nhưng không expose ra UI.

---

## 15. Acceptance Criteria

### 15.1. Kỹ năng nhân viên

- Tạo/sửa kỹ năng nhân viên chỉ bắt buộc `skillId` và `proficiency`.
- `yearsExperience`, `lastUsedAt`, `note` là optional.
- UI không bắt người dùng nhập số năm nếu không có dữ liệu.
- Backend validate `yearsExperience >= 0` nếu có nhập.

### 15.2. Kỹ năng task

- Tạo/sửa task required skills dùng `importance` thay vì bắt người dùng nhập `weight`.
- UI hiển thị `Bắt buộc / Quan trọng / Ưu tiên thêm`.
- Backend tự quy đổi `importance` thành weight khi tính AI.
- Không hiển thị weight số học cho người dùng.

### 15.3. AI suggestion

- Skill bắt buộc thiếu phải bị trừ mạnh.
- Skill ưu tiên thêm thiếu không được làm ứng viên tụt điểm quá nặng.
- Reason phải giải thích được kỹ năng nào khớp, kỹ năng nào thiếu, kỹ năng nào chỉ là ưu tiên thêm.
- Task không có required skills vẫn generate được nhưng phải có cảnh báo trên UI.

---

## 16. Kết luận

Thiết kế thực tế nhất là:

```txt
Kỹ năng nhân viên:
- Kỹ năng
- Mức thành thạo
- Số năm kinh nghiệm optional
- Lần sử dụng gần nhất optional

Kỹ năng task:
- Kỹ năng
- Mức tối thiểu
- Vai trò kỹ năng
```

Không nên dùng đồng thời:

```txt
Mức quan trọng + Bắt buộc
```

vì dễ trùng ý nghĩa và khó giải thích.

Thay vào đó, dùng một trường duy nhất:

```txt
Vai trò kỹ năng = Bắt buộc / Quan trọng / Ưu tiên thêm
```

Backend sẽ tự quy đổi vai trò kỹ năng thành trọng số để phục vụ AI gợi ý chia task. Cách này vừa dễ dùng, vừa thực tế, vừa đủ dữ liệu để tính điểm AI.
