ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultplaybookadminrole VARCHAR(64) DEFAULT ''::character varying;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultplaybookmemberrole VARCHAR(64) DEFAULT ''::character varying;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultrunadminrole VARCHAR(64) DEFAULT ''::character varying;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultrunmemberrole VARCHAR(64) DEFAULT ''::character varying;
