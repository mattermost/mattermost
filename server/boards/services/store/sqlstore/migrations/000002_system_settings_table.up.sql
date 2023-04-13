CREATE TABLE IF NOT EXISTS {{.prefix}}system_settings (
	id VARCHAR(100),
	value TEXT,
	PRIMARY KEY (id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};
