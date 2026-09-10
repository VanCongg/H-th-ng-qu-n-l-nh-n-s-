import '../core/i18n.dart';
import '../core/utils.dart';

class LoginResponse {
  LoginResponse({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  final AuthUser user;
  final String accessToken;
  final String refreshToken;

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      user: AuthUser.fromJson(mapOf(json['user'])),
      accessToken: textOf(json['accessToken']),
      refreshToken: textOf(json['refreshToken']),
    );
  }
}

class AuthUser {
  AuthUser({
    required this.id,
    required this.username,
    required this.email,
    required this.roles,
    required this.permissions,
    required this.mustChangePassword,
    this.employeeId,
  });

  final int id;
  final String username;
  final String email;
  final List<String> roles;
  final List<String> permissions;
  final int? employeeId;
  final bool mustChangePassword;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: intOf(json['id']),
      username: textOf(json['username']),
      email: textOf(json['email']),
      roles: stringListOf(json['roles']),
      permissions: stringListOf(json['permissions']),
      employeeId: json['employeeId'] == null ? null : intOf(json['employeeId']),
      mustChangePassword: json['mustChangePassword'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'roles': roles,
      'permissions': permissions,
      'employeeId': employeeId,
      'mustChangePassword': mustChangePassword,
    };
  }
}

class Department {
  Department({required this.id, required this.code, required this.name});

  final int id;
  final String code;
  final String name;

  factory Department.fromJson(Map<String, dynamic> json) {
    return Department(
      id: intOf(json['id']),
      code: textOf(json['code']),
      name: textOf(json['name']),
    );
  }
}

class Position {
  Position({required this.id, required this.code, required this.name});

  final int id;
  final String code;
  final String name;

  factory Position.fromJson(Map<String, dynamic> json) {
    return Position(
      id: intOf(json['id']),
      code: textOf(json['code']),
      name: textOf(json['name']),
    );
  }
}

class Project {
  Project({required this.id, required this.code, required this.name});

  final int id;
  final String code;
  final String name;

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: intOf(json['id']),
      code: textOf(json['code']),
      name: textOf(json['name']),
    );
  }
}

class Team {
  Team({required this.id, required this.code, required this.name});

  final int id;
  final String code;
  final String name;

  factory Team.fromJson(Map<String, dynamic> json) {
    return Team(
      id: intOf(json['id']),
      code: textOf(json['code']),
      name: textOf(json['name']),
    );
  }
}

class Employee {
  Employee({
    required this.id,
    required this.employeeCode,
    required this.fullName,
    required this.companyEmail,
    required this.status,
    this.personalEmail,
    this.phone,
    this.birthDate,
    this.hireDate,
    this.department,
    this.position,
  });

  final int id;
  final String employeeCode;
  final String fullName;
  final String companyEmail;
  final String status;
  final String? personalEmail;
  final String? phone;
  final String? birthDate;
  final String? hireDate;
  final Department? department;
  final Position? position;

  factory Employee.fromJson(Map<String, dynamic> json) {
    final departmentMap = mapOf(json['department']);
    final positionMap = mapOf(json['position']);
    return Employee(
      id: intOf(json['id']),
      employeeCode: textOf(json['employeeCode']),
      fullName: textOf(json['fullName'], tx('Nhân viên')),
      companyEmail: textOf(json['companyEmail']),
      personalEmail: json['personalEmail']?.toString(),
      phone: json['phone']?.toString(),
      birthDate: json['birthDate']?.toString(),
      hireDate: json['hireDate']?.toString(),
      status: textOf(json['status'], 'ACTIVE'),
      department: departmentMap.isEmpty
          ? null
          : Department.fromJson(departmentMap),
      position: positionMap.isEmpty ? null : Position.fromJson(positionMap),
    );
  }
}

class LeaveType {
  LeaveType({
    required this.id,
    required this.code,
    required this.name,
    this.annualAllowance,
  });

  final int id;
  final String code;
  final String name;
  final double? annualAllowance;

  factory LeaveType.fromJson(Map<String, dynamic> json) {
    return LeaveType(
      id: intOf(json['id']),
      code: textOf(json['code']),
      name: textOf(json['name']),
      annualAllowance: doubleOf(json['annualAllowance']),
    );
  }
}

class LeaveRequest {
  LeaveRequest({
    required this.id,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.rejectionReason,
  });

  final int id;
  final LeaveType leaveType;
  final String startDate;
  final String endDate;
  final double totalDays;
  final String reason;
  final String status;
  final String createdAt;
  final String? rejectionReason;

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: intOf(json['id']),
      leaveType: LeaveType.fromJson(mapOf(json['leaveType'])),
      startDate: textOf(json['startDate']),
      endDate: textOf(json['endDate']),
      totalDays: doubleOf(json['totalDays']) ?? 0,
      reason: textOf(json['reason']),
      status: textOf(json['status'], 'PENDING'),
      createdAt: textOf(json['createdAt']),
      rejectionReason: json['rejectionReason']?.toString(),
    );
  }
}

class AttendanceRecord {
  AttendanceRecord({
    required this.id,
    required this.workDate,
    required this.recordType,
    required this.recordedAt,
    required this.source,
    required this.isAdjustment,
    this.shift,
    this.attendanceStatus,
    this.latitude,
    this.longitude,
    this.address,
    this.distanceMeters,
    this.note,
  });

  final int id;
  final String workDate;
  final String recordType;
  final String recordedAt;
  final String source;
  final bool isAdjustment;
  final String? shift;
  final String? attendanceStatus;
  final double? latitude;
  final double? longitude;
  final String? address;
  final int? distanceMeters;
  final String? note;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: intOf(json['id']),
      workDate: textOf(json['workDate']),
      recordType: textOf(json['recordType']),
      recordedAt: textOf(json['recordedAt']),
      source: textOf(json['source']),
      isAdjustment: json['isAdjustment'] == true,
      shift: json['shift']?.toString(),
      attendanceStatus: json['attendanceStatus']?.toString(),
      latitude: doubleOf(json['latitude']),
      longitude: doubleOf(json['longitude']),
      address: json['address']?.toString(),
      distanceMeters: json['distanceMeters'] == null
          ? null
          : intOf(json['distanceMeters']),
      note: json['note']?.toString(),
    );
  }
}

class LocationPolicy {
  LocationPolicy({
    this.companyLatitude,
    this.companyLongitude,
    required this.attendanceRadiusMeters,
    required this.requireAttendanceLocation,
  });

  final double? companyLatitude;
  final double? companyLongitude;
  final double attendanceRadiusMeters;
  final bool requireAttendanceLocation;

  factory LocationPolicy.fromJson(Map<String, dynamic> json) {
    return LocationPolicy(
      companyLatitude: doubleOf(json['companyLatitude']),
      companyLongitude: doubleOf(json['companyLongitude']),
      attendanceRadiusMeters: doubleOf(json['attendanceRadiusMeters']) ?? 0,
      requireAttendanceLocation: json['requireAttendanceLocation'] == true,
    );
  }
}

class Skill {
  Skill({
    required this.id,
    required this.code,
    required this.name,
    this.category,
  });

  final int id;
  final String code;
  final String name;
  final String? category;

  factory Skill.fromJson(Map<String, dynamic> json) {
    return Skill(
      id: intOf(json['id']),
      code: textOf(json['code']),
      name: textOf(json['name']),
      category: json['category']?.toString(),
    );
  }
}

class EmployeeSkill {
  EmployeeSkill({
    required this.id,
    required this.skill,
    this.yearsExperience,
    this.proficiency,
    this.lastUsedAt,
    this.note,
  });

  final int id;
  final Skill skill;
  final double? yearsExperience;
  final String? proficiency;
  final String? lastUsedAt;
  final String? note;

  factory EmployeeSkill.fromJson(Map<String, dynamic> json) {
    return EmployeeSkill(
      id: intOf(json['id']),
      skill: Skill.fromJson(mapOf(json['skill'])),
      yearsExperience: doubleOf(json['yearsExperience']),
      proficiency: json['proficiency']?.toString(),
      lastUsedAt: json['lastUsedAt']?.toString(),
      note: json['note']?.toString(),
    );
  }
}

class TaskRequiredSkill {
  TaskRequiredSkill({
    required this.id,
    required this.skill,
    this.requiredProficiency,
    this.weight,
  });

  final int id;
  final Skill skill;
  final String? requiredProficiency;
  final double? weight;

  factory TaskRequiredSkill.fromJson(Map<String, dynamic> json) {
    return TaskRequiredSkill(
      id: intOf(json['id']),
      skill: Skill.fromJson(mapOf(json['skill'])),
      requiredProficiency: json['requiredProficiency']?.toString(),
      weight: doubleOf(json['weight']),
    );
  }
}

class TaskSummary {
  TaskSummary({
    required this.id,
    required this.title,
    required this.status,
    this.startDate,
    this.dueDate,
  });

  final int id;
  final String title;
  final String status;
  final String? startDate;
  final String? dueDate;

  factory TaskSummary.fromJson(Map<String, dynamic> json) {
    return TaskSummary(
      id: intOf(json['id']),
      title: textOf(json['title'], tx('Công việc chưa đặt tên')),
      status: textOf(json['status'], 'TODO'),
      startDate: json['startDate']?.toString(),
      dueDate: json['dueDate']?.toString(),
    );
  }
}

class TaskItem {
  TaskItem({
    required this.id,
    required this.title,
    required this.priority,
    required this.status,
    this.parentTaskId,
    this.description,
    this.project,
    this.department,
    this.team,
    this.assignee,
    this.parentTask,
    this.startDate,
    this.dueDate,
    this.estimatedHours,
    this.actualHours,
    this.requiredSkills = const [],
    this.childTasks = const [],
  });

  final int id;
  final String title;
  final String priority;
  final String status;
  final int? parentTaskId;
  final String? description;
  final Project? project;
  final Department? department;
  final Team? team;
  final Employee? assignee;
  final TaskSummary? parentTask;
  final String? startDate;
  final String? dueDate;
  final double? estimatedHours;
  final double? actualHours;
  final List<TaskRequiredSkill> requiredSkills;
  final List<TaskItem> childTasks;

  bool get isOpen => status != 'DONE' && status != 'CANCELLED';
  bool get isOverdue {
    final due = dateOf(dueDate);
    if (!isOpen || due == null) return false;
    final today = DateTime.now();
    final dueOnly = DateTime(due.year, due.month, due.day);
    final todayOnly = DateTime(today.year, today.month, today.day);
    return dueOnly.isBefore(todayOnly);
  }

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    final rawSkills = json['requiredSkills'] is List
        ? json['requiredSkills'] as List
        : const [];
    final rawChildTasks = json['childTasks'] is List
        ? json['childTasks'] as List
        : const [];
    final projectMap = mapOf(json['project']);
    final departmentMap = mapOf(json['department']);
    final teamMap = mapOf(json['team']);
    final assigneeMap = mapOf(json['assignee']);
    final parentTaskMap = mapOf(json['parentTask']);
    return TaskItem(
      id: intOf(json['id']),
      title: textOf(json['title'], tx('Công việc chưa đặt tên')),
      parentTaskId: json['parentTaskId'] == null
          ? null
          : intOf(json['parentTaskId']),
      description: json['description']?.toString(),
      priority: textOf(json['priority'], 'MEDIUM'),
      status: textOf(json['status'], 'TODO'),
      project: projectMap.isEmpty ? null : Project.fromJson(projectMap),
      department: departmentMap.isEmpty
          ? null
          : Department.fromJson(departmentMap),
      team: teamMap.isEmpty ? null : Team.fromJson(teamMap),
      assignee: assigneeMap.isEmpty ? null : Employee.fromJson(assigneeMap),
      parentTask: parentTaskMap.isEmpty
          ? null
          : TaskSummary.fromJson(parentTaskMap),
      startDate: json['startDate']?.toString(),
      dueDate: json['dueDate']?.toString(),
      estimatedHours: doubleOf(json['estimatedHours']),
      actualHours: doubleOf(json['actualHours']),
      requiredSkills: rawSkills
          .map((item) => TaskRequiredSkill.fromJson(mapOf(item)))
          .toList(),
      childTasks: rawChildTasks
          .map((item) => TaskItem.fromJson(mapOf(item)))
          .toList(),
    );
  }
}

class AppNotification {
  AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  final int id;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final String createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: intOf(json['id']),
      type: textOf(json['type']),
      title: textOf(json['title']),
      message: textOf(json['message']),
      isRead: json['isRead'] == true,
      createdAt: textOf(json['createdAt']),
    );
  }
}

class ReviewCycle {
  ReviewCycle({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.status,
  });

  final int id;
  final String name;
  final String startDate;
  final String endDate;
  final String status;

  factory ReviewCycle.fromJson(Map<String, dynamic> json) {
    return ReviewCycle(
      id: intOf(json['id']),
      name: textOf(json['name']),
      startDate: textOf(json['startDate']),
      endDate: textOf(json['endDate']),
      status: textOf(json['status'], 'OPEN'),
    );
  }
}

class PerformanceReview {
  PerformanceReview({
    required this.id,
    required this.cycle,
    required this.status,
    this.selfRating,
    this.selfComment,
    this.managerRating,
    this.managerComment,
    this.finalRating,
  });

  final int id;
  final ReviewCycle cycle;
  final String status;
  final int? selfRating;
  final String? selfComment;
  final int? managerRating;
  final String? managerComment;
  final int? finalRating;

  bool get needsSelfAssessment => status == 'PENDING_SELF';

  factory PerformanceReview.fromJson(Map<String, dynamic> json) {
    return PerformanceReview(
      id: intOf(json['id']),
      cycle: ReviewCycle.fromJson(mapOf(json['cycle'])),
      status: textOf(json['status'], 'PENDING_SELF'),
      selfRating: json['selfRating'] == null ? null : intOf(json['selfRating']),
      selfComment: json['selfComment']?.toString(),
      managerRating: json['managerRating'] == null
          ? null
          : intOf(json['managerRating']),
      managerComment: json['managerComment']?.toString(),
      finalRating: json['finalRating'] == null
          ? null
          : intOf(json['finalRating']),
    );
  }
}
