import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';

interface ValidateBody {
  code?: string;
  deviceId?: string;
}

const validateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'deviceId'],
  properties: {
    code: { type: 'string', minLength: 1 },
    deviceId: { type: 'string', minLength: 1 },
  },
} as const;

const promoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ValidateBody }>(
    '/promo/validate',
    { schema: { body: validateBodySchema } },
    async (request) => {
      const code = request.body.code!.trim().toUpperCase();

      const promoCode = await prisma.promoCode.findUnique({ where: { code } });
      if (!promoCode || !promoCode.active) {
        return { valid: false, message: 'That code is not valid.' };
      }
      if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
        return { valid: false, message: 'That code has expired.' };
      }

      // Recorded so the server exempts this device from the daily identification limit.
      const deviceId = request.body.deviceId!;
      await prisma.promoRedemption.upsert({
        where: { deviceId_promoCodeId: { deviceId, promoCodeId: promoCode.id } },
        create: { deviceId, promoCodeId: promoCode.id },
        update: {},
      });

      return { valid: true };
    },
  );
};

export default promoRoutes;
