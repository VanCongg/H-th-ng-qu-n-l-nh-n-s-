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
    return _GenieCanvas(
      size: size,
      painter: _GeniePainter(
        brand: brandColor,
        accent: accentColor,
        lamp: true,
        figure: true,
      ),
    );
  }
}

/// The lamp on its own, raised to the middle of its square: what the HRGenie
/// bubble shows until it is tapped and the genie comes out.
class GenieLamp extends StatelessWidget {
  const GenieLamp({super.key, this.size});

  final double? size;

  /// Where the spout ends, as a fraction of the square the lamp is drawn in.
  /// The opening animation lets the genie out from this point.
  static const spout = Offset(64 / 72, (55 - _lampLift) / 72);

  @override
  Widget build(BuildContext context) {
    return _GenieCanvas(
      size: size,
      painter: _GeniePainter(
        brand: brandColor,
        accent: accentColor,
        lamp: true,
        figure: false,
      ),
    );
  }
}

/// The genie without its lamp, trailing off into smoke at the bottom: the
/// part that flies out when the chat is opened.
class GenieFigure extends StatelessWidget {
  const GenieFigure({super.key, this.size});

  final double? size;

  @override
  Widget build(BuildContext context) {
    return _GenieCanvas(
      size: size,
      painter: _GeniePainter(
        brand: brandColor,
        accent: accentColor,
        lamp: false,
        figure: true,
      ),
    );
  }
}

/// How far the lamp is raised when it is drawn alone, so it sits in the
/// middle of its square instead of at the bottom.
const double _lampLift = 17;

class _GenieCanvas extends StatelessWidget {
  const _GenieCanvas({required this.size, required this.painter});

  final double? size;
  final CustomPainter painter;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: size == null ? Size.zero : Size.square(size!),
      painter: painter,
      child: size == null ? null : SizedBox.square(dimension: size),
    );
  }
}

/// A small genie sitting on its lamp: round head, big eyes, rosy cheeks.
/// [lamp] and [figure] pick which of the two parts are drawn, so the bubble
/// can show the lamp alone and the genie can fly out of it on its own.
/// The two theme colors are fields rather than globals read inside [paint],
/// so the mascot is repainted when the palette changes.
class _GeniePainter extends CustomPainter {
  const _GeniePainter({
    required this.brand,
    required this.accent,
    required this.lamp,
    required this.figure,
  });

  final Color brand;
  final Color accent;
  final bool lamp;
  final bool figure;

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

    if (lamp) {
      canvas.save();
      if (!figure) canvas.translate(0, -_lampLift);
      _paintLamp(canvas);
      if (!figure) _paintWisp(canvas);
      canvas.restore();
    }
    if (figure) _paintFigure(canvas, onLamp: lamp);

    canvas.restore();
  }

  void _paintLamp(Canvas canvas) {
    final lampPaint = Paint()
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
      ..drawPath(lampBody, lampPaint)
      ..drawOval(const Rect.fromLTWH(29, 46, 16, 6), lampPaint);
    canvas.drawPath(
      Path()
        ..moveTo(51, 54)
        ..quadraticBezierTo(61, 50, 64, 55)
        ..quadraticBezierTo(58, 58, 52, 57)
        ..close(),
      lampPaint,
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
    // A lid knob, which the genie's body covers when both are drawn.
    canvas.drawCircle(const Offset(37, 45), 2.6, Paint()..color = _lampEdge);
    // A shine along the belly so the brass reads as metal.
    canvas.drawPath(
      Path()
        ..moveTo(27, 55)
        ..quadraticBezierTo(33, 51.5, 40, 52.5),
      Paint()
        ..color = Colors.white.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeCap = StrokeCap.round,
    );
  }

  /// A thin curl of smoke over the spout: something is inside.
  void _paintWisp(Canvas canvas) {
    canvas.drawPath(
      Path()
        ..moveTo(64, 53)
        ..cubicTo(67, 48, 61, 45, 64, 40)
        ..cubicTo(66, 37, 63, 35, 65, 32),
      Paint()
        ..color = _skin.withValues(alpha: 0.7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round,
    );
  }

  void _paintFigure(Canvas canvas, {required bool onLamp}) {
    // Body: a short wisp of smoke rising from the lamp to the head. Without
    // the lamp it trails off into a tail instead of ending in a flat base.
    final bodyPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: onLamp
            ? [_skin, brand]
            : [_skin, brand, brand.withValues(alpha: 0)],
      ).createShader(Rect.fromLTWH(26, 32, 20, onLamp ? 20 : 32));
    final body = onLamp
        ? (Path()
            ..moveTo(30, 49)
            ..quadraticBezierTo(25, 44, 30, 38)
            ..lineTo(42, 38)
            ..quadraticBezierTo(47, 44, 42, 49)
            ..quadraticBezierTo(36, 52, 30, 49)
            ..close())
        : (Path()
            ..moveTo(30, 38)
            ..lineTo(42, 38)
            ..quadraticBezierTo(48, 46, 41, 52)
            ..quadraticBezierTo(35, 57, 40, 64)
            ..quadraticBezierTo(29, 59, 32, 51)
            ..quadraticBezierTo(24, 45, 30, 38)
            ..close());
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
  bool shouldRepaint(covariant _GeniePainter oldDelegate) =>
      oldDelegate.brand != brand ||
      oldDelegate.accent != accent ||
      oldDelegate.lamp != lamp ||
      oldDelegate.figure != figure;
}
