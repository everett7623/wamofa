export const PAGE_CSS = `
.wamofa-toolbar {
  display: flex;
  gap: 6px;
  margin: 4px 8px 2px;
  flex-wrap: wrap;
}
.wamofa-toolbar.is-out {
  justify-content: flex-end;
}
.wamofa-chip {
  appearance: none;
  border: 0;
  background: #1b9e77;
  color: #fff;
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
}
.wamofa-chip:disabled {
  opacity: 0.6;
  cursor: wait;
}
.wamofa-chip.ghost {
  background: transparent;
  color: #1b9e77;
  box-shadow: inset 0 0 0 1px #1b9e77;
}
.wamofa-result {
  margin: 2px 8px 8px;
  padding: 7px 9px;
  font-size: 13px;
  line-height: 1.45;
  color: #3b4a54;
  background: #eef6f3;
  border-radius: 8px;
  max-width: 85%;
  white-space: pre-wrap;
  word-break: break-word;
}
.wamofa-result.is-out {
  margin-left: auto;
  background: #e7f3ee;
}
.wamofa-result.is-error {
  color: #b42318;
  background: #fef3f2;
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
`;

export function injectPageStyles(): void {
  if (document.getElementById('wamofa-page-style')) return;
  const style = document.createElement('style');
  style.id = 'wamofa-page-style';
  style.textContent = PAGE_CSS;
  document.documentElement.append(style);
}
