import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { ScreenHeader } from '@/components/home/screen-header';
import { isRemoteEnabled } from '@/config/app-config';
import { DesignColors } from '@/constants/design';
import { usePedometerSystem } from '@/hooks/use-pedometer-system';

/**
 * 「アカウント」タブ。
 * ログイン状態・累計の記録・開発用ダッシュボードへの入口。
 */

export default function AccountScreen() {
  const { status, user, signOut } = useAuth();
  const { total, profile, lastSyncedAt } = usePedometerSystem();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="アカウント" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Ionicons name="person-circle" size={64} color={DesignColors.green} />
          {status === 'authenticated' && user ? (
            <>
              <Text style={styles.name}>{user.displayName}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </>
          ) : (
            <>
              <Text style={styles.name}>ゲスト</Text>
              <Text style={styles.email}>
                ログインすると、これまでの記録を引き継いで保存できます
              </Text>
            </>
          )}
        </View>

        {status === 'authenticated' ? (
          <Pressable style={styles.ghostButton} onPress={signOut}>
            <Text style={styles.ghostLabel}>ログアウト</Text>
          </Pressable>
        ) : (
          <Link href="/login" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonLabel}>ログイン / 新規登録</Text>
            </Pressable>
          </Link>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>これまでの記録</Text>
          <Row label="累計歩数" value={`${total.steps.toLocaleString('ja-JP')} 歩`} />
          <Row label="累計距離" value={`${(total.distanceM / 1000).toFixed(1)} km`} />
          <Row label="累計カロリー" value={`${Math.round(total.kcal).toLocaleString('ja-JP')} kcal`} />
          <Row label="累計節約額" value={`${Math.round(total.savedYen).toLocaleString('ja-JP')} 円`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>設定</Text>
          <Row label="身長" value={`${profile.heightCm} cm`} />
          <Row label="体重" value={`${profile.weightKg} kg`} />
          <Text style={styles.note}>※ 入力画面はこれから実装します</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>開発用</Text>
          <Row label="接続モード" value={isRemoteEnabled() ? 'サーバ接続' : 'ローカル専用'} />
          <Row
            label="最終同期"
            value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('ja-JP') : '—'}
          />
          <Link href="/debug" asChild>
            <Pressable style={styles.ghostButton}>
              <Text style={styles.ghostLabel}>開発用ダッシュボードを開く</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DesignColors.screen },
  content: { padding: 22, gap: 18, paddingBottom: 40 },
  card: { alignItems: 'center', gap: 4, paddingVertical: 12 },
  name: { fontSize: 20, fontWeight: '800', color: DesignColors.stationText },
  email: { fontSize: 12, color: '#888', textAlign: 'center' },
  section: {
    backgroundColor: '#F7F8F5',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: DesignColors.green, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 13, color: '#666' },
  rowValue: { fontSize: 13, fontWeight: '700', color: '#333' },
  note: { fontSize: 11, color: '#999', marginTop: 4 },
  // Link の asChild に配列スタイル ([a, b]) を渡すと web 側で
  // DOM に配列がそのまま渡ってしまうため、ボタンは 1 つの完結したスタイルにしている。
  button: {
    backgroundColor: DesignColors.green,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonLabel: { color: DesignColors.white, fontSize: 15, fontWeight: '800' },
  ghostButton: {
    backgroundColor: '#EEF2EA',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  ghostLabel: { color: '#4A7C2F', fontSize: 15, fontWeight: '800' },
});
