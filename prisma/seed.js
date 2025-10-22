const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', password: '$2b$10$CpNqjzKZ8x3s6Z5gQ1N8eO1qzQm6u5/3X6rE1K1tqfQ6Ykz1aY9Zm', name: 'Admin' } // password: Pass1234
  });

  // create buses
  const bus1 = await prisma.bus.upsert({ where: { plate: 'BUS-100' }, update: {}, create: { plate: 'BUS-100', capacity: 40 } });
  const bus2 = await prisma.bus.upsert({ where: { plate: 'BUS-200' }, update: {}, create: { plate: 'BUS-200', capacity: 30 } });

  // create trips
  const trip1 = await prisma.trip.upsert({
    where: { id: 1 },
    update: {},
    create: { busId: bus1.id, origin: 'City A', destination: 'City B', departAt: new Date(Date.now() + 1000 * 60 * 60 * 24), price: 12.5 }
  });

  const trip2 = await prisma.trip.upsert({
    where: { id: 2 },
    update: {},
    create: { busId: bus2.id, origin: 'City B', destination: 'City C', departAt: new Date(Date.now() + 1000 * 60 * 60 * 48), price: 20.0 }
  });

  // create a reservation for admin on trip1
  const reservation = await prisma.reservation.upsert({
    where: { id: 1 },
    update: {},
    create: { userId: admin.id, tripId: trip1.id, seat: 1 }
  });

  console.log({ adminId: admin.id, bus1: bus1.id, bus2: bus2.id, trip1: trip1.id, trip2: trip2.id, reservationId: reservation.id });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
