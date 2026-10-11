import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/common/Text';
import { HIT_SIZE, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export type SheetAction = { label: string; destructive?: boolean; run: () => void };

type Sheet = { title?: string; actions: SheetAction[] };

const ActionSheetContext = createContext<(sheet: Sheet) => void>(() => {});

// Seçenek menüleri. iOS'ta sistem menüsü kullanılır. Android'de Alert en fazla
// üç düğme gösterdiği için alttan açılan bir menü çizilir.
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const show = useCallback((next: Sheet) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: next.title,
          options: [...next.actions.map((a) => a.label), 'Vazgeç'],
          cancelButtonIndex: next.actions.length,
          destructiveButtonIndex: next.actions.flatMap((a, i) => (a.destructive ? [i] : [])),
        },
        (index) => next.actions[index]?.run(),
      );
    } else {
      setSheet(next);
    }
  }, []);

  const choose = (action?: SheetAction) => {
    setSheet(null);
    // Menü kapandıktan sonra çalıştırılır; böylece açılan Alert menünün arkasında kalmaz.
    if (action) setTimeout(action.run, 50);
  };

  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => choose()}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => choose()} accessibilityLabel="Kapat">
          <View
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.sm }]}
            onStartShouldSetResponder={() => true}
          >
            {sheet?.title ? (
              <Text variant="caption" tone="secondary" style={styles.title}>
                {sheet.title}
              </Text>
            ) : null}
            {sheet?.actions.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.skeleton }]}
                onPress={() => choose(action)}
                accessibilityRole="button"
              >
                <Text tone={action.destructive ? 'danger' : 'primary'}>{action.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.skeleton }]}
              onPress={() => choose()}
              accessibilityRole="button"
            >
              <Text tone="secondary">Vazgeç</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet() {
  return useContext(ActionSheetContext);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.sm },
  title: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  option: { minHeight: HIT_SIZE + 8, justifyContent: 'center', paddingHorizontal: spacing.xl },
});
