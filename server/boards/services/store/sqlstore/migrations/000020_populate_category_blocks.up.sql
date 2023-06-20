CREATE TABLE IF NOT EXISTS {{.prefix}}category_boards (
    id varchar(36) NOT NULL,
    user_id varchar(36) NOT NULL,
    category_id varchar(36) NOT NULL,
    board_id VARCHAR(36) NOT NULL,
    create_at BIGINT,
    update_at BIGINT,
    delete_at BIGINT,
    PRIMARY KEY (id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{- /* createIndexIfNeeded tableName columns */ -}}
{{ createIndexIfNeeded "category_boards" "category_id" }}
