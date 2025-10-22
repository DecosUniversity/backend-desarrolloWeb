const prisma = require('../src/prismaClient');

async function main() {
  const tripId = parseInt(process.argv[2] || '2', 10);
  const seat = parseInt(process.argv[3] || '8', 10);
  const r = await prisma.reservation.findFirst({ where: { tripId, seat } });
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
