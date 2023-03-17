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
	PRIMARY KEY (id, insert_at)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};
