import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/utils.dart';
import 'package:omnihr_app/modules/notifications/notifications_screen.dart';

void main() {
  group('notificationMessage', () {
    test('rewrites a task assignment, keeping the task title', () {
      expect(
        notificationMessage(
          'TASK_ASSIGNED',
          'You were assigned to "Khảo sát nhu cầu cho cải tạo văn phòng tầng 12".',
        ),
        'Bạn được giao công việc "Khảo sát nhu cầu cho cải tạo văn phòng tầng 12".',
      );
    });

    test('rewrites a rework notice', () {
      expect(
        notificationMessage(
          'TASK_STATUS_CHANGED',
          '"Lấy báo giá nhà cung cấp" needs changes before it can be accepted.',
        ),
        'Công việc "Lấy báo giá nhà cung cấp" cần chỉnh sửa trước khi được duyệt.',
      );
    });

    test('reads both date formats the server writes', () {
      // API and seed: JavaScript toDateString().
      expect(
        notificationMessage(
          'LEAVE_APPROVED',
          'Your leave request from Fri Jan 02 2026 to Mon Jan 05 2026 was approved.',
        ),
        'Đơn nghỉ phép từ 02/01/2026 đến 05/01/2026 của bạn đã được duyệt.',
      );
      // Simulator: ISO dates.
      expect(
        notificationMessage(
          'LEAVE_APPROVED',
          'Your leave request from 2026-09-21 to 2026-09-22 was approved.',
        ),
        'Đơn nghỉ phép từ 21/09/2026 đến 22/09/2026 của bạn đã được duyệt.',
      );
    });

    test('tells created and updated attendance adjustments apart', () {
      expect(
        notificationMessage(
          'ATTENDANCE_ADJUSTED',
          'An attendance record for Mon Sep 21 2026 was created by an admin.',
        ),
        'Quản trị viên đã thêm bản ghi chấm công ngày 21/09/2026.',
      );
      expect(
        notificationMessage(
          'ATTENDANCE_ADJUSTED',
          'An attendance record for Mon Sep 21 2026 was updated by an admin.',
        ),
        'Quản trị viên đã sửa bản ghi chấm công ngày 21/09/2026.',
      );
    });

    test('shows a free-text rejection reason exactly as written', () {
      const reason = 'Đơn gửi quá sát ngày nghỉ, cần sắp xếp người thay.';
      expect(notificationMessage('LEAVE_REJECTED', reason), reason);
    });

    test('keeps a sentence it does not recognise rather than mangling it', () {
      const reworded = 'You have been given "X" to do.';
      expect(notificationMessage('TASK_ASSIGNED', reworded), reworded);
    });
  });

  testWidgets('header fits a phone with unread notifications', (tester) async {
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            // Same side padding as the notifications list.
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: NotificationsHeader(
              unreadCount: 128,
              busy: false,
              onMarkAllRead: () {},
            ),
          ),
        ),
      ),
    );

    // A RenderFlex overflow is reported as an exception in tests.
    expect(tester.takeException(), isNull);
    expect(find.text('Đọc tất cả'), findsOneWidget);
  });
}
