import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { DesignColors } from '@/constants/design';

/**
 * 下部タブ。Figma の 記録 / マップ / アチーブ / アカウント に合わせている。
 *
 * Figma の指定: 背景 #96C17D、高さ 63、アイコン 30px 白、ラベル 11px 極太 白。
 * アイコン画像は届いていないので @expo/vector-icons で近いものを当てている。
 * 素材が用意できたら tabBarIcon を <Image> に差し替えればよい。
 */

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: DesignColors.white,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.75)',
        tabBarStyle: {
          backgroundColor: DesignColors.green,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 63,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '記録',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'マップ',
          tabBarIcon: ({ color }) => <Ionicons name="location-sharp" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          title: 'アチーブ',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="crown" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'アカウント',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
