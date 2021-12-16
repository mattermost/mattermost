ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultplaybookadminrole VARCHAR(64);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultplaybookmemberrole VARCHAR(64);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultrunadminrole VARCHAR(64);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS defaultrunmemberrole VARCHAR(64);
