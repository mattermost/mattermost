package bleveengine

import (
	"encoding/xml"
	"io"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
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

type BLVPost struct {
	Id          string
	TeamId      string
	ChannelId   string
	UserId      string
	CreateAt    int64
	Message     string
	Type        string
	Hashtags    []string
	Attachments string
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

// ToDo: this is a duplicate
func getMatchesForHit(highlights map[string][]string) ([]string, error) {
	matchMap := make(map[string]bool)

	parseMatches := func(snippets []string) error {
		// Highlighted matches are returned as an array of snippets of the post where
		// each snippet has the highlighted text surrounded by html <em> tags
		for _, snippet := range snippets {
			decoder := xml.NewDecoder(strings.NewReader(snippet))
			inMatch := false

			for {
				token, err := decoder.Token()
				if err == io.EOF {
					break
				} else if err != nil {
					return err
				}

				switch typed := token.(type) {
				case xml.StartElement:
					if typed.Name.Local == "em" {
						inMatch = true
					}
				case xml.EndElement:
					if typed.Name.Local == "em" {
						inMatch = false
					}
				case xml.CharData:
					if inMatch && len(typed) != 0 {
						match := string(typed)
						match = strings.Trim(match, "_*~")

						matchMap[match] = true
					}
				}
			}
		}

		return nil
	}

	if err := parseMatches(highlights["message"]); err != nil {
		return nil, err
	}
	if err := parseMatches(highlights["attachments"]); err != nil {
		return nil, err
	}
	if err := parseMatches(highlights["hashtags"]); err != nil {
		return nil, err
	}

	var matches []string
	for match := range matchMap {
		matches = append(matches, match)
	}

	return matches, nil
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

func BLVPostFromPost(post *model.Post, teamId string) *BLVPost {
	return &BLVPost{
		Id: post.Id,
		TeamId: teamId,
		ChannelId: post.ChannelId,
		UserId:    post.UserId,
		CreateAt:  post.CreateAt,
		Message:   post.Message,
		Type:      post.Type,
		Hashtags:  strings.Fields(post.Hashtags),
	}
}
