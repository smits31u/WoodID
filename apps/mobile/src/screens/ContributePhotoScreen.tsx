import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  listSpecies,
  SpeciesFetchError,
  type PhotoAngle,
  type SpeciesSummary,
} from '../api/species';
import { submitReferencePhoto, ContributionError } from '../api/contributions';
import { getDeviceId } from '../lib/deviceId';
import type { CapturedPhoto } from '../lib/photo';
import SinglePhotoCapture from '../components/SinglePhotoCapture';
import { colors } from '../theme/colors';
import { radii, spacing, typography } from '../theme/spacing';

type Props = NativeStackScreenProps<RootStackParamList, 'ContributePhoto'>;
type Stage = 'species' | 'angle' | 'capture' | 'submitting' | 'success' | 'error';

const ANGLE_OPTIONS: { value: PhotoAngle; label: string; description: string }[] = [
  {
    value: 'FACE_GRAIN',
    label: 'Face Grain',
    description: 'The flat surface showing the growth ring pattern.',
  },
  {
    value: 'EDGE_GRAIN',
    label: 'Edge Grain',
    description: 'The side edge where growth rings show at an angle.',
  },
  {
    value: 'END_GRAIN',
    label: 'End Grain',
    description: 'The cut end where rings form concentric circles.',
  },
];

export default function ContributePhotoScreen({ navigation }: Props) {
  const [stage, setStage] = useState<Stage>('species');
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<SpeciesSummary[]>([]);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesSummary | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<(typeof ANGLE_OPTIONS)[number] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastPhoto, setLastPhoto] = useState<CapturedPhoto | null>(null);

  useEffect(() => {
    listSpecies()
      .then(setSpecies)
      .catch((error) => {
        setSpeciesError(
          error instanceof SpeciesFetchError ? error.message : 'Could not load species.',
        );
      });
  }, []);

  const filteredSpecies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return species;
    }
    return species.filter(
      (item) =>
        item.commonName.toLowerCase().includes(normalized) ||
        item.scientificName.toLowerCase().includes(normalized),
    );
  }, [species, query]);

  const submit = useCallback(
    async (photo: CapturedPhoto) => {
      if (!selectedSpecies || !selectedAngle) {
        return;
      }
      setLastPhoto(photo);
      setStage('submitting');
      try {
        const deviceId = await getDeviceId();
        await submitReferencePhoto({
          speciesId: selectedSpecies.id,
          angle: selectedAngle.value,
          deviceId,
          photo,
        });
        setStage('success');
      } catch (error) {
        setErrorMessage(
          error instanceof ContributionError
            ? error.message
            : 'Something went wrong submitting this photo.',
        );
        setStage('error');
      }
    },
    [selectedSpecies, selectedAngle],
  );

  if (stage === 'capture' && selectedAngle) {
    return (
      <SinglePhotoCapture
        captureKey={selectedAngle.value}
        title={selectedAngle.label}
        description={selectedAngle.description}
        onCaptured={submit}
        onClose={() => setStage('angle')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {stage === 'species' && (
        <View style={styles.content}>
          <Text style={styles.title}>Contribute a photo</Text>
          <Text style={styles.subtitle}>Which species is this?</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search species…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {speciesError && <Text style={styles.errorText}>{speciesError}</Text>}
          <FlatList
            data={filteredSpecies}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                style={styles.speciesRow}
                onPress={() => {
                  setSelectedSpecies(item);
                  setStage('angle');
                }}
              >
                <Text style={styles.speciesName}>{item.commonName}</Text>
                <Text style={styles.speciesScientific}>{item.scientificName}</Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkButtonText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {stage === 'angle' && selectedSpecies && (
        <View style={styles.content}>
          <Text style={styles.title}>{selectedSpecies.commonName}</Text>
          <Text style={styles.subtitle}>Which angle are you photographing?</Text>
          {ANGLE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={styles.angleOption}
              onPress={() => {
                setSelectedAngle(option);
                setStage('capture');
              }}
            >
              <Text style={styles.angleLabel}>{option.label}</Text>
              <Text style={styles.angleDescription}>{option.description}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.linkButton} onPress={() => setStage('species')}>
            <Text style={styles.linkButtonText}>Back</Text>
          </Pressable>
        </View>
      )}

      {stage === 'submitting' && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.body}>Uploading…</Text>
        </View>
      )}

      {stage === 'success' && (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Thanks for contributing!</Text>
          <Text style={styles.body}>Your photo will appear once it's reviewed.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      )}

      {stage === 'error' && (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Upload failed</Text>
          <Text style={styles.body}>{errorMessage}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => (lastPhoto ? submit(lastPhoto) : setStage('angle'))}
          >
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
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  listContent: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  speciesRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  speciesName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  speciesScientific: {
    ...typography.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  angleOption: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  angleLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  angleDescription: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
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
    alignItems: 'center',
  },
  linkButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
