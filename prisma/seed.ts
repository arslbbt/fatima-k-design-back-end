import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email =  'admin@example.com';
  const password =  'admin@example.com';
  const name =  'Fatima K Admin';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Seed admin created:`);
  console.log(`   Name:  ${admin.name}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role:  ${admin.role}`);
  console.log(`\n⚠️  Change the default password after first login.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
