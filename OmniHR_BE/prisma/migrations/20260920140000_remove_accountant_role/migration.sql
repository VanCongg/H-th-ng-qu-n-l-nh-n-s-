-- The accountant role only existed to run payroll, which is out of scope, so
-- it is removed together with its grants and assignments. Everyone who held it
-- keeps their EMPLOYEE (and, where applicable, MANAGER) role.
DELETE FROM "user_roles" WHERE "role_id" IN (
  SELECT "id" FROM "roles" WHERE "name" = 'ACCOUNTANT'
);
DELETE FROM "role_permissions" WHERE "role_id" IN (
  SELECT "id" FROM "roles" WHERE "name" = 'ACCOUNTANT'
);
DELETE FROM "roles" WHERE "name" = 'ACCOUNTANT';
