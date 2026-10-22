import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { sendExtension } from '~/lib/messaging';
import { RELEASES_PAGE, type UpdatePhase, type UpdateSnapshot } from '~/lib/update';
import './version-center.css';

function formatCheckedAt(value: number | null): string {
  if (!value) return '尚未检查';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}

function statusTitle(phase: UpdatePhase): string {
  if (phase === 'current') return '已是最新版本';
  if (phase === 'update') return '发现新版本';
  if (phase === 'ahead') return '本地版本更新';
  return '尚未核对';
}

function statusDetail(info: UpdateSnapshot): string {
  if (info.phase === 'current') return `WAMofa ${info.current} 是最新版本。`;
  if (info.phase === 'update' && info.latest) {
    return `GitHub 已发布 v${info.latest}。打开发布页查看变更，再手动更新扩展。`;
  }
  if (info.phase === 'ahead') {
    return '当前安装比已发布版本更新。发布之后会显示已是最新版本。';
  }
  return info.error ?? '还没有成功检查过 GitHub。';
}

function unknownSnapshot(error: string): UpdateSnapshot {
  return {
    current: browser.runtime.getManifest().version,
    latest: null,
    htmlUrl: RELEASES_PAGE,
    checkedAt: null,
    phase: 'unknown',
    error,
  };
}

export default function VersionCenter() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<UpdateSnapshot | null>(null);
  const current = info?.current ?? browser.runtime.getManifest().version;
  const phase = info?.phase ?? 'unknown';

  async function check(force: boolean) {
    setChecking(true);
    try {
      const res = await sendExtension({ type: 'WAMOFA_CHECK_UPDATE', force });
      if (res.ok && 'update' in res) {
        setInfo(res.update);
        return;
      }
      setInfo((prev) => prev ?? unknownSnapshot(!res.ok ? res.error : '检查失败，请稍后重试'));
    } catch {
      setInfo((prev) => prev ?? unknownSnapshot('检查失败，请稍后重试'));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void check(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const chipLabel = checking && !info
    ? '正在检查…'
    : phase === 'unknown'
      ? '点击检查更新'
      : statusTitle(phase);

  const dialog = open ? (
    <div className="version-backdrop" onClick={() => setOpen(false)}>
      <div
        className="version-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="version-dialog-head">
          <div>
            <h2 id={titleId}>版本中心</h2>
            <p>对照 GitHub 最新发布，确认当前安装是不是最新版。不会自动下载。</p>
          </div>
          <button type="button" className="version-close" aria-label="关闭" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>

        <div className="version-rows">
          <div className="version-row">
            <span>当前安装版本</span>
            <strong>v{current}</strong>
          </div>
          <div className="version-row">
            <span>GitHub 最新版本</span>
            <strong>{info?.latest ? `v${info.latest}` : '—'}</strong>
          </div>
          <div className="version-row">
            <span>上次检查</span>
            <strong>{formatCheckedAt(info?.checkedAt ?? null)}</strong>
          </div>
        </div>

        <div className={`version-status is-${phase}`}>
          <strong>{checking ? '正在检查…' : statusTitle(phase)}</strong>
          <p>{info ? statusDetail(info) : '正在向 GitHub 查询最新发布。'}</p>
        </div>
        {info?.error && info.phase !== 'unknown' ? (
          <p className="version-error">{info.error} 下面仍是上次成功的结果。</p>
        ) : null}

        <div className="version-actions">
          <button
            type="button"
            className="version-check"
            disabled={checking}
            onClick={() => void check(true)}
          >
            <svg className={checking ? 'is-spin' : undefined} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.4 6.3L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12a9 9 0 0 1 15.4-6.3L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 3v5h-5M3 21v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {checking ? '正在检查' : '立即检查'}
          </button>
          <button
            type="button"
            className="version-changes"
            onClick={() => {
              void browser.tabs.create({ url: info?.htmlUrl || RELEASES_PAGE });
            }}
          >
            查看变更
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="version-center">
      <button
        type="button"
        className={`version-chip is-${phase}`}
        onClick={() => setOpen(true)}
      >
        <span className="version-chip-tag" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M20.2 13.4 12.6 21a2 2 0 0 1-2.8 0L3 14.2V4.8A1.8 1.8 0 0 1 4.8 3H14.2L20.2 9a2 2 0 0 1 0 2.8Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="1.3" fill="currentColor" />
          </svg>
        </span>
        <span>
          <strong>v{current}</strong>
          <small>{chipLabel}</small>
        </span>
      </button>
      {dialog ? createPortal(dialog, document.body) : null}
    </div>
  );
}
