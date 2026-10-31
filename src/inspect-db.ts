import { prisma } from "./app/lib/prisma.js";

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, images: true },
    take: 10,
  });
  console.log("PRODUCTS IN DB:", JSON.stringify(products, null, 2));

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, image: true },
  });
  console.log("CATEGORIES IN DB:", JSON.stringify(categories, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
