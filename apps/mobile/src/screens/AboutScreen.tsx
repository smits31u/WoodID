import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

interface DataSource {
  name: string;
  description: string;
}

const DATA_SOURCES: DataSource[] = [
  {
    name: 'SmartWoodID / Tervuren Wood Collection',
    description:
      'Species reference data licensed under CC BY 4.0. Royal Museum for Central Africa, Belgium.',
  },
  {
    name: 'CITES Species+',
    description: 'Conservation status data provided by CITES Species+.',
  },
  {
    name: 'USDA Forest Products Laboratory',
    description:
      'Wood properties data from the Wood Handbook (public domain), USDA Forest Products Laboratory.',
  },
];

export default function AboutScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>About</Text>
        <Text style={styles.intro}>
          Grainscope draws on a mix of AI-assisted analysis and reference data from the sources
          below.
        </Text>

        <Text style={styles.sectionLabel}>Data Sources</Text>
        {DATA_SOURCES.map((source) => (
          <View key={source.name} style={styles.card}>
            <Text style={styles.sourceName}>{source.name}</Text>
            <Text style={styles.sourceDescription}>{source.description}</Text>
          </View>
        ))}

        <Pressable
          style={styles.privacyLink}
          onPress={() => navigation.navigate('PrivacyPolicy')}
          hitSlop={8}
        >
          <Text style={styles.privacyLinkText}>Privacy Policy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
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
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sourceName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  privacyLink: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  privacyLinkText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.accent,
  },
  sourceDescription: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
