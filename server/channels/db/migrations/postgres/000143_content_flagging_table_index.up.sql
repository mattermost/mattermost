-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contentflaggingteamreviewers_userid ON ContentFlaggingTeamReviewers (userid);
