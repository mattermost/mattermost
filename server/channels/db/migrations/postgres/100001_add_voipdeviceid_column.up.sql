ALTER TABLE sessions ADD COLUMN IF NOT EXISTS voipdeviceid character varying(512) NOT NULL DEFAULT '';
