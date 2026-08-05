import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

const CONTACT_EMAIL = 'smits31u@gmail.com';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Information we collect',
    body:
      'Photos you take to identify a wood species. Photos you choose to submit as a ' +
      'reference photo or species suggestion. A device ID: a random identifier generated on ' +
      'your device the first time you contribute, used only to attribute that contribution — ' +
      "it isn't derived from any hardware identifier or tied to your name, email, or location. " +
      'We do not collect your name, email address, location, or any other personal ' +
      'information, and WoodID has no user accounts.',
  },
  {
    title: 'How we use it',
    body:
      "Photos you take to identify a species are sent to Anthropic's Claude API for analysis " +
      "and are not stored on our server afterward — we only keep the identification result. " +
      'Photos you submit as a reference photo or species suggestion are reviewed and, if ' +
      'approved, added to the public species database shown to all users, credited only by ' +
      'your anonymous device ID. We may use aggregated, non-identifying data to improve ' +
      'identification accuracy and expand the species catalog.',
  },
  {
    title: 'Third-party services',
    body:
      "Anthropic (Claude API) — analyzes submitted photos to identify wood species. See " +
      "Anthropic's privacy policy for how they handle that data. CITES Species+ — species " +
      "names (not photos or personal data) are checked against this database for " +
      "conservation status. USDA Forest Products Laboratory — a static reference dataset for " +
      "wood properties; no data is sent to USDA.",
  },
  {
    title: 'Data retention',
    body:
      'Your identification history is stored only on your device (never uploaded to our ' +
      'servers) and can be cleared at any time from the History screen. Photos submitted only ' +
      'for identification are not retained after the request completes. Reference photos and ' +
      'species suggestions you contribute are retained on our server as part of the species ' +
      'database until you request their removal.',
  },
  {
    title: 'No account required',
    body:
      "WoodID doesn't require you to create an account, sign in, or provide any personal " +
      'information to identify wood species.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.intro}>
          WoodID is built to work without collecting personal information. This page explains
          what we do collect and how it's used.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact us</Text>
          <Text style={styles.sectionBody}>
            Questions about this policy, or requests to remove content you've contributed:
          </Text>
          <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} hitSlop={8}>
            <Text style={styles.emailLink}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emailLink: {
    ...typography.body,
    fontWeight: '600',
    color: colors.accent,
    marginTop: spacing.sm,
  },
});
