CREATE TABLE IF NOT EXISTS {{.prefix}}users (
	id VARCHAR(100),
	username VARCHAR(100),
	email VARCHAR(255),
	password VARCHAR(100),
	mfa_secret VARCHAR(100),
	auth_service VARCHAR(20),
	auth_data VARCHAR(255),
	props       {{if .postgres}}JSON{{else}}TEXT{{end}},
	create_at    BIGINT,
	update_at    BIGINT,
	delete_at    BIGINT,
	PRIMARY KEY (id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

CREATE TABLE IF NOT EXISTS {{.prefix}}sessions (
	id VARCHAR(100),
	token VARCHAR(100),
	user_id VARCHAR(100),
	props       {{if .postgres}}JSON{{else}}TEXT{{end}},
	create_at    BIGINT,
	update_at    BIGINT,
	PRIMARY KEY (id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};
