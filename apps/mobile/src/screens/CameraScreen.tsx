import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { identifySpecies, IdentifyError, type IdentifyErrorCode } from '../api/species';
import { addHistoryEntry } from '../lib/history';
import { enqueue } from '../lib/offlineQueue';
import SinglePhotoCapture, { type HintVariant } from '../components/SinglePhotoCapture';
import type { CapturedPhoto } from '../lib/photo';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;
type Stage = 'capture' | 'review' | 'identifying' | 'error' | 'offline-saved';

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

// The extra angle captured from the Results screen's "low confidence" prompt. Not part of
// CAPTURE_STEPS since it isn't one of the fixed 3 angles — its key is generated fresh per mount
// so it can never collide with an existing photo's key (which would silently overwrite it).
const BOOST_STEP_META = {
  title: 'Additional Angle',
  description: 'Capture one more angle to help pin down the species.',
  hint: 'face' as HintVariant,
};

function stepFor(key: string): CaptureStep {
  return (
    CAPTURE_STEPS.find((step) => step.key === key) ?? { key, optional: false, ...BOOST_STEP_META }
  );
}

const ERROR_MESSAGES: Record<IdentifyErrorCode, { title: string; body: string }> = {
  NETWORK_ERROR: {
    title: 'No connection',
    body: "Couldn't reach the Grainscope server. Check your connection and try again.",
  },
  IMAGE_QUALITY_REJECTED: {
    title: "Couldn't read this photo",
    body: "This image couldn't be processed — try better lighting or a closer shot of the grain.",
  },
  AI_SERVICE_ERROR: {
    title: 'Identification failed',
    body: 'The identification service is having trouble right now. Please try again in a moment.',
  },
  SERVER_ERROR: {
    title: 'Something went wrong',
    body: 'Something went wrong on our end. Please try again.',
  },
};

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

function ReviewGrid({
  photos,
  onRetake,
  onAddEndGrain,
  onIdentify,
  onClose,
}: {
  photos: CapturedPhoto[];
  onRetake: (key: string) => void;
  onAddEndGrain: () => void;
  onIdentify: () => void;
  onClose: () => void;
}) {
  const endGrainStep = CAPTURE_STEPS.find((step) => step.key === 'endGrain')!;
  const hasEndGrain = photos.some((photo) => photo.key === endGrainStep.key);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.reviewTopBar}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.reviewContent}>
        <Text style={styles.stepTitle}>Review your photos</Text>
        <Text style={styles.stepDescription}>Tap any photo to retake it before identifying.</Text>

        <View style={styles.reviewGridWrap}>
          {photos.map((photo) => (
            <Pressable
              key={photo.key}
              style={styles.reviewTile}
              onPress={() => onRetake(photo.key)}
            >
              <Image source={{ uri: photo.uri }} style={styles.reviewThumbnail} />
              <Text style={styles.reviewTileLabel}>{stepFor(photo.key).title}</Text>
            </Pressable>
          ))}

          {!hasEndGrain && (
            <Pressable style={styles.reviewAddTile} onPress={onAddEndGrain}>
              <Text style={styles.reviewAddPlus}>+</Text>
              <Text style={styles.reviewTileLabel}>{endGrainStep.title}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={styles.reviewBottomBar}>
        <Pressable style={styles.primaryButton} onPress={onIdentify}>
          <Text style={styles.primaryButtonText}>Identify</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function CameraScreen({ navigation, route }: Props) {
  const existingPhotos = route.params?.existingPhotos;
  const isBoost = existingPhotos != null;

  const [boostKey] = useState(() => `boost-${Crypto.randomUUID()}`);
  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>(existingPhotos ?? []);
  const [stage, setStage] = useState<Stage>('capture');
  const [errorCode, setErrorCode] = useState<IdentifyErrorCode>('SERVER_ERROR');
  const [retakeKey, setRetakeKey] = useState<string | null>(null);

  const currentStep = CAPTURE_STEPS[stepIndex];
  const activeStep: CaptureStep =
    retakeKey != null ? stepFor(retakeKey) : isBoost ? { key: boostKey, optional: false, ...BOOST_STEP_META } : currentStep;
  const showProgress = retakeKey == null && !isBoost;

  const runIdentify = useCallback(
    async (collectedPhotos: CapturedPhoto[]) => {
      setStage('identifying');
      try {
        const result = await identifySpecies(collectedPhotos.map((photo) => photo.base64));
        await addHistoryEntry(result, collectedPhotos);
        navigation.replace('Results', { result, photos: collectedPhotos });
      } catch (error) {
        if (error instanceof IdentifyError && error.code === 'NETWORK_ERROR') {
          await enqueue(collectedPhotos);
          setStage('offline-saved');
          return;
        }
        setErrorCode(error instanceof IdentifyError ? error.code : 'SERVER_ERROR');
        setStage('error');
      }
    },
    [navigation],
  );

  const handleCaptured = useCallback(
    (photo: CapturedPhoto) => {
      if (retakeKey != null) {
        const alreadyHasPhoto = photos.some((p) => p.key === retakeKey);
        const updated = alreadyHasPhoto
          ? photos.map((p) => (p.key === retakeKey ? photo : p))
          : [...photos, photo];
        setPhotos(updated);
        setRetakeKey(null);
        setStage('review');
        return;
      }

      if (isBoost) {
        const merged = [...photos, photo];
        setPhotos(merged);
        runIdentify(merged);
        return;
      }

      const updatedPhotos = [...photos, photo];
      setPhotos(updatedPhotos);

      if (stepIndex + 1 < CAPTURE_STEPS.length) {
        setStepIndex(stepIndex + 1);
      } else {
        setStage('review');
      }
    },
    [photos, stepIndex, retakeKey, isBoost, runIdentify],
  );

  const handleSkip = useCallback(() => {
    setStage('review');
  }, []);

  const handleRetake = useCallback((key: string) => {
    const index = CAPTURE_STEPS.findIndex((step) => step.key === key);
    if (index >= 0) {
      setStepIndex(index);
    }
    setRetakeKey(key);
    setStage('capture');
  }, []);

  const handleAddEndGrain = useCallback(() => {
    const index = CAPTURE_STEPS.findIndex((step) => step.key === 'endGrain');
    setStepIndex(index);
    setRetakeKey('endGrain');
    setStage('capture');
  }, []);

  const handleClose = useCallback(() => {
    if (retakeKey != null) {
      setRetakeKey(null);
      setStage('review');
      return;
    }
    navigation.goBack();
  }, [retakeKey, navigation]);

  if (stage === 'capture') {
    return (
      <SinglePhotoCapture
        key={activeStep.key}
        captureKey={activeStep.key}
        title={activeStep.title}
        description={activeStep.description}
        hintVariant={activeStep.hint}
        topRight={showProgress ? <ProgressIndicator stepIndex={stepIndex} /> : undefined}
        skipLabel={showProgress && activeStep.optional ? 'Skip end grain' : undefined}
        onSkip={showProgress && activeStep.optional ? handleSkip : undefined}
        onCaptured={handleCaptured}
        onClose={handleClose}
      />
    );
  }

  if (stage === 'review') {
    return (
      <ReviewGrid
        photos={photos}
        onRetake={handleRetake}
        onAddEndGrain={handleAddEndGrain}
        onIdentify={() => runIdentify(photos)}
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
          <Text style={styles.errorTitle}>{ERROR_MESSAGES[errorCode].title}</Text>
          <Text style={styles.errorBody}>{ERROR_MESSAGES[errorCode].body}</Text>
          <Pressable style={styles.primaryButton} onPress={() => setStage('review')}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.linkButtonText}>Back to home</Text>
          </Pressable>
        </View>
      )}

      {stage === 'offline-saved' && (
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Saved</Text>
          <Text style={styles.errorBody}>
            You're offline right now — we'll submit this automatically once you're back online.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.primaryButtonText}>Back to home</Text>
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
  reviewTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  reviewContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  stepTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  stepDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  reviewGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  reviewTile: {
    width: 132,
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewThumbnail: {
    width: 132,
    height: 132,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  reviewAddTile: {
    width: 132,
    height: 132,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.accentMuted,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  reviewAddPlus: {
    fontSize: 28,
    color: colors.accent,
    fontWeight: '700',
  },
  reviewTileLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reviewBottomBar: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
