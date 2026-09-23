import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class SkillsBundle {
  SkillsBundle({required this.employee, required this.skills});

  final Employee? employee;
  final List<EmployeeSkill> skills;
}

class SkillsScreen extends StatefulWidget {
  const SkillsScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<SkillsScreen> createState() => _SkillsScreenState();
}

class _SkillsScreenState extends State<SkillsScreen> {
  late Future<SkillsBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<SkillsBundle> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }

    List<EmployeeSkill> skills = const [];
    if (employee != null) {
      skills = await widget.session.api.getList(
        '/employees/${employee.id}/skills',
        EmployeeSkill.fromJson,
      );
    }

    return SkillsBundle(employee: employee, skills: skills);
  }

  Future<void> _refresh() async {
    // Block body: an arrow would return the assigned Future to setState.
    setState(() {
      _future = _load();
    });
    try {
      await _future;
    } catch (_) {
      // The FutureBuilder already renders this failure.
    }
  }

  Future<void> _openAddSkillSheet(
    Employee employee,
    List<EmployeeSkill> existingSkills,
  ) async {
    List<Skill> catalog;
    try {
      catalog = await widget.session.api.getList('/skills', Skill.fromJson);
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          error is ApiException ? error.message : error.toString(),
          error: true,
        );
      }
      return;
    }
    if (!mounted) return;

    final existingSkillIds = existingSkills
        .map((skill) => skill.skill.id)
        .toSet();
    final available = catalog
        .where((skill) => !existingSkillIds.contains(skill.id))
        .toList();

    if (available.isEmpty) {
      if (mounted) {
        showAppSnack(context, tx('Bạn đã thêm tất cả kỹ năng khả dụng.'));
      }
      return;
    }

    int? skillId = available.first.id;
    String proficiency = 'INTERMEDIATE';
    final yearsController = TextEditingController();
    final noteController = TextEditingController();
    var submitting = false;

    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return ControllerScope(
          controllers: [yearsController, noteController],
          child: StatefulBuilder(
            builder: (context, setSheetState) {
              Future<void> submit() async {
                if (skillId == null) {
                  showAppSnack(
                    context,
                    tx('Vui lòng chọn kỹ năng.'),
                    error: true,
                  );
                  return;
                }
                setSheetState(() => submitting = true);
                try {
                  await widget.session.api.post(
                    '/employees/${employee.id}/skills',
                    body: {
                      'skillId': skillId,
                      'proficiency': proficiency,
                      if (yearsController.text.trim().isNotEmpty)
                        'yearsExperience': double.tryParse(
                          yearsController.text.trim(),
                        ),
                      if (noteController.text.trim().isNotEmpty)
                        'note': noteController.text.trim(),
                    },
                  );
                  if (context.mounted) Navigator.pop(context, true);
                } catch (error) {
                  if (context.mounted) {
                    showAppSnack(
                      context,
                      error is ApiException ? error.message : error.toString(),
                      error: true,
                    );
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
                      tx('Thêm kỹ năng'),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<int>(
                      initialValue: skillId,
                      decoration: InputDecoration(
                        labelText: tx('Kỹ năng'),
                        prefixIcon: const Icon(Icons.psychology_alt_outlined),
                      ),
                      items: available
                          .map(
                            (skill) => DropdownMenuItem(
                              value: skill.id,
                              child: Text(skill.name),
                            ),
                          )
                          .toList(),
                      onChanged: submitting
                          ? null
                          : (value) => setSheetState(() => skillId = value),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: proficiency,
                      decoration: InputDecoration(
                        labelText: tx('Mức độ'),
                        prefixIcon: const Icon(Icons.bar_chart_rounded),
                      ),
                      items: [
                        DropdownMenuItem(
                          value: 'BEGINNER',
                          child: Text(tx('Mới bắt đầu')),
                        ),
                        DropdownMenuItem(
                          value: 'INTERMEDIATE',
                          child: Text(tx('Trung bình')),
                        ),
                        DropdownMenuItem(
                          value: 'ADVANCED',
                          child: Text(tx('Khá')),
                        ),
                        DropdownMenuItem(
                          value: 'EXPERT',
                          child: Text(tx('Chuyên gia')),
                        ),
                      ],
                      onChanged: submitting
                          ? null
                          : (value) => setSheetState(
                              () => proficiency = value ?? proficiency,
                            ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: yearsController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: tx('Số năm kinh nghiệm (tùy chọn)'),
                        prefixIcon: const Icon(Icons.timelapse_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: noteController,
                      minLines: 2,
                      maxLines: 4,
                      decoration: InputDecoration(
                        labelText: tx('Ghi chú (tùy chọn)'),
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
                          : const Icon(Icons.check_rounded),
                      label: Text(
                        tx(submitting ? 'Đang lưu...' : 'Lưu kỹ năng'),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );

    if (added == true) {
      if (mounted) showAppSnack(context, tx('Đã thêm kỹ năng.'));
      await _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<SkillsBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final bundle = snapshot.data!;
        final employee = bundle.employee;
        final skills = bundle.skills;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              AppPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SectionTitle(
                      title: tx('Kỹ năng'),
                      subtitle: tx('Kỹ năng bạn tự khai báo'),
                    ),
                    if (skills.isEmpty)
                      EmptyState(
                        icon: Icons.psychology_alt_outlined,
                        title: tx('Chưa có kỹ năng'),
                        body: tx(
                          'Thêm kỹ năng để quản lý gợi ý task chính xác hơn.',
                        ),
                      )
                    else
                      ...skills.map((skill) => EmployeeSkillCard(skill: skill)),
                    const SizedBox(height: 4),
                    FilledButton.icon(
                      onPressed: employee == null
                          ? null
                          : () => _openAddSkillSheet(employee, skills),
                      icon: const Icon(Icons.add_rounded),
                      label: Text(tx('Thêm kỹ năng')),
                    ),
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
