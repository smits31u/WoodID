import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { identifySpecies, IdentifyError } from '../api/species';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;
type Stage = 'capturing' | 'preview' | 'identifying' | 'error';
type ErrorSource = 'capture' | 'identify';
type HintVariant = 'face' | 'edge' | 'end';

interface CaptureStep {
  key: string;
  title: string;
  description: string;
  hint: HintVariant;
  optional: boolean;
}

interface CapturedPhoto {
  key: string;
  base64: string;
  uri: string;
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

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

async function compressPhoto(uri: string, width: number, height: number) {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_DIMENSION) {
    context.resize(width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
}

function GrainHint({ variant }: { variant: HintVariant }) {
  if (variant === 'end') {
    return (
      <View style={styles.hintBox}>
        <View style={styles.hintRingOuter}>
          <View style={styles.hintRingMiddle}>
            <View style={styles.hintRingInner} />
          </View>
        </View>
      </View>
    );
  }

  const lineStyle = variant === 'edge' ? styles.hintLineDiagonal : styles.hintLineFlat;
  return (
    <View style={styles.hintBox}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={lineStyle} />
      ))}
    </View>
  );
}

export default function CameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<CapturedPhoto | null>(null);
  const [stage, setStage] = useState<Stage>('capturing');
  const [errorSource, setErrorSource] = useState<ErrorSource>('capture');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const currentStep = CAPTURE_STEPS[stepIndex];

  const runIdentify = useCallback(
    async (collectedPhotos: CapturedPhoto[]) => {
      setStage('identifying');
      try {
        const result = await identifySpecies(collectedPhotos.map((photo) => photo.base64));
        navigation.replace('Results', { result });
      } catch (error) {
        setErrorSource('identify');
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

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo?.uri) {
        throw new Error('No image data captured.');
      }
      const compressed = await compressPhoto(photo.uri, photo.width, photo.height);
      if (!compressed.base64) {
        throw new Error('No image data captured.');
      }
      setPendingPhoto({ key: currentStep.key, base64: compressed.base64, uri: compressed.uri });
      setStage('preview');
    } catch {
      setErrorSource('capture');
      setErrorMessage('Could not capture a photo. Try again.');
      setStage('error');
    }
  }, [currentStep.key]);

  const handleConfirm = useCallback(() => {
    if (!pendingPhoto) {
      return;
    }
    const updatedPhotos = [...photos, pendingPhoto];
    setPhotos(updatedPhotos);
    setPendingPhoto(null);

    if (stepIndex + 1 < CAPTURE_STEPS.length) {
      setStepIndex(stepIndex + 1);
      setStage('capturing');
    } else {
      runIdentify(updatedPhotos);
    }
  }, [pendingPhoto, photos, stepIndex, runIdentify]);

  const handleRetake = useCallback(() => {
    setPendingPhoto(null);
    setStage('capturing');
  }, []);

  const handleSkip = useCallback(() => {
    runIdentify(photos);
  }, [photos, runIdentify]);

  const handleTryAgain = useCallback(() => {
    if (errorSource === 'identify') {
      runIdentify(photos);
    } else {
      setPendingPhoto(null);
      setStage('capturing');
    }
  }, [errorSource, photos, runIdentify]);

  if (!permission) {
    return <SafeAreaView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            WoodID needs your camera to photograph wood grain and identify the species.
          </Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Enable camera</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkButtonText}>Not now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {stage === 'capturing' && (
        <>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          <SafeAreaView style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topBar}>
              <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
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
            </View>

            <View style={styles.stepGuide}>
              <GrainHint variant={currentStep.hint} />
              <Text style={styles.stepTitle}>{currentStep.title}</Text>
              <Text style={styles.stepDescription}>{currentStep.description}</Text>
            </View>

            <View style={styles.frameHint}>
              <View style={styles.frameBox} />
            </View>

            <View style={styles.bottomBar}>
              <Pressable
                onPress={handleCapture}
                hitSlop={16}
                style={({ pressed }) => [styles.shutterRing, pressed && styles.shutterRingPressed]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
              {currentStep.optional && (
                <Pressable style={styles.skipButton} onPress={handleSkip} hitSlop={12}>
                  <Text style={styles.skipButtonText}>Skip end grain</Text>
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </>
      )}

      {stage === 'preview' && pendingPhoto && (
        <>
          <Image source={{ uri: pendingPhoto.uri }} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.overlay} pointerEvents="box-none">
            <View style={styles.previewHeader}>
              <Text style={styles.previewHeaderText}>{currentStep.title}</Text>
            </View>
            <View style={styles.bottomBar}>
              <View style={styles.previewActions}>
                <Pressable style={styles.secondaryButton} onPress={handleRetake}>
                  <Text style={styles.secondaryButtonText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={handleConfirm}>
                  <Text style={styles.primaryButtonText}>Use photo</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </>
      )}

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
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>
              {errorSource === 'identify' ? 'Identification failed' : 'Capture failed'}
            </Text>
            <Text style={styles.errorBody}>{errorMessage}</Text>
            <Pressable style={styles.primaryButton} onPress={handleTryAgain}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
              <Text style={styles.linkButtonText}>Back to home</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const RING_SIZE = 88;
const INNER_SIZE = 70;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
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
  stepGuide: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stepTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  stepDescription: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hintBox: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    backgroundColor: colors.overlay,
  },
  hintLineFlat: {
    width: '70%',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  hintLineDiagonal: {
    width: '90%',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    transform: [{ rotate: '30deg' }],
  },
  hintRingOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRingMiddle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRingInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  frameHint: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBox: {
    width: 220,
    height: 220,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.textPrimary + '55',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  shutterRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingPressed: {
    borderColor: colors.accent,
  },
  shutterInner: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    backgroundColor: colors.textPrimary,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewHeader: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  previewHeaderText: {
    ...typography.title,
    color: colors.textPrimary,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
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
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  permissionBody: {
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
  secondaryButton: {
    backgroundColor: colors.overlay,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.textPrimary + '33',
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
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
