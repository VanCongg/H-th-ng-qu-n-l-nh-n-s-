/// The rules the backend holds a new password to (`ChangePasswordDto`:
/// class-validator's IsStrongPassword, plus the checks in AuthService), checked
/// on the phone first so a weak password is caught before any code is sent.
/// The whole rule in one sentence, shown when a new password falls short.
const passwordRuleHint =
    'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt';

bool meetsPasswordRules(String value) =>
    value.length >= 8 &&
    RegExp(r'[A-Z]').hasMatch(value) &&
    RegExp(r'[a-z]').hasMatch(value) &&
    RegExp(r'[0-9]').hasMatch(value) &&
    RegExp(r'[^A-Za-z0-9]').hasMatch(value);

/// Whether the password gives away whose it is: the username, or the name
/// part of the email, inside it. Names of three letters or fewer are ignored,
/// the same as on the server.
bool passwordContainsIdentity(
  String password,
  String? username,
  String? email,
) {
  final lower = password.toLowerCase();
  return [username ?? '', (email ?? '').split('@').first]
      .map((part) => part.trim().toLowerCase())
      .any((part) => part.length > 3 && lower.contains(part));
}
