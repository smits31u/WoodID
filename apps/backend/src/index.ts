import { mkdir } from 'node:fs/promises';
import Fastify, { type FastifyError } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyFormbody from '@fastify/formbody';
import speciesRoutes from './routes/species.js';
import contributionsRoutes from './routes/contributions.js';
import adminRoutes from './routes/admin.js';
import { UPLOADS_DIR } from './lib/imageStorage.js';

await mkdir(UPLOADS_DIR, { recursive: true });

const server = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024, // 10mb
});

server.register(fastifyMultipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});
server.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
});
server.register(fastifyFormbody);

server.setErrorHandler((error: FastifyError, request, reply) => {
  request.log.error(error);

  if (error.validation) {
    reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: error.message,
    });
    return;
  }

  const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
  reply.code(statusCode).send({
    statusCode,
    error: statusCode === 500 ? 'Internal Server Error' : error.name,
    message: statusCode === 500 ? 'An unexpected error occurred.' : error.message,
  });
});

server.get('/health', async () => {
  return { status: 'ok' };
});

server.register(speciesRoutes);
server.register(contributionsRoutes);
server.register(adminRoutes);

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3000);
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
