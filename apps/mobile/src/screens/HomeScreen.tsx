import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getQueue, markViewed, type QueueItem } from '../lib/offlineQueue';
import { canIdentify, getRemainingToday } from '../lib/usageStats';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      getQueue().then(setQueue);
      getRemainingToday().then(setRemainingToday);
    }, []),
  );

  const readyItem = queue.find((item) => item.status === 'done');
  const pendingCount = queue.filter(
    (item) => item.status === 'pending' || item.status === 'submitting',
  ).length;
  const failedItems = queue.filter((item) => item.status === 'failed');

  const handleOpenReady = () => {
    if (!readyItem?.result) {
      return;
    }
    markViewed(readyItem.id).then(() => setQueue((q) => q.filter((i) => i.id !== readyItem.id)));
    navigation.navigate('Results', {
      result: readyItem.result,
      photos: readyItem.photos,
      showFeedbackPrompt: readyItem.showFeedbackPrompt,
    });
  };

  const handleDismissFailed = () => {
    Promise.all(failedItems.map((item) => markViewed(item.id))).then(() =>
      setQueue((q) => q.filter((item) => item.status !== 'failed')),
    );
  };

  const handleShutterPress = async () => {
    if (await canIdentify()) {
      navigation.navigate('Camera');
    } else {
      navigation.navigate('Upgrade');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.brand}>Grainscope</Text>
        <Text style={styles.tagline}>Point. Snap. Identify.</Text>
      </View>

      {readyItem && (
        <Pressable style={styles.queueBanner} onPress={handleOpenReady}>
          <Text style={styles.queueBannerText}>
            {readyItem.result?.commonName ?? 'A queued photo'} identified — tap to view
          </Text>
        </Pressable>
      )}
      {!readyItem && pendingCount > 0 && (
        <View style={styles.queueBannerMuted}>
          <Text style={styles.queueBannerMutedText}>
            {pendingCount} photo{pendingCount === 1 ? '' : 's'} waiting to submit
          </Text>
        </View>
      )}
      {!readyItem && failedItems.length > 0 && (
        <Pressable style={styles.queueBannerMuted} onPress={handleDismissFailed}>
          <Text style={styles.queueBannerMutedText}>
            {failedItems.length} submission{failedItems.length === 1 ? '' : 's'} couldn't complete —
            tap to dismiss
          </Text>
        </Pressable>
      )}

      <View style={styles.center}>
        <Pressable
          onPress={handleShutterPress}
          hitSlop={16}
          style={({ pressed }) => [styles.shutterRing, pressed && styles.shutterRingPressed]}
        >
          <View style={styles.shutterInner}>
            <View style={styles.lens} />
          </View>
        </Pressable>
        <Text style={styles.hint}>Tap to identify a wood species</Text>
        {remainingToday != null && (
          <Text style={styles.quotaHint}>
            {remainingToday > 0
              ? `${remainingToday} free identification${remainingToday === 1 ? '' : 's'} left today`
              : "You've used today's free identifications"}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Works best in good light, close to the grain</Text>
        <View style={styles.contributeRow}>
          <Pressable onPress={() => navigation.navigate('ContributePhoto')} hitSlop={8}>
            <Text style={styles.contributeLink}>Contribute a photo</Text>
          </Pressable>
          <Text style={styles.contributeDivider}>·</Text>
          <Pressable onPress={() => navigation.navigate('SuggestSpecies')} hitSlop={8}>
            <Text style={styles.contributeLink}>Suggest a species</Text>
          </Pressable>
          <Text style={styles.contributeDivider}>·</Text>
          <Pressable onPress={() => navigation.navigate('History')} hitSlop={8}>
            <Text style={styles.contributeLink}>History</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => navigation.navigate('About')} hitSlop={8}>
          <Text style={styles.aboutLink}>About / Data Sources</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const RING_SIZE = 132;
const INNER_SIZE = 108;
const LENS_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  brand: {
    ...typography.display,
    color: colors.textPrimary,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  queueBanner: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: `${colors.accent}22`,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  queueBannerText: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
  },
  queueBannerMuted: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  queueBannerMutedText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  shutterRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accentMuted,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  shutterRingPressed: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
  },
  shutterInner: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lens: {
    width: LENS_SIZE,
    height: LENS_SIZE,
    borderRadius: LENS_SIZE / 2,
    backgroundColor: colors.backgroundElevated,
  },
  hint: {
    ...typography.label,
    color: colors.textMuted,
  },
  quotaHint: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  footerText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  contributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contributeLink: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  contributeDivider: {
    color: colors.textMuted,
  },
  aboutLink: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
