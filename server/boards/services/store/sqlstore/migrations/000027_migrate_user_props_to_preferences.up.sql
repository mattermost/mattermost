{{if .plugin}}
    {{- /* For plugin mode, we need to write into Mattermost's `Preferences` table, hence, no use of `prefix`. */ -}}

    {{if .postgres}}
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'welcomePageViewed', replace((Props->'focalboard_welcomePageViewed')::varchar, '"', '') FROM Users WHERE Props->'focalboard_welcomePageViewed' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'hiddenBoardIDs', replace(replace(replace((Props->'hiddenBoardIDs')::varchar, '"[', '['), ']"', ']'), '\"', '"') FROM Users WHERE Props->'hiddenBoardIDs' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'tourCategory', replace((Props->'focalboard_tourCategory')::varchar, '"', '') FROM Users WHERE Props->'focalboard_tourCategory' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStep', replace((Props->'focalboard_onboardingTourStep')::varchar, '"', '') FROM Users WHERE Props->'focalboard_onboardingTourStep' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStarted', replace((Props->'focalboard_onboardingTourStarted')::varchar, '"', '') FROM Users WHERE Props->'focalboard_onboardingTourStarted' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'version72MessageCanceled', replace((Props->'focalboard_version72MessageCanceled')::varchar, '"', '') FROM Users WHERE Props->'focalboard_version72MessageCanceled' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'lastWelcomeVersion', replace((Props->'focalboard_lastWelcomeVersion')::varchar, '"', '') FROM Users WHERE Props->'focalboard_lastWelcomeVersion' IS NOT NULL ON CONFLICT DO NOTHING;

        UPDATE Users SET props = (props - 'focalboard_welcomePageViewed' - 'hiddenBoardIDs' - 'focalboard_tourCategory' - 'focalboard_onboardingTourStep' - 'focalboard_onboardingTourStarted' - 'focalboard_version72MessageCanceled' - 'focalboard_lastWelcomeVersion') WHERE jsonb_typeof(props) = 'object';
    {{end}}

    {{if .mysql}}
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'welcomePageViewed', replace(JSON_EXTRACT(Props, '$."focalboard_welcomePageViewed"'), '"', '') FROM Users WHERE JSON_EXTRACT(Props, '$.focalboard_welcomePageViewed') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'hiddenBoardIDs', replace(replace(replace(JSON_EXTRACT(Props, '$."hiddenBoardIDs"'), '"[', '['), ']"', ']'), '\\"', '"') FROM Users WHERE JSON_EXTRACT(Props, '$.hiddenBoardIDs') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'tourCategory', replace(JSON_EXTRACT(Props, '$."focalboard_tourCategory"'), '"', '') FROM Users WHERE JSON_EXTRACT(Props, '$.focalboard_tourCategory') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStep', replace(JSON_EXTRACT(Props, '$."focalboard_onboardingTourStep"'), '"', '') FROM Users WHERE JSON_EXTRACT(Props, '$.focalboard_onboardingTourStep') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStarted', replace(JSON_EXTRACT(Props, '$."focalboard_onboardingTourStarted"'), '"', '') FROM Users WHERE JSON_EXTRACT(Props, '$.focalboard_onboardingTourStarted') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'version72MessageCanceled', replace(JSON_EXTRACT(Props, '$."focalboard_version72MessageCanceled"'), '"', '') FROM Users WHERE JSON_EXTRACT(Props, '$.focalboard_version72MessageCanceled') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'lastWelcomeVersion', replace(JSON_EXTRACT(Props, '$."focalboard_lastWelcomeVersion"'), '"', '') FROM Users WHERE JSON_EXTRACT(Props, '$.focalboard_lastWelcomeVersion') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;

        UPDATE Users SET Props =  JSON_REMOVE(Props, '$."focalboard_welcomePageViewed"', '$."hiddenBoardIDs"', '$."focalboard_tourCategory"', '$."focalboard_onboardingTourStep"', '$."focalboard_onboardingTourStarted"', '$."focalboard_version72MessageCanceled"', '$."focalboard_lastWelcomeVersion"');
    {{end}}
{{else}}
    {{- /* For personal server, we need to write to Focalboard's preferences table, hence the use of `prefix`. */ -}}

    {{if .postgres}}
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'welcomePageViewed', replace((Props->'focalboard_welcomePageViewed')::varchar, '"', '') from {{.prefix}}users WHERE Props->'focalboard_welcomePageViewed' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'hiddenBoardIDs', replace(replace(replace((Props->'hiddenBoardIDs')::varchar, '"[', '['), ']"', ']'), '\"', '"') from {{.prefix}}users WHERE Props->'hiddenBoardIDs' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'tourCategory', replace((Props->'focalboard_tourCategory')::varchar, '"', '') from {{.prefix}}users WHERE Props->'focalboard_tourCategory' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStep', replace((Props->'focalboard_onboardingTourStep')::varchar, '"', '') from {{.prefix}}users WHERE Props->'focalboard_onboardingTourStep' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStarted', replace((Props->'focalboard_onboardingTourStarted')::varchar, '"', '') from {{.prefix}}users WHERE Props->'focalboard_onboardingTourStarted' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'version72MessageCanceled', replace((Props->'focalboard_version72MessageCanceled')::varchar, '"', '') from {{.prefix}}users WHERE Props->'focalboard_version72MessageCanceled' IS NOT NULL ON CONFLICT DO NOTHING;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'lastWelcomeVersion', replace((Props->'focalboard_lastWelcomeVersion')::varchar, '"', '') from {{.prefix}}users WHERE Props->'focalboard_lastWelcomeVersion' IS NOT NULL ON CONFLICT DO NOTHING;

        UPDATE {{.prefix}}users SET props = (props::jsonb - 'focalboard_welcomePageViewed' - 'hiddenBoardIDs' - 'focalboard_tourCategory' - 'focalboard_onboardingTourStep' - 'focalboard_onboardingTourStarted' - 'focalboard_version72MessageCanceled' - 'focalboard_lastWelcomeVersion')::json WHERE jsonb_typeof(props::jsonb) = 'object';
    {{end}}

    {{if .mysql}}
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'welcomePageViewed', replace(JSON_EXTRACT(Props, '$."focalboard_welcomePageViewed"'), '"', '') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.focalboard_welcomePageViewed') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'hiddenBoardIDs', replace(replace(replace(JSON_EXTRACT(Props, '$."hiddenBoardIDs"'), '"[', '['), ']"', ']'), '\\"', '"') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.hiddenBoardIDs') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'tourCategory', replace(JSON_EXTRACT(Props, '$."focalboard_tourCategory"'), '"', '') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.focalboard_tourCategory') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStep', replace(JSON_EXTRACT(Props, '$."focalboard_onboardingTourStep"'), '"', '') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.focalboard_onboardingTourStep') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'onboardingTourStarted', replace(JSON_EXTRACT(Props, '$."focalboard_onboardingTourStarted"'), '"', '') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.focalboard_onboardingTourStarted') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'version72MessageCanceled', replace(JSON_EXTRACT(Props, '$."focalboard_version72MessageCanceled"'), '"', '') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.focalboard_version72MessageCanceled') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;
        INSERT INTO {{.prefix}}preferences (UserId, Category, Name, Value) SELECT Id, 'focalboard', 'lastWelcomeVersion', replace(JSON_EXTRACT(Props, '$."focalboard_lastWelcomeVersion"'), '"', '') from {{.prefix}}users WHERE JSON_EXTRACT(Props, '$.focalboard_lastWelcomeVersion') IS NOT NULL ON DUPLICATE KEY UPDATE value = value;

        UPDATE {{.prefix}}users SET Props =  JSON_REMOVE(Props, '$."focalboard_welcomePageViewed"', '$."hiddenBoardIDs"', '$."focalboard_tourCategory"', '$."focalboard_onboardingTourStep"', '$."focalboard_onboardingTourStarted"', '$."focalboard_version72MessageCanceled"', '$."focalboard_lastWelcomeVersion"');
    {{end}}

{{end}}
