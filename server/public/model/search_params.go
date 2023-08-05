// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"regexp"
	"strings"
	"time"
)

var searchTermPuncStart = regexp.MustCompile(`^[^\pL\d\s#"]+`)
var searchTermPuncEnd = regexp.MustCompile(`[^\pL\d\s*"]+$`)

// Regexp to match any quoted string. It is used in the file search
// logic to avoid adding a wildcard at the end of the quoted search
// terms, which need to be matched literally.
var exactPhraseRegExpForFileSearch = regexp.MustCompile(`"[^"]+"`)

type SearchParams struct {
	Terms                  string   `json:"terms,omitempty"`
	ExcludedTerms          string   `json:"excluded_terms,omitempty"`
	IsHashtag              bool     `json:"ishashtag,omitempty"`
	InChannels             []string `json:"in_channels,omitempty"`
	ExcludedChannels       []string `json:"excluded_channels,omitempty"`
	FromUsers              []string `json:"from_users,omitempty"`
	ExcludedUsers          []string `json:"excluded_users,omitempty"`
	AfterDate              string   `json:"after_date,omitempty"`
	ExcludedAfterDate      string   `json:"excluded_after_date,omitempty"`
	BeforeDate             string   `json:"before_date,omitempty"`
	ExcludedBeforeDate     string   `json:"excluded_before_date,omitempty"`
	Extensions             []string `json:"extensions,omitempty"`
	ExcludedExtensions     []string `json:"excluded_extensions,omitempty"`
	OnDate                 string   `json:"on_date,omitempty"`
	ExcludedDate           string   `json:"excluded_date,omitempty"`
	OrTerms                bool     `json:"or_terms,omitempty"`
	IncludeDeletedChannels bool     `json:"include_deleted_channels,omitempty"`
	TimeZoneOffset         int      `json:"timezone_offset,omitempty"`
	// True if this search doesn't originate from a "current user".
	SearchWithoutUserId bool   `json:"search_without_userid,omitempty"`
	Modifier            string `json:"modifier"`
}

// Returns the epoch timestamp of the start of the day specified by SearchParams.AfterDate
func (p *SearchParams) GetAfterDateMillis() int64 {
	date, err := time.Parse("2006-01-02", PadDateStringZeros(p.AfterDate))
	if err != nil {
		date = time.Now()
	}

	// travel forward 1 day
	oneDay := time.Hour * 24
	afterDate := date.Add(oneDay)
	return GetStartOfDayMillis(afterDate, p.TimeZoneOffset)
}

// Returns the epoch timestamp of the start of the day specified by SearchParams.ExcludedAfterDate
func (p *SearchParams) GetExcludedAfterDateMillis() int64 {
	date, err := time.Parse("2006-01-02", PadDateStringZeros(p.ExcludedAfterDate))
	if err != nil {
		date = time.Now()
	}

	// travel forward 1 day
	oneDay := time.Hour * 24
	afterDate := date.Add(oneDay)
	return GetStartOfDayMillis(afterDate, p.TimeZoneOffset)
}

// Returns the epoch timestamp of the end of the day specified by SearchParams.BeforeDate
func (p *SearchParams) GetBeforeDateMillis() int64 {
	date, err := time.Parse("2006-01-02", PadDateStringZeros(p.BeforeDate))
	if err != nil {
		return 0
	}

	// travel back 1 day
	oneDay := time.Hour * -24
	beforeDate := date.Add(oneDay)
	return GetEndOfDayMillis(beforeDate, p.TimeZoneOffset)
}

// Returns the epoch timestamp of the end of the day specified by SearchParams.ExcludedBeforeDate
func (p *SearchParams) GetExcludedBeforeDateMillis() int64 {
	date, err := time.Parse("2006-01-02", PadDateStringZeros(p.ExcludedBeforeDate))
	if err != nil {
		return 0
	}

	// travel back 1 day
	oneDay := time.Hour * -24
	beforeDate := date.Add(oneDay)
	return GetEndOfDayMillis(beforeDate, p.TimeZoneOffset)
}

// Returns the epoch timestamps of the start and end of the day specified by SearchParams.OnDate
func (p *SearchParams) GetOnDateMillis() (int64, int64) {
	date, err := time.Parse("2006-01-02", PadDateStringZeros(p.OnDate))
	if err != nil {
		return 0, 0
	}

	return GetStartOfDayMillis(date, p.TimeZoneOffset), GetEndOfDayMillis(date, p.TimeZoneOffset)
}

// Returns the epoch timestamps of the start and end of the day specified by SearchParams.ExcludedDate
func (p *SearchParams) GetExcludedDateMillis() (int64, int64) {
	date, err := time.Parse("2006-01-02", PadDateStringZeros(p.ExcludedDate))
	if err != nil {
		return 0, 0
	}

	return GetStartOfDayMillis(date, p.TimeZoneOffset), GetEndOfDayMillis(date, p.TimeZoneOffset)
}

// GetExactPhraseTerms returns a space-separated string with only the quoted terms in Terms.
// For example: '"one" two "three" four' returns '"one" "three"'
func (p *SearchParams) GetExactPhraseTerms() string {
	exactPhraseTerms := strings.Join(exactPhraseRegExpForFileSearch.FindAllString(p.Terms, -1), " ")

	return exactPhraseTerms
}

// GetWildcardAddedNormalTerms returns a space-separated string with only the non-quoted
// terms in Terms, with an additional asterisk character at the end.
// For example: '"one" two "three" four' returns 'two* four*'
func (p *SearchParams) GetWildcardAddedNormalTerms() string {
	// Filter the quoted terms
	normalTerms := exactPhraseRegExpForFileSearch.ReplaceAllLiteralString(p.Terms, "")

	result := []string{}

	for _, term := range strings.Fields(normalTerms) {
		if !strings.HasSuffix(term, "*") {
			term = term + "*"
		}
		result = append(result, term)
	}

	wildcardAddedNormalTerms := strings.Join(result, " ")

	return wildcardAddedNormalTerms
}

var searchFlags = [...]string{"from", "channel", "in", "before", "after", "on", "ext"}

type flag struct {
	name    string
	value   string
	exclude bool
}

type searchWord struct {
	value   string
	exclude bool
}

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
				nextStart := i
				if i > 0 && text[i-1] == '-' {
					nextStart = i - 1
				}
				words = append(words, strings.Fields(text[location:nextStart])...)
				foundQuote = true
				location = nextStart
			}
		}
	}

	words = append(words, strings.Fields(text[location:])...)

	return words
}

func parseSearchFlags(input []string) ([]searchWord, []flag) {
	words := []searchWord{}
	flags := []flag{}

	skipNextWord := false
	for i, word := range input {
		if skipNextWord {
			skipNextWord = false
			continue
		}

		isFlag := false

		if colon := strings.Index(word, ":"); colon != -1 {
			var flagName string
			var exclude bool
			if strings.HasPrefix(word, "-") {
				flagName = word[1:colon]
				exclude = true
			} else {
				flagName = word[:colon]
				exclude = false
			}

			value := word[colon+1:]

			for _, searchFlag := range searchFlags {
				// check for case insensitive equality
				if strings.EqualFold(flagName, searchFlag) {
					if value != "" {
						flags = append(flags, flag{
							searchFlag,
							value,
							exclude,
						})
						isFlag = true
					} else if i < len(input)-1 {
						flags = append(flags, flag{
							searchFlag,
							input[i+1],
							exclude,
						})
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
			exclude := false
			if strings.HasPrefix(word, "-") {
				exclude = true
			}
			// trim off surrounding punctuation (note that we leave trailing asterisks to allow wildcards)
			word = searchTermPuncStart.ReplaceAllString(word, "")
			word = searchTermPuncEnd.ReplaceAllString(word, "")

			// and remove extra pound #s
			word = hashtagStart.ReplaceAllString(word, "#")

			if word != "" {
				words = append(words, searchWord{
					word,
					exclude,
				})
			}
		}
	}

	return words, flags
}

func ParseSearchParams(text string, timeZoneOffset int) []*SearchParams {
	words, flags := parseSearchFlags(splitWords(text))

	hashtagTermList := []string{}
	excludedHashtagTermList := []string{}
	plainTermList := []string{}
	excludedPlainTermList := []string{}

	for _, word := range words {
		if validHashtag.MatchString(word.value) {
			if word.exclude {
				excludedHashtagTermList = append(excludedHashtagTermList, word.value)
			} else {
				hashtagTermList = append(hashtagTermList, word.value)
			}
		} else {
			if word.exclude {
				excludedPlainTermList = append(excludedPlainTermList, word.value)
			} else {
				plainTermList = append(plainTermList, word.value)
			}
		}
	}

	hashtagTerms := strings.Join(hashtagTermList, " ")
	excludedHashtagTerms := strings.Join(excludedHashtagTermList, " ")
	plainTerms := strings.Join(plainTermList, " ")
	excludedPlainTerms := strings.Join(excludedPlainTermList, " ")

	inChannels := []string{}
	excludedChannels := []string{}
	fromUsers := []string{}
	excludedUsers := []string{}
	afterDate := ""
	excludedAfterDate := ""
	beforeDate := ""
	excludedBeforeDate := ""
	onDate := ""
	excludedDate := ""
	excludedExtensions := []string{}
	extensions := []string{}

	for _, flag := range flags {
		if flag.name == "in" || flag.name == "channel" {
			if flag.exclude {
				excludedChannels = append(excludedChannels, flag.value)
			} else {
				inChannels = append(inChannels, flag.value)
			}
		} else if flag.name == "from" {
			if flag.exclude {
				excludedUsers = append(excludedUsers, flag.value)
			} else {
				fromUsers = append(fromUsers, flag.value)
			}
		} else if flag.name == "after" {
			if flag.exclude {
				excludedAfterDate = flag.value
			} else {
				afterDate = flag.value
			}
		} else if flag.name == "before" {
			if flag.exclude {
				excludedBeforeDate = flag.value
			} else {
				beforeDate = flag.value
			}
		} else if flag.name == "on" {
			if flag.exclude {
				excludedDate = flag.value
			} else {
				onDate = flag.value
			}
		} else if flag.name == "ext" {
			if flag.exclude {
				excludedExtensions = append(excludedExtensions, flag.value)
			} else {
				extensions = append(extensions, flag.value)
			}
		}
	}

	paramsList := []*SearchParams{}

	if plainTerms != "" || excludedPlainTerms != "" {
		paramsList = append(paramsList, &SearchParams{
			Terms:              plainTerms,
			ExcludedTerms:      excludedPlainTerms,
			IsHashtag:          false,
			InChannels:         inChannels,
			ExcludedChannels:   excludedChannels,
			FromUsers:          fromUsers,
			ExcludedUsers:      excludedUsers,
			AfterDate:          afterDate,
			ExcludedAfterDate:  excludedAfterDate,
			BeforeDate:         beforeDate,
			ExcludedBeforeDate: excludedBeforeDate,
			Extensions:         extensions,
			ExcludedExtensions: excludedExtensions,
			OnDate:             onDate,
			ExcludedDate:       excludedDate,
			TimeZoneOffset:     timeZoneOffset,
		})
	}

	if hashtagTerms != "" || excludedHashtagTerms != "" {
		paramsList = append(paramsList, &SearchParams{
			Terms:              hashtagTerms,
			ExcludedTerms:      excludedHashtagTerms,
			IsHashtag:          true,
			InChannels:         inChannels,
			ExcludedChannels:   excludedChannels,
			FromUsers:          fromUsers,
			ExcludedUsers:      excludedUsers,
			AfterDate:          afterDate,
			ExcludedAfterDate:  excludedAfterDate,
			BeforeDate:         beforeDate,
			ExcludedBeforeDate: excludedBeforeDate,
			Extensions:         extensions,
			ExcludedExtensions: excludedExtensions,
			OnDate:             onDate,
			ExcludedDate:       excludedDate,
			TimeZoneOffset:     timeZoneOffset,
		})
	}

	// special case for when no terms are specified but we still have a filter
	if plainTerms == "" && hashtagTerms == "" &&
		excludedPlainTerms == "" && excludedHashtagTerms == "" &&
		(len(inChannels) != 0 || len(fromUsers) != 0 ||
			len(excludedChannels) != 0 || len(excludedUsers) != 0 ||
			len(extensions) != 0 || len(excludedExtensions) != 0 ||
			afterDate != "" || excludedAfterDate != "" ||
			beforeDate != "" || excludedBeforeDate != "" ||
			onDate != "" || excludedDate != "") {
		paramsList = append(paramsList, &SearchParams{
			Terms:              "",
			ExcludedTerms:      "",
			IsHashtag:          false,
			InChannels:         inChannels,
			ExcludedChannels:   excludedChannels,
			FromUsers:          fromUsers,
			ExcludedUsers:      excludedUsers,
			AfterDate:          afterDate,
			ExcludedAfterDate:  excludedAfterDate,
			BeforeDate:         beforeDate,
			ExcludedBeforeDate: excludedBeforeDate,
			Extensions:         extensions,
			ExcludedExtensions: excludedExtensions,
			OnDate:             onDate,
			ExcludedDate:       excludedDate,
			TimeZoneOffset:     timeZoneOffset,
		})
	}

	return paramsList
}

func IsSearchParamsListValid(paramsList []*SearchParams) *AppError {
	// All SearchParams should have same IncludeDeletedChannels value.
	for _, params := range paramsList {
		if params.IncludeDeletedChannels != paramsList[0].IncludeDeletedChannels {
			return NewAppError("IsSearchParamsListValid", "model.search_params_list.is_valid.include_deleted_channels.app_error", nil, "", http.StatusInternalServerError)
		}
	}
	return nil
}
