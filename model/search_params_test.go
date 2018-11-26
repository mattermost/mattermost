// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestSplitWords(t *testing.T) {
	if words := splitWords(""); len(words) != 0 {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("   "); len(words) != 0 {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("word"); len(words) != 1 || words[0] != "word" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("wo\"rd"); len(words) != 2 || words[0] != "wo" || words[1] != "\"rd" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("wo\"rd\""); len(words) != 2 || words[0] != "wo" || words[1] != "\"rd\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("word1 word2 word3"); len(words) != 3 || words[0] != "word1" || words[1] != "word2" || words[2] != "word3" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("word1 \"word2 word3"); len(words) != 3 || words[0] != "word1" || words[1] != "\"word2" || words[2] != "word3" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("\"word1 word2 word3"); len(words) != 3 || words[0] != "\"word1" || words[1] != "word2" || words[2] != "word3" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("word1 word2 word3\""); len(words) != 4 || words[0] != "word1" || words[1] != "word2" || words[2] != "word3" || words[3] != "\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("word1 #word2 ##word3"); len(words) != 3 || words[0] != "word1" || words[1] != "#word2" || words[2] != "##word3" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("    word1 word2     word3  "); len(words) != 3 || words[0] != "word1" || words[1] != "word2" || words[2] != "word3" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("\"quoted\""); len(words) != 1 || words[0] != "\"quoted\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("\"quoted multiple words\""); len(words) != 1 || words[0] != "\"quoted multiple words\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("some stuff \"quoted multiple words\" more stuff"); len(words) != 5 || words[0] != "some" || words[1] != "stuff" || words[2] != "\"quoted multiple words\"" || words[3] != "more" || words[4] != "stuff" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}

	if words := splitWords("some \"stuff\" \"quoted multiple words\" #some \"more stuff\""); len(words) != 5 || words[0] != "some" || words[1] != "\"stuff\"" || words[2] != "\"quoted multiple words\"" || words[3] != "#some" || words[4] != "\"more stuff\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	}
}

func TestParseSearchFlags(t *testing.T) {
	if words, flags := parseSearchFlags(splitWords("")); len(words) != 0 {
		t.Fatalf("got words from empty input")
	} else if len(flags) != 0 {
		t.Fatalf("got flags from empty input")
	}

	if words, flags := parseSearchFlags(splitWords("word")); len(words) != 1 || words[0] != "word" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana cherry")); len(words) != 3 || words[0] != "apple" || words[1] != "banana" || words[2] != "cherry" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana from:chan")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "from" || flags[0][1] != "chan" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("#apple #banana from:chan")); len(words) != 2 || words[0] != "#apple" || words[1] != "#banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "from" || flags[0][1] != "chan" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana from: chan")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "from" || flags[0][1] != "chan" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana in: chan")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "in" || flags[0][1] != "chan" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana channel:chan")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "channel" || flags[0][1] != "chan" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("fruit: cherry")); len(words) != 2 || words[0] != "fruit" || words[1] != "cherry" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("channel:")); len(words) != 1 || words[0] != "channel" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("channel: first in: second from:")); len(words) != 1 || words[0] != "from" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 2 || flags[0][0] != "channel" || flags[0][1] != "first" || flags[1][0] != "in" || flags[1][1] != "second" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("channel: first channel: second from: third from: fourth")); len(words) != 0 {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 4 || flags[0][0] != "channel" || flags[0][1] != "first" || flags[1][0] != "channel" || flags[1][1] != "second" ||
		flags[2][0] != "from" || flags[2][1] != "third" || flags[3][0] != "from" || flags[3][1] != "fourth" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("\"quoted\"")); len(words) != 1 || words[0] != "\"quoted\"" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("\"quoted multiple words\"")); len(words) != 1 || words[0] != "\"quoted multiple words\"" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("some \"stuff\" \"quoted multiple words\" some \"more stuff\"")); len(words) != 5 || words[0] != "some" || words[1] != "\"stuff\"" || words[2] != "\"quoted multiple words\"" || words[3] != "some" || words[4] != "\"more stuff\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("some in:here \"stuff\" \"quoted multiple words\" from:someone \"more stuff\"")); len(words) != 4 || words[0] != "some" || words[1] != "\"stuff\"" || words[2] != "\"quoted multiple words\"" || words[3] != "\"more stuff\"" {
		t.Fatalf("Incorrect output splitWords: %v", words)
	} else if len(flags) != 2 || flags[0][0] != "in" || flags[0][1] != "here" || flags[1][0] != "from" || flags[1][1] != "someone" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("after:2018-1-1")); len(words) != 0 {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana after:2018-1-1")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana before:2018-1-1")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "before" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana after:2018-1-1 before:2018-1-10")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 2 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" || flags[1][0] != "before" || flags[1][1] != "2018-1-10" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("#apple #banana after:2018-1-1")); len(words) != 2 || words[0] != "#apple" || words[1] != "#banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("#apple #banana before:2018-1-1")); len(words) != 2 || words[0] != "#apple" || words[1] != "#banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "before" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("#apple #banana after:2018-1-1 before:2018-1-10")); len(words) != 2 || words[0] != "#apple" || words[1] != "#banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 2 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" || flags[1][0] != "before" || flags[1][1] != "2018-1-10" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana after: 2018-1-1")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana before: 2018-1-1")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "before" || flags[0][1] != "2018-1-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana after: 2018-1-1 before: 2018-1-10")); len(words) != 2 || words[0] != "apple" || words[1] != "banana" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 2 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" || flags[1][0] != "before" || flags[1][1] != "2018-1-10" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("apple banana after: 2018-1-1 before: 2018-1-10 #fruit")); len(words) != 3 || words[0] != "apple" || words[1] != "banana" || words[2] != "#fruit" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 2 || flags[0][0] != "after" || flags[0][1] != "2018-1-1" || flags[1][0] != "before" || flags[1][1] != "2018-1-10" {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("test after:2018-7-1")); len(words) != 1 || words[0] != "test" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 1 || flags[0][0] != "after" || flags[0][1] != "2018-7-1" {
		t.Fatalf("got incorrect flags %v", flags)
	}
}

func TestParseSearchParams(t *testing.T) {
	if sp := ParseSearchParams("", 0); len(sp) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("     ", 0); len(sp) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("words words", 0); len(sp) != 1 || sp[0].Terms != "words words" || sp[0].IsHashtag || len(sp[0].InChannels) != 0 || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("\"my stuff\"", 0); len(sp) != 1 || sp[0].Terms != "\"my stuff\"" || sp[0].IsHashtag || len(sp[0].InChannels) != 0 || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("#words #words", 0); len(sp) != 1 || sp[0].Terms != "#words #words" || !sp[0].IsHashtag || len(sp[0].InChannels) != 0 || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("#words words", 0); len(sp) != 2 || sp[1].Terms != "#words" || !sp[1].IsHashtag || len(sp[1].InChannels) != 0 || len(sp[1].FromUsers) != 0 || sp[0].Terms != "words" || sp[0].IsHashtag || len(sp[0].InChannels) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("in:channel", 0); len(sp) != 1 || sp[0].Terms != "" || len(sp[0].InChannels) != 1 || sp[0].InChannels[0] != "channel" || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("testing in:channel", 0); len(sp) != 1 || sp[0].Terms != "testing" || len(sp[0].InChannels) != 1 || sp[0].InChannels[0] != "channel" || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("in:channel testing", 0); len(sp) != 1 || sp[0].Terms != "testing" || len(sp[0].InChannels) != 1 || sp[0].InChannels[0] != "channel" || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("in:channel in:otherchannel", 0); len(sp) != 1 || sp[0].Terms != "" || len(sp[0].InChannels) != 2 || sp[0].InChannels[0] != "channel" || sp[0].InChannels[1] != "otherchannel" || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("testing in:channel from:someone", 0); len(sp) != 1 || sp[0].Terms != "testing" || len(sp[0].InChannels) != 1 || sp[0].InChannels[0] != "channel" || len(sp[0].FromUsers) != 1 || sp[0].FromUsers[0] != "someone" {
		t.Fatalf("Incorrect output from parse search params: %v", sp[0])
	}

	if sp := ParseSearchParams("##hashtag +#plus+", 0); len(sp) != 1 || sp[0].Terms != "#hashtag #plus" || !sp[0].IsHashtag || len(sp[0].InChannels) != 0 || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp[0])
	}

	if sp := ParseSearchParams("wildcar*", 0); len(sp) != 1 || sp[0].Terms != "wildcar*" || sp[0].IsHashtag || len(sp[0].InChannels) != 0 || len(sp[0].FromUsers) != 0 {
		t.Fatalf("Incorrect output from parse search params: %v", sp[0])
	}

	if sp := ParseSearchParams("after:2018-8-1 testing", 0); len(sp) != 1 || sp[0].Terms != "testing" || len(sp[0].AfterDate) == 0 || sp[0].AfterDate != "2018-8-1" {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
	}

	if sp := ParseSearchParams("after:2018-8-1", 0); len(sp) != 1 || sp[0].Terms != "" || len(sp[0].AfterDate) == 0 || sp[0].AfterDate != "2018-8-1" {
		t.Fatalf("Incorrect output from parse search params: %v", sp)
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
