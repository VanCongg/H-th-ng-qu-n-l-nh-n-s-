import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';
import '../attendance/attendance_screen.dart';
import '../chat/chat_screen.dart';
import '../leave/leave_screen.dart';
import '../tasks/tasks_screen.dart';

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
  const DashboardScreen({super.key, required this.session, this.topInset = 10});

  final AppSession session;

  /// Extra top padding so content starts below an overlaid header instead
  /// of underneath it. The header remains glass/translucent, so scrolled
  /// content still shows (blurred) through it above this inset.
  final double topInset;

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
            padding: EdgeInsets.fromLTRB(16, widget.topInset, 16, 112),
            children: [
              _EmployeeOverview(
                employee: data.employee,
                user: widget.session.user,
              ),
              const SizedBox(height: 20),
              _QuickActions(session: widget.session),
              const SizedBox(height: 18),
              _HrGeniePanel(onOpen: _openChat),
              const SizedBox(height: 18),
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
    final name = employee?.fullName ?? user?.username ?? tx('Nhân viên OmniHR');
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
                  '${tx('Xin chào,')} $name',
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

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.session});

  final AppSession session;

  void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _QuickActionButton(
            icon: Icons.location_on_rounded,
            color: brandColor,
            label: tx('Chấm công'),
            onTap: () => _open(
              context,
              SubScreen(
                title: tx('Chấm công'),
                child: AttendanceScreen(session: session),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionButton(
            icon: Icons.beach_access_rounded,
            color: brandGreen,
            label: tx('Nghỉ phép'),
            onTap: () => _open(
              context,
              SubScreen(
                title: tx('Nghỉ phép'),
                child: LeaveScreen(session: session),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionButton(
            icon: Icons.assignment_rounded,
            color: accentColor,
            label: tx('Công việc'),
            onTap: () => _open(
              context,
              SubScreen(
                title: tx('Công việc'),
                child: TasksScreen(session: session),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  static final _radius = BorderRadius.circular(14);

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      borderRadius: _radius,
      child: Container(
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: _radius,
          border: Border.all(color: brandColor.withValues(alpha: 0.11)),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.10),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIconBadge(icon: icon, color: color, size: 44),
            const SizedBox(height: 9),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
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
        SectionTitle(title: tx('Nghỉ phép gần đây')),
        if (requests.isEmpty)
          Text(
            tx('Chưa có đơn nghỉ phép.'),
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
                              style: TextStyle(
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
        SectionTitle(title: tx('Công việc sắp đến hạn')),
        if (visibleTasks.isEmpty)
          Text(
            tx('Không có công việc đang mở.'),
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
                              : tx('Hạn {date}', {
                                  'date': formatDate(task.dueDate),
                                }),
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
                        ? tx('Quá hạn')
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

  static final _radius = BorderRadius.circular(14);

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onOpen,
      borderRadius: _radius,
      child: Container(
        decoration: BoxDecoration(
          color: brandGreen.withValues(alpha: 0.08),
          borderRadius: _radius,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                      tx('Hỏi HRGenie'),
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      tx('Chấm công, nghỉ phép, công việc'),
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
              Icon(Icons.chevron_right_rounded, color: mutedTextColor),
            ],
          ),
        ),
      ),
    );
  }
}
