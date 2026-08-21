function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function findAudio(bubble: HTMLElement): HTMLAudioElement | null {
  return (
    bubble.querySelector('audio') ??
    bubble.closest('.message-in, .message-out, [data-testid="msg-container"]')?.querySelector('audio') ??
    null
  );
}

export async function captureVoiceAudio(
  bubble: HTMLElement,
): Promise<{ mime: string; dataBase64: string } | null> {
  let audio = findAudio(bubble);
  if (!audio?.src && !audio?.currentSrc) {
    const play =
      bubble.querySelector<HTMLButtonElement>('[data-testid="audio-play"]') ??
      bubble.querySelector<HTMLButtonElement>('[data-testid="ptt-play-button"]') ??
      [...bubble.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find((btn) =>
        /play|播放|voice|语音|audio|音频/i.test(btn.getAttribute('aria-label') ?? ''),
      );
    play?.click();

    // 轮询等待音频加载，最多 3 秒
    for (let i = 0; i < 10; i++) {
      await sleep(300);
      audio = findAudio(bubble);
      if (audio?.src || audio?.currentSrc) break;
    }
    audio?.pause();
  }

  const src = audio?.currentSrc || audio?.src;
  if (!src) return null;

  try {
    const res = await fetch(src);
    const blob = await res.blob();
    if (blob.size < 32) return null;
    return {
      mime: blob.type || 'audio/ogg',
      dataBase64: await blobToBase64(blob),
    };
  } catch {
    return null;
  }
}
