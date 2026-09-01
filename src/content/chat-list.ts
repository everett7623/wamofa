import { getChatListItemTitle, getChatListItems } from '~/wa/dom';
import { resolveChatLookup } from '~/lib/chat-keys';
import type { PublicState } from '~/lib/types';

export function enhanceChatList(state: PublicState): void {
  for (const item of getChatListItems()) {
    const title = getChatListItemTitle(item);
    if (!title) {
      item.querySelector('.wamofa-dots')?.remove();
      continue;
    }

    // Prefer phone from the list cell when available so dots match panel meta.
    const cellId =
      item.getAttribute('data-id') ??
      item.querySelector('[data-id]')?.getAttribute('data-id') ??
      '';
    const phoneMatch = cellId.match(/(\d{7,15})@(?:c\.us|s\.whatsapp\.net)/i);
    const phone = phoneMatch?.[1] ?? null;

    const { meta } = resolveChatLookup(state.chats, { title, phone });
    if (!meta.tagIds.length) {
      item.querySelector('.wamofa-dots')?.remove();
      continue;
    }

    const tags = state.tagPalette.filter((tag) => meta.tagIds.includes(tag.id));
    if (!tags.length) {
      item.querySelector('.wamofa-dots')?.remove();
      continue;
    }

    let wrap = item.querySelector<HTMLElement>('.wamofa-dots');
    const signature = tags.map((tag) => `${tag.id}:${tag.color}`).join('|');
    if (wrap?.dataset.signature === signature) continue;

    wrap?.remove();
    wrap = document.createElement('span');
    wrap.className = 'wamofa-dots';
    wrap.dataset.signature = signature;
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
