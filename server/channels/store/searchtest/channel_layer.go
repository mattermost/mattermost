// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

var searchChannelStoreTests = []searchTest{
	{
		Name: "Should be able to autocomplete a channel by name",
		Fn:   testAutocompleteChannelByName,
		Tags: []string{EngineMySql, EngineElasticSearch, EngineBleve},
	},
	{
		Name: "Should be able to autocomplete a channel by name (Postgres)",
		Fn:   testAutocompleteChannelByNamePostgres,
		Tags: []string{EnginePostgres},
	},
	{
		Name: "Should be able to autocomplete a channel by display name",
		Fn:   testAutocompleteChannelByDisplayName,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its name when has parts splitted by - character",
		Fn:   testAutocompleteChannelByNameSplittedWithDashChar,
		Tags: []string{EngineMySql, EngineElasticSearch, EngineBleve},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its name when has parts splitted by - character (Postgres)",
		Fn:   testAutocompleteChannelByNameSplittedWithDashCharPostgres,
		Tags: []string{EnginePostgres},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its name when has parts splitted by _ character",
		Fn:   testAutocompleteChannelByNameSplittedWithUnderscoreChar,
		Tags: []string{EngineMySql, EngineElasticSearch, EngineBleve},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its display name when has parts splitted by whitespace character",
		Fn:   testAutocompleteChannelByDisplayNameSplittedByWhitespaces,
		Tags: []string{EngineMySql, EngineElasticSearch, EngineBleve},
	},
	{
		Name: "Should be able to autocomplete retrieving all channels if the term is empty",
		Fn:   testAutocompleteAllChannelsIfTermIsEmpty,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should be able to autocomplete channels in a case insensitive manner",
		Fn:   testSearchChannelsInCaseInsensitiveManner,
		Tags: []string{EngineMySql, EngineElasticSearch, EngineBleve},
	},
	{
		Name: "Should be able to autocomplete channels in a case insensitive manner (Postgres)",
		Fn:   testSearchChannelsInCaseInsensitiveMannerPostgres,
		Tags: []string{EnginePostgres},
	},
	{
		Name: "Should support to autocomplete having a hyphen as the last character",
		Fn:   testSearchShouldSupportHavingHyphenAsLastCharacter,
		Tags: []string{EngineAll},
	},
	{
		Name: "Should support to autocomplete with archived channels",
		Fn:   testSearchShouldSupportAutocompleteWithArchivedChannels,
		Tags: []string{EngineAll},
	},
}

func TestSearchChannelStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	th := &SearchTestHelper{
		Store: s,
	}
	err := th.SetupBasicFixtures()
	require.NoError(t, err)
	defer th.CleanFixtures()
	runTestSearch(t, testEngine, searchChannelStoreTests, th)
}

func testAutocompleteChannelByName(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "Channel Alternate", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)

	private, err := th.createChannel(th.Team.Id, "channel-altprivate", "Channel AltPrivate", "Channel Private", model.ChannelTypePrivate, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(private)

	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id, private.Id}, res)

	res2, err := th.Store.Channel().Autocomplete(th.User.Id, "channel-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatchWithTeamData(t, []string{th.ChannelBasic.Id, alternate.Id, private.Id, th.ChannelAnotherTeam.Id}, res2)
}

func testAutocompleteChannelByNamePostgres(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "Channel Alternate", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelPrivate.Id, alternate.Id}, res)
}

func testAutocompleteChannelByDisplayName(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)

	private, err := th.createChannel(th.Team.Id, "channel-altprivate", "ChannelAltPrivate", "Channel Private", model.ChannelTypePrivate, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(private)

	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "ChannelA", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id, private.Id}, res)

	res2, err := th.Store.Channel().Autocomplete(th.User.Id, "ChannelA", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatchWithTeamData(t, []string{th.ChannelBasic.Id, alternate.Id, private.Id, th.ChannelAnotherTeam.Id}, res2)
}

func testAutocompleteChannelByNameSplittedWithDashChar(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
}

func testAutocompleteChannelByNameSplittedWithDashCharPostgres(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelPrivate.Id, alternate.Id}, res)
}

func testAutocompleteChannelByNameSplittedWithUnderscoreChar(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel_alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel_a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{alternate.Id}, res)

	res2, err := th.Store.Channel().Autocomplete(th.User.Id, "channel_a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatchWithTeamData(t, []string{alternate.Id}, res2)
}

func testAutocompleteChannelByDisplayNameSplittedByWhitespaces(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)

	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "Channel A", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{alternate.Id}, res)
}
func testAutocompleteAllChannelsIfTermIsEmpty(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	other, err := th.createChannel(th.Team.Id, "other-channel", "Other Channel", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	defer th.deleteChannel(other)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelPrivate.Id, alternate.Id, other.Id}, res)
}

func testSearchChannelsInCaseInsensitiveManner(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channela", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
	res, err = th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "ChAnNeL-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)

	res2, err := th.Store.Channel().Autocomplete(th.User.Id, "channela", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatchWithTeamData(t, []string{th.ChannelAnotherTeam.Id, th.ChannelBasic.Id, alternate.Id}, res2)
	res2, err = th.Store.Channel().Autocomplete(th.User.Id, "ChAnNeL-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatchWithTeamData(t, []string{th.ChannelAnotherTeam.Id, th.ChannelBasic.Id, alternate.Id}, res2)
}

func testSearchChannelsInCaseInsensitiveMannerPostgres(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channela", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
	res, err = th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "ChAnNeL-a", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelPrivate.Id, alternate.Id}, res)
}

func testSearchShouldSupportHavingHyphenAsLastCharacter(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.ChannelTypeOpen, th.User, false)
	require.NoError(t, err)
	defer th.deleteChannel(alternate)
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel-", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelPrivate.Id, alternate.Id}, res)

	res2, err := th.Store.Channel().Autocomplete(th.User.Id, "channel-", false, false)
	require.NoError(t, err)
	th.checkChannelIdsMatchWithTeamData(t, []string{th.ChannelAnotherTeam.Id, th.ChannelBasic.Id, th.ChannelPrivate.Id, alternate.Id}, res2)
}

func testSearchShouldSupportAutocompleteWithArchivedChannels(t *testing.T, th *SearchTestHelper) {
	res, err := th.Store.Channel().AutocompleteInTeam(th.Team.Id, th.User.Id, "channel-", true, false)
	require.NoError(t, err)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelPrivate.Id, th.ChannelDeleted.Id}, res)
}
