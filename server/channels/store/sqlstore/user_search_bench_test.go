// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/testlib/usersearchbench"
)

// BenchmarkUserSearchStore measures SqlUserStore search and autocomplete
// against a dedicated database seeded by usersearchbench (100k users by
// default). Options mirror what the API passes for a regular user with the
// default privacy settings. Run with:
//
//	go test ./channels/store/sqlstore -run '^$' -bench BenchmarkUserSearchStore -timeout 60m
//
// or use scripts/bench-user-search.sh to compare a branch against master.
func BenchmarkUserSearchStore(b *testing.B) {
	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		b.Skip(err)
	}
	// Migrations log every step; the benchmark only needs errors, which are returned.
	logger, err := mlog.NewLogger()
	require.NoError(b, err)
	ss, err := New(*settings, logger, nil)
	require.NoError(b, err)
	b.Cleanup(func() {
		ss.Close()
		storetest.CleanupSqlSettings(settings)
		require.NoError(b, logger.Shutdown())
	})

	db := ss.GetMaster().DB().DB
	data := usersearchbench.Seed(b, db, usersearchbench.ConfigFromEnv(b))
	stats := usersearchbench.NewQueryStats(b, db)
	rctx := request.TestContext(b)
	us := ss.User()

	searchOpts := func() *model.UserSearchOptions {
		return &model.UserSearchOptions{AllowEmails: true, AllowFullNames: true, Limit: model.UserSearchDefaultLimit}
	}
	autocompleteOpts := func() *model.UserSearchOptions {
		return &model.UserSearchOptions{AllowFullNames: true, Limit: 25}
	}
	// What GetViewUsersRestrictions returns for a member of the large team and
	// every benchmarked channel who lacks the system-wide view_members permission.
	restrictedOpts := func() *model.UserSearchOptions {
		opts := searchOpts()
		opts.ViewRestrictions = &model.ViewUsersRestrictions{
			Teams:    []string{data.LargeTeamID()},
			Channels: []string{data.TownSquareID, data.LargeChannelID, data.MediumChannelID, data.SmallChannelID},
		}
		return opts
	}

	count := func(users []*model.User, err error) (int, error) { return len(users), err }
	autocomplete := func(channelID string) func(string) (int, error) {
		return func(term string) (int, error) {
			res, err := us.AutocompleteUsersInChannel(rctx, data.LargeTeamID(), channelID, term, autocompleteOpts())
			if err != nil {
				return 0, err
			}
			return len(res.InChannel) + len(res.OutOfChannel), nil
		}
	}

	all, core := data.AllTerms(), data.CoreTerms()
	cases := []struct {
		name  string
		terms []usersearchbench.Term
		run   func(term string) (int, error)
	}{
		{"op=Search/scope=system", all, func(term string) (int, error) {
			return count(us.Search(rctx, "", term, searchOpts()))
		}},
		{"op=Search/scope=team_large", all, func(term string) (int, error) {
			return count(us.Search(rctx, data.LargeTeamID(), term, searchOpts()))
		}},
		{"op=Search/scope=team_small", core, func(term string) (int, error) {
			return count(us.Search(rctx, data.SmallTeamID(), term, searchOpts()))
		}},
		{"op=Search/scope=team_large_restricted", core, func(term string) (int, error) {
			return count(us.Search(rctx, data.LargeTeamID(), term, restrictedOpts()))
		}},
		{"op=SearchInChannel/scope=town_square", core, func(term string) (int, error) {
			return count(us.SearchInChannel(data.TownSquareID, term, searchOpts()))
		}},
		{"op=SearchInChannel/scope=large", core, func(term string) (int, error) {
			return count(us.SearchInChannel(data.LargeChannelID, term, searchOpts()))
		}},
		{"op=SearchInChannel/scope=small", core, func(term string) (int, error) {
			return count(us.SearchInChannel(data.SmallChannelID, term, searchOpts()))
		}},
		{"op=SearchNotInChannel/scope=large", core, func(term string) (int, error) {
			return count(us.SearchNotInChannel(data.LargeTeamID(), data.LargeChannelID, term, searchOpts()))
		}},
		{"op=SearchNotInChannel/scope=small", core, func(term string) (int, error) {
			return count(us.SearchNotInChannel(data.LargeTeamID(), data.SmallChannelID, term, searchOpts()))
		}},
		{"op=AutocompleteUsersInChannel/scope=town_square", all, autocomplete(data.TownSquareID)},
		{"op=AutocompleteUsersInChannel/scope=medium", core, autocomplete(data.MediumChannelID)},
		{"op=AutocompleteUsersInChannel/scope=small", all, autocomplete(data.SmallChannelID)},
		{"op=SearchNotInTeam/scope=team_small", core, func(term string) (int, error) {
			return count(us.SearchNotInTeam(data.SmallTeamID(), term, searchOpts()))
		}},
		{"op=SearchWithoutTeam/scope=system", core, func(term string) (int, error) {
			return count(us.SearchWithoutTeam(term, searchOpts()))
		}},
	}

	for _, c := range cases {
		b.Run(c.name, func(b *testing.B) {
			for _, term := range c.terms {
				b.Run("term="+term.Name, func(b *testing.B) {
					stats.Measure(b, func() (int, error) { return c.run(term.Value) })
				})
			}
		})
	}
}
