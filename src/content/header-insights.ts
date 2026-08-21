import { formatHeaderInsightLabel, getPhoneInsights } from '~/lib/phone-insights';
import {
  getActiveChatId,
  getHeader,
  getHeaderPhone,
  getHeaderTitle,
} from '~/wa/dom';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { CONTACT_PHONE_RESOLVED_EVENT } from '~/wa/contact-phone';

const SLOT_CLASS = 'wamofa-header-slot';

function getTitleNode(header: HTMLElement): HTMLElement | null {
  return (
    header.querySelector<HTMLElement>('[data-testid="conversation-info-header-chat-title"]') ??
    header.querySelector<HTMLElement>('span[dir="auto"][title]') ??
    header.querySelector<HTMLElement>('span[title]')
  );
}

function ensureSlotPlacement(slot: HTMLElement, header: HTMLElement) {
  const titleNode = getTitleNode(header);
  const titleRow = titleNode?.parentElement;
  if (!titleNode || !titleRow || titleRow === header) {
    if (slot.parentElement !== header) header.append(slot);
    return;
  }

  document.querySelectorAll('.wamofa-header-name-row').forEach((node) => {
    if (node !== titleRow) node.classList.remove('wamofa-header-name-row');
  });
  titleRow.classList.add('wamofa-header-name-row');
  if (slot.parentElement === titleRow && slot.previousElementSibling === titleNode) return;
  titleNode.insertAdjacentElement('afterend', slot);
}

function renderSlot(
  slot: HTMLElement,
  country: string,
  localTime: string,
  tip: string,
  verified: boolean,
) {
  const label = `${country} · ${localTime}`;
  if (
    slot.dataset.label === label &&
    slot.dataset.title === tip &&
    slot.dataset.verified === String(verified)
  ) return;
  slot.dataset.label = label;
  slot.dataset.title = tip;
  slot.dataset.verified = String(verified);
  slot.classList.toggle('is-estimated', !verified);
  slot.title = tip;
  slot.replaceChildren();

  const countryEl = document.createElement('span');
  countryEl.className = 'wamofa-header-country';
  countryEl.textContent = country;

  const sep = document.createElement('span');
  sep.className = 'wamofa-header-sep';
  sep.textContent = '·';

  const timeEl = document.createElement('span');
  timeEl.className = 'wamofa-header-time';
  timeEl.textContent = localTime;

  slot.append(countryEl, sep, timeEl);
}

export function enhanceHeaderInsights(): void {
  const header = getHeader();
  document.querySelectorAll(`.${SLOT_CLASS}`).forEach((node) => {
    if (!header || !header.contains(node)) node.remove();
  });
  if (!header) return;

  const title = getHeaderTitle();
  const insights = getPhoneInsights({
    chatId: getActiveChatId(),
    title,
    headerPhone: getHeaderPhone(),
  });
  const label = formatHeaderInsightLabel(insights);
  let slot = header.querySelector<HTMLElement>(`.${SLOT_CLASS}`);

  if (!label) {
    slot?.remove();
    return;
  }

  if (!slot) {
    slot = document.createElement('div');
    slot.className = SLOT_CLASS;
    slot.setAttribute('aria-label', '客户当地时间');
  }

  ensureSlotPlacement(slot, header);
  const tip = [
    insights.phone ? `已读取号码：+${insights.phone}` : '暂未读取联系人号码',
    `地区来源：${insights.regionSourceLabel}`,
    insights.timezone,
    insights.workingHint,
  ]
    .filter(Boolean)
    .join(' · ');
  renderSlot(
    slot,
    insights.countryEn || insights.country,
    insights.localTime || '时区待识别',
    tip,
    insights.hasRealPhone && insights.regionSource === 'phone' && Boolean(insights.localTime),
  );
}

export function bindHeaderInsights(ctx: ContentScriptContext): void {
  enhanceHeaderInsights();
  let frame = 0;
  const scheduleRefresh = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      enhanceHeaderInsights();
    });
  };
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'aria-label', 'data-id', 'aria-selected'],
  });
  window.addEventListener(CONTACT_PHONE_RESOLVED_EVENT, scheduleRefresh);
  const timer = window.setInterval(enhanceHeaderInsights, 15_000);
  ctx.onInvalidated(() => {
    observer.disconnect();
    window.removeEventListener(CONTACT_PHONE_RESOLVED_EVENT, scheduleRefresh);
    if (frame) window.cancelAnimationFrame(frame);
    window.clearInterval(timer);
    document.querySelectorAll(`.${SLOT_CLASS}`).forEach((node) => node.remove());
    document.querySelectorAll('.wamofa-header-name-row').forEach((node) => {
      node.classList.remove('wamofa-header-name-row');
    });
  });
}
