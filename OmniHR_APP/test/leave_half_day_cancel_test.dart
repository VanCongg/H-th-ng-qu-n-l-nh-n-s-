import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/utils.dart';
import 'package:omnihr_app/models/omni_models.dart';
import 'package:omnihr_app/shared/widgets/widgets.dart';

LeaveRequest _leave(Map<String, dynamic> extra) => LeaveRequest.fromJson({
  'id': 7,
  'leaveType': {'id': 1, 'code': 'ANNUAL_LEAVE', 'name': 'Phép năm'},
  'startDate': '2026-10-09',
  'endDate': '2026-10-09',
  'totalDays': 0.5,
  'reason': 'Khám bệnh',
  'status': 'APPROVED',
  'createdAt': '2026-09-26T02:00:00Z',
  ...extra,
});

void main() {
  test('reads a half day and a pending cancellation', () {
    final leave = _leave({
      'halfDay': 'AFTERNOON',
      'cancelRequestedAt': '2026-09-26T03:00:00Z',
    });

    expect(leave.halfDay, 'AFTERNOON');
    expect(leave.totalDays, 0.5);
    expect(leave.cancelRequested, isTrue);
    expect(_leave({}).cancelRequested, isFalse);
  });

  testWidgets('the card shows the shift and that cancellation is pending', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LeaveRequestCard(
            request: _leave({
              'halfDay': 'MORNING',
              'cancelRequestedAt': '2026-09-26T03:00:00Z',
            }),
            onCancel: null,
          ),
        ),
      ),
    );

    expect(find.text('Buổi sáng'), findsOneWidget);
    expect(find.text('Đang chờ duyệt hủy'), findsOneWidget);
  });

  test('translates the cancellation notifications', () {
    expect(
      notificationMessage(
        'LEAVE_CANCEL_APPROVED',
        'Your leave from Mon Oct 05 2026 to Tue Oct 06 2026 was cancelled.',
      ),
      'Đơn nghỉ từ 05/10/2026 đến 06/10/2026 của bạn đã được hủy.',
    );
    expect(
      notificationTitle(
        'LEAVE_CANCEL_REQUESTED',
        'Leave cancellation requested',
      ),
      'Có yêu cầu hủy đơn nghỉ đã duyệt',
    );
  });
}
