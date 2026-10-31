import { PrismaClient } from '@prisma/client';
import { backfillEnglishLearningOptions } from '../src/lib/backfill-learning-options';
const prisma = new PrismaClient();
backfillEnglishLearningOptions(prisma)
  .then(count => console.log(`English exercise labels added: ${count}`))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
