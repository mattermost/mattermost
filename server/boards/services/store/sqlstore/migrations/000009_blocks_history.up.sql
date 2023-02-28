{{- /* Only perform this migration if the blocks_history table does not already exist */ -}}

{{- /* doesTableExist tableName */ -}}
{{if doesTableExist "blocks_history" }}

    SELECT 1;

{{else}}

{{- /* renameTableIfNeeded oldTableName newTableName */ -}}
{{ renameTableIfNeeded "blocks" "blocks_history" }}

CREATE TABLE IF NOT EXISTS {{.prefix}}blocks (
    id VARCHAR(36),
    {{if .postgres}}insert_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),{{end}}
    {{if .mysql}}insert_at DATETIME(6) NOT NULL DEFAULT NOW(6),{{end}}
    parent_id VARCHAR(36),
    {{if .mysql}}`schema`{{else}}schema{{end}} BIGINT,
    type TEXT,
    title TEXT,
    fields {{if .postgres}}JSON{{else}}TEXT{{end}},
    create_at BIGINT,
    update_at BIGINT,
    delete_at BIGINT,
    root_id VARCHAR(36),
    modified_by VARCHAR(36),
    workspace_id VARCHAR(36),
    PRIMARY KEY (workspace_id,id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{if .mysql}}
INSERT IGNORE INTO {{.prefix}}blocks (SELECT * FROM {{.prefix}}blocks_history ORDER BY insert_at DESC);
{{end}}
{{if .postgres}}
INSERT INTO {{.prefix}}blocks (SELECT * FROM {{.prefix}}blocks_history ORDER BY insert_at DESC) ON CONFLICT DO NOTHING;
{{end}}

{{end}}

DELETE FROM {{.prefix}}blocks where delete_at > 0;
