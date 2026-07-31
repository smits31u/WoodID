import Fastify, { type FastifyError } from 'fastify';
import speciesRoutes from './routes/species.js';

const server = Fastify({
  logger: true,
});

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
