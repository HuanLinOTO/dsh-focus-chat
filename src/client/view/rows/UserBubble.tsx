import { memo, useMemo } from 'react'
import { JsonBlock, projectUserText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type { PendingSubmission } from '@deepseek-ai/dsh-api-session-controller/client'
import type { FocusTranslate } from '../../contract/props.ts'
import type { FocusFlowItem } from '../../model/types.ts'
import { jsonTruncated } from '../helpers/terminal.ts'
import { messageImageLabels, userImages } from '../helpers/image-labels.ts'
import { messageText } from '../helpers/message.tsx'
import { ImageGallery, type ImageLoader } from '../chrome/MessageImage.tsx'
import { MessageActions } from '../chrome/MessageActions.tsx'
import css from './UserBubble.module.css'

export const MessageRow = memo(function MessageRow({ item, t, mdLabels, loadImage }: {
  item: Extract<FocusFlowItem, { kind: 'message' }>
  t: FocusTranslate
  mdLabels: MarkdownLabels
  loadImage: ImageLoader
}) {
  const text = useMemo(() => messageText(item.content), [item.content])
  const images = useMemo(() => userImages(item.content), [item.content])
  const others = item.content.filter(block => block.type !== 'text' && block.type !== 'image')
  // An image-only message renders just the gallery, no bubble (the chat rule).
  const showBubble = text !== '' || others.length > 0
  return (
    <div className={css.userRow} data-role={item.role} data-time-hover-root>
      <div className={css.userStack}>
        {images.length > 0 && (
          <ImageGallery images={images} load={loadImage} align="end" labels={messageImageLabels(t)} />
        )}
        {showBubble && (
          <div className={css.bubble}>
            {projectUserText(text, item.referenceLabels ?? [], item.skillNames ?? [])}
            {others.map((block, index) => (
              <JsonBlock
                key={index}
                label={t('extraBlock')}
                payload={block}
                truncatedLabel={jsonTruncated(t)}
              />
            ))}
          </div>
        )}
      </div>
      <MessageActions
        text={text}
        time={item.time}
        runMs={null}
        ttftMs={null}
        tokensPerSecond={null}
        clock="start"
        t={t}
      />
    </div>
  )
})


export const PendingSteeringBubble = memo(function PendingSteeringBubble({ submission, t }: {
  submission: PendingSubmission
  t: FocusTranslate
}) {
  // 0.1.7-rc.1's SessionSnapshot replaced the authoritative `queue` with the
  // local submission echo: `text` plus image/file attachments. Image previews
  // are browser-owned URLs, so they render directly (no session loader).
  const text = submission.text
  const images = submission.attachments.filter(attachment => attachment.type === 'image')
  const files = submission.attachments.filter(attachment => attachment.type === 'file')
  const showBubble = text !== '' || files.length > 0
  return (
    <div className={css.userRow} data-pending-steering data-time-hover-root>
      <div className={css.userStack}>
        {images.length > 0 && (
          <div className={css.bubble} data-pending-images>
            {images.map((attachment, index) => attachment.type === 'image' && (
              <img
                key={index}
                className={css.pendingImage}
                src={attachment.value.previewUrl}
                alt={attachment.value.name ?? ''}
              />
            ))}
          </div>
        )}
        {showBubble && (
          <div className={css.bubble}>
            {projectUserText(text, [])}
            {files.map((attachment, index) => (
              <JsonBlock
                key={index}
                label={t('extraBlock')}
                payload={attachment}
                truncatedLabel={jsonTruncated(t)}
              />
            ))}
          </div>
        )}
      </div>
      <MessageActions
        text={text}
        time={null}
        runMs={null}
        ttftMs={null}
        tokensPerSecond={null}
        clock="start"
        t={t}
      />
    </div>
  )
})
