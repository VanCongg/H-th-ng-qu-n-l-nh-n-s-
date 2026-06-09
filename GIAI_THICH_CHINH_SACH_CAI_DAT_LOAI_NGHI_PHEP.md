# Giải thích: Chính sách, Cài đặt hệ thống, Loại nghỉ phép

File này giải thích lại theo hướng mới: **Chính sách không còn là một module quản lý dữ liệu riêng**. Nó chỉ là một trang văn bản để admin/quản lý đọc quy định nội bộ. Nút **Chính sách** nằm cùng cấp với nút **Cài đặt hệ thống** trong menu quản trị và được đặt ngay phía trên nút cài đặt.

## Tóm tắt nhanh

| Phần | Dùng để làm gì | Trạng thái hiện tại |
| --- | --- | --- |
| Chính sách | Văn bản mô tả quy định vận hành, phân quyền, hồ sơ, chấm công, nghỉ phép. | Trang đọc nội dung tĩnh, không phải module CRUD. |
| Cài đặt hệ thống | Nơi nhập JSON cấu hình chung của hệ thống. | Đang là cấu hình phase 1, lưu runtime trong backend. |
| Loại nghỉ phép | Danh mục các loại nghỉ mà nhân viên chọn khi tạo đơn nghỉ. | Chức năng nghiệp vụ đang dùng thật. |

## 1. Chính sách là gì?

**Chính sách** bây giờ nên hiểu là một văn bản nội bộ trong hệ thống, giống một trang quy định hoặc hướng dẫn vận hành. Nó không cần tạo/sửa/xóa từng policy record như module trước.

Trang này dùng để ghi rõ các nguyên tắc như:

- Ai được sử dụng hệ thống.
- Vai trò Admin, Manager, Employee khác nhau thế nào.
- Hồ sơ nhân sự cần được quản lý ra sao.
- Nhân viên chấm công thế nào.
- Đơn nghỉ phép được tạo và duyệt theo nguyên tắc nào.
- Dữ liệu cá nhân cần được bảo vệ thế nào.

Ví dụ nội dung chính sách:

> Manager chỉ được xem và xử lý dữ liệu của nhân viên thuộc phạm vi quản lý của mình. Admin có quyền quản trị toàn bộ dữ liệu nhân sự. Nhân viên chỉ sử dụng các chức năng cá nhân như hồ sơ, chấm công và nghỉ phép.

## 2. Vì sao không cần module Chính sách?

Module chính sách dạng CRUD trước đó phù hợp nếu hệ thống cần một rule engine nâng cao, ví dụ ABAC động: tạo rule, bật/tắt rule, backend đọc rule để quyết định cho phép hay từ chối request.

Nhưng với OmniHR hiện tại, quyền đã được xử lý bằng:

- Vai trò: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Permission cố định trong backend.
- Logic kiểm tra phạm vi manager trong service.

Vì vậy, module policy CRUD là dư ở phase này. Để người dùng dễ hiểu hơn, phần **Chính sách** chỉ nên là trang văn bản.

## 3. Nút Chính sách nằm ở đâu?

Trong menu quản trị, nút **Chính sách** nằm:

- Cùng cấp với các nút quản trị khác.
- Ngay phía trên nút **Cài đặt hệ thống**.
- Không còn là màn hình bảng dữ liệu có nút thêm/sửa/xóa policy.

Luồng menu mong muốn:

```txt
Nhật ký hệ thống
Chính sách
Cài đặt hệ thống
```

## 4. Cài đặt hệ thống là gì?

**Cài đặt hệ thống** là nơi nhập JSON cấu hình chung của app.

Giá trị mặc định hiện tại:

```json
{
  "workWeek": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  "leaveCalculation": "WEEKDAYS_ONLY",
  "phase": "PHASE_1"
}
```

Ý nghĩa:

| Trường | Ý nghĩa |
| --- | --- |
| `workWeek` | Các ngày làm việc mặc định trong tuần. |
| `leaveCalculation` | Cách tính ngày nghỉ. |
| `phase` | Ghi chú phase triển khai. |

Hiện tại phần này vẫn đơn giản:

- Settings được lưu trong memory runtime của backend.
- Restart server thì quay lại mặc định.
- Chưa lưu vào database.
- Chưa áp dụng sâu vào toàn bộ nghiệp vụ.

Nếu muốn dùng production, nên nâng cấp phần này để lưu database và validate JSON schema.

## 5. Loại nghỉ phép là gì?

**Loại nghỉ phép** là danh mục nghiệp vụ dùng thật khi nhân viên tạo đơn nghỉ.

Mỗi loại nghỉ có:

| Trường | Ý nghĩa |
| --- | --- |
| `code` | Mã loại nghỉ, ví dụ `ANNUAL_LEAVE`. |
| `name` | Tên loại nghỉ, ví dụ `Annual leave`. |
| `annualAllowance` | Hạn mức ngày nghỉ mỗi năm. |
| `isActive` | Còn cho phép chọn hay không. |

Các loại mặc định:

| Code | Tên | Hạn mức |
| --- | --- | --- |
| `ANNUAL_LEAVE` | Annual leave | 12 |
| `SICK_LEAVE` | Sick leave | 30 |
| `UNPAID_LEAVE` | Unpaid leave | Không giới hạn rõ |
| `MATERNITY_LEAVE` | Maternity leave | 180 |
| `MARRIAGE_LEAVE` | Marriage leave | 3 |
| `BEREAVEMENT_LEAVE` | Bereavement leave | 3 |

Khi tạo đơn nghỉ, nhân viên phải chọn một loại nghỉ. Backend kiểm tra loại nghỉ có tồn tại và đang active không.

## 6. Kết luận ngắn

- **Chính sách**: chỉ là trang văn bản nội bộ, không phải module quản trị policy.
- **Cài đặt hệ thống**: nơi chỉnh JSON cấu hình chung, hiện còn ở mức phase 1.
- **Loại nghỉ phép**: danh mục nghiệp vụ đang dùng thật trong quy trình tạo đơn nghỉ phép.

## 7. Hướng hoàn thiện sau

Nên ưu tiên:

1. Hoàn thiện loại nghỉ phép bằng số dư phép/năm, phép đã dùng, phép còn lại.
2. Nâng cài đặt hệ thống lên lưu database thay vì memory.
3. Giữ chính sách là văn bản nội bộ cho dễ dùng, chỉ làm rule engine nếu sau này thật sự cần phân quyền động phức tạp.
