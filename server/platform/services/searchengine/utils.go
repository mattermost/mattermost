// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"regexp"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
)

var EmailRegex = regexp.MustCompile(`^[^\s"]+@[^\s"]+$`)

func GetSuggestionInputsSplitBy(term, splitStr string) []string {
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

func GetSuggestionInputsSplitByMultiple(term string, splitStrs []string) []string {
	suggestionList := []string{}
	for _, splitStr := range splitStrs {
		suggestionList = append(suggestionList, GetSuggestionInputsSplitBy(term, splitStr)...)
	}
	return utils.RemoveDuplicatesFromStringArray(suggestionList)
}
