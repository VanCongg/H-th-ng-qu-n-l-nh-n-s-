import { AttendanceRecordType } from "@prisma/client";
export declare class AdminCreateAttendanceDto {
    employeeId: number;
    workDate: string;
    recordType: AttendanceRecordType;
    recordedAt: string;
    note: string;
}
export declare class AdminUpdateAttendanceDto {
    workDate?: string;
    recordType?: AttendanceRecordType;
    recordedAt?: string;
    note?: string;
}
