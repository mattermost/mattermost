// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package web

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestGetPerPageFromQuery(t *testing.T) {
	t.Run("defaults should be set", func(t *testing.T) {
		query := make(url.Values)
		perPage := getPerPageFromQuery(query)
		require.Equal(t, PerPageDefault, perPage)
	})

	t.Run("per_page should take priority", func(t *testing.T) {
		query := make(url.Values)
		query.Add("pageSize", "100")
		query.Add("per_page", "50")
		perPage := getPerPageFromQuery(query)
		require.Equal(t, 50, perPage)
	})

	t.Run("pageSize should be used only if per_page is incorrectly set", func(t *testing.T) {
		query := make(url.Values)
		query.Add("pageSize", "100")
		query.Add("per_page", "BAD VALUE")
		perPage := getPerPageFromQuery(query)
		require.Equal(t, 100, perPage)
	})
}

func TestParamsFromRequest(t *testing.T) {
	testCases := []struct {
		Description string
		URL         *url.URL
		Vars        map[string]string
		Params      *Params
	}{
		{
			"empty params",
			mustURL("/"),
			nil,
			&Params{
				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"query params",
			mustURL("/page?" +
				"channel_id=abc123&" +
				"filename=file.ext&" +
				"page=42&" +
				"time_range=then-till-now&" +
				"permanent=1&" +
				"logs_per_page=5&" +
				"limit_after=6&" +
				"limit_before=7&" +
				"q=picard&" +
				"is_linked=t&" +
				"is_configured=TRUE&" +
				"not_associated_to_team=this_team&" +
				"not_associated_to_channel=this_channel&" +
				"filter_allow_reference=true&" +
				"filter_parent_team_permitted=True&" +
				"paginate=T&" +
				"include_member_count=1&" +
				"not_associated_to_group=test&" +
				"exclude_default_channels=1&" +
				"group_ids=hello,world&" +
				"include_total_count=T&" +
				"include_deleted=True&" +
				"exclude_policy_constrained=TRUE&" +
				"filter_has_member=xyz"),
			nil,
			&Params{
				ChannelId:                 "abc123",
				Filename:                  "file.ext",
				Page:                      42,
				TimeRange:                 "then-till-now",
				PerPage:                   PerPageDefault,
				Permanent:                 true,
				LogsPerPage:               5,
				LimitAfter:                6,
				LimitBefore:               7,
				Q:                         "picard",
				IsLinked:                  boolPtr(true),
				IsConfigured:              boolPtr(true),
				NotAssociatedToTeam:       "this_team",
				NotAssociatedToChannel:    "this_channel",
				FilterAllowReference:      true,
				FilterParentTeamPermitted: true,
				Paginate:                  boolPtr(true),
				IncludeMemberCount:        true,
				NotAssociatedToGroup:      "test",
				ExcludeDefaultChannels:    true,
				GroupIDs:                  "hello,world",
				IncludeTotalCount:         true,
				IncludeDeleted:            true,
				ExcludePolicyConstrained:  true,
				FilterHasMember:           "xyz",
			},
		},
		{
			"page invalid",
			mustURL("?page=hello"),
			nil,
			&Params{
				Page: PageDefault,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"page negative",
			mustURL("?page=-1"),
			nil,
			&Params{
				Page: PageDefault,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"per page valid",
			mustURL("?per_page=123"),
			nil,
			&Params{
				PerPage: 123,

				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"per page too small",
			mustURL("?per_page=-100"),
			nil,
			&Params{
				PerPage: PerPageDefault,

				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"per page too big",
			mustURL("?per_page=100000"),
			nil,
			&Params{
				PerPage: PerPageMaximum,

				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"logs per page valid",
			mustURL("?logs_per_page=512"),
			nil,
			&Params{
				LogsPerPage: 512,

				PerPage:     PerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"logs per page invalid",
			mustURL("?logs_per_page=logs"),
			nil,
			&Params{
				LogsPerPage: LogsPerPageDefault,

				PerPage:     PerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"logs per page too small",
			mustURL("?logs_per_page=-512"),
			nil,
			&Params{
				LogsPerPage: LogsPerPageDefault,

				PerPage:     PerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"logs per page too big",
			mustURL("?logs_per_page=99999999"),
			nil,
			&Params{
				LogsPerPage: LogsPerPageMaximum,

				PerPage:     PerPageDefault,
				LimitAfter:  LimitDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"limit before valid",
			mustURL("?limit_before=100"),
			nil,
			&Params{
				LimitBefore: 100,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"limit before invalid",
			mustURL("?limit_before=limit"),
			nil,
			&Params{
				LimitBefore: LimitDefault,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"limit before too small",
			mustURL("?limit_before=-100"),
			nil,
			&Params{
				LimitBefore: LimitDefault,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"limit before too big",
			mustURL("?limit_before=99999"),
			nil,
			&Params{
				LimitBefore: LimitMaximum,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"limit after valid",
			mustURL("?limit_after=100"),
			nil,
			&Params{
				LimitAfter: 100,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"limit after invalid",
			mustURL("?limit_after=limit"),
			nil,
			&Params{
				LimitAfter: LimitDefault,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"limit after too small",
			mustURL("?limit_aftere=-100"),
			nil,
			&Params{
				LimitAfter: LimitDefault,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"limit after too big",
			mustURL("?limit_after=99999"),
			nil,
			&Params{
				LimitAfter: LimitMaximum,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
			},
		},
		{
			"group source custom",
			mustURL("?group_source=custom"),
			nil,
			&Params{
				GroupSource: model.GroupSourceCustom,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"group source LDAP",
			mustURL("?group_source=ldap"),
			nil,
			&Params{
				GroupSource: model.GroupSourceLdap,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"group source other",
			mustURL("?group_source=aabbcc"),
			nil,
			&Params{
				GroupSource: model.GroupSourceLdap,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"group source empty",
			mustURL("?group_souce="),
			nil,
			&Params{
				GroupSource: "",

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"timestamp valid",
			mustURL("/"),
			map[string]string{
				"timestamp": "1234567",
			},
			&Params{
				Timestamp: 1234567,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"timestamp valid",
			mustURL("/"),
			map[string]string{
				"timestamp": "yes",
			},
			&Params{
				Timestamp: 0,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"timestamp too small",
			mustURL("/"),
			map[string]string{
				"timestamp": "-1234567",
			},
			&Params{
				Timestamp: 0,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"syncable type teams",
			mustURL("/"),
			map[string]string{
				"syncable_type": "teams",
			},
			&Params{
				SyncableType: model.GroupSyncableTypeTeam,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"syncable type channels",
			mustURL("/"),
			map[string]string{
				"syncable_type": "channels",
			},
			&Params{
				SyncableType: model.GroupSyncableTypeChannel,

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
		{
			"syncable type other",
			mustURL("/"),
			map[string]string{
				"syncable_type": "unknownvalue",
			},
			&Params{
				SyncableType: "",

				PerPage:     PerPageDefault,
				LogsPerPage: LogsPerPageDefault,
				LimitBefore: LimitDefault,
				LimitAfter:  LimitDefault,
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			r := &http.Request{URL: testCase.URL}
			r = mux.SetURLVars(r, testCase.Vars)
			params := ParamsFromRequest(r)
			require.Equal(t, testCase.Params, params)
		})
	}
}

func mustURL(u string) *url.URL {
	parsed, err := url.Parse(u)
	if err != nil {
		panic(err)
	}
	return parsed
}

func boolPtr(b bool) *bool {
	return &b
}
