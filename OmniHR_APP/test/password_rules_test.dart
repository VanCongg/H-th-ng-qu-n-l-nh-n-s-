import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/password_rules.dart';
import 'package:omnihr_app/shared/widgets/user_avatar.dart';

void main() {
  group('password rules', () {
    test('ask for what the server asks for', () {
      expect(meetsPasswordRules('Brand#new2026'), isTrue);
      expect(meetsPasswordRules('abc123'), isFalse);
      expect(meetsPasswordRules('abcdefgh'), isFalse);
      expect(meetsPasswordRules('Abcdefg1'), isFalse, reason: 'no symbol');
    });

    test('spot the username or the email name inside a password', () {
      expect(
        passwordContainsIdentity(
          'Xx-congnv-99!',
          'congnv',
          'congnv@omnihr.com',
        ),
        isTrue,
      );
      expect(
        passwordContainsIdentity('Banana#2026', 'an', 'an@omnihr.com'),
        isFalse,
      );
    });
  });

  group('avatar image', () {
    test('reads a data URL, a link, and nothing else', () {
      const pixel =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      expect(avatarImage(pixel), isA<MemoryImage>());
      expect(avatarImage('https://example.com/a.png'), isA<NetworkImage>());
      expect(avatarImage(''), isNull);
      expect(avatarImage('javascript:alert(1)'), isNull);
    });

    testWidgets('shows the initial when there is no picture', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: UserAvatar(name: 'công nguyễn')),
      );
      expect(find.text('C'), findsOneWidget);
    });
  });
}
