import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/models/omni_models.dart';
import 'package:omnihr_app/shared/widgets/widgets.dart';

AttendanceRecord _record(String recordType) {
  return AttendanceRecord(
    id: 1,
    workDate: '2026-09-13',
    recordType: recordType,
    recordedAt: '2026-09-13T01:05:00Z',
    source: 'MOBILE',
    isAdjustment: false,
  );
}

Widget _host(Widget child) {
  return MaterialApp(
    home: Scaffold(body: Center(child: child)),
  );
}

void main() {
  testWidgets('fills a recorded slot with a tick and leaves the other empty', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        AttendanceMomentStrip(
          checkInRecord: _record('CHECK_IN'),
          checkOutRecord: null,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    expect(find.byIcon(Icons.logout_rounded), findsOneWidget);
    expect(find.text('--:--'), findsOneWidget);
  });

  testWidgets('shows a status as an icon with its label in the tooltip', (
    tester,
  ) async {
    await tester.pumpWidget(_host(StatusIcon.status('APPROVED')));

    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    expect(find.byTooltip('Đã duyệt'), findsOneWidget);
  });

  testWidgets('swaps the action icon for a tick after a punch is recorded', (
    tester,
  ) async {
    Widget orb({required bool celebrate}) => _host(
      AttendanceActionOrb(
        label: 'Vào ca',
        icon: Icons.login_rounded,
        color: Colors.blue,
        submitting: false,
        celebrate: celebrate,
        onPressed: () {},
      ),
    );

    await tester.pumpWidget(orb(celebrate: false));
    expect(find.byIcon(Icons.login_rounded), findsOneWidget);

    await tester.pumpWidget(orb(celebrate: true));
    // The orb pulses forever, so advance past the switch animation instead of settling.
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    expect(find.byIcon(Icons.login_rounded), findsNothing);
  });
}
