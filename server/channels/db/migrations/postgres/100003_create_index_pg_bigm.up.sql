CREATE INDEX IF NOT EXISTS idx_posts_lower_message_bigm ON posts USING gin (LOWER(message) gin_bigm_ops);
--CONCURRENTLY はmorphがマイグレーションをトランザクション内で行うため実行できず失敗する。
-- -- rambler: no-transaction
