DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_bigm'
  ) THEN
    CREATE EXTENSION pg_bigm;
  END IF;
END;
$$
LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_posts_message_bigm ON posts USING gin (message gin_bigm_ops);