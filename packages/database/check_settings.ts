import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function main() {
  console.log('================ DATABASE VERIFICATION ================');
  
  // 1. Verificar Preferencias Globales (SystemSettings)
  const settings = await prisma.systemSettings.findFirst();
  console.log('System Settings:');
  console.log(JSON.stringify(settings, null, 2));
  
  console.log('\n------------------------------------------------------');
  
  // 2. Verificar Usuarios
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      signature: true,
      avatarUrl: true,
      notifyComplete: true,
      notifyPush: true,
      notifyWeekly: true,
    }
  });
  console.log('Users in Database:');
  users.forEach((u: any) => {
    console.log(`- [${u.role}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name}`);
    console.log(`  Signature: ${u.signature} | Has Avatar: ${u.avatarUrl ? 'Yes (base64/url length: ' + u.avatarUrl.length + ' chars)' : 'No'}`);
    console.log(`  Notifications: Complete=${u.notifyComplete}, Push=${u.notifyPush}, Weekly=${u.notifyWeekly}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
