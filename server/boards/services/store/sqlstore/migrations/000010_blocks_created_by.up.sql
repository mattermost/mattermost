{{- /* addColumnIfNeeded tableName columnName datatype constraint) */ -}}
{{ addColumnIfNeeded "blocks" "created_by" "varchar(36)" ""}}
{{ addColumnIfNeeded "blocks_history" "created_by" "varchar(36)" ""}}

UPDATE {{.prefix}}blocks SET created_by = 
    COALESCE(NULLIF((select modified_by from {{.prefix}}blocks_history where {{.prefix}}blocks_history.id = {{.prefix}}blocks.id ORDER BY {{.prefix}}blocks_history.insert_at ASC limit 1), ''), 'system') 
WHERE created_by IS NULL;
