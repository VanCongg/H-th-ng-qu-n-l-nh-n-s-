import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/models/omni_models.dart';
import 'package:omnihr_app/modules/tasks/tasks_screen.dart';

TaskItem _task({required int id, String? dueDate}) {
  return TaskItem.fromJson({
    'id': id,
    'title': 'Task $id',
    'status': 'TODO',
    'priority': 'MEDIUM',
    'dueDate': dueDate,
  });
}

void main() {
  test('separates undated tasks from the month they were fetched with', () {
    final split = splitTasksByDueDate([
      _task(id: 1, dueDate: '2026-09-24'),
      _task(id: 2),
      _task(id: 3, dueDate: '2026-09-02'),
      _task(id: 4, dueDate: ''),
    ]);

    expect(split.dated.map((task) => task.id), [1, 3]);
    // Both a missing and an unparseable due date belong to no month.
    expect(split.undated.map((task) => task.id), [2, 4]);
  });

  test('handles a month with nothing in it', () {
    final split = splitTasksByDueDate(const []);
    expect(split.dated, isEmpty);
    expect(split.undated, isEmpty);
  });
}
