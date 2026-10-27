-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_botevents_createat ON BotEvents (CreateAt);
