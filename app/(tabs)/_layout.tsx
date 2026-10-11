import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, inactive: IconName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Ana Sayfa', tabBarIcon: icon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Keşfet', tabBarIcon: icon('compass', 'compass-outline') }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Paylaş',
          tabBarAccessibilityLabel: 'Kombin paylaş',
          // Paylaş sekmesi diğerlerinden görsel olarak ayrılır.
          tabBarIcon: () => (
            <View style={[styles.create, { backgroundColor: colors.accent }]}>
              <Ionicons name="add" size={26} color={colors.onAccent} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'Kaydedilenler', tabBarIcon: icon('bookmark', 'bookmark-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: icon('person-circle', 'person-circle-outline') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  create: { width: 44, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
