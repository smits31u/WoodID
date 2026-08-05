import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { compressPhoto, type CapturedPhoto } from '../lib/photo';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Stage = 'capturing' | 'preview' | 'error';
export type HintVariant = 'face' | 'edge' | 'end';

interface Props {
  captureKey: string;
  title: string;
  description: string;
  hintVariant?: HintVariant;
  topRight?: ReactNode;
  skipLabel?: string;
  onSkip?: () => void;
  onCaptured: (photo: CapturedPhoto) => void;
  onClose: () => void;
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

export default function SinglePhotoCapture({
  captureKey,
  title,
  description,
  hintVariant,
  topRight,
  skipLabel,
  onSkip,
  onCaptured,
  onClose,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [pendingPhoto, setPendingPhoto] = useState<CapturedPhoto | null>(null);
  const [stage, setStage] = useState<Stage>('capturing');
  const cameraRef = useRef<CameraView>(null);

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
      setPendingPhoto({ key: captureKey, base64: compressed.base64, uri: compressed.uri });
      setStage('preview');
    } catch {
      setStage('error');
    }
  }, [captureKey]);

  const handleConfirm = useCallback(() => {
    if (!pendingPhoto) {
      return;
    }
    onCaptured(pendingPhoto);
    setPendingPhoto(null);
  }, [pendingPhoto, onCaptured]);

  const handleRetake = useCallback(() => {
    setPendingPhoto(null);
    setStage('capturing');
  }, []);

  if (!permission) {
    return <SafeAreaView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Grainscope needs your camera to photograph wood grain.
          </Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Enable camera</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={onClose}>
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
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
              {topRight}
            </View>

            <View style={styles.stepGuide}>
              {hintVariant && <GrainHint variant={hintVariant} />}
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepDescription}>{description}</Text>
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
              {skipLabel && onSkip && (
                <Pressable style={styles.skipButton} onPress={onSkip} hitSlop={12}>
                  <Text style={styles.skipButtonText}>{skipLabel}</Text>
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
              <Text style={styles.previewHeaderText}>{title}</Text>
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

      {stage === 'error' && (
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>Capture failed</Text>
            <Text style={styles.errorBody}>Could not capture a photo. Try again.</Text>
            <Pressable style={styles.primaryButton} onPress={() => setStage('capturing')}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={onClose}>
              <Text style={styles.linkButtonText}>Back</Text>
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
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
