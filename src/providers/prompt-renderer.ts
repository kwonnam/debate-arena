import type { Message, MessageAttachment } from './types.js';

const ATTACHMENT_PREVIEW_LIMIT = 1200;

export function renderMessages(messages: Message[]): string {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const conversationMsgs = messages.filter((m) => m.role !== 'system');

  const parts: string[] = [];

  if (systemMsgs.length > 0) {
    parts.push(systemMsgs.map((m) => m.content).join('\n\n'));
    parts.push('---');
  }

  for (const msg of conversationMsgs) {
    if (msg.role === 'assistant') {
      parts.push(`[Your previous response]\n${renderMessageWithAttachments(msg)}`);
    } else {
      parts.push(renderMessageWithAttachments(msg));
    }
  }

  return parts.join('\n\n');
}

function renderMessageWithAttachments(message: Message): string {
  if (!message.attachments || message.attachments.length === 0) {
    return message.content;
  }

  const attachmentText = message.attachments
    .map(formatAttachmentPreview)
    .join('\n\n');

  return `${message.content}\n\n[Attached Inputs]\n${attachmentText}`;
}

function formatAttachmentPreview(attachment: MessageAttachment): string {
  const name = attachment.name ?? 'attachment';
  const mimeType = attachment.mimeType ?? (attachment.kind === 'image' ? 'image/unknown' : 'text/plain');

  if (attachment.kind === 'image') {
    return `- image: ${name} (${mimeType})`;
  }

  const preview = attachment.content.slice(0, ATTACHMENT_PREVIEW_LIMIT);
  const suffix = attachment.content.length > ATTACHMENT_PREVIEW_LIMIT ? '\n... [truncated]' : '';
  return `- file: ${name} (${mimeType})\n\`\`\`text\n${preview}${suffix}\n\`\`\``;
}
