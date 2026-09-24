import { memo, useEffect, useRef, useState } from 'react'
import { DisclosureRow, IconThinkOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FocusTranslate } from '../../contract/props.ts'
import { firstLine, latestLines, useThrottledVisualUpdate } from '../helpers/format.ts'
import a11yCss from '../accessibility.module.css'
import css from './ThinkRow.module.css'

/** Trailing lines the collapsed running preview shows. */
const PREVIEW_LINES = 4

/**
 * One Think disclosure, mirroring the chat reasoning row: the first line
 * once settled; while the reasoning is the streaming tail the collapsed row
 * grows a four-line end-following preview under the header — the height
 * animates open and shut, and the running sweep washes the whole segment;
 * the body expands on click.
 */
export const ThinkRow = memo(function ThinkRow({ text, running, title, t }: {
  text: string
  /** Whether the reasoning is still the streaming tail. */
  running: boolean
  /** Row title: the plain Think label, or the duration for a standalone row. */
  title: string
  t: FocusTranslate
}) {
  const [expanded, setExpanded] = useState(false)
  const previewRef = useRef<HTMLSpanElement>(null)
  const previewing = running && !expanded
  const tail = running ? latestLines(text, PREVIEW_LINES) : ''
  const schedulePreviewScroll = useThrottledVisualUpdate(() => {
    const element = previewRef.current
    if (element === null) return
    element.scrollTop = previewing ? element.scrollHeight - element.clientHeight : 0
  })
  useEffect(() => {
    schedulePreviewScroll()
  }, [previewing, schedulePreviewScroll, tail])
  return (
    <div className={css.thinkWrap} data-state={running ? 'running' : 'ok'}>
      {running && <span className={a11yCss.visuallyHidden}>{t('row.running')}</span>}
      <DisclosureRow
        className={css.thinkRow}
        icon={<IconThinkOutlineMedium size={14} />}
        title={title}
        open={expanded}
        expandable
        expandOnRowClick
        onToggle={() => { setExpanded(value => !value) }}
        collapsedContent={running ? null : (
          <>
            <span className={css.thinkSeparator} aria-hidden />
            <span className={css.thinkSummary}>{firstLine(text)}</span>
          </>
        )}
      >
        <div className={css.thinkBody}>{text}</div>
      </DisclosureRow>
      <div className={css.thinkPreview} data-on={previewing || undefined} aria-hidden={previewing ? undefined : 'true'}>
        <div className={css.thinkPreviewClip}>
          <span ref={previewRef} className={css.thinkPreviewText}>{tail}</span>
        </div>
      </div>
    </div>
  )
})
