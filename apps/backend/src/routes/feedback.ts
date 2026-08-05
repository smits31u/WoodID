import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';

interface CreateFeedbackBody {
  deviceId?: string;
  rating?: number;
  actualSpecies?: string;
  speciesId?: number;
  commonName?: string;
  scientificName?: string;
}

const createFeedbackBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['deviceId', 'rating'],
  properties: {
    deviceId: { type: 'string', minLength: 1 },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    actualSpecies: { type: 'string' },
    speciesId: { type: 'integer' },
    commonName: { type: 'string' },
    scientificName: { type: 'string' },
  },
} as const;

const feedbackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateFeedbackBody }>(
    '/feedback',
    { schema: { body: createFeedbackBodySchema } },
    async (request) => {
      const { deviceId, rating, actualSpecies, speciesId, commonName, scientificName } =
        request.body;

      return prisma.feedback.create({
        data: {
          deviceId: deviceId!,
          rating: rating!,
          actualSpecies: actualSpecies?.trim() || null,
          speciesId: speciesId ?? null,
          commonName: commonName?.trim() || null,
          scientificName: scientificName?.trim() || null,
        },
      });
    },
  );
};

export default feedbackRoutes;
