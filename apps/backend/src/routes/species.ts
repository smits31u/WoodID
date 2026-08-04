import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';
import type { Species } from '../generated/prisma/client.js';
import {
  IdentificationError,
  identifySpeciesFromImages,
  parseImageInput,
  type ClaudeIdentification,
  type DensityCategory,
} from '../ai/identifySpecies.js';

interface SpeciesIdParams {
  id: number;
}

interface IdentifyBody {
  image?: string;
  images?: string[];
}

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
} as const;

const BASE64_IMAGE_PATTERN = '^(data:image\\/[a-zA-Z0-9.+-]+;base64,)?[A-Za-z0-9+/]+={0,2}$';

const identifyBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    image: {
      type: 'string',
      minLength: 1,
      pattern: BASE64_IMAGE_PATTERN,
    },
    images: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 1,
        pattern: BASE64_IMAGE_PATTERN,
      },
    },
  },
  anyOf: [{ required: ['image'] }, { required: ['images'] }],
} as const;

const LIGHT_DENSITY_MAX = 0.45;
const MEDIUM_DENSITY_MAX = 0.7;

function densityCategoryOf(density: number): DensityCategory {
  if (density < LIGHT_DENSITY_MAX) return 'light';
  if (density <= MEDIUM_DENSITY_MAX) return 'medium';
  return 'heavy';
}

function mentionsKeywordsOf(dbValue: string | null, observed: string | undefined): boolean {
  if (!dbValue || !observed) return false;
  const dbWords = dbValue.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const observedLower = observed.toLowerCase();
  return dbWords.some((word) => observedLower.includes(word));
}

/**
 * When Claude's identified common name matches more than one DB species (common names collide
 * across genera/regions, and the catalog now has 3000+ entries), rank candidates by how well
 * Claude's IAWA-style observations and estimated density line up with each candidate's stored
 * data, rather than just taking the first match. vesselPattern/growthRingVisibility/rayVisibility
 * are populated on zero species today (no reference-collection import has supplied them yet), so
 * that part of the score is currently a no-op for every candidate — it activates automatically
 * once that data exists, without needing this scoring logic to change.
 */
function scoreCandidate(species: Species, identification: ClaudeIdentification): number {
  let score = 0;
  if (mentionsKeywordsOf(species.vesselPattern, identification.vesselPattern)) score += 1;
  if (mentionsKeywordsOf(species.rayVisibility, identification.rayVisibility)) score += 1;
  if (mentionsKeywordsOf(species.growthRingVisibility, identification.growthRingVisibility)) {
    score += 1;
  }
  if (identification.estimatedDensityCategory && species.density > 0) {
    score += densityCategoryOf(species.density) === identification.estimatedDensityCategory ? 0.5 : -0.5;
  }
  return score;
}

const speciesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/species', async () => {
    return prisma.species.findMany({
      select: {
        id: true,
        commonName: true,
        scientificName: true,
        jankaHardness: true,
        grainType: true,
        sustainabilityStatus: true,
      },
      orderBy: { id: 'asc' },
    });
  });

  fastify.get<{ Params: SpeciesIdParams }>(
    '/species/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const species = await prisma.species.findUnique({ where: { id } });

      if (!species) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Species with id ${id} was not found.`,
        });
      }

      return species;
    },
  );

  fastify.post<{ Body: IdentifyBody }>(
    '/species/identify',
    { schema: { body: identifyBodySchema } },
    async (request, reply) => {
      const rawImages = request.body.images ?? (request.body.image ? [request.body.image] : []);
      const parsedImages = rawImages.map(parseImageInput);

      let identification;
      try {
        identification = await identifySpeciesFromImages(parsedImages);
      } catch (error) {
        if (error instanceof IdentificationError) {
          request.log.error(error);
          return reply.code(502).send({
            statusCode: 502,
            error: 'Bad Gateway',
            message: error.message,
          });
        }
        throw error;
      }

      const identifiedName = identification.commonName.trim().toLowerCase();
      const allSpecies = await prisma.species.findMany();
      const candidates =
        identifiedName.length > 0
          ? allSpecies.filter((species) => {
              const dbName = species.commonName.trim().toLowerCase();
              return (
                dbName.length > 0 &&
                (dbName.includes(identifiedName) || identifiedName.includes(dbName))
              );
            })
          : [];

      // A single candidate is used as-is. With more than one (common names collide across the
      // 3000+-species catalog), rank by how well Claude's anatomical/density observations line
      // up with each candidate's stored data — see scoreCandidate.
      const match =
        candidates.length <= 1
          ? candidates[0]
          : candidates.reduce((best, candidate) =>
              scoreCandidate(candidate, identification) > scoreCandidate(best, identification)
                ? candidate
                : best,
            );

      if (match) {
        return {
          ...match,
          confidence: identification.confidence,
          reasoning: identification.reasoning,
        };
      }

      return {
        commonName: identification.commonName,
        scientificName: identification.scientificName,
        confidence: identification.confidence,
        reasoning: identification.reasoning,
        noDbMatch: true,
      };
    },
  );
};

export default speciesRoutes;
