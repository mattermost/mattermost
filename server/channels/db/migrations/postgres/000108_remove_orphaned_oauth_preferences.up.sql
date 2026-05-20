DO $$
DECLARE 
    preferences_exist boolean := false;
BEGIN
    SELECT count(p.*) != 0 INTO preferences_exist FROM preferences p
    WHERE (
        (NOT EXISTS (
            SELECT o.* FROM oauthaccessdata o
            WHERE o.clientid = p.name AND o.userid = p.userid AND p.category = 'oauth_app'
        ))
        AND 
        (NOT EXISTS (
            SELECT oa.* FROM oauthauthdata oa
            WHERE oa.clientid = p.name AND oa.userid = p.userid AND p.category = 'oauth_app'
        ))
    ) 
    AND p.category = 'oauth_app';
IF preferences_exist THEN
    DELETE FROM preferences p
    WHERE (
        (NOT EXISTS (
            SELECT o.* FROM oauthaccessdata o
            WHERE o.clientid = p.name AND o.userid = p.userid AND p.category = 'oauth_app'
        ))
        AND 
        (NOT EXISTS (
            SELECT oa.* FROM oauthauthdata oa
            WHERE oa.clientid = p.name AND oa.userid = p.userid AND p.category = 'oauth_app'
        ))
    ) 
    AND p.category = 'oauth_app';
END IF;
END $$;
