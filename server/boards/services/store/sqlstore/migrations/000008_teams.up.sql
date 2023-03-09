{{- /* addColumnIfNeeded tableName columnName datatype constraint */ -}}
{{ addColumnIfNeeded "blocks" "workspace_id" "varchar(36)" ""}}

{{ addColumnIfNeeded "sharing" "workspace_id" "varchar(36)" ""}}

{{ addColumnIfNeeded "sessions" "auth_service" "varchar(20)" ""}}

UPDATE {{.prefix}}blocks SET workspace_id = '0' WHERE workspace_id = '' OR workspace_id IS NULL;
