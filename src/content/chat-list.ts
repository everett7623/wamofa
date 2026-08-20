import { getChatListItemTitle, getChatListItems } from '~/wa/dom';
import type { PublicState } from '~/lib/types';

export function enhanceChatList(state: PublicState): void {
  for (const item of getChatListItems()) {
    item.querySelector('.wamofa-dots')?.remove();
    const title = getChatListItemTitle(item);
    if (!title) continue;
    const meta = state.chats[`title:${title}`];
    if (!meta?.tagIds.length) continue;
    const tags = state.tagPalette.filter((tag) => meta.tagIds.includes(tag.id));
    if (!tags.length) continue;
    const wrap = document.createElement('span');
    wrap.className = 'wamofa-dots';
    for (const tag of tags) {
      const dot = document.createElement('span');
      dot.className = 'wamofa-dot';
      dot.style.background = tag.color;
      dot.title = tag.name;
      wrap.append(dot);
    }
    const titleNode =
      item.querySelector('span[dir="auto"][title]') ??
      item.querySelector('[title]');
    titleNode?.parentElement?.append(wrap);
  }
}
