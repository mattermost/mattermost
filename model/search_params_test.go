// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
)

func TestParseSearchFlags(t *testing.T) {
	if words, flags := parseSearchFlags(splitWords("")); len(words) != 0 {
		t.Fatal("got words from empty input")
	} else if len(flags) != 0 {
		t.Fatal("got flags from empty input")
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

	if words, flags := parseSearchFlags(splitWords("fruit: cherry")); len(words) != 2 || words[0] != "fruit:" || words[1] != "cherry" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("channel:")); len(words) != 1 || words[0] != "channel:" {
		t.Fatalf("got incorrect words %v", words)
	} else if len(flags) != 0 {
		t.Fatalf("got incorrect flags %v", flags)
	}

	if words, flags := parseSearchFlags(splitWords("channel: first in: second from:")); len(words) != 1 || words[0] != "from:" {
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
}
