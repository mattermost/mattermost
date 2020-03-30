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
		"Should be able to autocomplete a channel by name",
		testAutocompleteChannelByName,
		[]string{ENGINE_ALL},
	},
	{
		"Should be able to autocomplete a channel by display name",
		testAutocompleteChannelByDisplayName,
		[]string{ENGINE_ALL},
	},
	{
		"Should be able to autocomplete a channel by a part of its name when has parts splitted by - character",
		testAutocompleteChannelByNameSplittedWithDashChar,
		[]string{ENGINE_ALL},
	},
	{
		"Should be able to autocomplete a channel by a part of its name when has parts splitted by _ character",
		testAutocompleteChannelByNameSplittedWithUnderscoreChar,
		[]string{ENGINE_ALL},
	},
	{
		"Should be able to autocomplete a channel by a part of its display name when has parts splitted by whitespace character",
		testAutocompleteChannelByDisplayNameSplittedByWhitespaces,
		[]string{ENGINE_ALL},
	},
	{
		"Should be able to autocomplete retrieving all channels if the term is empty",
		testAutocompleteAllChannelsIfTermIsEmpty,
		[]string{ENGINE_ALL},
	},
	{
		"Should be able to autocomplete channels in a case insensitive manner",
		testSearchChannelsInCaseInsensitiveManner,
		[]string{ENGINE_ALL},
	},
	{
		"Should autocomplete only returning public channels",
		testSearchOnlyPublicChannels,
		[]string{ENGINE_ALL},
	},
	{
		"Should support to autocomplete having a hyphen as the last character",
		testSearchShouldSupportHavingHyphenAsLastCharacter,
		[]string{ENGINE_ALL},
	},
	{
		"Should support to autocomplete with archived channels",
		testSearchShouldSupportAutocompleteWithArchivedChannels,
		[]string{ENGINE_ALL},
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
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, channelIds)
}

func testAutocompleteChannelByDisplayName(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "ChannelA", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, channelIds)
}

func testAutocompleteChannelByNameSplittedWithDashChar(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-a", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, channelIds)
}

func testAutocompleteChannelByNameSplittedWithUnderscoreChar(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel_alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel_a", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{alternate.Id}, channelIds)
}

func testAutocompleteChannelByDisplayNameSplittedByWhitespaces(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "Channel Alternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "Channel A", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{alternate.Id}, channelIds)
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
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id, other.Id}, channelIds)
}

func testSearchChannelsInCaseInsensitiveManner(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channela", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, channelIds)
	res, apperr = th.Store.Channel().AutocompleteInTeam(th.Team.Id, "ChAnNeL-a", false)
	require.Nil(t, apperr)
	channelIds = make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, channelIds)
}

func testSearchOnlyPublicChannels(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_PRIVATE, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-a", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id}, channelIds)
}

func testSearchShouldSupportHavingHyphenAsLastCharacter(t *testing.T, th *SearchTestHelper) {
	alternate, err := th.createChannel(th.Team.Id, "channel-alternate", "ChannelAlternate", "", model.CHANNEL_OPEN, false)
	require.Nil(t, err)
	defer th.deleteChannel(alternate)
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-", false)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, alternate.Id}, channelIds)
}

func testSearchShouldSupportAutocompleteWithArchivedChannels(t *testing.T, th *SearchTestHelper) {
	res, apperr := th.Store.Channel().AutocompleteInTeam(th.Team.Id, "channel-", true)
	require.Nil(t, apperr)
	channelIds := make([]string, len(*res))
	for i, channel := range *res {
		channelIds[i] = channel.Id
	}
	require.ElementsMatch(t, []string{th.ChannelBasic.Id, th.ChannelDeleted.Id}, channelIds)
}
