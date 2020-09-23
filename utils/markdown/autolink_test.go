// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseURLAutolink(t *testing.T) {
	testCases := []struct {
		Description string
		Input       string
		Position    int
		Expected    string
	}{
		{
			Description: "no link",
			Input:       "This is an :emoji:",
			Position:    11,
			Expected:    "",
		},
		{
			Description: "no link 2",
			Input:       "These are two things: apple and orange",
			Position:    20,
			Expected:    "",
		},
		{
			Description: "link with http",
			Input:       "http://example.com and some text",
			Position:    4,
			Expected:    "http://example.com",
		},
		{
			Description: "link with https",
			Input:       "https://example.com and some text",
			Position:    5,
			Expected:    "https://example.com",
		},
		{
			Description: "link with ftp",
			Input:       "ftp://example.com and some text",
			Position:    3,
			Expected:    "ftp://example.com",
		},
		{
			Description: "link with a path",
			Input:       "https://example.com/abcd and some text",
			Position:    5,
			Expected:    "https://example.com/abcd",
		},
		{
			Description: "link with parameters",
			Input:       "ftp://example.com/abcd?foo=bar and some text",
			Position:    3,
			Expected:    "ftp://example.com/abcd?foo=bar",
		},
		{
			Description: "link, not at start",
			Input:       "This is https://example.com and some text",
			Position:    13,
			Expected:    "https://example.com",
		},
		{
			Description: "link with a path, not at start",
			Input:       "This is also http://www.example.com/abcd and some text",
			Position:    17,
			Expected:    "http://www.example.com/abcd",
		},
		{
			Description: "link with parameters, not at start",
			Input:       "These are https://www.example.com/abcd?foo=bar and some text",
			Position:    15,
			Expected:    "https://www.example.com/abcd?foo=bar",
		},
		{
			Description: "link with trailing characters",
			Input:       "This is ftp://www.example.com??",
			Position:    11,
			Expected:    "ftp://www.example.com",
		},
		{
			Description: "multiple links",
			Input:       "This is https://example.com/abcd and ftp://www.example.com/1234",
			Position:    13,
			Expected:    "https://example.com/abcd",
		},
		{
			Description: "second of multiple links",
			Input:       "This is https://example.com/abcd and ftp://www.example.com/1234",
			Position:    40,
			Expected:    "ftp://www.example.com/1234",
		},
		{
			Description: "link with brackets",
			Input:       "Go to ftp://www.example.com/my/page_(disambiguation) and some text",
			Position:    9,
			Expected:    "ftp://www.example.com/my/page_(disambiguation)",
		},
		{
			Description: "link in brackets",
			Input:       "(https://www.example.com/foo/bar)",
			Position:    6,
			Expected:    "https://www.example.com/foo/bar",
		},
		{
			Description: "link in underscores",
			Input:       "_http://www.example.com_",
			Position:    5,
			Expected:    "http://www.example.com",
		},
		{
			Description: "link in asterisks",
			Input:       "This is **ftp://example.com**",
			Position:    13,
			Expected:    "ftp://example.com",
		},
		{
			Description: "link in strikethrough",
			Input:       "Those were ~~https://example.com~~",
			Position:    18,
			Expected:    "https://example.com",
		},
		{
			Description: "link with angle brackets",
			Input:       "<b>We use http://example.com</b>",
			Position:    14,
			Expected:    "http://example.com",
		},
		{
			Description: "bad link protocol",
			Input:       "://///",
			Position:    0,
			Expected:    "",
		},
		{
			Description: "position greater than input length",
			Input:       "there is no colon",
			Position:    1000,
			Expected:    "",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			rawRange, ok := parseURLAutolink(testCase.Input, testCase.Position)

			if testCase.Expected == "" {
				assert.False(t, ok)
				assert.Equal(t, Range{0, 0}, rawRange)
			} else {
				assert.True(t, ok)
				assert.Equal(t, testCase.Expected, testCase.Input[rawRange.Position:rawRange.End])
			}
		})
	}
}

func TestParseWWWAutolink(t *testing.T) {
	testCases := []struct {
		Description string
		Input       string
		Position    int
		Expected    string
	}{
		{
			Description: "no link",
			Input:       "This is some text",
			Position:    0,
			Expected:    "",
		},
		{
			Description: "link",
			Input:       "www.example.com and some text",
			Position:    0,
			Expected:    "www.example.com",
		},
		{
			Description: "link with a path",
			Input:       "www.example.com/abcd and some text",
			Position:    0,
			Expected:    "www.example.com/abcd",
		},
		{
			Description: "link with parameters",
			Input:       "www.example.com/abcd?foo=bar and some text",
			Position:    0,
			Expected:    "www.example.com/abcd?foo=bar",
		},
		{
			Description: "link, not at start",
			Input:       "This is www.example.com and some text",
			Position:    8,
			Expected:    "www.example.com",
		},
		{
			Description: "link with a path, not at start",
			Input:       "This is also www.example.com/abcd and some text",
			Position:    13,
			Expected:    "www.example.com/abcd",
		},
		{
			Description: "link with parameters, not at start",
			Input:       "These are www.example.com/abcd?foo=bar and some text",
			Position:    10,
			Expected:    "www.example.com/abcd?foo=bar",
		},
		{
			Description: "link with trailing characters",
			Input:       "This is www.example.com??",
			Position:    8,
			Expected:    "www.example.com",
		},
		{
			Description: "link after current position",
			Input:       "This is some text and www.example.com",
			Position:    0,
			Expected:    "",
		},
		{
			Description: "multiple links",
			Input:       "This is www.example.com/abcd and www.example.com/1234",
			Position:    8,
			Expected:    "www.example.com/abcd",
		},
		{
			Description: "multiple links 2",
			Input:       "This is www.example.com/abcd and www.example.com/1234",
			Position:    33,
			Expected:    "www.example.com/1234",
		},
		{
			Description: "link with brackets",
			Input:       "Go to www.example.com/my/page_(disambiguation) and some text",
			Position:    6,
			Expected:    "www.example.com/my/page_(disambiguation)",
		},
		{
			Description: "link following other letters",
			Input:       "aaawww.example.com and some text",
			Position:    3,
			Expected:    "",
		},
		{
			Description: "link in brackets",
			Input:       "(www.example.com)",
			Position:    1,
			Expected:    "www.example.com",
		},
		{
			Description: "link in underscores",
			Input:       "_www.example.com_",
			Position:    1,
			Expected:    "www.example.com",
		},
		{
			Description: "link in asterisks",
			Input:       "This is **www.example.com**",
			Position:    10,
			Expected:    "www.example.com",
		},
		{
			Description: "link in strikethrough",
			Input:       "Those were ~~www.example.com~~",
			Position:    13,
			Expected:    "www.example.com",
		},
		{
			Description: "using www1",
			Input:       "Our backup site is at www1.example.com/foo",
			Position:    22,
			Expected:    "www1.example.com/foo",
		},
		{
			Description: "link with angle brackets",
			Input:       "<b>We use www2.example.com</b>",
			Position:    10,
			Expected:    "www2.example.com",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			rawRange, ok := parseWWWAutolink(testCase.Input, testCase.Position)

			if testCase.Expected == "" {
				assert.False(t, ok)
				assert.Equal(t, Range{0, 0}, rawRange)
			} else {
				assert.True(t, ok)
				assert.Equal(t, testCase.Expected, testCase.Input[rawRange.Position:rawRange.End])
			}
		})
	}
}

func TestTrimTrailingCharactersFromLink(t *testing.T) {
	testCases := []struct {
		Input       string
		Start       int
		End         int
		ExpectedEnd int
	}{
		{
			Input:       "http://www.example.com",
			ExpectedEnd: 22,
		},
		{
			Input:       "http://www.example.com/abcd",
			ExpectedEnd: 27,
		},
		{
			Input:       "http://www.example.com/abcd/",
			ExpectedEnd: 28,
		},
		{
			Input:       "http://www.example.com/1234",
			ExpectedEnd: 27,
		},
		{
			Input:       "http://www.example.com/abcd?foo=bar",
			ExpectedEnd: 35,
		},
		{
			Input:       "http://www.example.com/abcd#heading",
			ExpectedEnd: 35,
		},
		{
			Input:       "http://www.example.com.",
			ExpectedEnd: 22,
		},
		{
			Input:       "http://www.example.com,",
			ExpectedEnd: 22,
		},
		{
			Input:       "http://www.example.com?",
			ExpectedEnd: 22,
		},
		{
			Input:       "http://www.example.com)",
			ExpectedEnd: 22,
		},
		{
			Input:       "http://www.example.com",
			ExpectedEnd: 22,
		},
		{
			Input:       "https://en.wikipedia.org/wiki/Dolphin_(disambiguation)",
			ExpectedEnd: 54,
		},
		{
			Input:       "https://en.wikipedia.org/wiki/Dolphin_(disambiguation",
			ExpectedEnd: 53,
		},
		{
			Input:       "https://en.wikipedia.org/wiki/Dolphin_(disambiguation))",
			ExpectedEnd: 54,
		},
		{
			Input:       "https://en.wikipedia.org/wiki/Dolphin_(disambiguation)_(disambiguation)",
			ExpectedEnd: 71,
		},
		{
			Input:       "https://en.wikipedia.org/wiki/Dolphin_(disambiguation_(disambiguation))",
			ExpectedEnd: 71,
		},
		{
			Input:       "http://www.example.com&quot;",
			ExpectedEnd: 22,
		},
		{
			Input:       "this is a sentence containing http://www.example.com in it",
			Start:       30,
			End:         52,
			ExpectedEnd: 52,
		},
		{
			Input:       "this is a sentence containing http://www.example.com???",
			Start:       30,
			End:         55,
			ExpectedEnd: 52,
		},
		{
			Input:       "http://google.com/å",
			ExpectedEnd: len("http://google.com/å"),
		},
		{
			Input:       "http://google.com/å...",
			ExpectedEnd: len("http://google.com/å"),
		},
		{
			Input:       "This is http://google.com/å, a link, and http://google.com/å",
			Start:       8,
			End:         len("This is http://google.com/å,"),
			ExpectedEnd: len("This is http://google.com/å"),
		},
		{
			Input:       "This is http://google.com/å, a link, and http://google.com/å",
			Start:       41,
			End:         len("This is http://google.com/å, a link, and http://google.com/å"),
			ExpectedEnd: len("This is http://google.com/å, a link, and http://google.com/å"),
		},
		{
			Input:       "This is http://google.com/å, a link, and http://google.com/å.",
			Start:       41,
			End:         len("This is http://google.com/å, a link, and http://google.com/å."),
			ExpectedEnd: len("This is http://google.com/å, a link, and http://google.com/å"),
		},
		{
			Input:       "http://🍄.ga/ http://x🍄.ga/",
			Start:       0,
			End:         len("http://🍄.ga/"),
			ExpectedEnd: len("http://🍄.ga/"),
		},
		{
			Input:       "http://🍄.ga/ http://x🍄.ga/",
			Start:       len("http://🍄.ga/ "),
			End:         len("http://🍄.ga/ http://x🍄.ga/"),
			ExpectedEnd: len("http://🍄.ga/ http://x🍄.ga/"),
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Input, func(t *testing.T) {
			if testCase.End == 0 {
				testCase.End = len(testCase.Input) - testCase.Start
			}

			assert.Equal(t, testCase.ExpectedEnd, trimTrailingCharactersFromLink(testCase.Input, testCase.Start, testCase.End))
		})
	}
}

func TestAutolinking(t *testing.T) {
	// These tests are adapted from https://github.com/mattermost/commonmark.js/test/mattermost.txt.
	// It is missing tests for:
	// 1. Links surrounded by emphasis (emphasis not implemented on the server)
	// 2. IPv6 addresses (not implemented on the server or by GitHub)
	// 3. Custom URL schemes (not implemented)

	for name, tc := range map[string]struct {
		Markdown     string
		ExpectedHTML string
	}{
		"valid-link-1": {
			Markdown:     `http://example.com`,
			ExpectedHTML: `<p><a href="http://example.com">http://example.com</a></p>`,
		},
		"valid-link-2": {
			Markdown:     `https://example.com`,
			ExpectedHTML: `<p><a href="https://example.com">https://example.com</a></p>`,
		},
		"valid-link-3": {
			Markdown:     `ftp://example.com`,
			ExpectedHTML: `<p><a href="ftp://example.com">ftp://example.com</a></p>`,
		},
		// "valid-link-4": {
		// 	Markdown:     `ts3server://example.com?port=9000`,
		// 	ExpectedHTML: `<p><a href="ts3server://example.com?port=9000">ts3server://example.com?port=9000</a></p>`,
		// },
		"valid-link-5": {
			Markdown:     `www.example.com`,
			ExpectedHTML: `<p><a href="http://www.example.com">www.example.com</a></p>`,
		},
		"valid-link-6": {
			Markdown:     `www.example.com/index`,
			ExpectedHTML: `<p><a href="http://www.example.com/index">www.example.com/index</a></p>`,
		},
		"valid-link-7": {
			Markdown:     `www.example.com/index.html`,
			ExpectedHTML: `<p><a href="http://www.example.com/index.html">www.example.com/index.html</a></p>`,
		},
		"valid-link-8": {
			Markdown:     `http://example.com/index/sub`,
			ExpectedHTML: `<p><a href="http://example.com/index/sub">http://example.com/index/sub</a></p>`,
		},
		"valid-link-9": {
			Markdown:     `www1.example.com`,
			ExpectedHTML: `<p><a href="http://www1.example.com">www1.example.com</a></p>`,
		},
		"valid-link-10": {
			Markdown:     `https://en.wikipedia.org/wiki/URLs#Syntax`,
			ExpectedHTML: `<p><a href="https://en.wikipedia.org/wiki/URLs#Syntax">https://en.wikipedia.org/wiki/URLs#Syntax</a></p>`,
		},
		"valid-link-11": {
			Markdown:     `https://groups.google.com/forum/#!msg`,
			ExpectedHTML: `<p><a href="https://groups.google.com/forum/#!msg">https://groups.google.com/forum/#!msg</a></p>`,
		},
		"valid-link-12": {
			Markdown:     `www.example.com/index?params=1`,
			ExpectedHTML: `<p><a href="http://www.example.com/index?params=1">www.example.com/index?params=1</a></p>`,
		},
		"valid-link-13": {
			Markdown:     `www.example.com/index?params=1&other=2`,
			ExpectedHTML: `<p><a href="http://www.example.com/index?params=1&amp;other=2">www.example.com/index?params=1&amp;other=2</a></p>`,
		},
		"valid-link-14": {
			Markdown:     `www.example.com/index?params=1;other=2`,
			ExpectedHTML: `<p><a href="http://www.example.com/index?params=1;other=2">www.example.com/index?params=1;other=2</a></p>`,
		},
		"valid-link-15": {
			Markdown:     `http://www.example.com/_/page`,
			ExpectedHTML: `<p><a href="http://www.example.com/_/page">http://www.example.com/_/page</a></p>`,
		},
		"valid-link-16": {
			Markdown:     `https://en.wikipedia.org/wiki/🐬`,
			ExpectedHTML: `<p><a href="https://en.wikipedia.org/wiki/%F0%9F%90%AC">https://en.wikipedia.org/wiki/🐬</a></p>`,
		},
		"valid-link-17": {
			Markdown:     `http://✪df.ws/1234`,
			ExpectedHTML: `<p><a href="http://%E2%9C%AAdf.ws/1234">http://✪df.ws/1234</a></p>`,
		},
		"valid-link-18": {
			Markdown:     `https://groups.google.com/forum/#!msg`,
			ExpectedHTML: `<p><a href="https://groups.google.com/forum/#!msg">https://groups.google.com/forum/#!msg</a></p>`,
		},
		"valid-link-19": {
			Markdown:     `https://пример.срб/пример-26/`,
			ExpectedHTML: `<p><a href="https://%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80.%D1%81%D1%80%D0%B1/%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80-26/">https://пример.срб/пример-26/</a></p>`,
		},
		"valid-link-20": {
			Markdown:     `mailto://test@example.com`,
			ExpectedHTML: `<p><a href="mailto://test@example.com">mailto://test@example.com</a></p>`,
		},
		"valid-link-21": {
			Markdown:     `tel://555-123-4567`,
			ExpectedHTML: `<p><a href="tel://555-123-4567">tel://555-123-4567</a></p>`,
		},

		"ip-address-1": {
			Markdown:     `http://127.0.0.1`,
			ExpectedHTML: `<p><a href="http://127.0.0.1">http://127.0.0.1</a></p>`,
		},
		"ip-address-2": {
			Markdown:     `http://192.168.1.1:4040`,
			ExpectedHTML: `<p><a href="http://192.168.1.1:4040">http://192.168.1.1:4040</a></p>`,
		},
		"ip-address-3": {
			Markdown:     `http://username:password@127.0.0.1`,
			ExpectedHTML: `<p><a href="http://username:password@127.0.0.1">http://username:password@127.0.0.1</a></p>`,
		},
		"ip-address-4": {
			Markdown:     `http://username:password@[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80`,
			ExpectedHTML: `<p><a href="http://username:password@%5B2001:0:5ef5:79fb:303a:62d5:3312:ff42%5D:80">http://username:password@[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80</a></p>`,
		},

		"link-with-brackets-1": {
			Markdown:     `https://en.wikipedia.org/wiki/Rendering_(computer_graphics)`,
			ExpectedHTML: `<p><a href="https://en.wikipedia.org/wiki/Rendering_(computer_graphics)">https://en.wikipedia.org/wiki/Rendering_(computer_graphics)</a></p>`,
		},
		"link-with-brackets-2": {
			Markdown:     `http://example.com/more_(than)_one_(parens)`,
			ExpectedHTML: `<p><a href="http://example.com/more_(than)_one_(parens)">http://example.com/more_(than)_one_(parens)</a></p>`,
		},
		"link-with-brackets-3": {
			Markdown:     `http://example.com/(something)?after=parens`,
			ExpectedHTML: `<p><a href="http://example.com/(something)?after=parens">http://example.com/(something)?after=parens</a></p>`,
		},
		"link-with-brackets-4": {
			Markdown:     `http://foo.com/unicode_(✪)_in_parens`,
			ExpectedHTML: `<p><a href="http://foo.com/unicode_(%E2%9C%AA)_in_parens">http://foo.com/unicode_(✪)_in_parens</a></p>`,
		},

		"inside-another-link-1": {
			Markdown:     `[www.example.com](https://example.com)`,
			ExpectedHTML: `<p><a href="https://example.com">www.example.com</a></p>`,
		},
		"inside-another-link-2": {
			Markdown:     `[http://www.example.com](https://example.com)`,
			ExpectedHTML: `<p><a href="https://example.com">http://www.example.com</a></p>`,
		},

		"link-in-sentence-1": {
			Markdown:     `(http://example.com)`,
			ExpectedHTML: `<p>(<a href="http://example.com">http://example.com</a>)</p>`,
		},
		"link-in-sentence-2": {
			Markdown:     `(see http://example.com)`,
			ExpectedHTML: `<p>(see <a href="http://example.com">http://example.com</a>)</p>`,
		},
		"link-in-sentence-3": {
			Markdown:     `(http://example.com watch this)`,
			ExpectedHTML: `<p>(<a href="http://example.com">http://example.com</a> watch this)</p>`,
		},
		"link-in-sentence-4": {
			Markdown:     `This is a sentence with a http://example.com in it.`,
			ExpectedHTML: `<p>This is a sentence with a <a href="http://example.com">http://example.com</a> in it.</p>`,
		},
		"link-in-sentence-5": {
			Markdown:     `This is a sentence with a [link](http://example.com) in it.`,
			ExpectedHTML: `<p>This is a sentence with a <a href="http://example.com">link</a> in it.</p>`,
		},
		"link-in-sentence-6": {
			Markdown:     `This is a sentence with a http://example.com/_/underscore in it.`,
			ExpectedHTML: `<p>This is a sentence with a <a href="http://example.com/_/underscore">http://example.com/_/underscore</a> in it.</p>`,
		},
		"link-in-sentence-7": {
			Markdown:     `This is a sentence with a link (http://example.com) in it.`,
			ExpectedHTML: `<p>This is a sentence with a link (<a href="http://example.com">http://example.com</a>) in it.</p>`,
		},
		"link-in-sentence-8": {
			Markdown:     `This is a sentence with a (https://en.wikipedia.org/wiki/Rendering_(computer_graphics)) in it.`,
			ExpectedHTML: `<p>This is a sentence with a (<a href="https://en.wikipedia.org/wiki/Rendering_(computer_graphics)">https://en.wikipedia.org/wiki/Rendering_(computer_graphics)</a>) in it.</p>`,
		},
		"link-in-sentence-9": {
			Markdown:     `This is a sentence with a http://192.168.1.1:4040 in it.`,
			ExpectedHTML: `<p>This is a sentence with a <a href="http://192.168.1.1:4040">http://192.168.1.1:4040</a> in it.</p>`,
		},
		"link-in-sentence-10": {
			Markdown:     `This is a link to http://example.com.`,
			ExpectedHTML: `<p>This is a link to <a href="http://example.com">http://example.com</a>.</p>`,
		},
		"link-in-sentence-11": {
			Markdown:     `This is a link to http://example.com*`,
			ExpectedHTML: `<p>This is a link to <a href="http://example.com">http://example.com</a>*</p>`,
		},
		"link-in-sentence-12": {
			Markdown:     `This is a link to http://example.com_`,
			ExpectedHTML: `<p>This is a link to <a href="http://example.com">http://example.com</a>_</p>`,
		},
		"link-in-sentence-13": {
			Markdown:     `This is a link containing http://example.com/something?with,commas,in,url, but not at the end`,
			ExpectedHTML: `<p>This is a link containing <a href="http://example.com/something?with,commas,in,url">http://example.com/something?with,commas,in,url</a>, but not at the end</p>`,
		},
		"link-in-sentence-14": {
			Markdown:     `This is a question about a link http://example.com?`,
			ExpectedHTML: `<p>This is a question about a link <a href="http://example.com">http://example.com</a>?</p>`,
		},

		"plt-7250-link-with-trailing-periods-1": {
			Markdown:     `http://example.com.`,
			ExpectedHTML: `<p><a href="http://example.com">http://example.com</a>.</p>`,
		},
		"plt-7250-link-with-trailing-periods-2": {
			Markdown:     `http://example.com...`,
			ExpectedHTML: `<p><a href="http://example.com">http://example.com</a>...</p>`,
		},
		"plt-7250-link-with-trailing-periods-3": {
			Markdown:     `http://example.com/foo.`,
			ExpectedHTML: `<p><a href="http://example.com/foo">http://example.com/foo</a>.</p>`,
		},
		"plt-7250-link-with-trailing-periods-4": {
			Markdown:     `http://example.com/foo...`,
			ExpectedHTML: `<p><a href="http://example.com/foo">http://example.com/foo</a>...</p>`,
		},
		"plt-7250-link-with-trailing-periods-5": {
			Markdown:     `http://example.com/foo.bar`,
			ExpectedHTML: `<p><a href="http://example.com/foo.bar">http://example.com/foo.bar</a></p>`,
		},
		"plt-7250-link-with-trailing-periods-6": {
			Markdown:     `http://example.com/foo...bar`,
			ExpectedHTML: `<p><a href="http://example.com/foo...bar">http://example.com/foo...bar</a></p>`,
		},

		"rn-319-www-link-as-part-of-word-1": {
			Markdown:     `testwww.example.com`,
			ExpectedHTML: `<p>testwww.example.com</p>`,
		},

		"mm-10180-link-containing-period-followed-by-non-letter-1": {
			Markdown:     `https://example.com/123.+Pagetitle`,
			ExpectedHTML: `<p><a href="https://example.com/123.+Pagetitle">https://example.com/123.+Pagetitle</a></p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-2": {
			Markdown:     `https://example.com/123.?Pagetitle`,
			ExpectedHTML: `<p><a href="https://example.com/123.?Pagetitle">https://example.com/123.?Pagetitle</a></p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-3": {
			Markdown:     `https://example.com/123.-Pagetitle`,
			ExpectedHTML: `<p><a href="https://example.com/123.-Pagetitle">https://example.com/123.-Pagetitle</a></p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-4": {
			Markdown:     `https://example.com/123._Pagetitle`,
			ExpectedHTML: `<p><a href="https://example.com/123._Pagetitle">https://example.com/123._Pagetitle</a></p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-5": {
			Markdown:     `https://example.com/123.+`,
			ExpectedHTML: `<p><a href="https://example.com/123.+">https://example.com/123.+</a></p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-6": {
			Markdown:     `https://example.com/123.?`,
			ExpectedHTML: `<p><a href="https://example.com/123">https://example.com/123</a>.?</p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-7": {
			Markdown:     `https://example.com/123.-`,
			ExpectedHTML: `<p><a href="https://example.com/123.-">https://example.com/123.-</a></p>`,
		},
		"mm-10180-link-containing-period-followed-by-non-letter-8": {
			Markdown:     `https://example.com/123._`,
			ExpectedHTML: `<p><a href="https://example.com/123">https://example.com/123</a>._</p>`,
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.ExpectedHTML, RenderHTML(tc.Markdown))
		})
	}
}
