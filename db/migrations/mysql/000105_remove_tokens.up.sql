DELETE o, s from OAuthAccessData o 
LEFT JOIN Preferences p ON o.clientid = p.name AND o.userid = p.userid AND p.category = 'oauth_app'
INNER JOIN Sessions s ON o.token = s.token
WHERE p.name IS NULL;
