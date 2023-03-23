{{- /* addColumnIfNeeded tableName columnName datatype constraint */ -}}
{{ addColumnIfNeeded "categories" "type" "varchar(64)" ""}}

UPDATE {{.prefix}}categories SET type = 'custom' WHERE type IS NULL;
