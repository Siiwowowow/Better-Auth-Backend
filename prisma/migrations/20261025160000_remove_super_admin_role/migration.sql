UPDATE "user" SET "role" = 'ADMIN' WHERE "role" = 'SUPER_ADMIN';

ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "Role_old";
