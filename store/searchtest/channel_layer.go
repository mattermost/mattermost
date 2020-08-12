// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/require"
)

var searchChannelStoreTests = []searchTest{
	{
		Name: "Should be able to autocomplete a channel by name",
		Fn:   testAutocompleteChannelByName,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should be able to autocomplete a channel by display name",
		Fn:   testAutocompleteChannelByDisplayName,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its name when has parts splitted by - character",
		Fn:   testAutocompleteChannelByNameSplittedWithDashChar,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its name when has parts splitted by _ character",
		Fn:   testAutocompleteChannelByNameSplittedWithUnderscoreChar,
		Tags: []string{ENGINE_MYSQL, ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name: "Should be able to autocomplete a channel by a part of its display name when has parts splitted by whitespace character",
		Fn:   testAutocompleteChannelByDisplayNameSplittedByWhitespaces,
		Tags: []string{ENGINE_MYSQL, ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name: "Should be able to autocomplete retrieving all channels if the term is empty",
		Fn:   testAutocompleteAllChannelsIfTermIsEmpty,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should be able to autocomplete channels in a case insensitive manner",
		Fn:   testSearchChannelsInCaseInsensitiveManner,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should autocomplete only returning public channels",
		Fn:   testSearchOnlyPublicChannels,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support to autocomplete having a hyphen as the last character",
		Fn:   testSearchShouldSupportHavingHyphenAsLastCharacter,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support to autocomplete with archived channels",
		Fn:   testSearchShouldSupportAutocompleteWithArchivedChannels,
		Tags: []string{ENGINE_ALL},
	},
}

func TestSearchChannelStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	th := &SearchTestHelper{
		Store: s,
	}
	err := th.SetupBasicFixtures()
	require.Nil(t, err)
	defer th.CleanFixtures()
	runTestSearch(t, testEngine, searchChannelStoreTests, th)
}

func testAutocompleteChannelByName(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-a", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
}

func testAutocompleteChannelByDisplayName(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "ChannelA", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
}

func testAutocompleteChannelByNameSplittedWithDashChar(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-a", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
}

func testAutocompleteChannelByNameSplittedWithUnderscoreChar(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel_alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel_a", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{alternate.Id}, res)
}

func testAutocompleteChannelByDisplayNameSplittedByWhitespaces(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)

	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "Channel A", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{alternate.Id}, res)
}
func testAutocompleteAllChannelsIfTermIsEmpty(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	other, err := th.createChannel(th.Team.Id, "other-channel", "Other Channel", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	defer th.deleteChannel(other)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id, other.Id}, res)
}

func testSearchChannelsInCaseInsensitiveManner(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channela", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
	res, apperr = th.Store.Channel().AutocompleteInTeam(th.Team.Id, "ChAnNeL-a", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
}

func testSearchOnlyPublicChannels(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_PRIVATE, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-a", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id}, res)
}

func testSearchShouldSupportHavingHyphenAsLastCharacter(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-", false)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, res)
}

func testSearchShouldSupportAutocompleteWithArchivedChannels(t *testing.T, th *SearchTestHelper) {
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-", true)
	require.Nil(t, apperr)
	th.checkChannelIdsMatch(t, []string{th.ChannelBasic.Id, th.ChannelDeleted.Id}, res)
}
