// Kiểu dữ liệu dùng chung: người dùng đã đăng nhập (roles, permissions, employeeId) và ngữ cảnh request.

// Người dùng đã đăng nhập, gắn vào request sau khi xác thực JWT.
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  employeeId?: number | null;
  mustChangePassword: boolean;
};

// Thông tin request dùng cho audit log.
export type RequestContext = {
  ip?: string;
  userAgent?: string;
};
