DO $$
BEGIN
WITH oauthDelete AS (
	DELETE FROM oauthaccessdata o
	WHERE NOT EXISTS (
		SELECT p.* FROM preferences p
		WHERE o.clientid = p.name AND o.userid = p.userid AND p.category = 'oauth_app' 
		and p.name IS NULL
	)
	RETURNING o.token
)
DELETE FROM sessions s WHERE s.token in (select oauthDelete.token from oauthDelete);
END $$;
