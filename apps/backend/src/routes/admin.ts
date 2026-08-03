import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';
import { ContentStatus } from '../generated/prisma/client.js';
import { fetchWoodProperties, DENSITY_KG_M3_TO_G_CM3 } from '../ai/woodProperties.js';
import { renderReferencePhotosPage, renderSpeciesSuggestionsPage } from '../admin/render.js';

interface StatusQuery {
  status?: string;
}

interface IdParams {
  id: number;
}

interface ApproveSuggestionBody {
  commonName?: string;
  scientificName?: string;
}

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
} as const;

function resolveStatus(raw: string | undefined): ContentStatus {
  if (raw && Object.values(ContentStatus).includes(raw as ContentStatus)) {
    return raw as ContentStatus;
  }
  return ContentStatus.PENDING;
}

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: StatusQuery }>('/admin/reference-photos', async (request, reply) => {
    const status = resolveStatus(request.query.status);
    const photos = await prisma.referencePhoto.findMany({
      where: { status },
      include: { species: true },
      orderBy: { createdAt: 'desc' },
    });
    reply.type('text/html').send(renderReferencePhotosPage(photos, status));
  });

  fastify.get<{ Querystring: StatusQuery }>(
    '/admin/species-suggestions',
    async (request, reply) => {
      const status = resolveStatus(request.query.status);
      const suggestions = await prisma.speciesSuggestion.findMany({
        where: { status },
        include: { photos: true },
        orderBy: { createdAt: 'desc' },
      });
      reply.type('text/html').send(renderSpeciesSuggestionsPage(suggestions, status));
    },
  );

  fastify.post<{ Params: IdParams }>(
    '/admin/reference-photos/:id/approve',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      await prisma.referencePhoto.update({
        where: { id: request.params.id },
        data: { status: ContentStatus.APPROVED },
      });
      reply.redirect('/admin/reference-photos?status=PENDING', 303);
    },
  );

  fastify.post<{ Params: IdParams }>(
    '/admin/reference-photos/:id/reject',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      await prisma.referencePhoto.update({
        where: { id: request.params.id },
        data: { status: ContentStatus.REJECTED },
      });
      reply.redirect('/admin/reference-photos?status=PENDING', 303);
    },
  );

  fastify.post<{ Params: IdParams; Body: ApproveSuggestionBody }>(
    '/admin/species-suggestions/:id/approve',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const suggestion = await prisma.speciesSuggestion.findUnique({
        where: { id: request.params.id },
      });
      if (!suggestion) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Species suggestion with id ${request.params.id} was not found.`,
        });
      }

      const commonName = request.body.commonName?.trim() || suggestion.proposedCommonName;
      const scientificName =
        request.body.scientificName?.trim() || suggestion.proposedScientificName;
      if (!scientificName) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'A scientific name is required to create the species.',
        });
      }

      const woodProperties = await fetchWoodProperties(commonName, scientificName);

      await prisma.species.create({
        data: {
          commonName,
          scientificName,
          family: 'Unknown',
          originRegions: 'Unknown',
          jankaHardness: woodProperties ? Math.round(woodProperties.jankaHardness) : 0,
          density: woodProperties ? woodProperties.density / DENSITY_KG_M3_TO_G_CM3 : 0,
          grainType: woodProperties?.grainType ?? 'Unknown',
          texture: woodProperties?.texture ?? 'Unknown',
          poreStructure: 'Unknown',
          heartwoodColor: woodProperties?.heartwood ?? 'Unknown',
          sapwoodColor: woodProperties?.sapwood ?? 'Unknown',
          workabilityRating: woodProperties ? Math.round(woodProperties.workabilityRating) : 0,
          workabilityNotes: woodProperties?.workabilityNotes ?? '',
          commonUses: woodProperties?.commonUses ?? '',
          sustainabilityStatus: 'Unknown',
          citesListed: false,
        },
      });

      await prisma.speciesSuggestion.update({
        where: { id: suggestion.id },
        data: { status: ContentStatus.APPROVED },
      });

      reply.redirect('/admin/species-suggestions?status=PENDING', 303);
    },
  );

  fastify.post<{ Params: IdParams }>(
    '/admin/species-suggestions/:id/reject',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      await prisma.speciesSuggestion.update({
        where: { id: request.params.id },
        data: { status: ContentStatus.REJECTED },
      });
      reply.redirect('/admin/species-suggestions?status=PENDING', 303);
    },
  );
};

export default adminRoutes;
