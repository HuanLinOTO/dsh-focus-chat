/** Tool-family leading icons (the chat GenericToolCard table). */
import type { ReactNode } from 'react'
import { IconApiOutlineMedium, IconBrowseOutlineRegular, IconChecklistOutlineMedium, IconCodeOutlineRegular, IconEditOutlineRegular, IconQuestionOutlineMedium, IconSearchOutlineRegular, IconSkillOutlineRegular, IconSparkleRegular, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FocusToolRow } from '../../model/types.ts'

/** Tool-family leading icons, mirroring the chat GenericToolCard table (glyphs at 14). */
export const VARIANT_ICONS: Record<'search' | 'read' | 'bash' | 'write' | 'edit' | 'code' | 'question' | 'todo' | 'skill' | 'others', ReactNode> = {
  search: <IconSearchOutlineRegular size={14} />,
  read: <IconBrowseOutlineRegular size={14} />,
  bash: <IconApiOutlineMedium size={14} />,
  write: <IconEditOutlineRegular size={14} />,
  edit: <IconEditOutlineRegular size={14} />,
  code: <IconCodeOutlineRegular size={14} />,
  question: <IconQuestionOutlineMedium size={14} />,
  todo: <IconChecklistOutlineMedium size={14} />,
  skill: <IconSkillOutlineRegular size={14} />,
  others: <IconSparkleRegular size={14} />,
}

/** Tool name → leading-icon family (mirrors the chat row classification). */
export const TOOL_VARIANTS: Readonly<Record<string, keyof typeof VARIANT_ICONS>> = {
  bash: 'bash',
  pwsh: 'bash',
  read: 'read',
  read_image: 'read',
  web_fetch: 'read',
  web_search: 'search',
  grep: 'search',
  glob: 'search',
  todo_write: 'todo',
  skill: 'skill',
  write: 'write',
  edit: 'edit',
  str_replace_editor: 'edit',
  run_code: 'code',
  cordis_inspect_list: 'read',
  cordis_inspect_query: 'read',
  ask_user_question: 'question',
}

/** One call's leading glyph: the family icon, or the state dot for failures. */
export function leadingFor(row: FocusToolRow): ReactNode {
  if (row.state === 'error') return <StateDot state="error" />
  if (row.state === 'stopped') return <StateDot state="warning" />
  const variant = TOOL_VARIANTS[row.name] ?? 'others'
  return <span data-tool-icon={variant}>{VARIANT_ICONS[variant]}</span>
}

