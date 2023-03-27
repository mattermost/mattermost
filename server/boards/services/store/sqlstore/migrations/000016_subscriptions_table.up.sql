CREATE TABLE IF NOT EXISTS {{.prefix}}subscriptions (
	block_type VARCHAR(10),
	block_id VARCHAR(36),
	workspace_id VARCHAR(36),
	subscriber_type VARCHAR(10),
	subscriber_id VARCHAR(36),
	notified_at BIGINT,
	create_at BIGINT,
	delete_at BIGINT,
	PRIMARY KEY (block_id, subscriber_id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

CREATE TABLE IF NOT EXISTS {{.prefix}}notification_hints (
	block_type VARCHAR(10),
	block_id VARCHAR(36),
	workspace_id VARCHAR(36),
	modified_by_id VARCHAR(36),
	create_at BIGINT,
	notify_at BIGINT,
	PRIMARY KEY (block_id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

