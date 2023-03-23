# Migration Scripts

These scripts are executed against the current database on server start-up. Any scripts previously executed are skipped, however these scripts are designed to be idempotent for Postgres and MySQL. To correct common problems with schema and data migrations the `focalboard_schema_migrations` table can be cleared of all records and the server restarted.

The following built-in variables are available:

| Name  | Syntax | Description |
| ----- | -----  | -----       |
| schemaName | {{ .schemaName }}     | Returns the database/schema name (e.g. `mattermost_`, `mattermost_test`, `public`, ...) |
| prefix | {{ .prefix }}     | Returns the table name prefix (e.g. `focalbaord_`) |
| postgres | {{if .postgres }} ... {{end}} | Returns true if the current database is Postgres. |
| sqlite   | {{if .sqlite }} ... {{end}}   | Returns true if the current database is Sqlite3. |
| mysql    | {{if .mysql }} ... {{end}}   | Returns true if the current database is MySQL. |
| plugin   | {{if .plugin }} ... {{end}}   | Returns true if the server is currently running as a plugin (or product). In others words this is true if the server is not running as stand-alone or personal server. |
| singleUser   | {{if .singleUser }} ... {{end}}   | Returns true if the server is currently running in single user mode. |

To help with creating scripts that are idempotent some template functions have been added to the migration engine.

| Name  | Syntax | Description |
| ----- | -----  | -----       |
| addColumnIfNeeded   | {{ addColumnIfNeeded schemaName tableName columnName datatype constraint }} | Adds column to table only if column doesn't already exist. |
| dropColumnIfNeeded  | {{ dropColumnIfNeeded schemaName tableName columnName }} | Drops column from table if the column exists. |
| createIndexIfNeeded | {{ createIndexIfNeeded schemaName tableName columns }} | Creates an index if it does not already exist. The index name follows the existing convention of using `idx_` plus the table name and all columns separated by underscores. |
| renameTableIfNeeded | {{ renameTableIfNeeded schemaName oldTableName newTableName }} | Renames the table if the new table name does not exist. |
| renameColumnIfNeeded | {{ renameColumnIfNeeded schemaName tableName oldVolumnName newColumnName datatype }} | Renames a column if the new column name does not exist. |
| doesTableExist       | {{if doesTableExist schemaName tableName }} ... {{end}}  | Returns true if the table exists. Typically used in a `if` statement to conditionally include a section of script. Currently the existence of the table is determined before any scripts are executed (limitation of Morph). |
| doesColumnExist       | {{if doesTableExist schemaName tableName columnName }} ... {{end}}  | Returns true if the column exists. Typically used in a `if` statement to conditionally include a section of script. Currently the existence of the column is determined before any scripts are executed (limitation of Morph). |

**Note, table names should not include table prefix or schema name.**

## Examples

```bash
{{ addColumnIfNeeded .schemaName "categories" "type" "varchar(64)" ""}}
{{ addColumnIfNeeded .schemaName "boards_history" "minimum_role" "varchar(36)" "NOT NULL DEFAULT ''"}}
```

```bash
{{ dropColumnIfNeeded .schemaName "blocks_history" "workspace_id" }}
```

```bash
{{ createIndexIfNeeded .schemaName "boards" "team_id, is_template" }}
```

```bash
{{ renameTableIfNeeded .schemaName "blocks" "blocks_history" }}
```

```bash
{{ renameColumnIfNeeded .schemaName "blocks_history" "workspace_id" "channel_id" "varchar(36)" }}
```

```bash
{{if doesTableExist .schemaName "blocks_history" }}
    SELECT 'table exists';
{{end}}

{{if not (doesTableExist .schemaName "blocks_history") }}
    SELECT 1;
{{end}}
```

```bash
{{if doesColumnExist .schemaName "boards_history" "minimum_role"}}
    UPDATE ...
 {{end}}
```
