package bleveengine

import (
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type BLVChannel struct {
	Id          string
	TeamId      []string
	NameSuggest []string
}

type BLVUser struct {
	Id                         string
	SuggestionsWithFullname    []string
	SuggestionsWithoutFullname []string
	TeamsIds                   []string
	ChannelsIds                []string
}

// ToDo: this is a duplicate
func getSuggestionInputsSplitBy(term, splitStr string) []string {
	splitTerm := strings.Split(strings.ToLower(term), splitStr)
	var initialSuggestionList []string
	for i := range splitTerm {
		initialSuggestionList = append(initialSuggestionList, strings.Join(splitTerm[i:], splitStr))
	}

	suggestionList := []string{}
	// If splitStr is not an empty space, we create a suggestion with it at the beginning
	if splitStr == " " {
		suggestionList = initialSuggestionList
	} else {
		for i, suggestion := range initialSuggestionList {
			if i == 0 {
				suggestionList = append(suggestionList, suggestion)
			} else {
				suggestionList = append(suggestionList, splitStr+suggestion, suggestion)
			}
		}
	}
	return suggestionList
}

// ToDo: this is a duplicate
func getSuggestionInputsSplitByMultiple(term string, splitStrs []string) []string {
	suggestionList := []string{}
	for _, splitStr := range splitStrs {
		suggestionList = append(suggestionList, getSuggestionInputsSplitBy(term, splitStr)...)
	}
	return utils.RemoveDuplicatesFromStringArray(suggestionList)
}

func BLVChannelFromChannel(channel *model.Channel) *BLVChannel {
	displayNameInputs := getSuggestionInputsSplitBy(channel.DisplayName, " ")
	nameInputs := getSuggestionInputsSplitByMultiple(channel.Name, []string{"-", "_"})

	return &BLVChannel{
		Id:          channel.Id,
		TeamId:      []string{channel.TeamId},
		NameSuggest: append(displayNameInputs, nameInputs...),
	}
}

func BLVUserFromUserAndTeams(user *model.User, teamsIds, channelsIds []string) *BLVUser {
	usernameSuggestions := getSuggestionInputsSplitByMultiple(user.Username, []string{".", "-", "_"})

	fullnameStrings := []string{}
	if user.FirstName != "" {
		fullnameStrings = append(fullnameStrings, user.FirstName)
	}
	if user.LastName != "" {
		fullnameStrings = append(fullnameStrings, user.LastName)
	}

	fullnameSuggestions := []string{}
	if len(fullnameStrings) > 0 {
		fullname := strings.Join(fullnameStrings, " ")
		fullnameSuggestions = getSuggestionInputsSplitBy(fullname, " ")
	}

	nicknameSuggesitons := []string{}
	if user.Nickname != "" {
		nicknameSuggesitons = getSuggestionInputsSplitBy(user.Nickname, " ")
	}

	usernameAndNicknameSuggestions := append(usernameSuggestions, nicknameSuggesitons...)

	return &BLVUser{
		Id:                         user.Id,
		SuggestionsWithFullname:    append(usernameAndNicknameSuggestions, fullnameSuggestions...),
		SuggestionsWithoutFullname: usernameAndNicknameSuggestions,
		TeamsIds:                   teamsIds,
		ChannelsIds:                channelsIds,
	}
}
