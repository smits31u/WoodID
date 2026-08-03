import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.brand}>WoodID</Text>
        <Text style={styles.tagline}>Point. Snap. Identify.</Text>
      </View>

      <View style={styles.center}>
        <Pressable
          onPress={() => navigation.navigate('Camera')}
          hitSlop={16}
          style={({ pressed }) => [styles.shutterRing, pressed && styles.shutterRingPressed]}
        >
          <View style={styles.shutterInner}>
            <View style={styles.lens} />
          </View>
        </Pressable>
        <Text style={styles.hint}>Tap to identify a wood species</Text>
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
        </View>
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
});
