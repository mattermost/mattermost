DROP TABLE IF EXISTS ContentFlaggingCommonReviewers;
DROP TABLE IF EXISTS ContentFlaggingTeamSettings;
DROP TABLE IF EXISTS ContentFlaggingTeamReviewers;
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_contentflaggingteamreviewers_userid;
