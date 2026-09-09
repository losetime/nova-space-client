<template>
  <a-config-provider :locale="zhCN" :theme="darkTheme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { theme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#00d4ff',
    colorBgContainer: '#1a1a2e',
    colorBgElevated: '#14142a',
    colorBorder: 'rgba(0, 212, 255, 0.15)',
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
    colorBgLayout: '#0a0a0f',
    borderRadius: 8,
  },
  components: {
    Button: {
      primaryColor: '#00d4ff',
    },
    Input: {
      colorBgContainer: 'rgba(255, 255, 255, 0.05)',
      colorBorder: 'rgba(255, 255, 255, 0.1)',
    },
    Select: {
      colorBgContainer: 'rgba(255, 255, 255, 0.05)',
      colorBorder: 'rgba(255, 255, 255, 0.1)',
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: 'rgba(0, 212, 255, 0.1)',
      headerColor: 'rgba(255, 255, 255, 0.9)',
      rowHoverBg: 'rgba(0, 212, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    Tabs: {
      colorText: 'rgba(255, 255, 255, 0.7)',
      colorTextActive: '#00d4ff',
      inkBarColor: '#00d4ff',
    },
    Modal: {
      contentBg: '#1a1a2e',
      headerBg: '#1a1a2e',
    },
    Dropdown: {
      colorBgElevated: 'rgba(20, 20, 42, 0.98)',
    },
    Menu: {
      colorBgElevated: 'transparent',
      colorItemText: 'rgba(255, 255, 255, 0.7)',
      colorItemTextHover: '#00d4ff',
      colorItemBgHover: 'rgba(0, 212, 255, 0.1)',
    },
    Form: {
      labelColor: 'rgba(255, 255, 255, 0.8)',
    },
    Tag: {
      defaultBg: 'rgba(255, 255, 255, 0.1)',
      defaultColor: 'rgba(255, 255, 255, 0.85)',
    },
  },
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #0a0a0f;
  color: #ffffff;
}

/* 科技感滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #1a1a2e;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #00d4ff 0%, #7b2cbf 100%);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #00a8cc 0%, #9d4edd 100%);
}
</style>
