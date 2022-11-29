INSERT IGNORE INTO
    Roles (
        Id,
        Name,
        DisplayName,
        Description,
        CreateAt,
        UpdateAt,
        DeleteAt,
        Permissions,
        SchemeManaged,
        BuiltIn
    )
VALUES
    (
        LEFT(MD5(RAND()), 26),
        'channel_previewer',
        'authentication.roles.channel_previewer.name',
        'authentication.roles.channel_previewer.description',
        ROUND(UNIX_TIMESTAMP(CURTIME(4)) * 1000),
        ROUND(UNIX_TIMESTAMP(CURTIME(4)) * 1000),
        0,
        'read_channel',
        false,
        true
    );
