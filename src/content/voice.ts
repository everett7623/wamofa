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

export async function captureVoiceAudio(
  bubble: HTMLElement,
): Promise<{ mime: string; dataBase64: string } | null> {
  let audio = bubble.querySelector('audio');
  if (!audio?.src) {
    const play =
      bubble.querySelector<HTMLButtonElement>('[data-testid="audio-play"]') ??
      bubble.querySelector<HTMLButtonElement>('button[aria-label]');
    play?.click();
    await sleep(400);
    audio = bubble.querySelector('audio');
    audio?.pause();
  }
  const src = audio?.currentSrc || audio?.src;
  if (!src) return null;
  const res = await fetch(src);
  const blob = await res.blob();
  if (blob.size < 32) return null;
  return {
    mime: blob.type || 'audio/ogg',
    dataBase64: await blobToBase64(blob),
  };
}
