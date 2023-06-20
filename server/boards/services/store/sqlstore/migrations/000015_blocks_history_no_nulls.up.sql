{{if .mysql}}

UPDATE {{.prefix}}blocks_history AS bh SET bh.parent_id='' WHERE bh.parent_id IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.schema=1 WHERE bh.schema IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.type='' WHERE bh.type IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.title='' WHERE bh.title IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.fields='' WHERE bh.fields IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.create_at=0 WHERE bh.create_at IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.root_id='' WHERE bh.root_id IS NULL;
UPDATE {{.prefix}}blocks_history AS bh SET bh.created_by='system' WHERE bh.created_by IS NULL;

{{else}}

/* parent_id */
UPDATE {{.prefix}}blocks_history AS bh1
	SET parent_id = COALESCE(
		(SELECT bh2.parent_id 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.parent_id IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, '')
WHERE parent_id IS NULL;

/* schema */
UPDATE {{.prefix}}blocks_history AS bh1
	SET schema = COALESCE(
		(SELECT bh2.schema 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.schema IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, 1)
WHERE schema IS NULL;

/* type */
UPDATE {{.prefix}}blocks_history AS bh1
	SET type = COALESCE(
		(SELECT bh2.type 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.type IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, '')
WHERE type IS NULL;

/* title */
UPDATE {{.prefix}}blocks_history AS bh1
	SET title = COALESCE(
		(SELECT bh2.title 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.title IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, '')
WHERE title IS NULL;

/* fields */
{{if .postgres}}
	UPDATE {{.prefix}}blocks_history AS bh1
		SET fields = COALESCE(
			(SELECT bh2.fields 
			FROM {{.prefix}}blocks_history AS bh2
			WHERE bh1.id = bh2.id AND bh2.fields IS NOT NULL 
			ORDER BY bh2.insert_at ASC limit 1) 
		, '{}'::json)
	WHERE fields IS NULL;
{{else}}
	UPDATE {{.prefix}}blocks_history AS bh1
		SET fields = COALESCE(
			(SELECT bh2.fields 
			FROM {{.prefix}}blocks_history AS bh2
			WHERE bh1.id = bh2.id AND bh2.fields IS NOT NULL 
			ORDER BY bh2.insert_at ASC limit 1) 
		, '')
	WHERE fields IS NULL;
{{end}}

/* create_at */
UPDATE {{.prefix}}blocks_history AS bh1
	SET create_at = COALESCE(
		(SELECT bh2.create_at 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.create_at IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, bh1.update_at)
WHERE create_at IS NULL;

/* root_id */
UPDATE {{.prefix}}blocks_history AS bh1
	SET root_id = COALESCE(
		(SELECT bh2.root_id 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.root_id IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, '')
WHERE root_id IS NULL;

/* created_by */
UPDATE {{.prefix}}blocks_history AS bh1
	SET created_by = COALESCE(
		(SELECT bh2.created_by 
		FROM {{.prefix}}blocks_history AS bh2
		WHERE bh1.id = bh2.id AND bh2.created_by IS NOT NULL 
		ORDER BY bh2.insert_at ASC limit 1) 
	, 'system')
WHERE created_by IS NULL;

{{end}}
