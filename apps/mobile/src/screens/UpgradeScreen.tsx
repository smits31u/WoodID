import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getCurrentOffering, purchasePackage, restorePurchases } from '../lib/purchases';
import { unlockProWithPromo } from '../lib/proStatus';
import { validatePromoCode, PromoValidationError } from '../api/promo';
import { getDeviceId } from '../lib/deviceId';
import { PRO_PLANS } from '../constants/billing';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'Upgrade'>;

export default function UpgradeScreen({ navigation }: Props) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  useEffect(() => {
    getCurrentOffering().then(setOffering);
  }, []);

  const packageFor = (identifier: string): PurchasesPackage | undefined =>
    offering?.availablePackages.find((pkg) => pkg.identifier === identifier) ??
    (identifier === '$rc_monthly' ? (offering?.monthly ?? undefined) : undefined) ??
    (identifier === '$rc_annual' ? (offering?.annual ?? undefined) : undefined);

  const handlePurchase = async (planId: string) => {
    const pkg = packageFor(planId);
    if (!pkg) {
      Alert.alert('Unavailable', 'In-app purchases are not available in this build yet.');
      return;
    }
    setPurchasingId(planId);
    const result = await purchasePackage(pkg);
    setPurchasingId(null);
    if (result.success) {
      Alert.alert('Welcome to Pro', 'Unlimited identifications are now unlocked.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else if (result.message) {
      Alert.alert('Purchase failed', result.message);
    }
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      Alert.alert('Restored', 'Your Pro subscription has been restored.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert(
        'Nothing to restore',
        "We couldn't find an active subscription for this account.",
      );
    }
  };

  const handleApplyPromoCode = async () => {
    const trimmed = promoCode.trim();
    if (!trimmed) {
      return;
    }
    setPromoStatus('checking');
    setPromoMessage(null);
    try {
      const deviceId = await getDeviceId();
      const response = await validatePromoCode(trimmed, deviceId);
      if (response.valid) {
        await unlockProWithPromo();
        setPromoStatus('success');
        setPromoMessage('Code applied — unlimited access unlocked.');
      } else {
        setPromoStatus('error');
        setPromoMessage(response.message ?? 'That code is not valid.');
      }
    } catch (error) {
      setPromoStatus('error');
      setPromoMessage(
        error instanceof PromoValidationError ? error.message : 'Something went wrong.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Grainscope Pro</Text>
        <Text style={styles.subtitle}>
          Unlock unlimited wood identifications and support ongoing development.
        </Text>

        <View style={styles.plans}>
          {PRO_PLANS.map((plan) => {
            const pkg = packageFor(plan.packageIdentifier);
            const priceLabel = pkg?.product.priceString
              ? `${pkg.product.priceString}/${plan.label === 'Yearly' ? 'year' : 'month'}`
              : plan.priceLabel;
            return (
              <Pressable
                key={plan.packageIdentifier}
                style={styles.planCard}
                onPress={() => handlePurchase(plan.packageIdentifier)}
                disabled={purchasingId !== null}
              >
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPrice}>{priceLabel}</Text>
                {purchasingId === plan.packageIdentifier && (
                  <ActivityIndicator
                    size="small"
                    color={colors.accent}
                    style={styles.planSpinner}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={handleRestore} hitSlop={8} style={styles.restoreLink}>
          <Text style={styles.restoreLinkText}>Restore purchases</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.promoLabel}>Have a promo code?</Text>
        <View style={styles.promoRow}>
          <TextInput
            style={styles.promoInput}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Enter code"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            style={styles.promoButton}
            onPress={handleApplyPromoCode}
            disabled={promoStatus === 'checking'}
          >
            {promoStatus === 'checking' ? (
              <ActivityIndicator size="small" color={colors.backgroundElevated} />
            ) : (
              <Text style={styles.promoButtonText}>Apply</Text>
            )}
          </Pressable>
        </View>
        {promoMessage && (
          <Text
            style={[
              styles.promoMessage,
              promoStatus === 'success' ? styles.promoMessageSuccess : styles.promoMessageError,
            ]}
          >
            {promoMessage}
          </Text>
        )}

        <Pressable style={styles.homeLink} onPress={() => navigation.goBack()}>
          <Text style={styles.homeLinkText}>Not now</Text>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  plans: {
    gap: spacing.md,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  planLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  planPrice: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  planSpinner: {
    marginTop: spacing.sm,
  },
  restoreLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  restoreLinkText: {
    ...typography.body,
    fontSize: 13,
    color: colors.accent,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  promoLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  promoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  promoInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  promoButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  promoButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.backgroundElevated,
  },
  promoMessage: {
    ...typography.body,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  promoMessageSuccess: {
    color: colors.success,
  },
  promoMessageError: {
    color: colors.danger,
  },
  homeLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  homeLinkText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
