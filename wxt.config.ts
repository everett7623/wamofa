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
      'WhatsApp Web 助手：AI 翻译、客户备注标签、快捷回复、语音转写。本地存储，不群发。',
    version: '0.2.5',
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
