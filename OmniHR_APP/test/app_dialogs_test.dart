import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/utils.dart';
import 'package:omnihr_app/shared/widgets/widgets.dart';

/// A phone-width surface: the old `actions:` layout stacked its buttons here.
Future<void> _pumpHost(
  WidgetTester tester,
  Widget Function(BuildContext) body,
) {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(body: Builder(builder: body)),
    ),
  );
}

void main() {
  testWidgets('keeps confirm and cancel on one row at phone width', (
    tester,
  ) async {
    await _pumpHost(tester, (context) {
      return TextButton(
        onPressed: () => showAppConfirm(
          context,
          icon: Icons.cancel_outlined,
          destructive: true,
          title: 'Hủy đơn nghỉ phép',
          message:
              'Bạn muốn hủy đơn Nghỉ phép năm từ 01/10/2026 '
              'đến 03/10/2026?',
          cancelLabel: 'Không hủy',
          confirmLabel: 'Xác nhận hủy',
        ),
        child: const Text('open'),
      );
    });

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final cancel = tester.getRect(find.text('Không hủy'));
    final confirm = tester.getRect(find.text('Xác nhận hủy'));

    // Same row: vertically aligned, cancel to the left of confirm.
    expect(cancel.center.dy, moreOrLessEquals(confirm.center.dy, epsilon: 1));
    expect(cancel.right, lessThan(confirm.left));
  });

  testWidgets('dismissing the dialog counts as declining', (tester) async {
    bool? answer;
    await _pumpHost(tester, (context) {
      return TextButton(
        onPressed: () async {
          answer = await showAppConfirm(
            context,
            icon: Icons.logout_rounded,
            title: 'Đăng xuất',
            message: 'Bạn muốn đăng xuất khỏi OmniHR?',
            confirmLabel: 'Đăng xuất',
          );
        },
        child: const Text('open'),
      );
    });

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(10, 10)); // outside the dialog
    await tester.pumpAndSettle();

    expect(answer, isFalse);
  });

  test('notification titles are rendered from the stable type', () {
    // The rows already in the database carry English titles.
    expect(
      notificationTitle('TASK_ASSIGNED', 'New task assigned'),
      'Bạn được giao công việc mới',
    );
    expect(
      notificationTitle('LEAVE_REJECTED', 'Leave request rejected'),
      'Đơn nghỉ phép bị từ chối',
    );
    // An unknown type keeps whatever the server stored.
    expect(notificationTitle('SOMETHING_NEW', 'Stored title'), 'Stored title');
  });

  test('distances read as grouped metres', () {
    expect(formatMeters(4520.4), '4,520');
    expect(formatMeters(150), '150');
  });
}
