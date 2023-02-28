{{- /* addColumnIfNeeded tableName columnName datatype constraint */ -}}
{{ addColumnIfNeeded "boards" "minimum_role" "varchar(36)" "NOT NULL DEFAULT ''"}}
{{ addColumnIfNeeded "boards_history" "minimum_role" "varchar(36)" "NOT NULL DEFAULT ''"}}

UPDATE {{.prefix}}boards SET minimum_role = 'editor' WHERE minimum_role IS NULL OR minimum_role='';
UPDATE {{.prefix}}boards_history SET minimum_role = 'editor' WHERE minimum_role IS NULL OR minimum_role='';
