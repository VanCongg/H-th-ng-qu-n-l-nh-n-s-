import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/models/omni_models.dart';
import 'package:omnihr_app/modules/approvals/approvals_screen.dart';

AuthUser _user(List<String> permissions) => AuthUser.fromJson({
  'id': 1,
  'username': 'lead',
  'email': 'lead@omnihr.local',
  'roles': ['MANAGER'],
  'permissions': permissions,
  'employeeId': 5,
});

void main() {
  test('offers the approvals screen only to someone who decides something', () {
    expect(canReviewOnMobile(null), isFalse);
    expect(canReviewOnMobile(_user(['LEAVE_READ_SELF'])), isFalse);
    expect(
      canReviewOnMobile(_user(['LEAVE_APPROVE', 'LEAVE_READ_TEAM'])),
      isTrue,
    );
    expect(
      canReviewOnMobile(_user(['TASK_UPDATE_STATUS', 'TASK_READ_TEAM'])),
      isTrue,
    );
    // Updating one's own task status is not reviewing anybody's.
    expect(canReviewOnMobile(_user(['TASK_UPDATE_STATUS'])), isFalse);
  });

  test('a team leave request carries who asked for it', () {
    final leave = LeaveRequest.fromJson({
      'id': 3,
      'leaveType': {'id': 1, 'code': 'ANNUAL_LEAVE', 'name': 'Phép năm'},
      'employee': {'id': 9, 'employeeCode': 'NV009', 'fullName': 'Trần B'},
      'startDate': '2026-10-05',
      'endDate': '2026-10-05',
      'totalDays': 1,
      'reason': 'Việc nhà',
      'status': 'PENDING',
      'createdAt': '2026-09-26T02:00:00Z',
    });

    expect(leave.employee?.fullName, 'Trần B');
  });
}
