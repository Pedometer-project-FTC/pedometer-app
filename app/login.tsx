import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isRemoteEnabled } from '@/config/app-config';

/**
 * ログイン / 新規登録の画面。
 *
 * デザインは仮。Figma の UI が固まったら差し替える前提で、
 * ロジック(useAuth)と見た目を分けてある。
 */

type Mode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, busy, error, clearError, status, user, signOut } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const switchMode = (next: Mode) => {
    clearError();
    setMode(next);
  };

  const submit = async () => {
    const ok =
      mode === 'signIn'
        ? await signIn({ email, password })
        : await signUp({ email, password, displayName });
    if (ok) router.back();
  };

  if (status === 'authenticated' && user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ログイン中</Text>
        <Text style={styles.body}>{user.displayName}</Text>
        <Text style={styles.caption}>{user.email}</Text>
        <Pressable style={[styles.button, styles.secondary]} onPress={signOut}>
          <Text style={styles.secondaryLabel}>ログアウト</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === 'signIn' ? 'ログイン' : '新規登録'}</Text>

        {!isRemoteEnabled() && (
          <Text style={styles.notice}>
            サーバ未接続 (ローカル専用モード)。アカウントはこの端末内にのみ作成されます。
          </Text>
        )}

        {mode === 'signUp' && (
          <TextInput
            style={styles.input}
            placeholder="ニックネーム"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="none"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード (8文字以上)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>{mode === 'signIn' ? 'ログイン' : '登録する'}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          style={styles.switch}>
          <Text style={styles.switchLabel}>
            {mode === 'signIn' ? 'アカウントを作る' : 'ログインに戻る'}
          </Text>
        </Pressable>

        <Text style={styles.caption}>
          ログインしなくても歩数は記録されます。あとからログインすると、それまでの記録が
          アカウントに引き継がれます。
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, gap: 12, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 18, fontWeight: '600' },
  caption: { fontSize: 12, color: '#666', lineHeight: 18 },
  notice: {
    fontSize: 12,
    color: '#7a5c00',
    backgroundColor: '#fff4d1',
    padding: 10,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#8FBC72',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { backgroundColor: '#eee' },
  secondaryLabel: { color: '#333', fontSize: 16, fontWeight: '700' },
  switch: { alignItems: 'center', paddingVertical: 8 },
  switchLabel: { color: '#4a7c2f', fontSize: 14, fontWeight: '600' },
  error: { color: '#c0392b', fontSize: 13 },
});
