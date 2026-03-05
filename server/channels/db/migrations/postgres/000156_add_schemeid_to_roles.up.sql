ALTER TABLE roles ADD COLUMN IF NOT EXISTS schemeid VARCHAR(26);

UPDATE roles
SET schemeid = schemes.id
FROM schemes
WHERE schemes.defaultteamadminrole    = roles.name
   OR schemes.defaultteamuserrole     = roles.name
   OR schemes.defaultteamguestrole    = roles.name
   OR schemes.defaultchanneladminrole = roles.name
   OR schemes.defaultchanneluserrole  = roles.name
   OR schemes.defaultchannelguestrole = roles.name
   OR schemes.defaultplaybookadminrole  = roles.name
   OR schemes.defaultplaybookmemberrole = roles.name
   OR schemes.defaultrunadminrole    = roles.name
   OR schemes.defaultrunmemberrole   = roles.name;
