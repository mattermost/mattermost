// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/require"
)

var searchUserStoreTests = []searchTest{
	{
		Name: "Should retrieve all users in a channel if the search term is empty",
		Fn:   testGetAllUsersInChannelWithEmptyTerm,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should honor channel restrictions when autocompleting users",
		Fn:   testHonorChannelRestrictionsAutocompletingUsers,
		Tags: []string{ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name: "Should honor team restrictions when autocompleting users",
		Fn:   testHonorTeamRestrictionsAutocompletingUsers,
		Tags: []string{ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name:        "Should return nothing if the user can't access the channels of a given search",
		Fn:          testShouldReturnNothingWithoutProperAccess,
		Tags:        []string{ENGINE_ALL},
		Skip:        true,
		SkipMessage: "Failing when the ListOfAllowedChannels property is empty",
	},
	{
		Name: "Should autocomplete for user using username",
		Fn:   testAutocompleteUserByUsername,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should autocomplete user searching by first name",
		Fn:   testAutocompleteUserByFirstName,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should autocomplete user searching by last name",
		Fn:   testAutocompleteUserByLastName,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should autocomplete for user using nickname",
		Fn:   testAutocompleteUserByNickName,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name:        "Should autocomplete for user using email",
		Fn:          testAutocompleteUserByEmail,
		Tags:        []string{ENGINE_ALL},
		Skip:        true,
		SkipMessage: "Failing for multiple different reasons in the engines",
	},
	{
		Name: "Should be able not to match specific queries with mail",
		Fn:   testShouldNotMatchSpecificQueriesEmail,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should be able to autocomplete a user by part of its username splitted by Dot",
		Fn:   testAutocompleteUserByUsernameWithDot,
		Tags: []string{ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name: "Should be able to autocomplete a user by part of its username splitted by underscore",
		Fn:   testAutocompleteUserByUsernameWithUnderscore,
		Tags: []string{ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name: "Should be able to autocomplete a user by part of its username splitted by hyphen",
		Fn:   testAutocompleteUserByUsernameWithHyphen,
		Tags: []string{ENGINE_ELASTICSEARCH, ENGINE_BLEVE},
	},
	{
		Name: "Should escape the percentage character",
		Fn:   testShouldEscapePercentageCharacter,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should escape the dash character",
		Fn:   testShouldEscapeUnderscoreCharacter,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should be able to search inactive users",
		Fn:   testShouldBeAbleToSearchInactiveUsers,
		Tags: []string{ENGINE_POSTGRES, ENGINE_MYSQL},
	},
	{
		Name: "Should be able to search filtering by role",
		Fn:   testShouldBeAbleToSearchFilteringByRole,
		Tags: []string{ENGINE_POSTGRES, ENGINE_MYSQL},
	},
	{
		Name: "Should ignore leading @ when searching users",
		Fn:   testShouldIgnoreLeadingAtSymbols,
		Tags: []string{ENGINE_MYSQL, ENGINE_POSTGRES},
	},
	{
		Name: "Should search users in a case insensitive manner",
		Fn:   testSearchUsersShouldBeCaseInsensitive,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support one or two character usernames and first/last names in search",
		Fn:   testSearchOneTwoCharUsersnameAndFirstLastNames,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support Korean characters",
		Fn:   testShouldSupportKoreanCharacters,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support search with a hyphen at the end of the term",
		Fn:   testSearchWithHyphenAtTheEndOfTheTerm,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support search all users in a team",
		Fn:   testSearchUsersInTeam,
		Tags: []string{ENGINE_ELASTICSEARCH},
	},
	{
		Name: "Should support search users by full name",
		Fn:   testSearchUsersByFullName,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support search all users in a team with username containing a dot",
		Fn:   testSearchUsersInTeamUsernameWithDot,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support search all users in a team with username containing a hyphen",
		Fn:   testSearchUsersInTeamUsernameWithHyphen,
		Tags: []string{ENGINE_ALL},
	},
	{
		Name: "Should support search all users in a team with username containing a underscore",
		Fn:   testSearchUsersInTeamUsernameWithUnderscore,
		Tags: []string{ENGINE_ALL},
	},
}

func TestSearchUserStore(t *testing.T, s store.Store, testEngine *SearchTestEngine) {
	th := &SearchTestHelper{
		Store: s,
	}
	err := th.SetupBasicFixtures()
	require.Nil(t, err)
	defer th.CleanFixtures()
	runTestSearch(t, testEngine, searchUserStoreTests, th)
}

func testGetAllUsersInChannelWithEmptyTerm(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, err := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
	require.Nil(t, err)
	th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
	th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
}
func testHonorChannelRestrictionsAutocompletingUsers(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("user-alternate", "user-alternate", "user", "alternate")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames:   true,
		Limit:            model.USER_SEARCH_DEFAULT_LIMIT,
		ViewRestrictions: &model.ViewUsersRestrictions{Channels: []string{th.ChannelBasic.Id}},
	}
	t.Run("Autocomplete users with channel restrictions", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User, userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Autocomplete users with term and channel restrictions", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alt", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Autocomplete users with all channels restricted", func(t *testing.T) {
		options.ViewRestrictions = &model.ViewUsersRestrictions{Channels: []string{}}
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}
func testHonorTeamRestrictionsAutocompletingUsers(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("user-alternate", "user-alternate", "user", "alternate")
	defer th.deleteUser(userAlternate)
	require.Nil(t, err)
	err = th.addUserToTeams(userAlternate, []string{th.AnotherTeam.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelAnotherTeam.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames:   true,
		Limit:            model.USER_SEARCH_DEFAULT_LIMIT,
		ViewRestrictions: &model.ViewUsersRestrictions{Teams: []string{th.Team.Id}},
	}
	t.Run("Should return results for users in the team", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
	t.Run("Should return empty because we're filtering all the teams", func(t *testing.T) {
		options.ViewRestrictions = &model.ViewUsersRestrictions{Teams: []string{}}
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}
func testShouldReturnNothingWithoutProperAccess(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		AllowFullNames:        true,
		Limit:                 model.USER_SEARCH_DEFAULT_LIMIT,
		ListOfAllowedChannels: []string{th.ChannelBasic.Id},
	}
	t.Run("Should return results users for the defined channel in the list", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return empty because we're filtering all the channels", func(t *testing.T) {
		options.ListOfAllowedChannels = []string{}
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}
func testAutocompleteUserByUsername(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternateusername", "alternatenick", "user", "alternate")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: false,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "basicusername", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
	th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
}
func testAutocompleteUserByFirstName(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("user-alternate", "user-alternate", "altfirstname", "lastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete users when the first name is unique", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "altfirstname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should autocomplete users for in the channel and out of the channel with the same first name", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "basicfirstname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
}
func testAutocompleteUserByLastName(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("user-alternate", "user-alternate", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should return results when the last name is unique", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "altlastname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results for in the channel and out of the channel with the same last name", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "basiclastname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
}
func testAutocompleteUserByNickName(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternateusername", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should return results when the nickname is unique", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternatenickname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return users that share the same part of the nickname", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "basicnickname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
}
func testAutocompleteUserByEmail(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternateusername", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	userAlternate.Email = "useralt@test.email.com"
	_, apperr := th.Store.User().Update(userAlternate, false)
	require.Nil(t, apperr)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowEmails: true,
		Limit:       model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete users when the email is unique", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "useralt@test.email.com", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should autocomplete users that share the same email user prefix", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "success_", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
	t.Run("Should autocomplete users that share the same email domain", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "simulator.amazon.com", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
	t.Run("Should search users when the email is unique", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "useralt@test.email.com", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
	})
	t.Run("Should search users that share the same email user prefix", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "success_", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users)
	})
	t.Run("Should search users that share the same email domain", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "simulator.amazon.com", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users)
	})
}
func testShouldNotMatchSpecificQueriesEmail(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		AllowEmails: false,
		Limit:       model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "success_", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.InChannel)
	th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
}
func testAutocompleteUserByUsernameWithDot(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate.username", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should return results when searching for the whole username with Dot", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate.username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results when searching for part of the username including the Dot", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, ".username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results when searching for part of the username not including the Dot", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}
func testAutocompleteUserByUsernameWithUnderscore(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate_username", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should return results when searching for the whole username with underscore", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate_username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results when searching for part of the username including the underscore", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "_username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results when searching for part of the username not including the underscore", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}
func testAutocompleteUserByUsernameWithHyphen(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate-username", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should return results when searching for the whole username with hyphen", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate-username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results when searching for part of the username including the hyphen", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "-username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should return results when searching for part of the username not including the hyphen", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}
func testShouldEscapePercentageCharacter(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternateusername", "alternate%nickname", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete users escaping percentage symbol", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate%", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should search users escaping percentage symbol", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "alternate%", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
	})
}
func testShouldEscapeUnderscoreCharacter(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate_username", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete users escaping underscore symbol", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate_", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should search users escaping underscore symbol", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "alternate_", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
	})
}

func testShouldBeAbleToSearchInactiveUsers(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate-username", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	userAlternate.DeleteAt = model.GetMillis()
	_, apperr := th.Store.User().Update(userAlternate, true)
	require.Nil(t, apperr)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowInactive: true,
		Limit:         model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete inactive users if we allow it", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate-username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should search inactive users if we allow it", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "alternate-username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
	})
	t.Run("Shouldn't autocomplete inactive users if we don't allow it", func(t *testing.T) {
		options.AllowInactive = false
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate-username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Shouldn't search inactive users if we don't allow it", func(t *testing.T) {
		options.AllowInactive = false
		users, apperr := th.Store.User().Search(th.Team.Id, "alternate-username", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users)
	})
}

func testShouldBeAbleToSearchFilteringByRole(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("basicusernamealternate", "alternatenickname", "firstname", "altlastname")
	require.Nil(t, err)
	userAlternate.Roles = "system_admin"
	_, apperr := th.Store.User().Update(userAlternate, true)
	require.Nil(t, apperr)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowInactive: true,
		Role:          "system_admin",
		Limit:         model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete users filtering by roles", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "basicusername", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should search users filtering by roles", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "basicusername", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
	})
}

func testShouldIgnoreLeadingAtSymbols(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should autocomplete ignoring the @ symbol at the beginning", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "@basicusername", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
	})
	t.Run("Should search ignoring the @ symbol at the beginning", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "@basicusername", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User, th.User2}, users)
	})
}

func testSearchUsersShouldBeCaseInsensitive(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "BaSiCUsErNaMe", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users.InChannel)
	th.assertUsersMatchInAnyOrder(t, []*model.User{th.User2}, users.OutOfChannel)
}

func testSearchOneTwoCharUsersnameAndFirstLastNames(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("ho", "alternatenickname", "zi", "k")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should support two characters in the full name", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "zi", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should support two characters in the username", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "ho", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}

func testShouldSupportKoreanCharacters(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate-username", "alternate-nickname", "서강준", "안신원")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should support hanja korean characters", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "서강준", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
	t.Run("Should support hangul korean characters", func(t *testing.T) {
		users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "안신원", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
	})
}

func testSearchWithHyphenAtTheEndOfTheTerm(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate-username", "alternate-nickname", "altfirst", "altlast")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().AutocompleteUsersInChannel(th.Team.Id, th.ChannelBasic.Id, "alternate-", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users.InChannel)
	th.assertUsersMatchInAnyOrder(t, []*model.User{}, users.OutOfChannel)
}

func testSearchUsersInTeam(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		Limit: model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should return all the team users", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User, th.User2}, users)
	})
	t.Run("Should return all the team users with no team id", func(t *testing.T) {
		users, apperr := th.Store.User().Search("", "basicusername", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User, th.User2, th.UserAnotherTeam}, users)
	})
	t.Run("Should return all the team users filtered by username", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "basicusername1", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users)
	})
	t.Run("Should not return spurious results", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "falseuser", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users)
	})
	t.Run("Should return all the team users filtered by username and with channel restrictions", func(t *testing.T) {
		options.ViewRestrictions = &model.ViewUsersRestrictions{Channels: []string{th.ChannelBasic.Id}}
		users, apperr := th.Store.User().Search(th.Team.Id, "basicusername", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users)
	})
	t.Run("Should return all the team users filtered by username and with all channel restricted", func(t *testing.T) {
		options.ViewRestrictions = &model.ViewUsersRestrictions{Channels: []string{}}
		users, apperr := th.Store.User().Search(th.Team.Id, "basicusername1", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users)
	})
}

func testSearchUsersInTeamUsernameWithDot(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate.username", "altnickname", "altfirst", "altlast")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().Search(th.Team.Id, "alternate.", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
}

func testSearchUsersInTeamUsernameWithHyphen(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate-username", "altnickname", "altfirst", "altlast")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().Search(th.Team.Id, "alternate-", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
}

func testSearchUsersInTeamUsernameWithUnderscore(t *testing.T, th *SearchTestHelper) {
	userAlternate, err := th.createUser("alternate_username", "altnickname", "altfirst", "altlast")
	require.Nil(t, err)
	defer th.deleteUser(userAlternate)
	err = th.addUserToTeams(userAlternate, []string{th.Team.Id})
	require.Nil(t, err)
	_, err = th.addUserToChannels(userAlternate, []string{th.ChannelBasic.Id})
	require.Nil(t, err)
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	users, apperr := th.Store.User().Search(th.Team.Id, "alternate_", options)
	require.Nil(t, apperr)
	th.assertUsersMatchInAnyOrder(t, []*model.User{userAlternate}, users)
}

func testSearchUsersByFullName(t *testing.T, th *SearchTestHelper) {
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          model.USER_SEARCH_DEFAULT_LIMIT,
	}
	t.Run("Should search users by full name", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "basicfirstname", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User, th.User2}, users)
	})
	t.Run("Should search user by full name", func(t *testing.T) {
		users, apperr := th.Store.User().Search(th.Team.Id, "basicfirstname1", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{th.User}, users)
	})
	t.Run("Should return empty when search by full name and is deactivated", func(t *testing.T) {
		options.AllowFullNames = false
		users, apperr := th.Store.User().Search(th.Team.Id, "basicfirstname1", options)
		require.Nil(t, apperr)
		th.assertUsersMatchInAnyOrder(t, []*model.User{}, users)
	})
}
