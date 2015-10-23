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

func parseSearchFlags(input []string) ([]string, [][2]string) {
	words := []string{}
	flags := [][2]string{}

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
						flags = append(flags, [2]string{searchFlag, value})
						isFlag = true
					} else if i < len(input)-1 {
						flags = append(flags, [2]string{searchFlag, input[i+1]})
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

func ParseSearchParams(text string) []*SearchParams {
	words, flags := parseSearchFlags(splitWords(text))

	hashtagTermList := []string{}
	plainTermList := []string{}

	for _, word := range words {
		if validHashtag.MatchString(word) {
			hashtagTermList = append(hashtagTermList, word)
		} else {
			plainTermList = append(plainTermList, word)
		}
	}

	hashtagTerms := strings.Join(hashtagTermList, " ")
	plainTerms := strings.Join(plainTermList, " ")

	inChannels := []string{}
	fromUsers := []string{}

	for _, flagPair := range flags {
		flag := flagPair[0]
		value := flagPair[1]

		if flag == "in" || flag == "channel" {
			inChannels = append(inChannels, value)
		} else if flag == "from" {
			fromUsers = append(fromUsers, value)
		}
	}

	if len(inChannels) == 0 {
		inChannels = append(inChannels, "")
	}
	if len(fromUsers) == 0 {
		fromUsers = append(fromUsers, "")
	}

	paramsList := []*SearchParams{}

	for _, inChannel := range inChannels {
		for _, fromUser := range fromUsers {
			if len(plainTerms) > 0 {
				paramsList = append(paramsList, &SearchParams{
					Terms:     plainTerms,
					IsHashtag: false,
					InChannel: inChannel,
					FromUser:  fromUser,
				})
			}

			if len(hashtagTerms) > 0 {
				paramsList = append(paramsList, &SearchParams{
					Terms:     hashtagTerms,
					IsHashtag: true,
					InChannel: inChannel,
					FromUser:  fromUser,
				})
			}

			// special case for when no terms are specified but we still have a filter
			if len(plainTerms) == 0 && len(hashtagTerms) == 0 {
				paramsList = append(paramsList, &SearchParams{
					Terms:     "",
					IsHashtag: true,
					InChannel: inChannel,
					FromUser:  fromUser,
				})
			}
		}
	}

	return paramsList
}
