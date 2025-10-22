require('dotenv').config();
const prisma = require('../src/prismaClient');
const bcrypt = require('bcrypt');

async function main() {
  const email = 'admin@example.com';
  const plain = 'Pass1234';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found:', email);
    process.exit(1);
  }
  console.log('Found user:', { id: user.id, email: user.email, passwordHash: user.password });
  const ok = await bcrypt.compare(plain, user.password);
  console.log('bcrypt.compare result for Pass1234:', ok);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
