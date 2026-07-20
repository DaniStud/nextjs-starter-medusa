-- Init script: create tenant databases
-- This runs automatically on first PostgreSQL container start.
-- Add new tenant databases here before provisioning them.

-- 10SHRTS main database (created by POSTGRES_DB env var, but ensure it exists)
SELECT 'db_10shrts already created by POSTGRES_DB' AS info;

-- Example tenant databases (uncomment when adding tenants):
-- CREATE DATABASE db_tenant_example;
