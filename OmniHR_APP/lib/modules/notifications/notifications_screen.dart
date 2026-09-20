import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<AppNotification>> _future;
  List<AppNotification> _items = const [];
  bool _markingAll = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<AppNotification>> _load() async {
    final items = await widget.session.api.getList(
      '/notifications',
      AppNotification.fromJson,
      query: {'limit': 50},
    );
    _items = items;
    return items;
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  int get _unreadCount =>
      _items.where((notification) => !notification.isRead).length;

  Future<void> _markRead(AppNotification notification) async {
    if (notification.isRead) return;

    // The list is already on screen, so flip the row first and put it back
    // only if the server refuses.
    setState(() => _items = _replace(notification.copyWith(isRead: true)));
    try {
      await widget.session.api.patch('/notifications/${notification.id}/read');
    } catch (error) {
      if (!mounted) return;
      setState(() => _items = _replace(notification));
      showAppSnack(
        context,
        error is ApiException ? error.message : error.toString(),
        error: true,
      );
    }
  }

  List<AppNotification> _replace(AppNotification updated) {
    return [for (final item in _items) item.id == updated.id ? updated : item];
  }

  Future<void> _markAllRead() async {
    if (_markingAll || _unreadCount == 0) return;

    setState(() => _markingAll = true);
    try {
      await widget.session.api.patch('/notifications/read-all');
      await _refresh();
      if (mounted) {
        showAppSnack(context, tx('Đã đánh dấu tất cả là đã đọc.'));
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          error is ApiException ? error.message : error.toString(),
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AppNotification>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 104),
            children: [
              Row(
                children: [
                  Pill(
                    label: _unreadCount == 0
                        ? tx('Bạn đã đọc hết thông báo.')
                        : tx('{count} thông báo chưa đọc', {
                            'count': '$_unreadCount',
                          }),
                    color: _unreadCount > 0 ? accentColor : brandGreen,
                  ),
                  const Spacer(),
                  if (_unreadCount > 0)
                    TextButton.icon(
                      onPressed: _markingAll ? null : _markAllRead,
                      icon: const Icon(Icons.done_all_rounded, size: 18),
                      label: Text(tx('Đánh dấu đã đọc tất cả')),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (_items.isEmpty)
                EmptyState(
                  icon: Icons.notifications_none_rounded,
                  title: tx('Chưa có thông báo'),
                  body: tx('Thông báo mới sẽ xuất hiện tại đây.'),
                )
              else
                for (final notification in _items) ...[
                  _NotificationCard(
                    notification: notification,
                    onTap: () => _markRead(notification),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        );
      },
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = notificationColor(notification.type);

    return PressableScale(
      onTap: onTap,
      child: AppPanel(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppIconBadge(
              icon: notificationIcon(notification.type),
              color: color,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontWeight: notification.isRead
                                ? FontWeight.w700
                                : FontWeight.w900,
                          ),
                        ),
                      ),
                      if (!notification.isRead)
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.message,
                    style: TextStyle(
                      color: mutedTextColor,
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    formatDateTime(notification.createdAt),
                    style: TextStyle(
                      color: mutedTextColor,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
