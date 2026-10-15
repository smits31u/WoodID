import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

// HTTP Basic auth for the /admin pages. Browsers prompt once and resend the credentials on the
// approve/reject form posts. Fails closed: with ADMIN_PASSWORD unset, every admin request is refused.
const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function hasValidCredentials(header: string | undefined): boolean {
  const [scheme, encoded] = (header ?? '').split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return false;
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) {
    return false;
  }
  // Both comparisons always run, so a wrong username takes as long as a wrong password.
  const userOk = safeEqual(decoded.slice(0, separator), ADMIN_USER);
  const passwordOk = safeEqual(decoded.slice(separator + 1), ADMIN_PASSWORD);
  return userOk && passwordOk;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!ADMIN_PASSWORD) {
    return reply.code(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Admin access is not configured.',
    });
  }

  if (!hasValidCredentials(request.headers.authorization)) {
    return reply
      .code(401)
      .header('WWW-Authenticate', 'Basic realm="Grainscope admin", charset="UTF-8"')
      .send({ statusCode: 401, error: 'Unauthorized', message: 'Admin login required.' });
  }
}
