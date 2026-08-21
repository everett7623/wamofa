export const PAGE_CSS = `
.wamofa-toolbar {
  position: absolute;
  top: 50%;
  right: -60px;
  z-index: 50;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin: 0;
  opacity: 1;
  transform: translateY(-50%);
  pointer-events: none;
}
.wamofa-toolbar.is-out {
  right: auto;
  left: -60px;
  flex-direction: row;
}
.message-in:has(.wamofa-toolbar),
.message-out:has(.wamofa-toolbar),
[data-testid="msg-container"]:has(.wamofa-toolbar) {
  position: relative;
  overflow: visible !important;
}
[data-pre-plain-text]:has(.wamofa-toolbar),
.copyable-text:has(.wamofa-toolbar) {
  overflow: visible !important;
}
.wamofa-icon-btn {
  appearance: none;
  border: 1px solid rgba(0, 128, 105, 0.18);
  background: #fff;
  color: #008069;
  width: 27px;
  height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 0;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 2px 7px rgba(11, 20, 26, 0.16);
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
  pointer-events: auto;
}
.wamofa-icon-btn svg {
  width: 16px;
  height: 16px;
  display: block;
}
.wamofa-icon-btn:hover {
  background: rgba(0, 128, 105, 0.1);
  border-color: rgba(0, 128, 105, 0.35);
}
.wamofa-icon-btn:focus-visible {
  outline: 3px solid rgba(7, 139, 112, 0.2);
  outline-offset: 2px;
}
.wamofa-icon-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}
.wamofa-icon-btn.ghost {
  background: transparent;
  color: #667781;
  border-color: rgba(0, 0, 0, 0.12);
  box-shadow: none;
}
.wamofa-icon-btn.ghost:hover {
  color: #008069;
  border-color: rgba(0, 128, 105, 0.3);
}
.wamofa-result {
  margin: 2px 8px 4px;
  padding: 6px 8px;
  font-size: 13px;
  line-height: 1.4;
  color: #3b4a54;
  background: rgba(231, 246, 241, 0.88);
  border: 1px solid rgba(27, 158, 119, 0.15);
  border-radius: 8px;
  max-width: 80%;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.wamofa-result::before {
  content: "WAMofa";
  display: block;
  margin-bottom: 2px;
  color: #078b70;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.wamofa-result.is-out {
  margin-left: auto;
  background: rgba(231, 243, 238, 0.9);
}
.wamofa-result.is-error {
  color: #b42318;
  background: rgba(254, 243, 242, 0.92);
  border-color: rgba(180, 35, 24, 0.2);
}
.wamofa-dots {
  display: inline-flex;
  gap: 3px;
  margin-left: 6px;
  vertical-align: middle;
}
.wamofa-dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  display: inline-block;
}
.wamofa-header-slot {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  margin-left: 9px;
  padding: 3px 9px;
  max-width: min(240px, 34vw);
  overflow: hidden;
  pointer-events: auto;
  user-select: none;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
  letter-spacing: 0;
  white-space: nowrap;
  color: var(--secondary, #667781);
  background: rgba(0, 128, 105, 0.07);
  border: 1px solid rgba(0, 128, 105, 0.13);
  border-radius: 999px;
  font-family: inherit;
  vertical-align: middle;
  cursor: help;
}
.wamofa-header-slot.is-estimated {
  background: rgba(181, 118, 20, 0.07);
  border-color: rgba(181, 118, 20, 0.24);
  border-style: dashed;
}
.wamofa-header-slot.is-estimated .wamofa-header-time {
  color: #9a6700;
}
.wamofa-header-name-row {
  display: flex !important;
  align-items: center !important;
  min-width: 0;
  white-space: nowrap;
}
.wamofa-header-name-row > [title],
.wamofa-header-name-row > [data-testid="conversation-info-header-chat-title"] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wamofa-header-country {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wamofa-header-sep {
  opacity: 0.5;
  flex-shrink: 0;
}
.wamofa-header-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: 600;
  color: #008069;
}
[data-theme="dark"] .wamofa-header-slot,
.dark .wamofa-header-slot {
  background: rgba(0, 168, 132, 0.12);
  border-color: rgba(0, 168, 132, 0.2);
}
[data-theme="dark"] .wamofa-header-time,
.dark .wamofa-header-time {
  color: #00a884;
}
[data-theme="dark"] .wamofa-header-slot.is-estimated,
.dark .wamofa-header-slot.is-estimated {
  background: rgba(229, 169, 58, 0.12);
  border-color: rgba(229, 169, 58, 0.3);
}
[data-theme="dark"] .wamofa-header-slot.is-estimated .wamofa-header-time,
.dark .wamofa-header-slot.is-estimated .wamofa-header-time {
  color: #e5a93a;
}
[data-theme="dark"] .wamofa-result,
.dark .wamofa-result {
  color: #dfe9e5;
  background: rgba(23, 50, 42, 0.94);
  border-color: rgba(53, 211, 166, 0.18);
}
[data-theme="dark"] .wamofa-result::before,
.dark .wamofa-result::before {
  color: #63e0bb;
}
`;

export function injectPageStyles(): void {
  if (document.getElementById('wamofa-page-style')) return;
  const style = document.createElement('style');
  style.id = 'wamofa-page-style';
  style.textContent = PAGE_CSS;
  document.documentElement.append(style);
}
