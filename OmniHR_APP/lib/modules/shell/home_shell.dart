import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';
import '../chat/chat_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../notifications/notifications_screen.dart';
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
                      _NotificationBellButton(session: session),
                      const SizedBox(width: 6),
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

class _NotificationBellButton extends StatefulWidget {
  const _NotificationBellButton({required this.session});

  final AppSession session;

  @override
  State<_NotificationBellButton> createState() =>
      _NotificationBellButtonState();
}

class _NotificationBellButtonState extends State<_NotificationBellButton> {
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _loadUnread();
  }

  Future<void> _loadUnread() async {
    try {
      final data = await widget.session.api.get('/notifications/unread-count');
      if (mounted) setState(() => _unread = intOf(data));
    } catch (_) {
      // A badge is not worth an error on the home screen.
    }
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SubScreen(
          title: tx('Thông báo'),
          child: NotificationsScreen(session: widget.session),
        ),
      ),
    );
    await _loadUnread();
  }

  @override
  Widget build(BuildContext context) {
    final badge = _unread > 99 ? '99+' : '$_unread';

    return Semantics(
      label: tx('Thông báo'),
      button: true,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: _openNotifications,
          child: SizedBox(
            width: 38,
            height: 38,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  Icons.notifications_none_rounded,
                  size: 24,
                  color: brandColor,
                ),
                if (_unread > 0)
                  Positioned(
                    top: 4,
                    right: 2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1,
                      ),
                      constraints: const BoxConstraints(minWidth: 16),
                      decoration: BoxDecoration(
                        color: dangerColor,
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(color: surfaceColor, width: 1.5),
                      ),
                      child: Text(
                        badge,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
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

class _DraggableHrGenieBubbleState extends State<_DraggableHrGenieBubble>
    with SingleTickerProviderStateMixin {
  static const _size = 68.0;
  static const _margin = 14.0;

  /// How much of the bubble still shows once it is tucked against the edge,
  /// and how far off screen a drag has to end for it to be tucked away.
  static const _peek = 0.42;
  static const _hideThreshold = _size * 0.3;

  /// The drag writes here instead of calling setState: only the position
  /// changes, so rebuilding the bubble itself - border, blurred shadow,
  /// mascot - on every pointer move is wasted work, and it is what made
  /// dragging feel heavy.
  late final ValueNotifier<Offset> _offset;
  late final AnimationController _settle;
  Animation<Offset>? _slide;
  bool _dragging = false;

  @override
  void initState() {
    super.initState();
    _settle = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 240),
    )..addListener(() => _offset.value = _slide?.value ?? _offset.value);
    // Parks bottom right on first launch.
    _offset = ValueNotifier(
      _restingPlace(
        Offset(widget.constraints.maxWidth, widget.constraints.maxHeight),
      ),
    );
  }

  @override
  void didUpdateWidget(covariant _DraggableHrGenieBubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Covers both the home screen's card bringing the bubble back and the
    // screen changing size (rotation, window resize).
    if (_dragging) return;
    final target = _restingPlace(_offset.value);
    if (target != _offset.value) _settleTo(target);
  }

  @override
  void dispose() {
    _settle.dispose();
    _offset.dispose();
    super.dispose();
  }

  bool get _hidden => widget.session.genieHidden;

  double get _maxX => (widget.constraints.maxWidth - _size - _margin)
      .clamp(_margin, double.infinity)
      .toDouble();

  double get _maxY => (widget.constraints.maxHeight - _size - _margin)
      .clamp(_margin, double.infinity)
      .toDouble();

  /// Where the bubble comes to rest after being let go: against the nearer
  /// side, fully on screen, or peeking out of it while it is hidden.
  Offset _restingPlace(Offset value) {
    final onRight = value.dx + _size / 2 >= widget.constraints.maxWidth / 2;
    final y = value.dy.clamp(_margin, _maxY).toDouble();
    if (!_hidden) return Offset(onRight ? _maxX : _margin, y);
    return Offset(
      onRight
          ? widget.constraints.maxWidth - _size * _peek
          : -_size * (1 - _peek),
      y,
    );
  }

  /// A drag may take the bubble half way off either side - that is how it is
  /// tucked away - but never off the top or the bottom.
  Offset _clampToDragArea(Offset value) {
    return Offset(
      value.dx
          .clamp(-_size / 2, widget.constraints.maxWidth - _size / 2)
          .toDouble(),
      value.dy.clamp(_margin, _maxY).toDouble(),
    );
  }

  /// How far a position pushes the bubble past the left or the right edge.
  double _offScreen(Offset value) {
    final left = -value.dx;
    final right = value.dx + _size - widget.constraints.maxWidth;
    return left > right ? left : right;
  }

  void _settleTo(Offset target) {
    _slide = Tween<Offset>(
      begin: _offset.value,
      end: target,
    ).animate(CurvedAnimation(parent: _settle, curve: Curves.easeOutCubic));
    _settle.forward(from: 0);
  }

  void _onPanStart(DragStartDetails details) {
    _settle.stop();
    _dragging = true;
  }

  void _onPanUpdate(DragUpdateDetails details) {
    _offset.value = _clampToDragArea(_offset.value + details.delta);
  }

  void _onPanEnd(DragEndDetails details) {
    _dragging = false;
    // Set first, then read: the resting place depends on the new state, and
    // the session applies it before it notifies.
    widget.session.setGenieHidden(_offScreen(_offset.value) > _hideThreshold);
    _settleTo(_restingPlace(_offset.value));
  }

  void _onTap() {
    if (_hidden) {
      widget.session.setGenieHidden(false);
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(session: widget.session),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Offset>(
      valueListenable: _offset,
      builder: (context, offset, child) =>
          Positioned(left: offset.dx, top: offset.dy, child: child!),
      child: GestureDetector(
        // Start on touch down rather than after the drag slop, so the bubble
        // follows the finger from the first pixel instead of jumping once it
        // has travelled far enough.
        dragStartBehavior: DragStartBehavior.down,
        onPanStart: _onPanStart,
        onPanUpdate: _onPanUpdate,
        onPanEnd: _onPanEnd,
        child: RepaintBoundary(
          child: _HrGenieBubble(size: _size, hidden: _hidden, onTap: _onTap),
        ),
      ),
    );
  }
}

class _HrGenieBubble extends StatelessWidget {
  const _HrGenieBubble({
    required this.size,
    required this.hidden,
    required this.onTap,
  });

  final double size;
  final bool hidden;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    // The circle and its shadow sit outside the Material: painted as Ink
    // inside it, the offset shadow was clipped to the square bounds and
    // showed as a pale block under the bubble.
    return Semantics(
      label: hidden ? tx('Hiện trợ lý') : 'HRGenie',
      button: true,
      child: AnimatedOpacity(
        opacity: hidden ? 0.62 : 1,
        duration: const Duration(milliseconds: 200),
        child: SizedBox.square(
          dimension: size,
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
                onTap: onTap,
                child: const Padding(
                  padding: EdgeInsets.all(7),
                  child: GenieMascot(),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
