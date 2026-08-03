import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { identifySpecies, IdentifyError } from '../api/species';
import SinglePhotoCapture, { type HintVariant } from '../components/SinglePhotoCapture';
import type { CapturedPhoto } from '../lib/photo';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;
type Stage = 'capture' | 'identifying' | 'error';

interface CaptureStep {
  key: string;
  title: string;
  description: string;
  hint: HintVariant;
  optional: boolean;
}

const CAPTURE_STEPS: CaptureStep[] = [
  {
    key: 'faceGrain',
    title: 'Face Grain',
    description: 'Photograph the flat surface showing the growth ring pattern.',
    hint: 'face',
    optional: false,
  },
  {
    key: 'edgeGrain',
    title: 'Edge Grain',
    description: 'Photograph the side edge where growth rings show at an angle.',
    hint: 'edge',
    optional: false,
  },
  {
    key: 'endGrain',
    title: 'End Grain',
    description: 'Photograph the cut end where rings form concentric circles.',
    hint: 'end',
    optional: true,
  },
];

function ProgressIndicator({ stepIndex }: { stepIndex: number }) {
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressText}>
        Step {stepIndex + 1} of {CAPTURE_STEPS.length}
      </Text>
      <View style={styles.progressDots}>
        {CAPTURE_STEPS.map((step, index) => (
          <View
            key={step.key}
            style={[styles.progressDot, index <= stepIndex && styles.progressDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

export default function CameraScreen({ navigation }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [stage, setStage] = useState<Stage>('capture');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentStep = CAPTURE_STEPS[stepIndex];

  const runIdentify = useCallback(
    async (collectedPhotos: CapturedPhoto[]) => {
      setStage('identifying');
      try {
        const result = await identifySpecies(collectedPhotos.map((photo) => photo.base64));
        navigation.replace('Results', { result });
      } catch (error) {
        setErrorMessage(
          error instanceof IdentifyError
            ? error.message
            : 'Unexpected error identifying this photo.',
        );
        setStage('error');
      }
    },
    [navigation],
  );

  const handleCaptured = useCallback(
    (photo: CapturedPhoto) => {
      const updatedPhotos = [...photos, photo];
      setPhotos(updatedPhotos);

      if (stepIndex + 1 < CAPTURE_STEPS.length) {
        setStepIndex(stepIndex + 1);
      } else {
        runIdentify(updatedPhotos);
      }
    },
    [photos, stepIndex, runIdentify],
  );

  const handleSkip = useCallback(() => {
    runIdentify(photos);
  }, [photos, runIdentify]);

  if (stage === 'capture') {
    return (
      <SinglePhotoCapture
        key={currentStep.key}
        captureKey={currentStep.key}
        title={currentStep.title}
        description={currentStep.description}
        hintVariant={currentStep.hint}
        topRight={<ProgressIndicator stepIndex={stepIndex} />}
        skipLabel={currentStep.optional ? 'Skip end grain' : undefined}
        onSkip={currentStep.optional ? handleSkip : undefined}
        onCaptured={handleCaptured}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={styles.container}>
      {stage === 'identifying' && (
        <>
          {photos.length > 0 && (
            <Image
              source={{ uri: photos[photos.length - 1].uri }}
              style={StyleSheet.absoluteFill}
              blurRadius={4}
            />
          )}
          <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} />
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.identifyingText}>Reading the grain…</Text>
          </View>
        </>
      )}

      {stage === 'error' && (
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Identification failed</Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable style={styles.primaryButton} onPress={() => runIdentify(photos)}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.linkButtonText}>Back to home</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressWrap: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  progressText: {
    ...typography.label,
    color: colors.textPrimary,
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressDot: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.overlay,
  },
  progressDotActive: {
    backgroundColor: colors.accent,
  },
  dimOverlay: {
    backgroundColor: colors.overlay,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  identifyingText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  errorTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.backgroundElevated,
  },
  linkButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
  },
  linkButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
