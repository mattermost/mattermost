// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
)

type SearchParams struct {
	Terms     string
	IsHashtag bool
	InChannel string
	FromUser  string
}

var searchFlags = [...]string{"from", "channel", "in"}

func splitWords(text string) []string {
	words := []string{}

	for _, word := range strings.Fields(text) {
		word = puncStart.ReplaceAllString(word, "")
		word = puncEnd.ReplaceAllString(word, "")

		if len(word) != 0 {
			words = append(words, word)
		}
	}

	return words
}

func parseSearchFlags(input []string) ([]string, map[string]string) {
	words := []string{}
	flags := make(map[string]string)

	skipNextWord := false
	for i, word := range input {
		if skipNextWord {
			skipNextWord = false
			continue
		}

		isFlag := false

		if colon := strings.Index(word, ":"); colon != -1 {
			flag := word[:colon]
			value := word[colon+1:]

			for _, searchFlag := range searchFlags {
				// check for case insensitive equality
				if strings.EqualFold(flag, searchFlag) {
					if value != "" {
						flags[searchFlag] = value
						isFlag = true
					} else if i < len(input)-1 {
						flags[searchFlag] = input[i+1]
						skipNextWord = true
						isFlag = true
					}

					if isFlag {
						break
					}
				}
			}
		}

		if !isFlag {
			words = append(words, word)
		}
	}

	return words, flags
}

func ParseSearchParams(text string) (*SearchParams, *SearchParams) {
	words, flags := parseSearchFlags(splitWords(text))

	hashtagTerms := []string{}
	plainTerms := []string{}

	for _, word := range words {
		if validHashtag.MatchString(word) {
			hashtagTerms = append(hashtagTerms, word)
		} else {
			plainTerms = append(plainTerms, word)
		}
	}

	inChannel := flags["channel"]
	if inChannel == "" {
		inChannel = flags["in"]
	}

	fromUser := flags["from"]

	var plainParams *SearchParams
	if len(plainTerms) > 0 {
		plainParams = &SearchParams{
			Terms:     strings.Join(plainTerms, " "),
			IsHashtag: false,
			InChannel: inChannel,
			FromUser:  fromUser,
		}
	}

	var hashtagParams *SearchParams
	if len(hashtagTerms) > 0 {
		hashtagParams = &SearchParams{
			Terms:     strings.Join(hashtagTerms, " "),
			IsHashtag: true,
			InChannel: inChannel,
			FromUser:  fromUser,
		}
	}

	// special case for when no terms are specified but we still have a filter
	if plainParams == nil && hashtagParams == nil && (inChannel != "" || fromUser != "") {
		plainParams = &SearchParams{
			Terms:     "",
			IsHashtag: false,
			InChannel: inChannel,
			FromUser:  fromUser,
		}
	}

	return plainParams, hashtagParams
}
