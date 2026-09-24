const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.absensi.findMany({
  orderBy: { id: 'desc' },
  take: 5
}).then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error)
  .finally(() => p.$disconnect());
