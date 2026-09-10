/** User message text join (the chat bubble's text source). */
export function messageText(content: readonly { type?: string; text?: string }[]): string {
  return content.flatMap(block => block.type === 'text' ? [block.text ?? ''] : []).join('')
}
