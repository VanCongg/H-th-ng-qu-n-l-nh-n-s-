import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';

class EmployeeSkillCard extends StatelessWidget {
  const EmployeeSkillCard({super.key, required this.skill});

  final EmployeeSkill skill;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          AppIconBadge(icon: Icons.psychology_alt_rounded, color: brandColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  skill.skill.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (skill.proficiency != null)
                      Pill(label: skill.proficiency!, color: brandColor),
                    if (skill.yearsExperience != null)
                      Pill(
                        label:
                            '${skill.yearsExperience!.toStringAsFixed(1)} ${tx('năm')}',
                        color: brandColor,
                      ),
                    if (skill.lastUsedAt != null)
                      Pill(
                        label: tx('Gần nhất {date}', {
                          'date': formatDate(skill.lastUsedAt),
                        }),
                        color: mutedTextColor,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
