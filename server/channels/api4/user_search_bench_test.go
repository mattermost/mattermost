// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib/usersearchbench"
)

// BenchmarkUserSearchAppAPI measures user search and autocomplete through the
// App layer and over HTTP against the directory seeded by usersearchbench
// (100k users by default). Calls are made as a regular member of the large
// team and of every benchmarked channel, with the default privacy settings;
// the App cases pass the options the API handlers derive for that user. Run
// with:
//
//	go test ./channels/api4 -run '^$' -bench BenchmarkUserSearchAppAPI -timeout 60m
//
// or use scripts/bench-user-search.sh to compare a branch against master.
func BenchmarkUserSearchAppAPI(b *testing.B) {
	// Request logging goes through the global logger, which defaults to
	// synchronous stdout writes that would interleave with benchmark results.
	quiet, err := mlog.NewLogger()
	require.NoError(b, err)
	mlog.InitGlobalLogger(quiet)
	b.Cleanup(func() {
		mlog.InitGlobalLogger(nil)
		require.NoError(b, quiet.Shutdown())
	})

	th := Setup(b)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 1_000_000 })

	db := mainHelper.GetSQLStore().GetMaster().DB().DB
	data := usersearchbench.Seed(b, db, usersearchbench.ConfigFromEnv(b))
	require.Nil(b, th.App.Srv().InvalidateAllCaches())

	team, appErr := th.App.GetTeam(data.LargeTeamID())
	require.Nil(b, appErr)
	th.LinkUserToTeam(b, th.BasicUser, team)
	for _, id := range []string{data.TownSquareID, data.LargeChannelID, data.MediumChannelID, data.SmallChannelID} {
		channel, appErr := th.App.GetChannel(th.Context, id)
		require.Nil(b, appErr)
		th.AddUserToChannel(b, th.BasicUser, channel)
	}

	// The default transport keeps only two idle connections per host, which
	// would make the parallel cases measure connection setup.
	client := th.CreateClient()
	client.HTTPClient = &http.Client{Transport: &http.Transport{MaxIdleConnsPerHost: 1024}}
	th.LoginBasicWithClient(b, client)
	admin := th.SystemAdminClient

	stats := usersearchbench.NewQueryStats(b, db)
	ctx := context.Background()
	rctx := th.Context

	searchOpts := func() *model.UserSearchOptions {
		return &model.UserSearchOptions{AllowEmails: true, AllowFullNames: true, Limit: model.UserSearchDefaultLimit}
	}
	autocompleteOpts := func() *model.UserSearchOptions {
		return &model.UserSearchOptions{AllowFullNames: true, Limit: 25}
	}
	appSearch := func(props model.UserSearch) func(string) (int, error) {
		return func(term string) (int, error) {
			props.Term = term
			users, appErr := th.App.SearchUsers(rctx, &props, searchOpts())
			if appErr != nil {
				return 0, appErr
			}
			return len(users), nil
		}
	}
	apiSearch := func(c *model.Client4, props model.UserSearch) func(string) (int, error) {
		return func(term string) (int, error) {
			props.Term = term
			users, _, err := c.SearchUsers(ctx, &props)
			return len(users), err
		}
	}
	apiAutocompleteInChannel := func(channelID string) func(string) (int, error) {
		return func(term string) (int, error) {
			res, _, err := client.AutocompleteUsersInChannel(ctx, data.LargeTeamID(), channelID, term, 25, "")
			if err != nil {
				return 0, err
			}
			return len(res.Users) + len(res.OutOfChannel), nil
		}
	}
	appAutocompleteInChannel := func(channelID string) func(string) (int, error) {
		return func(term string) (int, error) {
			res, appErr := th.App.AutocompleteUsersInChannel(rctx, data.LargeTeamID(), channelID, term, autocompleteOpts())
			if appErr != nil {
				return 0, appErr
			}
			return len(res.InChannel) + len(res.OutOfChannel), nil
		}
	}

	all, core := data.AllTerms(), data.CoreTerms()
	cases := []struct {
		name     string
		terms    []usersearchbench.Term
		parallel bool
		run      func(term string) (int, error)
	}{
		{"layer=app/op=AutocompleteUsersInChannel/scope=town_square", core, false, appAutocompleteInChannel(data.TownSquareID)},
		{"layer=app/op=AutocompleteUsersInChannel/scope=small", core, false, appAutocompleteInChannel(data.SmallChannelID)},
		{"layer=app/op=AutocompleteUsersInTeam/scope=team_large", core, false, func(term string) (int, error) {
			res, appErr := th.App.AutocompleteUsersInTeam(rctx, data.LargeTeamID(), term, autocompleteOpts())
			if appErr != nil {
				return 0, appErr
			}
			return len(res.InTeam), nil
		}},
		{"layer=app/op=SearchUsers/scope=team_large", core, false, appSearch(model.UserSearch{TeamId: data.LargeTeamID()})},
		{"layer=app/op=SearchUsers/scope=not_in_channel_large", core, false, appSearch(model.UserSearch{TeamId: data.LargeTeamID(), NotInChannelId: data.LargeChannelID})},

		{"layer=api/op=autocomplete/scope=town_square", all, false, apiAutocompleteInChannel(data.TownSquareID)},
		{"layer=api/op=autocomplete/scope=small", core, false, apiAutocompleteInChannel(data.SmallChannelID)},
		{"layer=api/op=autocomplete/scope=team_large", core, false, func(term string) (int, error) {
			res, _, err := client.AutocompleteUsersInTeam(ctx, data.LargeTeamID(), term, 25, "")
			if err != nil {
				return 0, err
			}
			return len(res.Users), nil
		}},
		{"layer=api/op=autocomplete/scope=system", core, false, func(term string) (int, error) {
			res, _, err := client.AutocompleteUsers(ctx, term, 25, "")
			if err != nil {
				return 0, err
			}
			return len(res.Users), nil
		}},
		{"layer=api/op=search/scope=system", core, false, apiSearch(client, model.UserSearch{})},
		{"layer=api/op=search/scope=team_large", core, false, apiSearch(client, model.UserSearch{TeamId: data.LargeTeamID()})},
		{"layer=api/op=search/scope=in_channel_large", core, false, apiSearch(client, model.UserSearch{InChannelId: data.LargeChannelID})},
		{"layer=api/op=search/scope=not_in_channel_large", core, false, apiSearch(client, model.UserSearch{TeamId: data.LargeTeamID(), NotInChannelId: data.LargeChannelID})},
		{"layer=api/op=search_as_admin/scope=team_large", core, false, apiSearch(admin, model.UserSearch{TeamId: data.LargeTeamID()})},

		{"layer=api_parallel/op=autocomplete/scope=town_square", data.Terms("prefix", "nomatch"), true, apiAutocompleteInChannel(data.TownSquareID)},
		{"layer=api_parallel/op=search/scope=team_large", data.Terms("prefix", "nomatch"), true, apiSearch(client, model.UserSearch{TeamId: data.LargeTeamID()})},
	}

	for _, c := range cases {
		b.Run(c.name, func(b *testing.B) {
			for _, term := range c.terms {
				b.Run("term="+term.Name, func(b *testing.B) {
					op := func() (int, error) { return c.run(term.Value) }
					if c.parallel {
						stats.MeasureParallel(b, op)
					} else {
						stats.Measure(b, op)
					}
				})
			}
		})
	}
}
