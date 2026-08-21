import type { ReactNode } from 'react';

export type RailPanel = 'info' | 'translate' | 'quick' | null;

interface Props {
  active: RailPanel;
  dark: boolean;
  chatReady: boolean;
  configured: boolean;
  onToggle: (panel: RailPanel) => void;
  onSettings: () => void;
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.14 0-7.5 2.1-7.5 4.69V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-.81c0-2.59-3.36-4.69-7.5-4.69Z"
      />
    </svg>
  );
}

function IconTranslate() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04ZM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12Zm-2.62 7l1.62-4.33L19.12 17h-3.24Z"
      />
    </svg>
  );
}

function IconQuick() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h16a1 1 0 0 1 1 1v2.18a1 1 0 0 1-.29.7l-6.6 6.6V20l-4.22-2.11A1 1 0 0 1 9.4 17.1v-2.62L2.79 7.88A1 1 0 0 1 2.5 7.18V5a1 1 0 0 1 1-1H4Zm1.41 3 5.8 5.8a1 1 0 0 1 .29.7v1.91l1 .5v-2.41a1 1 0 0 1 .29-.7L18.59 7H5.41Z"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94s.02.63.05.94L2.83 14.16a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
      />
    </svg>
  );
}

const ITEMS: Array<{
  id: Exclude<RailPanel, null>;
  label: string;
  title: string;
  icon: ReactNode;
}> = [
  { id: 'info', label: '客户', title: '客户信息', icon: <IconUser /> },
  { id: 'translate', label: '译出', title: '翻译发出', icon: <IconTranslate /> },
  { id: 'quick', label: '快捷', title: '快捷回复', icon: <IconQuick /> },
];

export function RightRail({ active, dark, chatReady, configured, onToggle, onSettings }: Props) {
  return (
    <aside
      className={`wm-right-rail ${dark ? 'is-dark' : ''}`}
      aria-label="WAMofa"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="wm-rail-group">
        <button
          type="button"
          className="wm-rail-brand"
          title="打开 WAMofa 设置"
          aria-label="打开 WAMofa 设置"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSettings();
          }}
        >
          <span>W</span>
          <i className={`wm-brand-status ${configured ? 'is-ready' : ''}`} aria-hidden="true" />
        </button>
        <span className="wm-rail-divider" aria-hidden="true" />
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`wm-rail-item ${active === item.id ? 'is-active' : ''}`}
            title={item.title}
            aria-label={item.title}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(active === item.id ? null : item.id);
            }}
          >
            <span className="wm-rail-icon">{item.icon}</span>
            <span className="wm-rail-label">{item.label}</span>
            {item.id === 'info' && chatReady ? <i className="wm-rail-dot" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      <div className="wm-rail-group wm-rail-bottom">
        <button
          type="button"
          className="wm-rail-item"
          title="WAMofa 设置"
          aria-label="WAMofa 设置"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSettings();
          }}
        >
          <span className="wm-rail-icon">
            <IconSettings />
          </span>
          <span className="wm-rail-label">设置</span>
        </button>
      </div>
    </aside>
  );
}
