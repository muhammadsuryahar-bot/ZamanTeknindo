const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const k = await prisma.kantor.findFirst();
  if (k) {
    const updated = await prisma.kantor.update({
      where: { id: k.id },
      data: {
        latitude: 0.4869445,
        longitude: 101.4067598
      }
    });
    console.log("Kantor updated:", updated);
  }
}

main().finally(() => prisma.$disconnect());
