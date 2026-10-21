import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/models/omni_models.dart';
import 'package:omnihr_app/modules/attendance/attendance_screen.dart';

void main() {
  test('reads the public holidays of the attendance policy by date', () {
    final policy = LocationPolicy.fromJson({
      'attendanceRadiusMeters': 200,
      'requireAttendanceLocation': false,
      'workWeek': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      'holidays': [
        {'date': '2026-09-02', 'name': 'Quốc khánh'},
      ],
    });

    expect(policy.holidays, {'2026-09-02': 'Quốc khánh'});
  });

  testWidgets(
    'names a holiday instead of calling it a day without attendance',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DayAttendanceDetails(
              day: DateTime(2026, 9, 2),
              records: const [],
              holidayName: 'Quốc khánh',
            ),
          ),
        ),
      );

      expect(find.text('Ngày lễ: Quốc khánh'), findsOneWidget);
      expect(find.text('Ngày này chưa ghi nhận chấm công.'), findsNothing);
    },
  );
}
