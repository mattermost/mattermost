// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSplitWords(t *testing.T) {
	for _, testCase := range []struct {
		Name  string
		Input string

		Output []string
	}{
		{
			Name:   "string is empty, output should be empty",
			Input:  "",
			Output: []string{},
		},
		{
			Name:   "string is only spaces, output should be empty",
			Input:  "      ",
			Output: []string{},
		},
		{
			Name:   "string is a single word, output should be one word length",
			Input:  "word",
			Output: []string{"word"},
		},
		{
			Name:   "string has a single \" character, output should be two words",
			Input:  "wo\"rd",
			Output: []string{"wo", "\"rd"},
		},
		{
			Name:   "string has multiple \" characters, output should be two words",
			Input:  "wo\"rd\"",
			Output: []string{"wo", "\"rd\""},
		},
		{
			Name:   "string has multiple \" characters and a -, output should be two words",
			Input:  "wo-\"rd\"",
			Output: []string{"wo", "-\"rd\""},
		},
		{
			Name:   "string has multiple words, output should be 3 words",
			Input:  "word1 word2 word3",
			Output: []string{"word1", "word2", "word3"},
		},
		{
			Name:   "string has multiple words with a \" in the middle, output should be 3 words",
			Input:  "word1 \"word2 word3",
			Output: []string{"word1", "\"word2", "word3"},
		},
		{
			Name:   "string has multiple words with a \" at the start, output should be 3 words",
			Input:  "\"word1 word2 word3",
			Output: []string{"\"word1", "word2", "word3"},
		},
		{
			Name:   "string has multiple words with a \" at the end, output should be 3 words and a \"",
			Input:  "word1 word2 word3\"",
			Output: []string{"word1", "word2", "word3", "\""},
		},
		{
			Name:   "string has multiple words with # as a prefix, output should be 3 words and prefixes kept",
			Input:  "word1 #word2 ##word3",
			Output: []string{"word1", "#word2", "##word3"},
		},
		{
			Name:   "string has multiple words with multiple space between them, output should still be 3 words",
			Input:  "   word1 word2      word3",
			Output: []string{"word1", "word2", "word3"},
		},
		{
			Name:   "string has a quoted word, output should also be quoted",
			Input:  "\"quoted\"",
			Output: []string{"\"quoted\""},
		},
		{
			Name:   "string has a quoted word with a - prefix, output should also be quoted with the same prefix",
			Input:  "-\"quoted\"",
			Output: []string{"-\"quoted\""},
		},
		{
			Name:   "string has multiple quoted words, output should not be splitted and quotes should be kept",
			Input:  "\"quoted multiple words\"",
			Output: []string{"\"quoted multiple words\""},
		},
		{
			Name:   "string has a mix of quoted words and non quoted words, output should contain 5 entries, quoted words should not be split",
			Input:  "some stuff \"quoted multiple words\" more stuff",
			Output: []string{"some", "stuff", "\"quoted multiple words\"", "more", "stuff"},
		},
		{
			Name:   "string has a mix of quoted words with a - prefix and non quoted words, output should contain 5 entries, quoted words should not be split, - should be kept",
			Input:  "some stuff -\"quoted multiple words\" more stuff",
			Output: []string{"some", "stuff", "-\"quoted multiple words\"", "more", "stuff"},
		},
		{
			Name:   "string has a mix of multiple quoted words with a - prefix and non quoted words including a # character, output should contain 5 entries, quoted words should not be split, # and - should be kept",
			Input:  "some \"stuff\" \"quoted multiple words\" #some \"more stuff\"",
			Output: []string{"some", "\"stuff\"", "\"quoted multiple words\"", "#some", "\"more stuff\""},
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			assert.Equal(t, testCase.Output, splitWords(testCase.Input))
		})
	}
}

func TestParseSearchFlags2(t *testing.T) {
	for _, testCase := range []struct {
		Name  string
		Input string

		Words []searchWord
		Flags []flag
	}{
		{
			Name:  "string is empty",
			Input: "",
			Words: []searchWord{},
			Flags: []flag{},
		},
		{
			Name:  "string is a single word",
			Input: "word",
			Words: []searchWord{
				{
					value:   "word",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is a single word with a - prefix",
			Input: "-word",
			Words: []searchWord{
				{
					value:   "word",
					exclude: true,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple words all with - prefix",
			Input: "-apple -banana -cherry",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: true,
				},
				{
					value:   "banana",
					exclude: true,
				},
				{
					value:   "cherry",
					exclude: true,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple words with a single - prefix",
			Input: "apple -banana cherry",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: true,
				},
				{
					value:   "cherry",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple words containing a flag",
			Input: "apple banana from:chan",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:  "from",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag and a - prefix",
			Input: "apple -banana from:chan",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: true,
				},
			},
			Flags: []flag{
				{
					name:  "from",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag and multiple - prefixes",
			Input: "-apple -banana from:chan",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: true,
				},
				{
					value:   "banana",
					exclude: true,
				},
			},
			Flags: []flag{
				{
					name:  "from",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag and multiple # prefixes",
			Input: "#apple #banana from:chan",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: false,
				},
				{
					value:   "#banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:  "from",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag with a single - and multiple # prefixes",
			Input: "-#apple #banana from:chan",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: true,
				},
				{
					value:   "#banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:  "from",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag prefixed with - and multiple # prefixes",
			Input: "#apple #banana -from:chan",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: false,
				},
				{
					value:   "#banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "from",
					value:   "chan",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag prefixed with multiple - and multiple # prefixes",
			Input: "-#apple -#banana -from:chan",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: true,
				},
				{
					value:   "#banana",
					exclude: true,
				},
			},
			Flags: []flag{
				{
					name:    "from",
					value:   "chan",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is multiple words containing a flag with a space",
			Input: "apple banana from: chan",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:  "from",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a in flag with a space",
			Input: "apple banana in: chan",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:  "in",
					value: "chan",
				},
			},
		},
		{
			Name:  "string is multiple words containing a channel flag with a space",
			Input: "apple banana channel: chan",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:  "channel",
					value: "chan",
				},
			},
		},
		{
			Name:  "string with a non-flag followed by :",
			Input: "fruit: cherry",
			Words: []searchWord{
				{
					value:   "fruit",
					exclude: false,
				},
				{
					value:   "cherry",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string with the a flag but without the value for that flag should be threaded as a word",
			Input: "channel:",
			Words: []searchWord{
				{
					value:   "channel",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is a single flag which results in a single flag",
			Input: "channel:first",
			Words: []searchWord{},
			Flags: []flag{
				{
					name:  "channel",
					value: "first",
				},
			},
		},
		{
			Name:  "single flag with - which results in a excluded flag",
			Input: "-channel:first",
			Words: []searchWord{},
			Flags: []flag{
				{
					name:    "channel",
					value:   "first",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is multiple flags which results in multiple unexcluded flags and a single search word",
			Input: "channel: first in: second from:",
			Words: []searchWord{
				{
					value:   "from",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "channel",
					value:   "first",
					exclude: false,
				},
				{
					name:    "in",
					value:   "second",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is multiple flags which results in multiple unexcluded and excluded flags and a single search word",
			Input: "channel: first -in: second from:",
			Words: []searchWord{
				{
					value:   "from",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "channel",
					value:   "first",
					exclude: false,
				},
				{
					name:    "in",
					value:   "second",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is multiple flags which results in multiple excluded and unexcluded flags and a single search word",
			Input: "-channel: first in: second from:",
			Words: []searchWord{
				{
					value:   "from",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "channel",
					value:   "first",
					exclude: true,
				},
				{
					name:    "in",
					value:   "second",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is four flags which results four unexcluded flags",
			Input: "channel: first channel: second from: third from: fourth",
			Words: []searchWord{},
			Flags: []flag{
				{
					name:    "channel",
					value:   "first",
					exclude: false,
				},
				{
					name:    "channel",
					value:   "second",
					exclude: false,
				},
				{
					name:    "from",
					value:   "third",
					exclude: false,
				},
				{
					name:    "from",
					value:   "fourth",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single quoted flag which results in a single search word which is quoted",
			Input: "\"quoted\"",
			Words: []searchWord{
				{
					value:   "\"quoted\"",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is a single quoted flag prefixed with a - which results in a single search word which is quoted",
			Input: "\"-quoted\"",
			Words: []searchWord{
				{
					value:   "\"-quoted\"",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is a single quoted flag prefixed with a - which results in a single search word which is quoted and exported",
			Input: "-\"quoted\"",
			Words: []searchWord{
				{
					value:   "\"quoted\"",
					exclude: true,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple quoted flags which results in a single search word which is quoted and unexported",
			Input: "\"quoted multiple words\"",
			Words: []searchWord{
				{
					value:   "\"quoted multiple words\"",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple quoted flags prefixed with - which results in a single search word which is quoted and unexported",
			Input: "\"quoted -multiple words\"",
			Words: []searchWord{
				{
					value:   "\"quoted -multiple words\"",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple quoted flags and unquoted words",
			Input: "some \"stuff\" \"quoted multiple words\" some \"more stuff\"",
			Words: []searchWord{
				{
					value:   "some",
					exclude: false,
				},
				{
					value:   "\"stuff\"",
					exclude: false,
				},
				{
					value:   "\"quoted multiple words\"",
					exclude: false,
				},
				{
					value:   "some",
					exclude: false,
				},
				{
					value:   "\"more stuff\"",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple quoted flags and unquoted words some being prefixed with -",
			Input: "some -\"stuff\" \"quoted multiple words\" some -\"more stuff\"",
			Words: []searchWord{
				{
					value:   "some",
					exclude: false,
				},
				{
					value:   "\"stuff\"",
					exclude: true,
				},
				{
					value:   "\"quoted multiple words\"",
					exclude: false,
				},
				{
					value:   "some",
					exclude: false,
				},
				{
					value:   "\"more stuff\"",
					exclude: true,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string is multiple quoted flags and unquoted words some being flags",
			Input: "some in:here \"stuff\" \"quoted multiple words\" from:someone \"more stuff\"",
			Words: []searchWord{
				{
					value:   "some",
					exclude: false,
				},
				{
					value:   "\"stuff\"",
					exclude: false,
				},
				{
					value:   "\"quoted multiple words\"",
					exclude: false,
				},
				{
					value:   "\"more stuff\"",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "in",
					value:   "here",
					exclude: false,
				},
				{
					name:    "from",
					value:   "someone",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single flag with multiple -",
			Input: "after:2018-1-1",
			Words: []searchWord{},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single flag with multiple - prefixed with a -",
			Input: "-after:2018-1-1",
			Words: []searchWord{},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is a single flag with multiple - prefixed with two words",
			Input: "apple banana before:2018-1-1",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "before",
					value:   "2018-1-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single before flag with multiple - prefixed with - and two words",
			Input: "apple banana -before:2018-1-1",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "before",
					value:   "2018-1-1",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is multiple before/after flags with two words before",
			Input: "apple banana after:2018-1-1 before:2018-1-10",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
				{
					name:    "before",
					value:   "2018-1-10",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is multiple before/after flags prefixed with - with two words before",
			Input: "apple banana -after:2018-1-1 -before:2018-1-10",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: true,
				},
				{
					name:    "before",
					value:   "2018-1-10",
					exclude: true,
				},
			},
		},
		{
			Name:  "string is a single after flag with two words before which are prefixed with #",
			Input: "#apple #banana after:2018-1-1",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: false,
				},
				{
					value:   "#banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single after flag with two words before which are prefixed with #",
			Input: "#apple #banana before:2018-1-1",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: false,
				},
				{
					value:   "#banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "before",
					value:   "2018-1-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is two after and before flags with two words before which are prefixed with #",
			Input: "#apple #banana after:2018-1-1 before:2018-1-10",
			Words: []searchWord{
				{
					value:   "#apple",
					exclude: false,
				},
				{
					value:   "#banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
				{
					name:    "before",
					value:   "2018-1-10",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single after flag with two words before",
			Input: "apple banana after: 2018-1-1",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is a single before flag with two words before",
			Input: "apple banana before: 2018-1-1",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "before",
					value:   "2018-1-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is two after and before flags with two words before",
			Input: "apple banana after: 2018-1-1 before: 2018-1-10",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
				{
					name:    "before",
					value:   "2018-1-10",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is two after and before flags with two words before and a single after",
			Input: "apple banana after: 2018-1-1 before: 2018-1-10 #fruit",
			Words: []searchWord{
				{
					value:   "apple",
					exclude: false,
				},
				{
					value:   "banana",
					exclude: false,
				},
				{
					value:   "#fruit",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-1-1",
					exclude: false,
				},
				{
					name:    "before",
					value:   "2018-1-10",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is one after flag with one word before",
			Input: "test after:2018-7-1",
			Words: []searchWord{
				{
					value:   "test",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "after",
					value:   "2018-7-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is one on flag with one word before",
			Input: "test on:2018-7-1",
			Words: []searchWord{
				{
					value:   "test",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "on",
					value:   "2018-7-1",
					exclude: false,
				},
			},
		},
		{
			Name:  "string is one excluded on flag with one word after",
			Input: "-on:2018-7-1 test",
			Words: []searchWord{
				{
					value:   "test",
					exclude: false,
				},
			},
			Flags: []flag{
				{
					name:    "on",
					value:   "2018-7-1",
					exclude: true,
				},
			},
		},
		{
			Name:  "string end with  thai upper vowel",
			Input: "สวัสดี",
			Words: []searchWord{
				{
					value:   "สวัสดี",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string end with  thai upper tone mark",
			Input: "ที่นี่",
			Words: []searchWord{
				{
					value:   "ที่นี่",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string end with  thai upper indication mark",
			Input: "การันต์",
			Words: []searchWord{
				{
					value:   "การันต์",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
		{
			Name:  "string end with  thai lower vowel",
			Input: "กตัญญู",
			Words: []searchWord{
				{
					value:   "กตัญญู",
					exclude: false,
				},
			},
			Flags: []flag{},
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			words, flags := parseSearchFlags(splitWords(testCase.Input))
			require.Equal(t, testCase.Words, words)
			require.Equal(t, testCase.Flags, flags)
		})
	}
}

func TestParseSearchParams(t *testing.T) {
	for _, testCase := range []struct {
		Name  string
		Input string

		Output []*SearchParams
	}{
		{
			Name:   "input is empty should result in no params",
			Input:  "",
			Output: []*SearchParams{},
		},
		{
			Name:   "input is only spaces should result in no params",
			Input:  "   ",
			Output: []*SearchParams{},
		},
		{
			Name:  "input is two words should result in one param",
			Input: "words words",
			Output: []*SearchParams{
				{
					Terms:              "words words",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words should result in one param with two excluded terms",
			Input: "-word1 -word2",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "word1 word2",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two quoted words should result in one term",
			Input: "\"my stuff\"",
			Output: []*SearchParams{
				{
					Terms:              "\"my stuff\"",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two quoted words should result in one excluded term",
			Input: "-\"my stuff\"",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "\"my stuff\"",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words prefixed with hashtags should result in one term",
			Input: "#words #words",
			Output: []*SearchParams{
				{
					Terms:              "#words #words",
					ExcludedTerms:      "",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words one is prefixed with a hashtag should result in two terms",
			Input: "#words words",
			Output: []*SearchParams{
				{
					Terms:              "words",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
				{
					Terms:              "#words",
					ExcludedTerms:      "",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is one word prefixed with hashtag and a dash should result in one excluded term",
			Input: "-#hashtag",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "#hashtag",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words prefixed with hashtags and dashes should result in excluded term",
			Input: "-#hashtag1 -#hashtag2",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "#hashtag1 #hashtag2",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words prefixed with hashtags and one dash should result in excluded and nonexcluded term",
			Input: "#hashtag1 -#hashtag2",
			Output: []*SearchParams{
				{
					Terms:              "#hashtag1",
					ExcludedTerms:      "#hashtag2",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is 4 words prefixed with hashtags and a dash should result in excluded and nonexcluded multiple SearchParams",
			Input: "word1 #hashtag1 -#hashtag2 -word2",
			Output: []*SearchParams{
				{
					Terms:              "word1",
					ExcludedTerms:      "word2",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
				{
					Terms:              "#hashtag1",
					ExcludedTerms:      "#hashtag2",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with : and should result in a single InChannel",
			Input: "in:channel",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with :, prefied with - and should result in a single ExcludedChannel",
			Input: "-in:channel",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{"channel"},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with : with a prefixed word should result in a single InChannel and a term",
			Input: "testing in:channel",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with : with a prefixed word should result in a single ExcludedChannel and a term",
			Input: "testing -in:channel",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{"channel"},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with : with a postfix word should result in a single InChannel and a term",
			Input: "in:channel testing",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is four words separated with : should result in a two InChannels",
			Input: "in:channel in:otherchannel",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel", "otherchannel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is four words separated with : prefixed with a word should result in two InChannels and one term",
			Input: "testing in:channel in:otherchannel",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel", "otherchannel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is four words separated with : prefixed with a word should result in one InChannel, one FromUser and one term",
			Input: "testing in:channel from:someone",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{"someone"},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is four words separated with : prefixed with a word should result in one InChannel, one ExcludedUser and one term",
			Input: "testing in:channel -from:someone",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{"someone"},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is six words separated with : prefixed with a word should result in one InChannel, one FromUser, one ExcludedUser and one term",
			Input: "testing in:channel from:someone -from:someoneelse",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{"channel"},
					ExcludedChannels:   []string{},
					FromUsers:          []string{"someone"},
					ExcludedUsers:      []string{"someoneelse"},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words first one is prefixed with two #, should result in one term with IsHashtag = true, pluses should be removed",
			Input: "##hashtag +#plus+",
			Output: []*SearchParams{
				{
					Terms:              "#hashtag #plus",
					ExcludedTerms:      "",
					IsHashtag:          true,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is a wildcard with a *, should result in one term with a *",
			Input: "wildcar*",
			Output: []*SearchParams{
				{
					Terms:              "wildcar*",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an after date with one word, should in one AfterDate and one term",
			Input: "after:2018-8-1 testing",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					AfterDate:          "2018-8-1",
					ExcludedAfterDate:  "",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an after date with one word, should in one ExcludedAfterDate and one term",
			Input: "-after:2018-8-1 testing",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					AfterDate:          "",
					ExcludedAfterDate:  "2018-8-1",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an on date with one word, should in one OnDate and one term",
			Input: "on:2018-8-1 testing",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					OnDate:             "2018-8-1",
					AfterDate:          "",
					ExcludedAfterDate:  "",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an on date with one word, should in one ExcludedDate and one term",
			Input: "-on:2018-8-1 testing",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					AfterDate:          "",
					ExcludedDate:       "2018-8-1",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an after date, should in one AfterDate",
			Input: "after:2018-8-1",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					AfterDate:          "2018-8-1",
					ExcludedDate:       "",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an before date, should in one BeforeDate",
			Input: "before:2018-8-1",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					BeforeDate:         "2018-8-1",
					AfterDate:          "",
					ExcludedDate:       "",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is an before date, should in one ExcludedBeforeDate",
			Input: "-before:2018-8-1",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					BeforeDate:         "",
					AfterDate:          "",
					ExcludedBeforeDate: "2018-8-1",
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with : and should result in a single Extension",
			Input: "ext:png",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{"png"},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with :, prefied with - and should result in a single ExcludedExtensions",
			Input: "-ext:png",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{"png"},
				},
			},
		},
		{
			Name:  "input is two words separated with : with a prefixed word should result in a single Extension and a term",
			Input: "testing ext:png",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{"png"},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is two words separated with : with a prefixed word should result in a single ExcludedExtension and a term",
			Input: "testing -ext:png",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{},
					ExcludedExtensions: []string{"png"},
				},
			},
		},
		{
			Name:  "input is two words separated with : with a postfix word should result in a single Extension and a term",
			Input: "ext:png testing",
			Output: []*SearchParams{
				{
					Terms:              "testing",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{"png"},
					ExcludedExtensions: []string{},
				},
			},
		},
		{
			Name:  "input is four words separated with : should result in a two Extensions",
			Input: "ext:png ext:jpg",
			Output: []*SearchParams{
				{
					Terms:              "",
					ExcludedTerms:      "",
					IsHashtag:          false,
					InChannels:         []string{},
					ExcludedChannels:   []string{},
					FromUsers:          []string{},
					ExcludedUsers:      []string{},
					Extensions:         []string{"png", "jpg"},
					ExcludedExtensions: []string{},
				},
			},
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			require.Equal(t, testCase.Output, ParseSearchParams(testCase.Input, 0))
		})
	}
}

func TestGetOnDateMillis(t *testing.T) {
	for _, testCase := range []struct {
		Name        string
		Input       string
		StartOnDate int64
		EndOnDate   int64
	}{
		{
			Name:        "Valid date",
			Input:       "2018-08-01",
			StartOnDate: 1533081600000,
			EndOnDate:   1533167999999,
		},
		{
			Name:        "Valid date but requires padding of zero",
			Input:       "2018-8-1",
			StartOnDate: 1533081600000,
			EndOnDate:   1533167999999,
		},
		{
			Name:        "Invalid date, date not exist",
			Input:       "2018-02-29",
			StartOnDate: 0,
			EndOnDate:   0,
		},
		{
			Name:        "Invalid date, not date format",
			Input:       "holiday",
			StartOnDate: 0,
			EndOnDate:   0,
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			sp := &SearchParams{OnDate: testCase.Input, TimeZoneOffset: 0}
			startOnDate, endOnDate := sp.GetOnDateMillis()
			assert.Equal(t, testCase.StartOnDate, startOnDate)
			assert.Equal(t, testCase.EndOnDate, endOnDate)
		})
	}
}

func TestGetBeforeDateMillis(t *testing.T) {
	for _, testCase := range []struct {
		Name       string
		Input      string
		BeforeDate int64
	}{
		{
			Name:       "Valid date",
			Input:      "2018-08-01",
			BeforeDate: 1533081599999,
		},
		{
			Name:       "Valid date but requires padding of zero",
			Input:      "2018-8-1",
			BeforeDate: 1533081599999,
		},
		{
			Name:       "Invalid date, date not exist",
			Input:      "2018-02-29",
			BeforeDate: 0,
		},
		{
			Name:       "Invalid date, not date format",
			Input:      "holiday",
			BeforeDate: 0,
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			sp := &SearchParams{BeforeDate: testCase.Input, TimeZoneOffset: 0}
			beforeDate := sp.GetBeforeDateMillis()
			assert.Equal(t, testCase.BeforeDate, beforeDate)
		})
	}
}

func TestGetAfterDateMillis(t *testing.T) {
	for _, testCase := range []struct {
		Name      string
		Input     string
		AfterDate int64
	}{
		{
			Name:      "Valid date",
			Input:     "2018-08-01",
			AfterDate: 1533168000000,
		},
		{
			Name:      "Valid date but requires padding of zero",
			Input:     "2018-8-1",
			AfterDate: 1533168000000,
		},
		{
			Name:      "Invalid date, date not exist",
			Input:     "2018-02-29",
			AfterDate: GetStartOfDayMillis(time.Now().Add(time.Hour*24), 0),
		},
		{
			Name:      "Invalid date, not date format",
			Input:     "holiday",
			AfterDate: GetStartOfDayMillis(time.Now().Add(time.Hour*24), 0),
		},
	} {
		t.Run(testCase.Name, func(t *testing.T) {
			sp := &SearchParams{AfterDate: testCase.Input, TimeZoneOffset: 0}
			afterDate := sp.GetAfterDateMillis()
			assert.Equal(t, testCase.AfterDate, afterDate)
		})
	}
}

func TestIsSearchParamsListValid(t *testing.T) {
	var appErr *AppError

	appErr = IsSearchParamsListValid([]*SearchParams{{IncludeDeletedChannels: true}, {IncludeDeletedChannels: true}})
	assert.Nil(t, appErr)

	appErr = IsSearchParamsListValid([]*SearchParams{{IncludeDeletedChannels: true}, {IncludeDeletedChannels: false}})
	assert.NotNil(t, appErr)

	appErr = IsSearchParamsListValid([]*SearchParams{{IncludeDeletedChannels: true}})
	assert.Nil(t, appErr)

	appErr = IsSearchParamsListValid([]*SearchParams{})
	assert.Nil(t, appErr)
}
