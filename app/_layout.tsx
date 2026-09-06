import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

// ⚠️ この import は消さないこと。
// バックグラウンドタスクの defineTask をモジュールのトップレベルで実行させるために
// 必要で、これが無いと OS がバックグラウンドで JS を起こしてもタスクが未定義になる。
import { bootstrapBackgroundAsync } from '@/background';

import { AuthProvider } from '@/auth/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // 定期同期タスクの登録と、起動時の歩数取り込み。
  // 失敗しても画面は出したいので await せず、例外もここで握る。
  useEffect(() => {
    bootstrapBackgroundAsync().catch((error) => {
      console.error('[app] バックグラウンドの初期化に失敗', error);
    });
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
