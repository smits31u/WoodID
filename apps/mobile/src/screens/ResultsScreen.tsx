import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getReferencePhotos, type ReferencePhoto } from '../api/species';
import { API_BASE_URL } from '../constants/api';
import { canIdentify } from '../lib/usageStats';
import FeedbackPrompt from '../components/FeedbackPrompt';
import { colors, getStatusColor } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

// Drives the "suggest a new species" prompt — distinct from ADD_ANGLE_CONFIDENCE_THRESHOLD below,
// which drives the "add another angle" prompt. Both can show at once for a very low-confidence
// result; they address different actions (report a possible gap in the catalog vs. improve the
// evidence for this specific identification).
const LOW_CONFIDENCE_THRESHOLD = 0.5;

// Below this, the result is shown with a "Low confidence" indicator and a prompt to add another
// angle photo and resubmit. Named constant so it's easy to tune later.
const ADD_ANGLE_CONFIDENCE_THRESHOLD = 0.7;

export default function ResultsScreen({ route, navigation }: Props) {
  const { result, photos, showFeedbackPrompt } = route.params;
  const statusColor = getStatusColor(result.sustainabilityStatus);
  const confidencePercent = Math.round(result.confidence * 100);
  const jankaHardnessLabel =
    result.jankaHardness != null ? `${result.jankaHardness} lbf` : 'Unknown';
  const showSuggestPrompt = result.noDbMatch || result.confidence < LOW_CONFIDENCE_THRESHOLD;
  const isLowConfidence = result.confidence < ADD_ANGLE_CONFIDENCE_THRESHOLD;

  const [galleryPhotos, setGalleryPhotos] = useState<ReferencePhoto[]>([]);

  useEffect(() => {
    if (result.id == null) {
      return;
    }
    getReferencePhotos(result.id)
      .then(setGalleryPhotos)
      .catch(() => setGalleryPhotos([]));
  }, [result.id]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.confidenceRow}>
          <View style={[styles.confidenceDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.confidenceText}>{confidencePercent}% match</Text>
          {isLowConfidence && (
            <View style={styles.lowConfidenceBadge}>
              <Text style={styles.lowConfidenceBadgeText}>Low confidence</Text>
            </View>
          )}
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

        {isLowConfidence && (
          <View style={styles.boostBox}>
            <Text style={styles.reasoningText}>
              Not sure this looks right? Add another angle photo to improve accuracy.
            </Text>
            <Pressable
              style={styles.suggestButton}
              onPress={() => navigation.replace('Camera', { existingPhotos: photos })}
            >
              <Text style={styles.suggestButtonText}>Add another photo</Text>
            </Pressable>
          </View>
        )}

        {result.endGrainImageUrl && (
          <View style={styles.galleryBox}>
            <Text style={styles.reasoningLabel}>Reference end grain</Text>
            <Image source={{ uri: result.endGrainImageUrl }} style={styles.referenceImage} />
          </View>
        )}

        {galleryPhotos.length > 0 && (
          <View style={styles.galleryBox}>
            <Text style={styles.reasoningLabel}>From the community</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryRow}>
              {galleryPhotos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: `${API_BASE_URL}${photo.imageUrl}` }}
                  style={styles.galleryImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {showSuggestPrompt && (
          <View style={styles.suggestBox}>
            <Text style={styles.reasoningText}>Not quite right?</Text>
            <Pressable
              style={styles.suggestButton}
              onPress={() =>
                navigation.navigate('SuggestSpecies', {
                  prefillCommonName: result.commonName,
                  prefillScientificName: result.scientificName,
                })
              }
            >
              <Text style={styles.suggestButtonText}>Suggest a new species</Text>
            </Pressable>
          </View>
        )}

        {showFeedbackPrompt && <FeedbackPrompt result={result} />}

        <Pressable
          style={({ pressed }) => [
            styles.scanAgainButton,
            pressed && styles.scanAgainButtonPressed,
          ]}
          onPress={async () => {
            if (await canIdentify()) {
              navigation.navigate('Camera');
            } else {
              navigation.navigate('Upgrade');
            }
          }}
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
  lowConfidenceBadge: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: `${colors.warning}22`,
  },
  lowConfidenceBadgeText: {
    ...typography.label,
    color: colors.warning,
    letterSpacing: 0.6,
  },
  boostBox: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
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
  galleryBox: {
    marginTop: spacing.lg,
  },
  galleryRow: {
    marginTop: spacing.xs,
  },
  galleryImage: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    marginRight: spacing.sm,
  },
  referenceImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  suggestBox: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  suggestButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.accent,
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
