import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { prisma } from '../db/client.js';
import { ContentStatus, PhotoAngle } from '../generated/prisma/client.js';
import { isWoodPhoto, type ImageMediaType } from '../ai/identifySpecies.js';
import { isSupportedImageType, saveUploadedImage } from '../lib/imageStorage.js';

const MAX_SUGGESTION_PHOTOS = 3;

interface SpeciesIdParams {
  id: number;
}

interface ReferencePhotosQuery {
  status?: string;
}

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
} as const;

function badRequest(reply: FastifyReply, message: string) {
  return reply.code(400).send({
    statusCode: 400,
    error: 'Bad Request',
    message,
  });
}

interface RawUpload {
  buffer: Buffer;
  mimetype: string;
}

interface UploadedImage {
  buffer: Buffer;
  mediaType: ImageMediaType;
}

function toUploadedImage(raw: RawUpload): UploadedImage | null {
  if (!isSupportedImageType(raw.mimetype)) {
    return null;
  }
  return { buffer: raw.buffer, mediaType: raw.mimetype };
}

const contributionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/reference-photos', async (request, reply) => {
    const fields: Record<string, string> = {};
    let rawPhoto: RawUpload | undefined;

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname === 'photo') {
          rawPhoto = { buffer: await part.toBuffer(), mimetype: part.mimetype };
        }
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    const { speciesId: speciesIdRaw, angle, deviceId } = fields;

    if (!rawPhoto) {
      return badRequest(reply, 'A "photo" file is required.');
    }
    const photo = toUploadedImage(rawPhoto);
    if (!photo) {
      return badRequest(reply, `Unsupported image type: ${rawPhoto.mimetype}`);
    }
    if (!deviceId) {
      return badRequest(reply, 'deviceId is required.');
    }
    if (!angle || !Object.values(PhotoAngle).includes(angle as PhotoAngle)) {
      return badRequest(reply, `angle must be one of: ${Object.values(PhotoAngle).join(', ')}.`);
    }
    const speciesId = Number(speciesIdRaw);
    if (!speciesIdRaw || !Number.isInteger(speciesId) || speciesId < 1) {
      return badRequest(reply, 'speciesId must be a positive integer.');
    }

    const species = await prisma.species.findUnique({ where: { id: speciesId } });
    if (!species) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Species with id ${speciesId} was not found.`,
      });
    }

    const imageUrl = await saveUploadedImage(photo.buffer, photo.mediaType);
    const woodCheck = await isWoodPhoto({
      base64Data: photo.buffer.toString('base64'),
      mediaType: photo.mediaType,
    });

    return prisma.referencePhoto.create({
      data: {
        speciesId,
        imageUrl,
        angle: angle as PhotoAngle,
        deviceId,
        status: woodCheck === 'no' ? ContentStatus.REJECTED : ContentStatus.PENDING,
      },
    });
  });

  fastify.post('/species-suggestions', async (request, reply) => {
    const fields: Record<string, string> = {};
    const rawPhotos: RawUpload[] = [];

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname === 'photos') {
          rawPhotos.push({ buffer: await part.toBuffer(), mimetype: part.mimetype });
        }
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    const { proposedCommonName, proposedScientificName, submitterNotes, deviceId } = fields;

    if (!proposedCommonName?.trim()) {
      return badRequest(reply, 'proposedCommonName is required.');
    }
    if (!deviceId) {
      return badRequest(reply, 'deviceId is required.');
    }
    if (rawPhotos.length === 0) {
      return badRequest(reply, 'At least one photo is required.');
    }
    if (rawPhotos.length > MAX_SUGGESTION_PHOTOS) {
      return badRequest(reply, `At most ${MAX_SUGGESTION_PHOTOS} photos are allowed.`);
    }

    const photos: UploadedImage[] = [];
    for (const raw of rawPhotos) {
      const photo = toUploadedImage(raw);
      if (!photo) {
        return badRequest(reply, `Unsupported image type: ${raw.mimetype}`);
      }
      photos.push(photo);
    }

    const imageUrls = await Promise.all(
      photos.map((photo) => saveUploadedImage(photo.buffer, photo.mediaType)),
    );

    const woodCheck = await isWoodPhoto({
      base64Data: photos[0].buffer.toString('base64'),
      mediaType: photos[0].mediaType,
    });

    return prisma.speciesSuggestion.create({
      data: {
        proposedCommonName: proposedCommonName.trim(),
        proposedScientificName: proposedScientificName?.trim() || null,
        submitterNotes: submitterNotes?.trim() || null,
        deviceId,
        status: woodCheck === 'no' ? ContentStatus.REJECTED : ContentStatus.PENDING,
        photos: {
          create: imageUrls.map((imageUrl) => ({ imageUrl })),
        },
      },
      include: { photos: true },
    });
  });

  fastify.get<{ Params: SpeciesIdParams; Querystring: ReferencePhotosQuery }>(
    '/species/:id/reference-photos',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const statusParam = request.query.status ?? ContentStatus.APPROVED;

      if (!Object.values(ContentStatus).includes(statusParam as ContentStatus)) {
        return badRequest(
          reply,
          `status must be one of: ${Object.values(ContentStatus).join(', ')}.`,
        );
      }

      return prisma.referencePhoto.findMany({
        where: { speciesId: id, status: statusParam as ContentStatus },
        orderBy: { createdAt: 'desc' },
      });
    },
  );
};

export default contributionsRoutes;
