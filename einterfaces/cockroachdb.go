package einterfaces

import "github.com/mattermost/mattermost-server/v5/model"

// CockroachQueryBuilder interfaces represents the data structed that build the needed queries for cockroachdb
type CockroachQueryBuilder interface {
	BuildAnalyticsUserCountsWithPostsByDayQuery(string) string
	BuildAnalyticsPostCountsByDayQuery(*model.AnalyticsPostCountsOptions) string
	BuildDetermineMaxPostSizeQuery() (string, []interface{})
	BuildDoesTableExistsQuery(string) (string, []interface{})
	BuildDoesColumnExistsQuery(string, string) (string, []interface{})
}
