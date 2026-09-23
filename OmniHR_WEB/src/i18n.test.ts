import { describe, expect, it } from "vitest";
import {
  auditActionCodes,
  auditEntityTypes,
  translateAuditAction,
  translateEntityType,
  translateText
} from "./i18n";

describe("translateText", () => {
  it("leaves the backend message untouched in English", () => {
    expect(translateText("en", "Email already exists")).toBe("Email already exists");
  });

  it("translates a literal backend error", () => {
    expect(translateText("vi", "Email already exists")).toBe("Email đã tồn tại");
    expect(translateText("vi", "Username belongs to a deleted account")).toBe(
      "Tên đăng nhập đang thuộc một tài khoản đã bị xóa"
    );
  });

  it("translates the fields of a unique violation that reached the database", () => {
    expect(translateText("vi", "Duplicate value for field(s): email")).toBe(
      "Dữ liệu bị trùng ở trường: Email"
    );
    expect(translateText("vi", "Unique constraint violated")).toBe(
      "Dữ liệu bị trùng với bản ghi đã có"
    );
  });

  // Exactly what POST /users answers for this payload, joined by the backend.
  it("translates every part of a joined validation message", () => {
    const message = translateText(
      "vi",
      "property nickname should not exist; username must be shorter than or equal to 100 characters; email must be an email; Password must include uppercase, lowercase, number, and special character; password must be longer than or equal to 8 characters; each value in roleIds must be an integer number; employeeProfile.employeeCode must be a string; employeeProfile.birthDate must be a valid ISO 8601 date string"
    );

    expect(message.split("; ")).toEqual([
      "Không được gửi trường nickname",
      "Tên đăng nhập không được dài hơn 100 ký tự",
      "Email phải là email hợp lệ",
      "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt",
      "Mật khẩu phải có ít nhất 8 ký tự",
      "Từng giá trị của Vai trò phải là số nguyên",
      "Mã nhân viên phải là chuỗi ký tự",
      "Ngày sinh phải là ngày hợp lệ"
    ]);
  });

  it("translates the allowed values of an enum field", () => {
    expect(
      translateText(
        "vi",
        "priority must be one of the following values: LOW, MEDIUM, HIGH, URGENT"
      )
    ).toBe("Mức ưu tiên chỉ nhận một trong các giá trị: Thấp, Trung bình, Cao, Khẩn cấp");
  });

  it("translates numeric and coordinate constraints", () => {
    expect(translateText("vi", "estimatedHours must not be less than 0")).toBe(
      "Số giờ dự kiến không được nhỏ hơn 0"
    );
    expect(translateText("vi", "latitude must be a latitude string or number")).toBe(
      "Vĩ độ không hợp lệ"
    );
    expect(
      translateText(
        "vi",
        "longitude must be a number conforming to the specified constraints"
      )
    ).toBe("Kinh độ phải là số hợp lệ");
  });

  it("translates transport level failures", () => {
    expect(translateText("vi", "Network Error")).toBe(
      "Không kết nối được tới máy chủ. Kiểm tra lại đường truyền."
    );
    expect(translateText("vi", "timeout of 15000ms exceeded")).toBe(
      "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
    );
    expect(translateText("vi", "ThrottlerException: Too many requests")).toBe(
      "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút."
    );
    expect(translateText("vi", "Internal server error")).toBe(
      "Lỗi hệ thống. Vui lòng thử lại sau."
    );
  });

  it("translates the employee skill messages of the save flow", () => {
    expect(translateText("vi", "Employee already has this skill")).toBe(
      "Nhân viên đã có kỹ năng này"
    );
    expect(
      translateText("vi", "Saved, but the skills were not updated")
    ).toBe("Đã lưu, nhưng chưa cập nhật được kỹ năng");
    expect(translateText("vi", "Skill is not applicable to employee position")).not.toBe(
      "Skill is not applicable to employee position"
    );
  });

  it("keeps an unknown message rather than dropping it", () => {
    expect(translateText("vi", "Some brand new backend message")).toBe(
      "Some brand new backend message"
    );
    expect(translateText("vi", undefined)).toBe("");
  });
});

describe("audit log labels", () => {
  it("labels an action in both languages", () => {
    expect(translateAuditAction("en", "CREATE_USER")).toBe("Create account");
    expect(translateAuditAction("vi", "CREATE_USER")).toBe("Tạo tài khoản");
    expect(translateAuditAction("vi", "CHATBOT_CONFIRM_ACTION")).toBe(
      "Xác nhận thao tác HRGenie"
    );
  });

  it("labels an entity type in both languages", () => {
    expect(translateEntityType("en", "LeaveRequest")).toBe("Leave request");
    expect(translateEntityType("vi", "LeaveRequest")).toBe("Đơn nghỉ phép");
    expect(translateEntityType("vi", "AttendanceRecord")).toBe("Bản ghi chấm công");
  });

  it("reads a code added later as a sentence instead of SCREAMING_SNAKE", () => {
    expect(translateAuditAction("en", "ARCHIVE_PERFORMANCE_REVIEW")).toBe(
      "Archive performance review"
    );
    expect(translateEntityType("vi", "PerformanceReview")).toBe("Performance review");
  });

  it("returns an empty label for a missing code", () => {
    expect(translateAuditAction("vi", null)).toBe("");
    expect(translateEntityType("vi", undefined)).toBe("");
  });

  it("has a label for every action and entity type the backend audits", () => {
    // Kept in sync with the codes collected from OmniHR_BE's audit.log calls.
    const backendActions = [
      "ADD_EMPLOYEE_SKILL",
      "ADD_TEAM_MEMBER",
      "APPROVE_LEAVE_REQUEST",
      "ASSIGN_MANAGER",
      "ASSIGN_PERMISSION",
      "ASSIGN_ROLE",
      "ASSIGN_TASK",
      "ATTENDANCE_ADMIN_CREATE",
      "ATTENDANCE_ADMIN_UPDATE",
      "CANCEL_AI_TASK_SUGGESTION",
      "CANCEL_LEAVE_REQUEST",
      "CANCEL_LEAVE_REQUEST_BY_CHATBOT",
      "CHATBOT_CANCEL_ACTION",
      "CHATBOT_CONFIRM_ACTION",
      "CHATBOT_CREATE_PENDING_ACTION",
      "CHATBOT_EXECUTE_ACTION",
      "CHATBOT_EXPIRE_ACTION",
      "CHATBOT_TOOL_CALL_FAILED",
      "CHECK_IN",
      "CHECK_OUT",
      "CREATE_DEPARTMENT",
      "CREATE_EMPLOYEE",
      "CREATE_LEAVE_REQUEST",
      "CREATE_LEAVE_REQUEST_BY_CHATBOT",
      "CREATE_LEAVE_TYPE",
      "CREATE_POSITION",
      "CREATE_PROJECT",
      "CREATE_ROLE",
      "CREATE_SKILL",
      "CREATE_TASK",
      "CREATE_TEAM",
      "CREATE_USER",
      "CREATE_USER_FOR_EMPLOYEE",
      "DELETE_DEPARTMENT",
      "DELETE_EMPLOYEE",
      "DELETE_LEAVE_TYPE",
      "DELETE_POSITION",
      "DELETE_PROJECT",
      "DELETE_ROLE",
      "DELETE_SKILL",
      "DELETE_TASK",
      "DELETE_TEAM",
      "DELETE_USER",
      "GENERATE_AI_TASK_SUGGESTION",
      "LOGIN",
      "LOGOUT",
      "REASSIGN_TASK",
      "REFRESH_TOKEN_REUSE_DETECTED",
      "REJECT_LEAVE_REQUEST",
      "REMOVE_EMPLOYEE_SKILL",
      "REMOVE_MANAGER",
      "REMOVE_PERMISSION",
      "REMOVE_ROLE",
      "REMOVE_TEAM_MEMBER",
      "RESET_EMPLOYEE_PASSWORD",
      "RESET_USER_PASSWORD",
      "SELECT_AI_TASK_SUGGESTION",
      "UPDATE_DEPARTMENT",
      "UPDATE_EMPLOYEE",
      "UPDATE_EMPLOYEE_SELF",
      "UPDATE_EMPLOYEE_SKILL",
      "UPDATE_LEAVE_TYPE",
      "UPDATE_POSITION",
      "UPDATE_PROJECT",
      "UPDATE_ROLE",
      "UPDATE_SKILL",
      "UPDATE_SYSTEM_SETTINGS",
      "UPDATE_TASK",
      "UPDATE_TASK_STATUS",
      "UPDATE_TEAM",
      "UPDATE_TEAM_MEMBER",
      "UPDATE_USER"
    ];
    const backendEntityTypes = [
      "AiTaskSuggestion",
      "AttendanceRecord",
      "ChatbotPendingAction",
      "ChatbotTool",
      "Department",
      "Employee",
      "EmployeeManager",
      "EmployeeSkill",
      "LeaveRequest",
      "LeaveType",
      "Position",
      "Project",
      "Role",
      "Skill",
      "SystemSetting",
      "Task",
      "Team",
      "User"
    ];

    expect([...auditActionCodes].sort()).toEqual([...backendActions].sort());
    expect([...auditEntityTypes].sort()).toEqual([...backendEntityTypes].sort());
  });
});
