import '../core/i18n.dart';
import '../core/utils.dart';

enum ChatMessageRole { user, assistant }

class ChatMessage {
  const ChatMessage({
    required this.role,
    required this.content,
    this.pendingAction,
  });

  final ChatMessageRole role;
  final String content;
  final PendingChatAction? pendingAction;
}

class PendingChatAction {
  const PendingChatAction({
    required this.actionId,
    required this.type,
    required this.title,
    required this.summary,
    this.expiresAt,
  });

  final int actionId;
  final String type;
  final String title;
  final Map<String, dynamic> summary;
  final DateTime? expiresAt;

  factory PendingChatAction.fromJson(Map<String, dynamic> json) {
    return PendingChatAction(
      actionId: intOf(json['actionId']),
      type: textOf(json['type']),
      title: textOf(json['title'], tx('Xác nhận thao tác')),
      summary: mapOf(json['summary']),
      expiresAt: dateOf(json['expiresAt']),
    );
  }
}
