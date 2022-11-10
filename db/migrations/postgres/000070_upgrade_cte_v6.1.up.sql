DO $$
	<< migrate_cte >>
DECLARE
	column_exist boolean := FALSE;
BEGIN
	SELECT
		count(*) != 0 INTO column_exist
	FROM
		information_schema.columns
	WHERE
		table_name = 'channels'
		AND table_schema = '{{.SchemaName}}'
		AND column_name = 'lastrootpostat';
	IF NOT column_exist THEN
		ALTER TABLE channels ADD COLUMN lastrootpostat bigint DEFAULT '0'::bigint;
		WITH q AS (
			SELECT
				Channels.Id channelid,
				COALESCE(MAX(Posts.CreateAt),
					0) AS lastrootpost
			FROM
				Channels
			LEFT JOIN Posts ON Channels.Id = Posts.ChannelId
		WHERE
			Posts.RootId = ''
		GROUP BY
			Channels.Id
)
UPDATE
	Channels
SET
	LastRootPostAt = q.lastrootpost
FROM
	q
WHERE
	q.channelid = Channels.Id;
END IF;
END migrate_cte
$$;
