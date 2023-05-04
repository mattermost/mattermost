CREATE PROCEDURE Remove_Tokens_If_Exist ()
BEGIN
    DECLARE C INT;

    SELECT COUNT(o.`Token`) INTO C from OAuthAccessData o 
    LEFT JOIN Preferences p ON o.clientid = p.name AND o.userid = p.userid AND p.category = 'oauth_app'
    INNER JOIN Sessions s ON o.token = s.token
    WHERE p.name IS NULL;

    IF(C > 0) THEN
        DELETE o, s from OAuthAccessData o 
        LEFT JOIN Preferences p ON o.clientid = p.name AND o.userid = p.userid AND p.category = 'oauth_app'
        INNER JOIN Sessions s ON o.token = s.token
        WHERE p.name IS NULL;
    END IF;
END;
    CALL Remove_Tokens_If_Exist ();
	DROP PROCEDURE IF EXISTS Remove_Tokens_If_Exist;
