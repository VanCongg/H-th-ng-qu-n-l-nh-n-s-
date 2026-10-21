import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/utils.dart';
import 'package:omnihr_app/models/omni_models.dart';

void main() {
  test('a subtask without its own level range shows its team task\'s', () {
    final task = TaskItem.fromJson({
      'id': 5,
      'title': 'Sửa lỗi chính tả',
      'priority': 'LOW',
      'status': 'TODO',
      'parentTaskId': 4,
      'parentTask': {
        'id': 4,
        'title': 'Web',
        'minLevel': 'FRESHER',
        'maxLevel': 'JUNIOR',
      },
    });

    expect(task.minLevel, 'FRESHER');
    expect(
      levelRangeLabel(task.minLevel, task.maxLevel),
      'Cấp: Fresher - Junior',
    );
  });

  test('names an open-ended range', () {
    expect(levelRangeLabel('MIDDLE', null), 'Cấp: từ Middle');
    expect(levelRangeLabel(null, 'JUNIOR'), 'Cấp: tối đa Junior');
  });
}
