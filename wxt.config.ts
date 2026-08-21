import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
    developmentIndicator: false,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'WAMofa',
    description:
      'WhatsApp Web 安全辅助：AI 翻译、快捷回复、备注与语音转写。纯本地，不群发。',
    version: '0.2.0',
    homepage_url: 'https://wamofa.com',
    permissions: ['storage'],
    host_permissions: [
      'https://web.whatsapp.com/*',
      'https://*/*',
      'http://127.0.0.1/*',
      'http://localhost/*',
    ],
  },
});
