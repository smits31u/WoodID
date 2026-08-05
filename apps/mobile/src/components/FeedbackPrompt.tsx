import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { submitFeedback, FeedbackSubmitError } from '../api/feedback';
import { getDeviceId } from '../lib/deviceId';
import type { IdentifyResult } from '../api/species';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

const STAR_VALUES = [1, 2, 3, 4, 5];

interface Props {
  result: IdentifyResult;
}

type Stage = 'prompt' | 'submitting' | 'done';

export default function FeedbackPrompt({ result }: Props) {
  const [stage, setStage] = useState<Stage>('prompt');
  const [rating, setRating] = useState(0);
  const [actualSpecies, setActualSpecies] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || stage === 'done') {
    return stage === 'done' ? (
      <View style={styles.card}>
        <Text style={styles.thanksText}>Thanks for the feedback!</Text>
      </View>
    ) : null;
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      return;
    }
    setError(null);
    setStage('submitting');
    try {
      const deviceId = await getDeviceId();
      await submitFeedback({
        deviceId,
        rating,
        actualSpecies: actualSpecies.trim() || undefined,
        speciesId: result.id,
        commonName: result.commonName,
        scientificName: result.scientificName,
      });
      setStage('done');
    } catch (err) {
      setError(err instanceof FeedbackSubmitError ? err.message : 'Something went wrong.');
      setStage('prompt');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Was this identification correct?</Text>

      <View style={styles.starRow}>
        {STAR_VALUES.map((value) => (
          <Pressable key={value} onPress={() => setRating(value)} hitSlop={8}>
            <Text style={[styles.star, value <= rating && styles.starFilled]}>★</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>What species was it actually? (optional)</Text>
      <TextInput
        style={styles.input}
        value={actualSpecies}
        onChangeText={setActualSpecies}
        placeholder="e.g. Red Oak"
        placeholderTextColor={colors.textMuted}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <Pressable
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || stage === 'submitting'}
        >
          {stage === 'submitting' ? (
            <ActivityIndicator size="small" color={colors.backgroundElevated} />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  star: {
    fontSize: 28,
    color: colors.textMuted,
  },
  starFilled: {
    color: colors.accent,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  skipText: {
    ...typography.body,
    color: colors.textMuted,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 88,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.accentMuted,
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.backgroundElevated,
  },
  thanksText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
