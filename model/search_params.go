// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"regexp"
	"strings"
	"time"
)

var searchTermPuncStart = regexp.MustCompile(`^[^\pL\d\s#"]+`)
var searchTermPuncEnd = regexp.MustCompile(`[^\pL\d\s*"]+$`)

type SearchParams struct {
	Terms                  string
	IsHashtag              bool
	InChannels             []string
	FromUsers              []string
	AfterDate              string
	BeforeDate             string
	OnDate                 string
	OrTerms                bool
	IncludeDeletedChannels bool
	TimeZoneOffset         int
}

// Returns the epoch timestamp of the start of the day specified by SearchParams.AfterDate
func (p *SearchParams) GetAfterDateMillis() int64 {
	date := ParseDateFilterToTime(p.AfterDate)
	// travel forward 1 day
	oneDay := time.Hour * 24
	afterDate := date.Add(oneDay)
	return GetStartOfDayMillis(afterDate, p.TimeZoneOffset)
}

// Returns the epoch timestamp of the end of the day specified by SearchParams.BeforeDate
func (p *SearchParams) GetBeforeDateMillis() int64 {
	date := ParseDateFilterToTime(p.BeforeDate)
	// travel back 1 day
	oneDay := time.Hour * -24
	beforeDate := date.Add(oneDay)
	return GetEndOfDayMillis(beforeDate, p.TimeZoneOffset)
}

// Returns the epoch timestamps of the start and end of the day specified by SearchParams.OnDate
func (p *SearchParams) GetOnDateMillis() (int64, int64) {
	date := ParseDateFilterToTime(p.OnDate)
	return GetStartOfDayMillis(date, p.TimeZoneOffset), GetEndOfDayMillis(date, p.TimeZoneOffset)
}

var searchFlags = [...]string{"from", "channel", "in", "before", "after", "on"}

func splitWords(text string) []string {
	words := []string{}

	foundQuote := false
	location := 0
	for i, char := range text {
		if char == '"' {
			if foundQuote {
				// Grab the quoted section
				word := text[location : i+1]
				words = append(words, word)
				foundQuote = false
				location = i + 1
			} else {
				words = append(words, strings.Fields(text[location:i])...)
				foundQuote = true
				location = i
			}
		}
	}

	words = append(words, strings.Fields(text[location:])...)

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
			// trim off surrounding punctuation (note that we leave trailing asterisks to allow wildcards)
			word = searchTermPuncStart.ReplaceAllString(word, "")
			word = searchTermPuncEnd.ReplaceAllString(word, "")

			// and remove extra pound #s
			word = hashtagStart.ReplaceAllString(word, "#")

			if len(word) != 0 {
				words = append(words, word)
			}
		}
	}

	return words, flags
}

func ParseSearchParams(text string, timeZoneOffset int) []*SearchParams {
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
	afterDate := ""
	beforeDate := ""
	onDate := ""

	for _, flagPair := range flags {
		flag := flagPair[0]
		value := flagPair[1]

		if flag == "in" || flag == "channel" {
			inChannels = append(inChannels, value)
		} else if flag == "from" {
			fromUsers = append(fromUsers, value)
		} else if flag == "after" {
			afterDate = value
		} else if flag == "before" {
			beforeDate = value
		} else if flag == "on" {
			onDate = value
		}
	}

	paramsList := []*SearchParams{}

	if len(plainTerms) > 0 {
		paramsList = append(paramsList, &SearchParams{
			Terms:          plainTerms,
			IsHashtag:      false,
			InChannels:     inChannels,
			FromUsers:      fromUsers,
			AfterDate:      afterDate,
			BeforeDate:     beforeDate,
			OnDate:         onDate,
			TimeZoneOffset: timeZoneOffset,
		})
	}

	if len(hashtagTerms) > 0 {
		paramsList = append(paramsList, &SearchParams{
			Terms:          hashtagTerms,
			IsHashtag:      true,
			InChannels:     inChannels,
			FromUsers:      fromUsers,
			AfterDate:      afterDate,
			BeforeDate:     beforeDate,
			OnDate:         onDate,
			TimeZoneOffset: timeZoneOffset,
		})
	}

	// special case for when no terms are specified but we still have a filter
	if len(plainTerms) == 0 && len(hashtagTerms) == 0 && (len(inChannels) != 0 || len(fromUsers) != 0 || len(afterDate) != 0 || len(beforeDate) != 0 || len(onDate) != 0) {
		paramsList = append(paramsList, &SearchParams{
			Terms:          "",
			IsHashtag:      false,
			InChannels:     inChannels,
			FromUsers:      fromUsers,
			AfterDate:      afterDate,
			BeforeDate:     beforeDate,
			OnDate:         onDate,
			TimeZoneOffset: timeZoneOffset,
		})
	}

	return paramsList
}
