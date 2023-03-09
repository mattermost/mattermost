CREATE TABLE IF NOT EXISTS {{.prefix}}workspaces (
	id VARCHAR(36),
	signup_token VARCHAR(100) NOT NULL,
	settings {{if .postgres}}JSON{{else}}TEXT{{end}},
	modified_by VARCHAR(36),
	update_at BIGINT,
	PRIMARY KEY (id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};
