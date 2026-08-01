import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';
import {
  IdentificationError,
  identifySpeciesFromImages,
  parseImageInput,
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
      const match =
        identifiedName.length > 0
          ? allSpecies.find((species) => {
              const dbName = species.commonName.trim().toLowerCase();
              return (
                dbName.length > 0 &&
                (dbName.includes(identifiedName) || identifiedName.includes(dbName))
              );
            })
          : undefined;

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
