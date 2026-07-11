INSERT INTO "role_permissions"("role_id", "permission_id")
SELECT "roles"."id", "permissions"."id"
FROM "roles"
CROSS JOIN "permissions"
WHERE "roles"."name" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
