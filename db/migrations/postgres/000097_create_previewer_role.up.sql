INSERT INTO
    roles (
        id,
        name,
        displayname,
        description,
        createat,
        updateat,
        deleteat,
        permissions,
        schememanaged,
        builtin
    )
VALUES
    (
        substr(concat(md5(random()::text), md5(random()::text)), 0, 27),
        'channel_previewer',
        'authentication.roles.channel_previewer.name',
        'authentication.roles.channel_previewer.description',
        FLOOR(EXTRACT(epoch FROM NOW())*1000),
        FLOOR(EXTRACT(epoch FROM NOW())*1000),
        0,
        'read_channel',
        false,
        true
    ) ON CONFLICT (name) DO NOTHING;
