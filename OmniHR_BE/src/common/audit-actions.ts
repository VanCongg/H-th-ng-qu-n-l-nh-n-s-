// Danh sách hành động audit log, chia nhóm (bảo mật / nhân sự / nghỉ phép / công việc / AI).
// Thêm action mới phải khai báo ở đây, nếu không bộ lọc trên web sẽ không tìm thấy.

/**
 * What the audit log records, grouped the way an admin reads it. The web page
 * filters by these groups, and retention keeps the security group longest.
 */
export const AUDIT_CATEGORIES = {
  SECURITY: [
    "LOGIN",
    "LOGOUT",
    "REFRESH_TOKEN_REUSE_DETECTED",
    "CREATE_USER",
    "CREATE_USER_FOR_EMPLOYEE",
    "UPDATE_USER",
    "DELETE_USER",
    "CHANGE_PASSWORD",
    "SEND_VERIFICATION_CODE",
    "RESET_PASSWORD_BY_EMAIL",
    "RESET_USER_PASSWORD",
    "RESET_EMPLOYEE_PASSWORD",
    "CREATE_ROLE",
    "UPDATE_ROLE",
    "DELETE_ROLE",
    "ASSIGN_ROLE",
    "REMOVE_ROLE",
    "ASSIGN_PERMISSION",
    "REMOVE_PERMISSION",
    "UPDATE_SYSTEM_SETTINGS"
  ],
  PEOPLE: [
    "CREATE_EMPLOYEE",
    "UPDATE_EMPLOYEE",
    "UPDATE_EMPLOYEE_SELF",
    "DELETE_EMPLOYEE",
    "CREATE_DEPARTMENT",
    "UPDATE_DEPARTMENT",
    "DELETE_DEPARTMENT",
    "CREATE_POSITION",
    "UPDATE_POSITION",
    "DELETE_POSITION",
    "CREATE_TEAM",
    "UPDATE_TEAM",
    "DELETE_TEAM",
    "ADD_TEAM_MEMBER",
    "UPDATE_TEAM_MEMBER",
    "REMOVE_TEAM_MEMBER",
    "ASSIGN_MANAGER",
    "REMOVE_MANAGER",
    "CREATE_SKILL",
    "UPDATE_SKILL",
    "DELETE_SKILL",
    "ADD_EMPLOYEE_SKILL",
    "UPDATE_EMPLOYEE_SKILL",
    "REMOVE_EMPLOYEE_SKILL",
    "CREATE_HOLIDAY",
    "UPDATE_HOLIDAY",
    "DELETE_HOLIDAY",
    "CREATE_LEAVE_TYPE",
    "UPDATE_LEAVE_TYPE",
    "DELETE_LEAVE_TYPE",
    "ATTENDANCE_ADMIN_CREATE",
    "ATTENDANCE_ADMIN_UPDATE"
  ],
  LEAVE: [
    "CREATE_LEAVE_REQUEST",
    "CREATE_LEAVE_REQUEST_BY_CHATBOT",
    "APPROVE_LEAVE_REQUEST",
    "REJECT_LEAVE_REQUEST",
    "CANCEL_LEAVE_REQUEST",
    "CANCEL_LEAVE_REQUEST_BY_CHATBOT",
    "REQUEST_LEAVE_CANCELLATION",
    "APPROVE_LEAVE_CANCELLATION",
    "REJECT_LEAVE_CANCELLATION"
  ],
  WORK: [
    "CREATE_PROJECT",
    "UPDATE_PROJECT",
    "DELETE_PROJECT",
    "CREATE_TASK",
    "UPDATE_TASK",
    "DELETE_TASK",
    "UPDATE_TASK_STATUS",
    "ASSIGN_TASK",
    "REASSIGN_TASK"
  ],
  AI: [
    "GENERATE_AI_TASK_SUGGESTION",
    "SELECT_AI_TASK_SUGGESTION",
    "CANCEL_AI_TASK_SUGGESTION",
    "CHATBOT_CREATE_PENDING_ACTION",
    "CHATBOT_CONFIRM_ACTION",
    "CHATBOT_EXECUTE_ACTION",
    "CHATBOT_CANCEL_ACTION",
    "CHATBOT_EXPIRE_ACTION",
    "CHATBOT_TOOL_CALL_FAILED"
  ]
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export const AUDIT_CATEGORY_KEYS = Object.keys(AUDIT_CATEGORIES) as AuditCategory[];

/**
 * Everyday steps that repeat many times a day and change nothing an admin has
 * to answer for: a task moving along, a suggestion looked at, a chatbot turn,
 * a sign-in. "Only important changes" on the web hides them.
 */
export const ROUTINE_AUDIT_ACTIONS: readonly string[] = [
  "LOGIN",
  "LOGOUT",
  "UPDATE_TASK_STATUS",
  "GENERATE_AI_TASK_SUGGESTION",
  "CHATBOT_CREATE_PENDING_ACTION",
  "CHATBOT_CONFIRM_ACTION",
  "CHATBOT_EXECUTE_ACTION",
  "CHATBOT_CANCEL_ACTION",
  "CHATBOT_EXPIRE_ACTION",
  "CHATBOT_TOOL_CALL_FAILED"
];

export const SECURITY_AUDIT_ACTIONS: readonly string[] = AUDIT_CATEGORIES.SECURITY;
