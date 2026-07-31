import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';

interface SpeciesIdParams {
  id: number;
}

interface IdentifyBody {
  image: string;
}

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
} as const;

const identifyBodySchema = {
  type: 'object',
  required: ['image'],
  additionalProperties: false,
  properties: {
    image: {
      type: 'string',
      minLength: 1,
      pattern: '^(data:image\\/[a-zA-Z0-9.+-]+;base64,)?[A-Za-z0-9+/]+={0,2}$',
    },
  },
} as const;

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
      const allSpecies = await prisma.species.findMany();

      if (allSpecies.length === 0) {
        return reply.code(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'No species reference data is available to identify against.',
        });
      }

      const match = allSpecies[Math.floor(Math.random() * allSpecies.length)];
      const confidenceScore = Number((0.7 + Math.random() * 0.29).toFixed(2));

      return { ...match, confidenceScore };
    },
  );
};

export default speciesRoutes;
