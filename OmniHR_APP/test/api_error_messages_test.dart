import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/api_service.dart';

void main() {
  test('a wrong password is not reported as an expired session', () {
    expect(
      friendlyBackendMessage(
        'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      ),
      'Tên đăng nhập hoặc mật khẩu không đúng.',
    );
    expect(
      friendlyBackendMessage('Unauthorized', statusCode: 401),
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  test('says how much annual leave is left, in Vietnamese', () {
    expect(
      friendlyBackendMessage(
        'Not enough annual leave: 2 day(s) left for 2026, this request needs 5',
        code: 'LEAVE_BALANCE_INSUFFICIENT',
        statusCode: 400,
      ),
      'Không đủ phép năm: năm 2026 còn 2 ngày, đơn này cần 5 ngày.',
    );
  });

  test('words the errors of half days, cancellations and task reviews', () {
    expect(
      friendlyBackendMessage(
        'x',
        code: 'LEAVE_ALREADY_STARTED',
        statusCode: 400,
      ),
      'Đơn nghỉ đã bắt đầu. Hãy trao đổi trực tiếp với quản lý để điều chỉnh.',
    );
    expect(
      friendlyBackendMessage(
        'x',
        code: 'LEAVE_HALF_DAY_RANGE',
        statusCode: 400,
      ),
      'Nghỉ nửa ngày chỉ áp dụng cho đơn một ngày.',
    );
    expect(
      friendlyBackendMessage(
        'x',
        code: 'TASK_STATUS_TRANSITION_DENIED',
        statusCode: 400,
      ),
      contains('trưởng nhóm'),
    );
  });

  test('leaves an unknown message as the server wrote it', () {
    expect(
      friendlyBackendMessage(
        'Something new',
        code: 'NEW_CODE',
        statusCode: 400,
      ),
      'Something new',
    );
  });
}
