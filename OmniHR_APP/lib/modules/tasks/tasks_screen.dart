import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  late Future<List<LeaveType>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<LeaveType>> _load() {
    return widget.session.api.getList('/leave-types', LeaveType.fromJson);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  void _showSnack(String message, {bool error = false}) {
    if (!mounted) return;
    showAppSnack(context, message, error: error);
  }

  Future<void> _openCreateSheet(List<LeaveType> types) async {
    if (!(widget.session.user?.permissions.contains('LEAVE_CREATE') ?? false)) {
      showAppSnack(
        context,
        'Tài khoản chưa có quyền tạo đơn nghỉ.',
        error: true,
      );
      return;
    }
    if (types.isEmpty) {
      showAppSnack(context, 'Chưa có loại nghỉ khả dụng.', error: true);
      return;
    }

    final reasonController = TextEditingController();
    int? leaveTypeId = types.first.id;
    var startDate = DateTime.now();
    var endDate = DateTime.now();
    var submitting = false;

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> pickStart() async {
              final picked = await showDatePicker(
                context: context,
                initialDate: startDate,
                firstDate: DateTime(2020),
                lastDate: DateTime(2035),
              );
              if (!context.mounted) return;
              if (picked != null) {
                setSheetState(() {
                  startDate = picked;
                  if (endDate.isBefore(startDate)) endDate = startDate;
                });
              }
            }

            Future<void> pickEnd() async {
              final picked = await showDatePicker(
                context: context,
                initialDate: endDate,
                firstDate: startDate,
                lastDate: DateTime(2035),
              );
              if (!context.mounted) return;
              if (picked != null) {
                setSheetState(() => endDate = picked);
              }
            }

            Future<void> submit() async {
              if (reasonController.text.trim().isEmpty) {
                showAppSnack(context, 'Nhập lý do xin nghỉ.', error: true);
                return;
              }

              setSheetState(() => submitting = true);
              try {
                await widget.session.api.post(
                  '/leave-requests',
                  body: {
                    'leaveTypeId': leaveTypeId,
                    'startDate': apiDate(startDate),
                    'endDate': apiDate(endDate),
                    'reason': reasonController.text.trim(),
                  },
                );
                if (context.mounted) Navigator.pop(context, true);
              } catch (error) {
                if (context.mounted) {
                  showAppSnack(context, error.toString(), error: true);
                }
              } finally {
                if (context.mounted) {
                  setSheetState(() => submitting = false);
                }
              }
            }

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  left: 18,
                  right: 18,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 18,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Tạo đơn xin nghỉ',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<int>(
                      initialValue: leaveTypeId,
                      decoration: const InputDecoration(
                        labelText: 'Loại nghỉ',
                        prefixIcon: Icon(Icons.category_outlined),
                      ),
                      items: types
                          .map(
                            (type) => DropdownMenuItem(
                              value: type.id,
                              child: Text(type.name),
                            ),
                          )
                          .toList(),
                      onChanged: submitting
                          ? null
                          : (value) => setSheetState(() => leaveTypeId = value),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: submitting ? null : pickStart,
                            icon: const Icon(Icons.event_rounded),
                            label: Text(formatDate(startDate)),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: submitting ? null : pickEnd,
                            icon: const Icon(Icons.event_available_rounded),
                            label: Text(formatDate(endDate)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: reasonController,
                      minLines: 3,
                      maxLines: 5,
                      decoration: const InputDecoration(
                        labelText: 'Lý do',
                        alignLabelWithHint: true,
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: submitting ? null : submit,
                      icon: submitting
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                      label: Text(submitting ? 'Đang gửi...' : 'Gửi đơn'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    reasonController.dispose();
    if (created == true) _showSnack('Đã tạo đơn xin nghỉ.');
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<LeaveType>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final types = snapshot.data ?? const <LeaveType>[];
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 112),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: AppPanel(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const AppIconBadge(
                          icon: Icons.beach_access_rounded,
                          color: accentColor,
                          size: 52,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Đơn xin nghỉ',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Tạm thời tab này chỉ dùng để tạo đơn xin nghỉ thủ công.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: mutedTextColor,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: () => _openCreateSheet(types),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Tạo đơn xin nghỉ thủ công'),
                        ),
                      ],
                    ),
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
