import 'package:flutter/material.dart';

import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';

class EmployeeHeader extends StatelessWidget {
  const EmployeeHeader({super.key, required this.employee, required this.user});

  final Employee? employee;
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? 'OmniHR user';
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return AppPanel(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      brandColor.withValues(alpha: 0.08),
                      Colors.white,
                      brandGreen.withValues(alpha: 0.06),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [brandColor, brandGreen],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: brandColor.withValues(alpha: 0.22),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Text(
                      name.isEmpty ? 'O' : name.substring(0, 1).toUpperCase(),
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
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle.isEmpty
                              ? textOf(user?.email, 'Nhân viên')
                              : subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: mutedTextColor,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        if (user != null && user!.roles.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: user!.roles
                                .map(
                                  (role) => Pill(
                                    label: role,
                                    color: _roleColor(role),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ],
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

Color _roleColor(String role) {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return brandPurple;
    case 'MANAGER':
      return const Color(0xFF0B7285);
    case 'EMPLOYEE':
      return const Color(0xFF2B8A3E);
    default:
      return brandColor;
  }
}
