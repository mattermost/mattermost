{{- /* addColumnIfNeeded tableName columnName datatype constraint */ -}}
{{ addColumnIfNeeded "blocks" "modified_by" "varchar(36)" ""}}