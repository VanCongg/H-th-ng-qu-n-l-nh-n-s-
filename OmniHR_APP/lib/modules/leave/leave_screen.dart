import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class LeaveBundle {
  LeaveBundle({required this.types, required this.requests});

  final List<LeaveType> types;
  final List<LeaveRequest> requests;

  double remainingFor(LeaveType type) {
    final used = requests
        .where(
          (request) =>
              request.leaveType.id == type.id && request.status == 'APPROVED',
        )
        .fold<double>(0, (sum, request) => sum + request.totalDays);
    return (type.annualAllowance ?? 0) - used;
  }
}

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  late Future<LeaveBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<LeaveBundle> _load() async {
    final types = await widget.session.api.getList(
      '/leave-types',
      LeaveType.fromJson,
    );
    final requests = await widget.session.api.getList(
      '/leave-requests/self',
      LeaveRequest.fromJson,
      query: {'limit': 50},
    );
    return LeaveBundle(types: types, requests: requests);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _cancel(LeaveRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          icon: const AppIconBadge(
            icon: Icons.cancel_outlined,
            color: dangerColor,
            size: 54,
          ),
          title: const Text('Hủy đơn nghỉ phép'),
          content: Text(
            'Bạn muốn hủy đơn ${request.leaveType.name} từ ${formatDate(request.startDate)} đến ${formatDate(request.endDate)}?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Không hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: dangerColor),
              child: const Text('Xác nhận hủy'),
            ),
          ],
        );
      },
    );
    if (confirmed != true) return;

    try {
      await widget.session.api.post('/leave-requests/${request.id}/cancel');
      if (mounted) showAppSnack(context, 'Đã hủy đơn nghỉ phép.');
      await _refresh();
    } catch (error) {
      if (mounted) showAppSnack(context, error.toString(), error: true);
    }
  }

  Future<void> _openCreateSheet(LeaveBundle bundle) async {
    if (bundle.types.isEmpty) {
      showAppSnack(context, 'Chưa có loại nghỉ khả dụng.', error: true);
      return;
    }

    final reasonController = TextEditingController();
    int? leaveTypeId = bundle.types.first.id;
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
              if (picked != null) {
                setSheetState(() => endDate = picked);
              }
            }

            Future<void> submit() async {
              if (leaveTypeId == null) {
                showAppSnack(context, 'Vui lòng chọn loại nghỉ.', error: true);
                return;
              }
              if (endDate.isBefore(startDate)) {
                showAppSnack(
                  context,
                  'Ngày kết thúc không được trước ngày bắt đầu.',
                  error: true,
                );
                return;
              }
              if (reasonController.text.trim().isEmpty) {
                showAppSnack(context, 'Vui lòng nhập lý do nghỉ.', error: true);
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

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Tạo đơn nghỉ phép',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<int>(
                    initialValue: leaveTypeId,
                    decoration: const InputDecoration(
                      labelText: 'Loại nghỉ',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    items: bundle.types
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
                          icon: const Icon(Icons.event),
                          label: Text(formatDate(startDate)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: submitting ? null : pickEnd,
                          icon: const Icon(Icons.event_available),
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
                        : const Icon(Icons.send),
                    label: Text(submitting ? 'Đang gửi...' : 'Gửi đơn'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    reasonController.dispose();
    if (created == true) {
      if (mounted) showAppSnack(context, 'Đã tạo đơn nghỉ phép.');
      await _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<LeaveBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final bundle = snapshot.data!;
        final pending = bundle.requests
            .where((request) => request.status == 'PENDING')
            .length;
        final approved = bundle.requests
            .where((request) => request.status == 'APPROVED')
            .length;
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 104),
            children: [
              PageHeroCard(
                icon: Icons.beach_access_rounded,
                title: 'Nghỉ phép',
                subtitle: 'Tạo đơn nghỉ và theo dõi trạng thái phê duyệt.',
                color: accentColor,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Pill(label: '$pending chờ duyệt', color: Colors.white),
                        Pill(label: '$approved đã duyệt', color: Colors.white),
                        Pill(
                          label: '${bundle.requests.length} tổng',
                          color: Colors.white,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: () => _openCreateSheet(bundle),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Tạo đơn nghỉ'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: brandColor,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const SectionTitle(
                title: 'Số ngày phép còn lại',
                subtitle: 'Tính theo các đơn đã được duyệt',
              ),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: bundle.types.map((type) {
                  if (type.annualAllowance == null) {
                    return Pill(
                      label: '${type.name}: Không giới hạn',
                      color: brandColor,
                    );
                  }
                  final remaining = bundle.remainingFor(type);
                  return SizedBox(
                    width: 160,
                    child: StatCard(
                      label: type.name,
                      value:
                          '${remaining.toStringAsFixed(1)}/${type.annualAllowance!.toStringAsFixed(0)}',
                      icon: Icons.beach_access_outlined,
                      color: remaining <= 0 ? dangerColor : brandColor,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              const SectionTitle(
                title: 'Đơn nghỉ của tôi',
                subtitle: 'Các đơn đã gửi và trạng thái xử lý',
              ),
              if (bundle.requests.isEmpty)
                const EmptyState(
                  icon: Icons.beach_access_outlined,
                  title: 'Chưa có đơn nghỉ',
                  body: 'Đơn nghỉ đã gửi sẽ xuất hiện tại đây.',
                )
              else
                ...bundle.requests.map(
                  (request) => LeaveRequestCard(
                    request: request,
                    onCancel: request.status == 'PENDING'
                        ? () => _cancel(request)
                        : null,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
