import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';
import '../chat/chat_screen.dart';

class DashboardBundle {
  DashboardBundle({
    required this.employee,
    required this.leaveRequests,
    required this.tasks,
  });

  final Employee? employee;
  final List<LeaveRequest> leaveRequests;
  final List<TaskItem> tasks;
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<DashboardBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<DashboardBundle> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }

    final results = await Future.wait([
      _safeList('/leave-requests/self', LeaveRequest.fromJson, limit: 5),
      _safeList('/tasks/me', TaskItem.fromJson, limit: 5),
    ]);

    return DashboardBundle(
      employee: employee,
      leaveRequests: results[0].cast<LeaveRequest>(),
      tasks: results[1].cast<TaskItem>(),
    );
  }

  Future<List<T>> _safeList<T>(
    String path,
    T Function(Map<String, dynamic>) parser, {
    required int limit,
  }) async {
    try {
      return await widget.session.api.getList(
        path,
        parser,
        query: {'limit': limit},
      );
    } catch (_) {
      return <T>[];
    }
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  void _openChat() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(session: widget.session),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DashboardBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final data = snapshot.data!;
        final upcomingTasks = data.tasks.where((task) => task.isOpen).toList();

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              _EmployeeOverview(
                employee: data.employee,
                user: widget.session.user,
              ),
              const SizedBox(height: 12),
              _HrGeniePanel(onOpen: _openChat),
              const SizedBox(height: 14),
              AppPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _LeavePreview(requests: data.leaveRequests),
                    Divider(
                      height: 24,
                      color: brandColor.withValues(alpha: 0.08),
                    ),
                    _TaskPreview(tasks: upcomingTasks),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _EmployeeOverview extends StatelessWidget {
  const _EmployeeOverview({required this.employee, required this.user});

  final Employee? employee;
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? 'Nhân viên OmniHR';
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Xin chào, $name',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle.isEmpty ? textOf(user?.email, '-') : subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Pill(label: formatDate(DateTime.now()), color: brandGreen),
        ],
      ),
    );
  }
}

class _LeavePreview extends StatelessWidget {
  const _LeavePreview({required this.requests});

  final List<LeaveRequest> requests;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
          const SectionTitle(
            title: 'Nghỉ phép gần đây',
            subtitle: 'Theo dõi trạng thái đơn đã gửi',
          ),
          if (requests.isEmpty)
            const Text(
              'Chưa có đơn nghỉ phép.',
              style: TextStyle(
                color: mutedTextColor,
                fontWeight: FontWeight.w600,
              ),
            )
          else
            ...requests
                .take(3)
                .map(
                  (request) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        AppIconBadge(
                          icon: Icons.beach_access_rounded,
                          color: statusColor(request.status),
                          size: 38,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                request.leaveType.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${formatDate(request.startDate)} - ${formatDate(request.endDate)}',
                                style: const TextStyle(
                                  color: mutedTextColor,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Pill(
                          label: friendlyStatus(request.status),
                          color: statusColor(request.status),
                        ),
                      ],
                    ),
                  ),
                ),
      ],
    );
  }
}

class _TaskPreview extends StatelessWidget {
  const _TaskPreview({required this.tasks});

  final List<TaskItem> tasks;

  @override
  Widget build(BuildContext context) {
    final visibleTasks = tasks.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
          const SectionTitle(
            title: 'Công việc sắp đến hạn',
            subtitle: 'Các công việc đang mở cần chú ý',
          ),
          if (visibleTasks.isEmpty)
            const Text(
              'Không có công việc đang mở.',
              style: TextStyle(
                color: mutedTextColor,
                fontWeight: FontWeight.w600,
              ),
            )
          else
            ...visibleTasks.map(
              (task) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    AppIconBadge(
                      icon: Icons.task_alt_rounded,
                      color: task.isOverdue
                          ? dangerColor
                          : statusColor(task.status),
                      size: 38,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            task.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            task.dueDate == null
                                ? friendlyStatus(task.status)
                                : 'Hạn ${formatDate(task.dueDate)}',
                            style: TextStyle(
                              color: task.isOverdue
                                  ? dangerColor
                                  : mutedTextColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Pill(
                      label: task.isOverdue
                          ? 'Quá hạn'
                          : friendlyPriority(task.priority),
                      color: task.isOverdue
                          ? dangerColor
                          : priorityColor(task.priority),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _HrGeniePanel extends StatelessWidget {
  const _HrGeniePanel({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: brandGreen.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              AppIconBadge(
                icon: Icons.auto_awesome_rounded,
                color: brandGreen,
                size: 36,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hỏi HRGenie',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Chấm công, nghỉ phép, công việc',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: mutedTextColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: mutedTextColor),
            ],
          ),
        ),
      ),
    );
  }
}
