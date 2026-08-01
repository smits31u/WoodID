import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, getStatusColor } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ route, navigation }: Props) {
  const { result } = route.params;
  const statusColor = getStatusColor(result.sustainabilityStatus);
  const confidencePercent = Math.round(result.confidence * 100);
  const jankaHardnessLabel =
    result.jankaHardness != null ? `${result.jankaHardness} lbf` : 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.confidenceRow}>
          <View style={[styles.confidenceDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.confidenceText}>{confidencePercent}% match</Text>
        </View>

        <Text style={styles.commonName}>{result.commonName ?? 'Unknown species'}</Text>
        <Text style={styles.scientificName}>
          {result.scientificName ?? 'Scientific name unavailable'}
        </Text>

        <View style={styles.card}>
          <StatRow label="Janka hardness" value={jankaHardnessLabel} />
          <Divider />
          <StatRow label="Grain type" value={result.grainType ?? 'Unknown'} />
          <Divider />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sustainability</Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {result.sustainabilityStatus ?? 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        {result.reasoning && (
          <View style={styles.reasoningBox}>
            <Text style={styles.reasoningLabel}>Why this identification</Text>
            <Text style={styles.reasoningText}>{result.reasoning}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.scanAgainButton,
            pressed && styles.scanAgainButtonPressed,
          ]}
          onPress={() => navigation.navigate('Camera')}
        >
          <Text style={styles.scanAgainText}>Scan another sample</Text>
        </Pressable>

        <Pressable style={styles.homeLink} onPress={() => navigation.popToTop()}>
          <Text style={styles.homeLinkText}>Back to home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    ...typography.label,
    color: colors.accent,
  },
  commonName: {
    ...typography.display,
    color: colors.textPrimary,
  },
  scientificName: {
    ...typography.subtitle,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  reasoningBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  reasoningLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  reasoningText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  statLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusPill: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  statusPillText: {
    ...typography.label,
    letterSpacing: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  scanAgainButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  scanAgainButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  scanAgainText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.backgroundElevated,
  },
  homeLink: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  homeLinkText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
