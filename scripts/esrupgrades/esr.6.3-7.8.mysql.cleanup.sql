/* Remove migration-related tables that are only updated through the server to track which
   migrations have been applied */
DROP TABLE IF EXISTS db_lock;
DROP TABLE IF EXISTS db_migrations;

