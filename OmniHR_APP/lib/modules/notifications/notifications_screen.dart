import 'package:flutter/material.dart';

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

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<AppNotification>> _load() {
    return widget.session.api.getList(
      '/notifications',
      AppNotification.fromJson,
      query: {'limit': 50},
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _markRead(AppNotification notification) async {
    if (notification.isRead) return;
    try {
      await widget.session.api.patch('/notifications/${notification.id}/read');
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await widget.session.api.patch('/notifications/read-all');
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
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

        final items = snapshot.data ?? const <AppNotification>[];
        final unreadCount = items.where((item) => !item.isRead).length;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 104),
            children: [
              Row(
                children: [
                  Pill(
                    label: '$unreadCount ${tx('chưa đọc')}',
                    color: unreadCount > 0 ? accentColor : brandGreen,
                  ),
                  const Spacer(),
                  if (unreadCount > 0)
                    TextButton.icon(
                      onPressed: _markAllRead,
                      icon: const Icon(Icons.done_all_rounded, size: 18),
                      label: Text(tx('Đánh dấu đã đọc tất cả')),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              if (items.isEmpty)
                EmptyState(
                  icon: Icons.notifications_none_rounded,
                  title: tx('Chưa có thông báo'),
                  body: tx('Thông báo mới sẽ xuất hiện tại đây.'),
                )
              else
                ...items.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _NotificationTile(
                      notification: item,
                      onTap: () => _markRead(item),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: AppPanel(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppIconBadge(
              icon: Icons.notifications_rounded,
              color: notification.isRead ? Colors.grey : brandColor,
              size: 38,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: TextStyle(
                      fontWeight: notification.isRead
                          ? FontWeight.w600
                          : FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notification.message,
                    style: TextStyle(color: inkColor.withValues(alpha: 0.72)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    formatDateTime(notification.createdAt),
                    style: TextStyle(
                      fontSize: 12,
                      color: inkColor.withValues(alpha: 0.5),
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
