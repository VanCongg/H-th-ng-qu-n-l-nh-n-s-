import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';
import '../chat/chat_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../profile/profile_screen.dart';

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.session});

  final AppSession session;

  void _openProfile(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SubScreen(
          title: tx('Cá nhân'),
          child: ProfileScreen(session: session),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BrandBackdrop(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Stack(
              children: [
                Positioned.fill(
                  child: DashboardScreen(
                    session: session,
                    topInset: AppHeaderBar.preferredHeight + 10,
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: AppHeaderBar(
                    title: tx('Trang chủ'),
                    subtitle: tx('Tổng quan công việc hôm nay'),
                    actions: [
                      _ProfileAvatarButton(
                        session: session,
                        onTap: () => _openProfile(context),
                      ),
                    ],
                  ),
                ),
                _DraggableHrGenieBubble(
                  session: session,
                  constraints: constraints,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ProfileAvatarButton extends StatelessWidget {
  const _ProfileAvatarButton({required this.session, required this.onTap});

  final AppSession session;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name =
        session.employee?.fullName ?? session.user?.username ?? tx('Nhân viên');
    final initial = name.trim().isEmpty ? 'O' : name.trim()[0].toUpperCase();

    return Semantics(
      label: tx('Cá nhân'),
      button: true,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Hero(
            tag: 'profile-avatar',
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                // Same avatar gradient as the web header.
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF1971C2),
                    Color(0xFF0CA678),
                    Color(0xFFF59F00),
                  ],
                  stops: [0, 0.65, 1],
                ),
              ),
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DraggableHrGenieBubble extends StatefulWidget {
  const _DraggableHrGenieBubble({
    required this.session,
    required this.constraints,
  });

  final AppSession session;
  final BoxConstraints constraints;

  @override
  State<_DraggableHrGenieBubble> createState() =>
      _DraggableHrGenieBubbleState();
}

class _DraggableHrGenieBubbleState extends State<_DraggableHrGenieBubble> {
  static const _size = 68.0;
  static const _margin = 14.0;

  Offset? _offset;

  @override
  Widget build(BuildContext context) {
    final maxX = (widget.constraints.maxWidth - _size - _margin)
        .clamp(_margin, double.infinity)
        .toDouble();
    final maxY = (widget.constraints.maxHeight - _size - _margin)
        .clamp(_margin, double.infinity)
        .toDouble();
    final offset = _clampOffset(
      _offset ?? Offset(maxX, maxY),
      maxX: maxX,
      maxY: maxY,
    );

    return Positioned(
      left: offset.dx,
      top: offset.dy,
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            _offset = _clampOffset(
              offset + details.delta,
              maxX: maxX,
              maxY: maxY,
            );
          });
        },
        child: _HrGenieBubble(session: widget.session),
      ),
    );
  }

  Offset _clampOffset(
    Offset value, {
    required double maxX,
    required double maxY,
  }) {
    return Offset(
      value.dx.clamp(_margin, maxX).toDouble(),
      value.dy.clamp(_margin, maxY).toDouble(),
    );
  }
}

class _HrGenieBubble extends StatelessWidget {
  const _HrGenieBubble({required this.session});

  final AppSession session;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    // The circle and its shadow sit outside the Material: painted as Ink
    // inside it, the offset shadow was clipped to the square bounds and
    // showed as a pale block under the bubble.
    return Semantics(
      label: 'HRGenie',
      button: true,
      child: SizedBox.square(
        dimension: 68,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: surfaceColor,
            border: Border.all(
              color: brandColor.withValues(alpha: dark ? 0.35 : 0.28),
              width: 1.6,
            ),
            boxShadow: [
              BoxShadow(
                color: dark
                    ? Colors.black.withValues(alpha: 0.45)
                    : const Color(0xFF1971C2).withValues(alpha: 0.22),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => _openChat(context),
              child: const Padding(
                padding: EdgeInsets.all(7),
                child: CustomPaint(painter: _GenieMascotPainter()),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _openChat(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ChatScreen(session: session)),
    );
  }
}

class _GenieMascotPainter extends CustomPainter {
  const _GenieMascotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 72;
    canvas
      ..save()
      ..translate((size.width - 72 * scale) / 2, (size.height - 72 * scale) / 2)
      ..scale(scale);

    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [brandColor.withValues(alpha: 0.20), Colors.transparent],
      ).createShader(const Rect.fromLTWH(6, 6, 60, 60));
    canvas.drawCircle(const Offset(36, 36), 31, glowPaint);

    final vaporPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [const Color(0xFF74C0FC), brandColor, brandNavy],
      ).createShader(const Rect.fromLTWH(18, 10, 36, 46));
    final vapor = Path()
      ..moveTo(29, 49)
      ..cubicTo(20, 41, 19, 30, 29, 22)
      ..cubicTo(24, 17, 27, 10, 36, 10)
      ..cubicTo(46, 10, 50, 17, 44, 23)
      ..cubicTo(54, 30, 52, 42, 42, 49)
      ..cubicTo(38, 52, 33, 52, 29, 49)
      ..close();
    canvas.drawPath(vapor, vaporPaint);

    final highlightPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.32);
    canvas.drawOval(const Rect.fromLTWH(27, 15, 11, 20), highlightPaint);

    final facePaint = Paint()..color = const Color(0xFFE7F5FF);
    canvas.drawOval(const Rect.fromLTWH(25, 19, 22, 18), facePaint);

    final eyePaint = Paint()..color = brandNavy;
    canvas
      ..drawCircle(const Offset(31, 27), 1.6, eyePaint)
      ..drawCircle(const Offset(41, 27), 1.6, eyePaint);

    final smilePaint = Paint()
      ..color = brandNavy
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.7
      ..strokeCap = StrokeCap.round;
    final smile = Path()
      ..moveTo(32, 31)
      ..quadraticBezierTo(36, 34, 40, 31);
    canvas.drawPath(smile, smilePaint);

    final armPaint = Paint()
      ..color = const Color(0xFF4DABF7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.4
      ..strokeCap = StrokeCap.round;
    canvas
      ..drawLine(const Offset(27, 38), const Offset(19, 43), armPaint)
      ..drawLine(const Offset(45, 38), const Offset(53, 43), armPaint);

    final lampPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [const Color(0xFFFFF3BF), accentColor, const Color(0xFFE67700)],
      ).createShader(const Rect.fromLTWH(15, 47, 44, 18));
    final lamp = Path()
      ..moveTo(19, 55)
      ..cubicTo(27, 47, 44, 47, 53, 55)
      ..cubicTo(49, 63, 24, 63, 19, 55)
      ..close();
    canvas.drawPath(lamp, lampPaint);
    canvas.drawOval(const Rect.fromLTWH(26, 44, 20, 7), lampPaint);
    canvas.drawOval(const Rect.fromLTWH(29, 60, 18, 4), lampPaint);

    final spout = Path()
      ..moveTo(52, 54)
      ..quadraticBezierTo(63, 50, 66, 55)
      ..quadraticBezierTo(60, 58, 53, 57)
      ..close();
    canvas.drawPath(spout, lampPaint);

    final handlePaint = Paint()
      ..color = const Color(0xFFE67700)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    final handle = Path()
      ..moveTo(20, 55)
      ..cubicTo(9, 48, 8, 62, 19, 58);
    canvas.drawPath(handle, handlePaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _GenieMascotPainter oldDelegate) => false;
}
