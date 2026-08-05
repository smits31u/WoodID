import { prisma } from '../src/db/client.js';

// Usage: npm run promo:create -- CODE123 [YYYY-MM-DD]
const [rawCode, expiresAtArg] = process.argv.slice(2);

async function main() {
  if (!rawCode) {
    throw new Error('Usage: npm run promo:create -- CODE123 [YYYY-MM-DD]');
  }
  const code = rawCode.trim().toUpperCase();
  const expiresAt = expiresAtArg ? new Date(expiresAtArg) : null;
  if (expiresAtArg && Number.isNaN(expiresAt?.getTime())) {
    throw new Error(`Invalid expiry date: ${expiresAtArg}`);
  }

  const promoCode = await prisma.promoCode.upsert({
    where: { code },
    update: { active: true, expiresAt },
    create: { code, expiresAt },
  });

  console.log(
    `Promo code "${promoCode.code}" is active${expiresAt ? ` until ${expiresAt.toISOString()}` : ' (no expiry)'}.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
