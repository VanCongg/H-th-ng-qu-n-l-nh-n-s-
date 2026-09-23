import 'package:flutter/material.dart';

import '../../core/utils.dart';

/// The HRGenie mascot, drawn rather than shipped as an image so it stays
/// sharp at any size and follows the theme. [size] is the side of the square
/// it is drawn in.
class GenieMascot extends StatelessWidget {
  const GenieMascot({super.key, this.size});

  final double? size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: size == null ? Size.zero : Size.square(size!),
      painter: _GenieMascotPainter(brand: brandColor, accent: accentColor),
      child: size == null ? null : SizedBox.square(dimension: size),
    );
  }
}

/// A small genie sitting on its lamp: round head, big eyes, rosy cheeks.
/// The two theme colors are fields rather than globals read inside [paint],
/// so the mascot is repainted when the palette changes.
class _GenieMascotPainter extends CustomPainter {
  const _GenieMascotPainter({required this.brand, required this.accent});

  final Color brand;
  final Color accent;

  static const _skin = Color(0xFF74C0FC);
  static const _blush = Color(0xFFFFC9C9);
  static const _lampEdge = Color(0xFFE67700);

  @override
  void paint(Canvas canvas, Size size) {
    // Drawn in a 72x72 box and then scaled, so every coordinate is fixed.
    final scale = size.shortestSide / 72;
    canvas
      ..save()
      ..translate((size.width - 72 * scale) / 2, (size.height - 72 * scale) / 2)
      ..scale(scale);

    final glow = Paint()
      ..shader = RadialGradient(
        colors: [brand.withValues(alpha: 0.22), Colors.transparent],
      ).createShader(const Rect.fromLTWH(4, 4, 64, 64));
    canvas.drawCircle(const Offset(36, 34), 32, glow);

    final sparkle = Paint()..color = accent;
    canvas
      ..drawPath(_star(const Offset(13, 24), 4), sparkle)
      ..drawPath(_star(const Offset(59, 18), 3), sparkle)
      ..drawPath(_star(const Offset(60, 35), 2.2), sparkle);

    final lamp = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [const Color(0xFFFFF3BF), accent, _lampEdge],
      ).createShader(const Rect.fromLTWH(14, 47, 48, 18));
    final lampBody = Path()
      ..moveTo(21, 56)
      ..cubicTo(28, 48, 45, 48, 52, 56)
      ..cubicTo(47, 64, 26, 64, 21, 56)
      ..close();
    canvas
      ..drawPath(lampBody, lamp)
      ..drawOval(const Rect.fromLTWH(29, 46, 16, 6), lamp);
    canvas.drawPath(
      Path()
        ..moveTo(51, 54)
        ..quadraticBezierTo(61, 50, 64, 55)
        ..quadraticBezierTo(58, 58, 52, 57)
        ..close(),
      lamp,
    );
    canvas.drawPath(
      Path()
        ..moveTo(22, 56)
        ..cubicTo(11, 49, 10, 63, 21, 59),
      Paint()
        ..color = _lampEdge
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );

    // Body: a short wisp of smoke rising from the lamp to the head.
    final bodyPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [_skin, brand],
      ).createShader(const Rect.fromLTWH(26, 32, 20, 20));
    final body = Path()
      ..moveTo(30, 49)
      ..quadraticBezierTo(25, 44, 30, 38)
      ..lineTo(42, 38)
      ..quadraticBezierTo(47, 44, 42, 49)
      ..quadraticBezierTo(36, 52, 30, 49)
      ..close();
    canvas.drawPath(body, bodyPaint);

    final arm = Paint()
      ..color = _skin
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.4
      ..strokeCap = StrokeCap.round;
    canvas
      ..drawLine(const Offset(28, 43), const Offset(21, 45), arm)
      ..drawLine(const Offset(44, 43), const Offset(51, 45), arm);

    // Head: big and round, with a little top knot.
    final headPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [const Color(0xFFA5D8FF), brand],
      ).createShader(const Rect.fromLTWH(22, 12, 28, 28));
    canvas
      ..drawCircle(const Offset(36, 27), 14, headPaint)
      ..drawCircle(const Offset(36, 11), 3.4, headPaint)
      ..drawLine(
        const Offset(36, 14),
        const Offset(36, 17),
        Paint()
          ..color = brand
          ..strokeWidth = 2.2
          ..strokeCap = StrokeCap.round,
      );

    // A soft highlight keeps the head from reading as a flat ball.
    canvas.drawOval(
      const Rect.fromLTWH(26, 16, 11, 8),
      Paint()..color = Colors.white.withValues(alpha: 0.28),
    );

    final eye = Paint()..color = brandNavy;
    canvas
      ..drawCircle(const Offset(31, 27), 3, eye)
      ..drawCircle(const Offset(41, 27), 3, eye);
    final shine = Paint()..color = Colors.white;
    canvas
      ..drawCircle(const Offset(32.1, 25.9), 1.1, shine)
      ..drawCircle(const Offset(42.1, 25.9), 1.1, shine);

    final cheek = Paint()..color = _blush.withValues(alpha: 0.85);
    canvas
      ..drawOval(const Rect.fromLTWH(23.5, 30, 6, 4), cheek)
      ..drawOval(const Rect.fromLTWH(42.5, 30, 6, 4), cheek);

    canvas.drawPath(
      Path()
        ..moveTo(33, 32)
        ..quadraticBezierTo(36, 35.4, 39, 32),
      Paint()
        ..color = brandNavy
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8
        ..strokeCap = StrokeCap.round,
    );

    canvas.restore();
  }

  /// A four-pointed sparkle: a diamond with its sides pulled inwards.
  Path _star(Offset center, double radius) {
    final waist = radius * 0.22;
    return Path()
      ..moveTo(center.dx, center.dy - radius)
      ..quadraticBezierTo(
        center.dx + waist,
        center.dy - waist,
        center.dx + radius,
        center.dy,
      )
      ..quadraticBezierTo(
        center.dx + waist,
        center.dy + waist,
        center.dx,
        center.dy + radius,
      )
      ..quadraticBezierTo(
        center.dx - waist,
        center.dy + waist,
        center.dx - radius,
        center.dy,
      )
      ..quadraticBezierTo(
        center.dx - waist,
        center.dy - waist,
        center.dx,
        center.dy - radius,
      )
      ..close();
  }

  @override
  bool shouldRepaint(covariant _GenieMascotPainter oldDelegate) =>
      oldDelegate.brand != brand || oldDelegate.accent != accent;
}
