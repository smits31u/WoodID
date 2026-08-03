import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { submitSpeciesSuggestion, ContributionError } from '../api/contributions';
import { getDeviceId } from '../lib/deviceId';
import type { CapturedPhoto } from '../lib/photo';
import SinglePhotoCapture from '../components/SinglePhotoCapture';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'SuggestSpecies'>;
type Stage = 'form' | 'photos' | 'capture' | 'submitting' | 'success' | 'error';

const MAX_PHOTOS = 3;

export default function SuggestSpeciesScreen({ navigation, route }: Props) {
  const [stage, setStage] = useState<Stage>('form');
  const [commonName, setCommonName] = useState(route.params?.prefillCommonName ?? '');
  const [scientificName, setScientificName] = useState(route.params?.prefillScientificName ?? '');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePhotoCaptured = useCallback((photo: CapturedPhoto) => {
    setPhotos((current) => [...current, photo]);
    setStage('photos');
  }, []);

  const submit = useCallback(async () => {
    setStage('submitting');
    try {
      const deviceId = await getDeviceId();
      await submitSpeciesSuggestion({
        proposedCommonName: commonName.trim(),
        proposedScientificName: scientificName.trim() || undefined,
        submitterNotes: notes.trim() || undefined,
        deviceId,
        photos,
      });
      setStage('success');
    } catch (error) {
      setErrorMessage(
        error instanceof ContributionError
          ? error.message
          : 'Something went wrong submitting this suggestion.',
      );
      setStage('error');
    }
  }, [commonName, scientificName, notes, photos]);

  if (stage === 'capture') {
    return (
      <SinglePhotoCapture
        captureKey={`photo-${photos.length}`}
        title={`Photo ${photos.length + 1} of ${MAX_PHOTOS}`}
        description="Photograph the grain, bark, or any identifying detail."
        onCaptured={handlePhotoCaptured}
        onClose={() => setStage(photos.length === 0 ? 'form' : 'photos')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {stage === 'form' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Suggest a new species</Text>
          <Text style={styles.label}>Common name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Bubinga"
            placeholderTextColor={colors.textMuted}
            value={commonName}
            onChangeText={setCommonName}
          />
          <Text style={styles.label}>Scientific name (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="If you know it"
            placeholderTextColor={colors.textMuted}
            value={scientificName}
            onChangeText={setScientificName}
          />
          <Text style={styles.label}>How do you know this?</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Optional notes"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <Pressable
            style={[styles.primaryButton, !commonName.trim() && styles.primaryButtonDisabled]}
            disabled={!commonName.trim()}
            onPress={() => setStage('photos')}
          >
            <Text style={styles.primaryButtonText}>Next: add photos</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      )}

      {stage === 'photos' && (
        <View style={styles.content}>
          <Text style={styles.title}>Add photos</Text>
          <Text style={styles.body}>At least one photo, up to {MAX_PHOTOS}.</Text>
          <View style={styles.thumbnailRow}>
            {photos.map((photo) => (
              <Image key={photo.key} source={{ uri: photo.uri }} style={styles.thumbnail} />
            ))}
          </View>
          {photos.length < MAX_PHOTOS && (
            <Pressable style={styles.secondaryButton} onPress={() => setStage('capture')}>
              <Text style={styles.secondaryButtonText}>
                {photos.length === 0 ? 'Take a photo' : 'Add another photo'}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.primaryButton, photos.length === 0 && styles.primaryButtonDisabled]}
            disabled={photos.length === 0}
            onPress={submit}
          >
            <Text style={styles.primaryButtonText}>Submit</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => setStage('form')}>
            <Text style={styles.linkButtonText}>Back</Text>
          </Pressable>
        </View>
      )}

      {stage === 'submitting' && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.body}>Submitting…</Text>
        </View>
      )}

      {stage === 'success' && (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Thanks for the suggestion!</Text>
          <Text style={styles.body}>We'll review it and add it if it checks out.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      )}

      {stage === 'error' && (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Submission failed</Text>
          <Text style={styles.body}>{errorMessage}</Text>
          <Pressable style={styles.primaryButton} onPress={submit}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.linkButtonText}>Back to home</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: radii.md,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.backgroundElevated,
  },
  secondaryButton: {
    backgroundColor: colors.overlay,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.textPrimary + '33',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  linkButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  linkButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
