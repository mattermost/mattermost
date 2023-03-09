CREATE TABLE IF NOT EXISTS {{.prefix}}preferences
(
    userid   VARCHAR(36) NOT NULL,
    category VARCHAR(32) NOT NULL,
    name     VARCHAR(32) NOT NULL,
    value    TEXT        NULL,
    PRIMARY KEY (userid, category, name)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{- /* createIndexIfNeeded tableName columns */ -}}
{{ createIndexIfNeeded "preferences" "category" }}
{{ createIndexIfNeeded "preferences" "name" }}
