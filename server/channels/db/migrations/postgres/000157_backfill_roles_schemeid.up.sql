UPDATE roles
SET schemeid = match.scheme_id
FROM (
    SELECT DISTINCT ON (role_name) id AS scheme_id, role_name
    FROM (
        SELECT id, unnest(ARRAY[
            defaultteamadminrole,
            defaultteamuserrole,
            defaultteamguestrole,
            defaultchanneladminrole,
            defaultchanneluserrole,
            defaultchannelguestrole,
            defaultplaybookadminrole,
            defaultplaybookmemberrole,
            defaultrunadminrole,
            defaultrunmemberrole
        ]) AS role_name
        FROM schemes
    ) expanded
    WHERE role_name IS NOT NULL AND role_name <> ''
    ORDER BY role_name, scheme_id
) match
WHERE roles.name = match.role_name;
