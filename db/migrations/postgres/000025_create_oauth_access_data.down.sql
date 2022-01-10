CREATE INDEX IF NOT EXISTS idx_oauthaccessdata_client_id ON oauthaccessdata (clientid);

DROP TABLE IF EXISTS oauthaccessdata;
