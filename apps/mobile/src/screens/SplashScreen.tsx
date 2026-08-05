import { useCallback, useEffect, useRef } from 'react';
import { Animated, ImageBackground, Platform, StyleSheet, Text, View } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { colors } from '../theme/colors';
import { spacing, typography } from '../theme/spacing';

// Native splash (app.json's expo-splash-screen plugin) is just a solid #18110D background —
// it hands off to this screen almost instantly, since a native splash can't render live text,
// custom fonts, or animation. This is where the actual designed splash (ring, name, tagline,
// scan animation) lives.
//
// Background photo: American walnut basecolor texture, CC0 (public domain, no attribution
// required) via cc0-textures.com, resized from the original 4096x4096 PNG (~67MB) down to
// 1200x1200 JPEG (~170KB) — full res is far more than a phone screen needs and would bloat the
// app bundle. A dark scrim (colors.overlay, the same token used elsewhere for dim overlays) sits
// between the photo and the text/ring so they stay legible over the photo's natural mid-brown
// tone rather than baking a permanent darken/tint into the image file itself.

const RING_SIZE = 96;
const RING_MIDDLE_SIZE = 64;
const RING_INNER_SIZE = 28;
const SCAN_DURATION_MS = 1400;
const DISPLAY_DURATION_MS = 1800;

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const hasHiddenNativeSplash = useRef(false);

  const handleLayout = useCallback(() => {
    if (hasHiddenNativeSplash.current) {
      return;
    }
    hasHiddenNativeSplash.current = true;
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: SCAN_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    sweep.start();

    const timer = setTimeout(onFinish, DISPLAY_DURATION_MS);
    return () => {
      sweep.stop();
      clearTimeout(timer);
    };
  }, [onFinish, scanAnim]);

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-RING_SIZE / 2, RING_SIZE / 2],
  });

  return (
    <ImageBackground
      source={require('../../assets/splash-background.jpg')}
      style={styles.container}
      onLayout={handleLayout}
    >
      <View style={styles.scrim} />
      <View style={styles.ringOuter}>
        <View style={styles.ringMiddle}>
          <View style={styles.ringInner} />
        </View>
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]}
          pointerEvents="none"
        />
      </View>
      <Text style={styles.appName}>Grainscope</Text>
      <Text style={styles.tagline}>Identify any wood</Text>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  ringOuter: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringMiddle: {
    width: RING_MIDDLE_SIZE,
    height: RING_MIDDLE_SIZE,
    borderRadius: RING_MIDDLE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: RING_INNER_SIZE,
    height: RING_INNER_SIZE,
    borderRadius: RING_INNER_SIZE / 2,
    backgroundColor: colors.accent,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
  appName: {
    ...typography.display,
    fontFamily: SERIF_FONT,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  tagline: {
    ...typography.label,
    textTransform: 'none',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
});
