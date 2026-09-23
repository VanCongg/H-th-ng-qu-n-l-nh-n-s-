import { describe, expect, it } from "vitest";
import { messageDate, notificationMessage, notificationTitle } from "./notificationText";

describe("notification text", () => {
  it("renders titles from the stable type, including the one tx() missed", () => {
    expect(notificationTitle("vi", "TASK_STATUS_CHANGED", "Task returned for rework")).toBe(
      "Công việc bị trả về để sửa"
    );
    expect(notificationTitle("vi", "SOMETHING_NEW", "Stored title")).toBe("Stored title");
  });

  it("rebuilds each stored sentence in Vietnamese", () => {
    expect(
      notificationMessage(
        "vi",
        "TASK_ASSIGNED",
        'You were assigned to "Khảo sát nhu cầu cho cải tạo văn phòng tầng 12".'
      )
    ).toBe('Bạn được giao công việc "Khảo sát nhu cầu cho cải tạo văn phòng tầng 12".');

    expect(
      notificationMessage(
        "vi",
        "TASK_STATUS_CHANGED",
        '"Lấy báo giá nhà cung cấp" needs changes before it can be accepted.'
      )
    ).toBe('Công việc "Lấy báo giá nhà cung cấp" cần chỉnh sửa trước khi được duyệt.');

    expect(
      notificationMessage(
        "vi",
        "LEAVE_APPROVED",
        "Your leave request from Fri Jan 02 2026 to Mon Jan 05 2026 was approved."
      )
    ).toBe("Đơn nghỉ phép từ 02/01/2026 đến 05/01/2026 của bạn đã được duyệt.");

    expect(
      notificationMessage(
        "vi",
        "ATTENDANCE_ADJUSTED",
        "An attendance record for Mon Sep 21 2026 was updated by an admin."
      )
    ).toBe("Quản trị viên đã sửa bản ghi chấm công ngày 21/09/2026.");
  });

  it("reads the simulator's ISO dates too", () => {
    expect(messageDate("2026-09-21")).toBe("21/09/2026");
    expect(messageDate("Mon Sep 21 2026")).toBe("21/09/2026");
    expect(messageDate("sometime")).toBe("sometime");
  });

  it("leaves free text and English mode alone", () => {
    const reason = "Đơn gửi quá sát ngày nghỉ, cần sắp xếp người thay.";
    expect(notificationMessage("vi", "LEAVE_REJECTED", reason)).toBe(reason);

    const english = 'You were assigned to "X".';
    expect(notificationMessage("en", "TASK_ASSIGNED", english)).toBe(english);
    expect(notificationTitle("en", "TASK_ASSIGNED", "New task assigned")).toBe(
      "New task assigned"
    );
  });
});
