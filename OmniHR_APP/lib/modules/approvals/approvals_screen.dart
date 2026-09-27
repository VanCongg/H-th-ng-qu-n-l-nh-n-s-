import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

/// Whether the signed-in user decides on anything this screen lists: leave
/// of their team, or subtasks handed in for their review.
bool canReviewOnMobile(AuthUser? user) {
  final permissions = user?.permissions ?? const <String>[];
  return (permissions.contains('LEAVE_APPROVE') &&
          permissions.contains('LEAVE_READ_TEAM')) ||
      (permissions.contains('TASK_UPDATE_STATUS') &&
          permissions.contains('TASK_READ_TEAM'));
}

class ApprovalsBundle {
  ApprovalsBundle({
    required this.leaveRequests,
    required this.cancellations,
    required this.reviews,
  });

  final List<LeaveRequest> leaveRequests;
  final List<LeaveRequest> cancellations;
  final List<TaskItem> reviews;

  int get total => leaveRequests.length + cancellations.length + reviews.length;
}

/// Loads what waits on the user. Each list is fetched only when the user's
/// permissions allow it, so a lead without leave rights still sees reviews.
Future<ApprovalsBundle> loadApprovals(AppSession session) async {
  final permissions = session.user?.permissions ?? const <String>[];
  final canLeave =
      permissions.contains('LEAVE_APPROVE') &&
      permissions.contains('LEAVE_READ_TEAM');
  final canReview =
      permissions.contains('TASK_UPDATE_STATUS') &&
      permissions.contains('TASK_READ_TEAM');

  final results = await Future.wait<List<Object>>([
    canLeave
        ? session.api.getList(
            '/leave-requests/team',
            LeaveRequest.fromJson,
            query: {'status': 'PENDING', 'limit': 50},
          )
        : Future.value(const <LeaveRequest>[]),
    canLeave
        ? session.api.getList(
            '/leave-requests/team',
            LeaveRequest.fromJson,
            query: {'cancelRequested': 'true', 'limit': 50},
          )
        : Future.value(const <LeaveRequest>[]),
    canReview
        ? session.api.getList(
            '/tasks/team',
            TaskItem.fromJson,
            query: {'status': 'IN_REVIEW', 'limit': 50},
          )
        : Future.value(const <TaskItem>[]),
  ]);

  return ApprovalsBundle(
    leaveRequests: results[0].cast<LeaveRequest>(),
    cancellations: results[1].cast<LeaveRequest>(),
    // Only work this user may accept: not their own, not another team's.
    reviews: results[2]
        .cast<TaskItem>()
        .where((task) => task.allowedStatuses?.contains('DONE') ?? false)
        .toList(),
  );
}

/// Everything waiting on a lead or head, decided from the phone: leave
/// requests, requests to withdraw approved leave, and subtasks handed in.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  late Future<ApprovalsBundle> _future;
  final Set<String> _busy = {};

  @override
  void initState() {
    super.initState();
    _future = loadApprovals(widget.session);
  }

  Future<void> _refresh() async {
    setState(() => _future = loadApprovals(widget.session));
    try {
      await _future;
    } catch (_) {
      // Shown by the FutureBuilder.
    }
  }

  Future<void> _act(
    String key,
    Future<void> Function() action,
    String done,
  ) async {
    setState(() => _busy.add(key));
    try {
      await action();
      if (mounted) showAppSnack(context, tx(done));
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(key));
    }
  }

  Future<void> _decideLeave(
    LeaveRequest request, {
    required bool approve,
  }) async {
    final key = 'leave-${request.id}';
    if (approve) {
      await _act(
        key,
        () => widget.session.api.post('/leave-requests/${request.id}/approve'),
        'Đã duyệt đơn nghỉ.',
      );
      return;
    }
    final reason = await askReason(context, title: tx('Từ chối đơn nghỉ'));
    if (reason == null) return;
    await _act(
      key,
      () => widget.session.api.post(
        '/leave-requests/${request.id}/reject',
        body: {'rejectionReason': reason},
      ),
      'Đã từ chối đơn nghỉ.',
    );
  }

  Future<void> _decideCancellation(
    LeaveRequest request, {
    required bool approve,
  }) async {
    final key = 'cancel-${request.id}';
    if (approve) {
      await _act(
        key,
        () => widget.session.api.post(
          '/leave-requests/${request.id}/cancel-request/approve',
        ),
        'Đã đồng ý hủy đơn nghỉ.',
      );
      return;
    }
    final reason = await askReason(context, title: tx('Giữ đơn nghỉ'));
    if (reason == null) return;
    await _act(
      key,
      () => widget.session.api.post(
        '/leave-requests/${request.id}/cancel-request/reject',
        body: {'rejectionReason': reason},
      ),
      'Đã giữ nguyên đơn nghỉ.',
    );
  }

  Future<void> _decideTask(TaskItem task, {required bool accept}) async {
    await _act(
      'task-${task.id}',
      () => widget.session.api.patch(
        '/tasks/${task.id}/status',
        body: {'status': accept ? 'DONE' : 'IN_PROGRESS'},
      ),
      accept ? 'Đã duyệt hoàn thành công việc.' : 'Đã trả lại để làm tiếp.',
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApprovalsBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }
        final data = snapshot.data!;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              if (data.total == 0)
                EmptyState(
                  icon: Icons.task_alt_rounded,
                  title: tx('Không có gì chờ duyệt'),
                  body: tx(
                    'Đơn nghỉ, yêu cầu hủy và công việc cần bạn duyệt sẽ '
                    'xuất hiện tại đây.',
                  ),
                ),
              if (data.leaveRequests.isNotEmpty) ...[
                SectionTitle(
                  title: tx('Đơn nghỉ chờ duyệt'),
                  subtitle: '${data.leaveRequests.length}',
                ),
                ...data.leaveRequests.map(
                  (request) => _DecisionCard(
                    icon: Icons.beach_access_rounded,
                    color: brandGreen,
                    title: request.employee?.fullName ?? '-',
                    lines: [
                      '${request.leaveType.name} · ${_period(request)}',
                      request.reason,
                    ],
                    busy: _busy.contains('leave-${request.id}'),
                    acceptLabel: tx('Duyệt'),
                    declineLabel: tx('Từ chối'),
                    onAccept: () => _decideLeave(request, approve: true),
                    onDecline: () => _decideLeave(request, approve: false),
                  ),
                ),
              ],
              if (data.cancellations.isNotEmpty) ...[
                const SizedBox(height: 8),
                SectionTitle(
                  title: tx('Yêu cầu hủy đơn đã duyệt'),
                  subtitle: '${data.cancellations.length}',
                ),
                ...data.cancellations.map(
                  (request) => _DecisionCard(
                    icon: Icons.event_repeat_rounded,
                    color: const Color(0xFFF59F00),
                    title: request.employee?.fullName ?? '-',
                    lines: [
                      '${request.leaveType.name} · ${_period(request)}',
                      if ((request.cancelRequestReason ?? '').isNotEmpty)
                        tx('Lý do xin hủy: {reason}', {
                          'reason': request.cancelRequestReason!,
                        }),
                    ],
                    busy: _busy.contains('cancel-${request.id}'),
                    acceptLabel: tx('Đồng ý hủy'),
                    declineLabel: tx('Giữ đơn'),
                    onAccept: () => _decideCancellation(request, approve: true),
                    onDecline: () =>
                        _decideCancellation(request, approve: false),
                  ),
                ),
              ],
              if (data.reviews.isNotEmpty) ...[
                const SizedBox(height: 8),
                SectionTitle(
                  title: tx('Công việc chờ duyệt'),
                  subtitle: '${data.reviews.length}',
                ),
                ...data.reviews.map(
                  (task) => _DecisionCard(
                    icon: Icons.fact_check_rounded,
                    color: brandColor,
                    title: task.title,
                    lines: [
                      [
                        task.assignee?.fullName,
                        task.parentTask?.title,
                      ].whereType<String>().join(' · '),
                      if (task.dueDate != null)
                        tx('Hạn {date}', {'date': formatDate(task.dueDate)}),
                    ],
                    busy: _busy.contains('task-${task.id}'),
                    acceptLabel: tx('Duyệt xong'),
                    declineLabel: tx('Trả lại'),
                    onAccept: () => _decideTask(task, accept: true),
                    onDecline: () => _decideTask(task, accept: false),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  String _period(LeaveRequest request) {
    final days = request.halfDay == 'MORNING'
        ? tx('buổi sáng')
        : request.halfDay == 'AFTERNOON'
        ? tx('buổi chiều')
        : tx('{days} ngày', {'days': request.totalDays.toStringAsFixed(1)});
    return request.startDate == request.endDate
        ? '${formatDate(request.startDate)} ($days)'
        : '${formatDate(request.startDate)} - ${formatDate(request.endDate)} ($days)';
  }
}

/// Asks for the reason a manager must give when turning something down.
Future<String?> askReason(BuildContext context, {required String title}) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(labelText: tx('Lý do')),
        ),
        actions: [
          AppDialogActions(
            children: [
              OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: Text(tx('Hủy')),
              ),
              FilledButton(
                onPressed: () {
                  final text = controller.text.trim();
                  if (text.isNotEmpty) Navigator.pop(context, text);
                },
                child: Text(tx('Gửi')),
              ),
            ],
          ),
        ],
      );
    },
  ).whenComplete(controller.dispose);
}

class _DecisionCard extends StatelessWidget {
  const _DecisionCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.lines,
    required this.busy,
    required this.acceptLabel,
    required this.declineLabel,
    required this.onAccept,
    required this.onDecline,
  });

  final IconData icon;
  final Color color;
  final String title;
  final List<String> lines;
  final bool busy;
  final String acceptLabel;
  final String declineLabel;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AppIconBadge(icon: icon, color: color, size: 38),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          for (final line in lines.where((line) => line.isNotEmpty)) ...[
            const SizedBox(height: 6),
            Text(
              line,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: mutedTextColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onDecline,
                  style: OutlinedButton.styleFrom(foregroundColor: dangerColor),
                  child: Text(declineLabel),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onAccept,
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(acceptLabel),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
