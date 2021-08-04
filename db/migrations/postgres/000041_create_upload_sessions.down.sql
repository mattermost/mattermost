ALTER TABLE uploadsessions DROP COLUMN IF EXISTS reqfileid;
ALTER TABLE uploadsessions DROP COLUMN IF EXISTS remoteid;

DROP TABLE IF EXISTS uploadsessions;
