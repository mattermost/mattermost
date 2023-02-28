
UPDATE {{.prefix}}users SET create_at = create_at*1000, update_at = update_at*1000, delete_at = delete_at*1000
	WHERE create_at < 1000000000000;

UPDATE {{.prefix}}blocks SET create_at = create_at*1000, update_at = update_at*1000, delete_at = delete_at*1000
	WHERE create_at < 1000000000000;

UPDATE {{.prefix}}blocks_history SET create_at = create_at*1000, update_at = update_at*1000, delete_at = delete_at*1000
	WHERE create_at < 1000000000000;

UPDATE {{.prefix}}workspaces SET update_at = update_at*1000
	WHERE update_at < 1000000000000;

UPDATE {{.prefix}}sharing SET update_at = update_at*1000
	WHERE update_at < 1000000000000;

UPDATE {{.prefix}}sessions SET create_at = create_at*1000, update_at = update_at*1000
	WHERE create_at < 1000000000000;
