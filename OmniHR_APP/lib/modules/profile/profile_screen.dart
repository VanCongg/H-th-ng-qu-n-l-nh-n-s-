import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class ProfileBundle {
  ProfileBundle({required this.employee, required this.skills});

  final Employee? employee;
  final List<EmployeeSkill> skills;
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<ProfileBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ProfileBundle> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }

    List<EmployeeSkill> skills = const [];
    if (employee != null) {
      try {
        skills = await widget.session.api.getList(
          '/employees/${employee.id}/skills',
          EmployeeSkill.fromJson,
        );
      } catch (_) {
        skills = const [];
      }
    }

    return ProfileBundle(employee: employee, skills: skills);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _openChangePassword() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (context) => ChangePasswordDialog(session: widget.session),
    );
    if (changed == true && mounted) {
      showAppSnack(context, 'Đã đổi mật khẩu.');
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
        showAppSnack(context, 'Bạn đã thêm tất cả kỹ năng khả dụng.');
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
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> submit() async {
              if (skillId == null) {
                showAppSnack(context, 'Vui lòng chọn kỹ năng.', error: true);
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
                    'Thêm kỹ năng',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<int>(
                    initialValue: skillId,
                    decoration: const InputDecoration(
                      labelText: 'Kỹ năng',
                      prefixIcon: Icon(Icons.psychology_alt_outlined),
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
                    decoration: const InputDecoration(
                      labelText: 'Mức độ',
                      prefixIcon: Icon(Icons.bar_chart_rounded),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'BEGINNER',
                        child: Text('Mới bắt đầu'),
                      ),
                      DropdownMenuItem(
                        value: 'INTERMEDIATE',
                        child: Text('Trung bình'),
                      ),
                      DropdownMenuItem(
                        value: 'ADVANCED',
                        child: Text('Khá'),
                      ),
                      DropdownMenuItem(
                        value: 'EXPERT',
                        child: Text('Chuyên gia'),
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
                    decoration: const InputDecoration(
                      labelText: 'Số năm kinh nghiệm (tùy chọn)',
                      prefixIcon: Icon(Icons.timelapse_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Ghi chú (tùy chọn)',
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
                    label: Text(submitting ? 'Đang lưu...' : 'Lưu kỹ năng'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    yearsController.dispose();
    noteController.dispose();
    if (added == true) {
      if (mounted) showAppSnack(context, 'Đã thêm kỹ năng.');
      await _refresh();
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          icon: const AppIconBadge(
            icon: Icons.logout_rounded,
            color: dangerColor,
            size: 54,
          ),
          title: const Text('Đăng xuất'),
          content: const Text('Bạn muốn đăng xuất khỏi OmniHR?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: dangerColor),
              child: const Text('Đăng xuất'),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      await widget.session.logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProfileBundle>(
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
        final user = widget.session.user;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              _ProfileHeader(employee: employee, user: user),
              const SizedBox(height: 14),
              AppPanel(
                child: Column(
                  children: [
                    ProfileRow(
                      icon: Icons.mail_outline_rounded,
                      label: 'Email công ty',
                      value: employee?.companyEmail ?? user?.email,
                    ),
                    ProfileRow(
                      icon: Icons.verified_user_outlined,
                      label: 'Trạng thái',
                      value: employee == null
                          ? null
                          : friendlyStatus(employee.status),
                    ),
                    ProfileRow(
                      icon: Icons.event_outlined,
                      label: 'Ngày vào làm',
                      value: formatDate(employee?.hireDate),
                    ),
                    ProfileRow(
                      icon: Icons.phone_outlined,
                      label: 'Số điện thoại',
                      value: employee?.phone,
                    ),
                    Divider(
                      height: 24,
                      color: brandColor.withValues(alpha: 0.08),
                    ),
                    const SectionTitle(title: 'Tài khoản'),
                    ProfileRow(
                      icon: Icons.person_outline_rounded,
                      label: 'Tên đăng nhập',
                      value: user?.username,
                    ),
                    ProfileRow(
                      icon: Icons.dns_outlined,
                      label: 'Máy chủ API',
                      value: widget.session.baseUrl,
                    ),
                    const SizedBox(height: 10),
                    FilledButton.icon(
                      onPressed: _openChangePassword,
                      icon: const Icon(Icons.password_rounded),
                      label: const Text('Đổi mật khẩu'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Đăng xuất'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: dangerColor,
                        side: BorderSide(
                          color: dangerColor.withValues(alpha: 0.32),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              AppPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SectionTitle(
                      title: 'Kỹ năng',
                      subtitle: 'Kỹ năng bạn tự khai báo',
                    ),
                    if (skills.isEmpty)
                      const EmptyState(
                        icon: Icons.psychology_alt_outlined,
                        title: 'Chưa có kỹ năng',
                        body: 'Thêm kỹ năng để quản lý gợi ý task chính xác hơn.',
                      )
                    else
                      ...skills.map(
                        (skill) => EmployeeSkillCard(skill: skill),
                      ),
                    const SizedBox(height: 4),
                    FilledButton.icon(
                      onPressed: employee == null
                          ? null
                          : () => _openAddSkillSheet(employee, skills),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Thêm kỹ năng'),
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

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.employee, required this.user});

  final Employee? employee;
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? 'Nhân viên OmniHR';
    final initial = name.trim().isEmpty ? 'O' : name.trim()[0].toUpperCase();
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [brandColor, brandGreen],
              ),
            ),
            child: Text(
              initial,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle.isEmpty ? textOf(user?.email, '-') : subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (employee?.status != null) ...[
            const SizedBox(width: 8),
            Pill(
              label: friendlyStatus(employee!.status),
              color: statusColor(employee!.status),
            ),
          ],
        ],
      ),
    );
  }
}

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key, required this.session});

  final AppSession session;

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await widget.session.changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      _close(true);
    } catch (error) {
      _showError(error is ApiException ? error.message : error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _close(bool value) {
    if (!mounted) return;
    Navigator.pop(context, value);
  }

  void _showError(String message) {
    if (!mounted) return;
    showAppSnack(context, message, error: true);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const AppIconBadge(
        icon: Icons.password_rounded,
        color: brandColor,
        size: 54,
      ),
      title: const Text('Đổi mật khẩu'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _currentController,
                obscureText: _obscure,
                decoration: const InputDecoration(
                  labelText: 'Mật khẩu hiện tại',
                  prefixIcon: Icon(Icons.lock_outline_rounded),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập mật khẩu hiện tại';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _newController,
                obscureText: _obscure,
                decoration: const InputDecoration(
                  labelText: 'Mật khẩu mới',
                  prefixIcon: Icon(Icons.password_rounded),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập mật khẩu mới';
                  }
                  if (value.length < 6) {
                    return 'Mật khẩu mới phải có ít nhất 6 ký tự';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _confirmController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Nhập lại mật khẩu mới',
                  prefixIcon: const Icon(Icons.verified_outlined),
                  suffixIcon: IconButton(
                    tooltip: _obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập lại mật khẩu mới';
                  }
                  if (value != _newController.text) {
                    return 'Mật khẩu nhập lại không khớp';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: Text(_submitting ? 'Đang lưu...' : 'Lưu'),
        ),
      ],
    );
  }
}
