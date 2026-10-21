import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/shared/widgets/widgets.dart';

void main() {
  testWidgets('keeps a sheet controller alive until the route unmounts', (
    tester,
  ) async {
    final controller = TextEditingController();
    var disposed = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) {
              return TextButton(
                onPressed: () {
                  showModalBottomSheet<bool>(
                    context: context,
                    builder: (context) {
                      return ControllerScope(
                        controllers: [controller],
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TextField(controller: controller),
                            TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('send'),
                            ),
                          ],
                        ),
                      );
                    },
                  ).whenComplete(() {
                    // The old code disposed here, while the sheet was still
                    // animating out and its TextField still using it.
                    disposed = true;
                  });
                },
                child: const Text('open'),
              );
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'nghỉ việc riêng');

    await tester.tap(find.text('send'));
    await tester.pump();

    // The sheet's future is already done while the exit animation runs, so a
    // caller disposing here would kill a controller the field still reads.
    expect(disposed, isTrue);
    expect(find.byType(TextField), findsOneWidget);

    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(() => controller.addListener(() {}), throwsFlutterError);
  });
}
