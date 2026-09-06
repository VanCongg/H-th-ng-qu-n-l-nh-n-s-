import 'package:flutter/material.dart';

import '../../core/utils.dart';

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 48, this.showShadow = true});

  final double size;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'OmniHR',
      image: true,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(painter: _LogoMarkPainter(showShadow: showShadow)),
        ),
      ),
    );
  }
}

class _LogoMarkPainter extends CustomPainter {
  const _LogoMarkPainter({required this.showShadow});

  final bool showShadow;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 72;
    canvas
      ..save()
      ..translate((size.width - 72 * scale) / 2, (size.height - 72 * scale) / 2)
      ..scale(scale);

    final badgePath = Path()
      ..moveTo(36, 4.5)
      ..lineTo(58.5, 17.7)
      ..lineTo(58.5, 54.3)
      ..lineTo(36, 67.5)
      ..lineTo(13.5, 54.3)
      ..lineTo(13.5, 17.7)
      ..close();

    if (showShadow) {
      canvas.drawShadow(
        badgePath,
        const Color(0xFF127195).withValues(alpha: 0.32),
        10,
        false,
      );
    }

    final badgePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [brandGreen, brandColor, brandNavy],
        stops: const [0, 0.42, 1],
      ).createShader(const Rect.fromLTWH(4, 4, 64, 64));
    canvas.drawPath(badgePath, badgePaint);

    final edgePath = Path()
      ..moveTo(36, 7.8)
      ..lineTo(55.6, 19.3)
      ..lineTo(55.6, 52.7)
      ..lineTo(36, 64.2)
      ..lineTo(16.4, 52.7)
      ..lineTo(16.4, 19.3)
      ..close();
    final edgePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFFFF3BF), Color(0xFF74C0FC), Color(0xFF63E6BE)],
        stops: [0, 0.46, 1],
      ).createShader(const Rect.fromLTWH(12, 8, 48, 58));
    canvas.drawPath(edgePath, edgePaint);

    final shinePath = Path()
      ..moveTo(19.2, 20.8)
      ..lineTo(36, 10.9)
      ..lineTo(52.8, 20.8)
      ..lineTo(52.8, 30.5)
      ..cubicTo(41.6, 26.8, 30.4, 26.8, 19.2, 30.5)
      ..close();
    final shinePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white.withValues(alpha: 0.62),
          Colors.white.withValues(alpha: 0),
        ],
      ).createShader(const Rect.fromLTWH(18, 10, 36, 46));
    canvas.drawPath(shinePath, shinePaint);

    final whiteStroke = Paint()
      ..color = Colors.white.withValues(alpha: 0.92)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.4;
    canvas.drawCircle(const Offset(35.9, 36), 17.7, whiteStroke);

    final hPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas
      ..drawLine(const Offset(27.8, 26.6), const Offset(27.8, 45.4), hPaint)
      ..drawLine(const Offset(44.2, 26.6), const Offset(44.2, 45.4), hPaint)
      ..drawLine(const Offset(27.8, 36), const Offset(44.2, 36), hPaint);

    final arrowPaint = Paint()
      ..color = const Color(0xFFFFE066)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final arrowPath = Path()
      ..moveTo(48.9, 17.8)
      ..lineTo(55.1, 21.4)
      ..lineTo(51.5, 27.6);
    canvas.drawPath(arrowPath, arrowPaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LogoMarkPainter oldDelegate) {
    return oldDelegate.showShadow != showShadow;
  }
}
