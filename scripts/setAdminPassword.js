require('dotenv').config();
const prisma = require('../src/prismaClient');
const bcrypt = require('bcrypt');

async function main() {
  const email = 'admin@example.com';
  const plain = 'Pass1234';
  const hashed = await bcrypt.hash(plain, 10);
  const user = await prisma.user.update({ where: { email }, data: { password: hashed } });
  console.log('Updated user password hash for', user.email);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
