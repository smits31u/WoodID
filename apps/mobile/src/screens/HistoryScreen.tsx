import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { clearHistory, getHistory, type HistoryEntry } from '../lib/history';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setEntries);
    }, []),
  );

  const handleClear = () => {
    Alert.alert('Clear history', 'This removes every saved identification from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => clearHistory().then(() => setEntries([])),
      },
    ]);
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const thumbnail = item.photos[0];
    const confidencePercent = Math.round(item.result.confidence * 100);

    return (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Results', { result: item.result, photos: item.photos })}
      >
        {thumbnail ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${thumbnail.base64}` }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.result.commonName ?? 'Unknown species'}
          </Text>
          <Text style={styles.rowMeta}>
            {confidencePercent}% match · {formatDate(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        {entries.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Text style={styles.clearLink}>Clear</Text>
          </Pressable>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Identifications you make will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  clearLink: {
    ...typography.body,
    fontWeight: '600',
    color: colors.danger,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowMeta: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
