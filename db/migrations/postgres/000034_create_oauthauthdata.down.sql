CREATE INDEX IF NOT EXISTS idx_oauthauthdata_client_id ON oauthauthdata (code);

DROP TABLE IF EXISTS oauthauthdata;
