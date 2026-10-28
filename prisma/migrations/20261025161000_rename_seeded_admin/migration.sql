UPDATE "admins"
SET "name" = 'Admin'
WHERE "name" = 'Super Admin';

UPDATE "user" AS u
SET "name" = 'Admin'
WHERE u."name" = 'Super Admin'
  AND EXISTS (
    SELECT 1
    FROM "admins" AS a
    WHERE a."userId" = u."id"
      AND a."name" = 'Admin'
  );
