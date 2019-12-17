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
	words := splitWords("")
	require.Empty(t, words)

	words = splitWords("   ")
	require.Empty(t, words)

	words = splitWords("word")
	require.Len(t, words, 1)
	require.Equal(t, "word", words[0])

	words = splitWords("wo\"rd")
	require.Len(t, words, 2)
	require.Equal(t, "wo", words[0])
	require.Equal(t, "\"rd", words[1])

	words = splitWords("wo\"rd\"")
	require.Len(t, words, 2)
	require.Equal(t, "wo", words[0])
	require.Equal(t, "\"rd\"", words[1])

	words = splitWords("wo-\"rd\"")
	require.Len(t, words, 2)
	require.Equal(t, "wo", words[0])
	require.Equal(t, "-\"rd\"", words[1])

	words = splitWords("word1 word2 word3")
	require.Len(t, words, 3)
	require.Equal(t, "word1", words[0])
	require.Equal(t, "word2", words[1])
	require.Equal(t, "word3", words[2])

	words = splitWords("word1 \"word2 word3")
	require.Len(t, words, 3)
	require.Equal(t, "word1", words[0])
	require.Equal(t, "\"word2", words[1])
	require.Equal(t, "word3", words[2])

	words = splitWords("\"word1 word2 word3")
	require.Len(t, words, 3)
	require.Equal(t, "\"word1", words[0])
	require.Equal(t, "word2", words[1])
	require.Equal(t, "word3", words[2])

	words = splitWords("word1 word2 word3\"")
	require.Len(t, words, 4)
	require.Equal(t, "word1", words[0])
	require.Equal(t, "word2", words[1])
	require.Equal(t, "word3", words[2])
	require.Equal(t, "\"", words[3])

	words = splitWords("word1 #word2 ##word3")
	require.Len(t, words, 3)
	require.Equal(t, "word1", words[0])
	require.Equal(t, "#word2", words[1])
	require.Equal(t, "##word3", words[2])

	words = splitWords("    word1 word2     word3  ")
	require.Len(t, words, 3)
	require.Equal(t, "word1", words[0])
	require.Equal(t, "word2", words[1])
	require.Equal(t, "word3", words[2])

	words = splitWords("\"quoted\"")
	require.Len(t, words, 1)
	require.Equal(t, "\"quoted\"", words[0])

	words = splitWords("-\"quoted\"")
	require.Len(t, words, 1)
	require.Equal(t, "-\"quoted\"", words[0])

	words = splitWords("\"quoted multiple words\"")
	require.Len(t, words, 1)
	require.Equal(t, "\"quoted multiple words\"", words[0])

	words = splitWords("some stuff \"quoted multiple words\" more stuff")
	require.Len(t, words, 5)
	require.Equal(t, "some", words[0])
	require.Equal(t, "stuff", words[1])
	require.Equal(t, "\"quoted multiple words\"", words[2])
	require.Equal(t, "more", words[3])
	require.Equal(t, "stuff", words[4])

	words = splitWords("some stuff -\"quoted multiple words\" more stuff")
	require.Len(t, words, 5)
	require.Equal(t, "some", words[0])
	require.Equal(t, "stuff", words[1])
	require.Equal(t, "-\"quoted multiple words\"", words[2])
	require.Equal(t, "more", words[3])
	require.Equal(t, "stuff", words[4])

	words = splitWords("some \"stuff\" \"quoted multiple words\" #some \"more stuff\"")
	require.Len(t, words, 5)
	require.Equal(t, "some", words[0])
	require.Equal(t, "\"stuff\"", words[1])
	require.Equal(t, "\"quoted multiple words\"", words[2])
	require.Equal(t, "#some", words[3])
	require.Equal(t, "\"more stuff\"", words[4])
}

func TestParseSearchFlags(t *testing.T) {
	words, flags := parseSearchFlags(splitWords(""))
	require.Empty(t, words)
	require.Equal(t, 0, len(flags))

	words, flags = parseSearchFlags(splitWords("word"))
	require.Len(t, words, 1)
	require.Equal(t, "word", words[0].value)
	require.False(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("-word"))
	require.Len(t, words, 1)
	require.Equal(t, "word", words[0].value)
	require.True(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("apple banana cherry"))
	require.Len(t, words, 3)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Equal(t, "cherry", words[2].value)
	require.False(t, words[2].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("-apple -banana -cherry"))
	require.Len(t, words, 3)
	require.Equal(t, "apple", words[0].value)
	require.True(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.True(t, words[1].exclude)
	require.Equal(t, "cherry", words[2].value)
	require.True(t, words[2].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("apple -banana cherry"))
	require.Len(t, words, 3)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.True(t, words[1].exclude)
	require.Equal(t, "cherry", words[2].value)
	require.False(t, words[2].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("apple banana from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple -banana from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.True(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("-apple -banana from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.True(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.True(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("#apple #banana from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("-#apple #banana from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.True(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("#apple #banana -from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.True(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("-#apple -#banana -from:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.True(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.True(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.True(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana from: chan"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "from", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana in: chan"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "in", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana channel:chan"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "chan", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("fruit: cherry"))
	require.Len(t, words, 2)
	require.Equal(t, "fruit", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "cherry", words[1].value)
	require.False(t, words[1].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("channel:"))
	require.Len(t, words, 1)
	require.Equal(t, "channel", words[0].value)
	require.False(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("channel:first"))
	require.Empty(t, words)
	require.Len(t, flags, 1)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "first", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("-channel:first"))
	require.Empty(t, words)
	require.Len(t, flags, 1)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "first", flags[0].value)
	require.True(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("channel: first in: second from:"))
	require.Len(t, words, 1)
	require.Equal(t, "from", words[0].value)
	require.False(t, words[0].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "first", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "in", flags[1].name)
	require.Equal(t, "second", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("channel: first -in: second from:"))
	require.Len(t, words, 1)
	require.Equal(t, "from", words[0].value)
	require.False(t, words[0].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "first", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "in", flags[1].name)
	require.Equal(t, "second", flags[1].value)
	require.True(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("-channel: first in: second from:"))
	require.Len(t, words, 1)
	require.Equal(t, "from", words[0].value)
	require.False(t, words[0].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "first", flags[0].value)
	require.True(t, flags[0].exclude)
	require.Equal(t, "in", flags[1].name)
	require.Equal(t, "second", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("channel: first channel: second from: third from: fourth"))
	require.Empty(t, words)
	require.Len(t, flags, 4)
	require.Equal(t, "channel", flags[0].name)
	require.Equal(t, "first", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "channel", flags[1].name)
	require.Equal(t, "second", flags[1].value)
	require.False(t, flags[1].exclude)
	require.Equal(t, "from", flags[2].name)
	require.Equal(t, "third", flags[2].value)
	require.False(t, flags[2].exclude)
	require.Equal(t, "from", flags[3].name)
	require.Equal(t, "fourth", flags[3].value)
	require.False(t, flags[3].exclude)

	words, flags = parseSearchFlags(splitWords("\"quoted\""))
	require.Len(t, words, 1)
	require.Equal(t, "\"quoted\"", words[0].value)
	require.False(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("\"-quoted\""))
	require.Len(t, words, 1)
	require.Equal(t, "\"-quoted\"", words[0].value)
	require.False(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("-\"quoted\""))
	require.Len(t, words, 1)
	require.Equal(t, "\"quoted\"", words[0].value)
	require.True(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("\"quoted multiple words\""))
	require.Len(t, words, 1)
	require.Equal(t, "\"quoted multiple words\"", words[0].value)
	require.False(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("\"quoted -multiple words\""))
	require.Len(t, words, 1)
	require.Equal(t, "\"quoted -multiple words\"", words[0].value)
	require.False(t, words[0].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("some \"stuff\" \"quoted multiple words\" some \"more stuff\""))
	require.Len(t, words, 5)
	require.Equal(t, "some", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "\"stuff\"", words[1].value)
	require.False(t, words[1].exclude)
	require.Equal(t, "\"quoted multiple words\"", words[2].value)
	require.False(t, words[2].exclude)
	require.Equal(t, "some", words[3].value)
	require.False(t, words[3].exclude)
	require.Equal(t, "\"more stuff\"", words[4].value)
	require.False(t, words[4].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("some -\"stuff\" \"quoted multiple words\" some -\"more stuff\""))
	require.Len(t, words, 5)
	require.Equal(t, "some", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "\"stuff\"", words[1].value)
	require.True(t, words[1].exclude)
	require.Equal(t, "\"quoted multiple words\"", words[2].value)
	require.False(t, words[2].exclude)
	require.Equal(t, "some", words[3].value)
	require.False(t, words[3].exclude)
	require.Equal(t, "\"more stuff\"", words[4].value)
	require.True(t, words[4].exclude)
	require.Empty(t, flags)

	words, flags = parseSearchFlags(splitWords("some in:here \"stuff\" \"quoted multiple words\" from:someone \"more stuff\""))
	require.Len(t, words, 4)
	require.Equal(t, "some", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "\"stuff\"", words[1].value)
	require.False(t, words[1].exclude)
	require.Equal(t, "\"quoted multiple words\"", words[2].value)
	require.False(t, words[2].exclude)
	require.Equal(t, "\"more stuff\"", words[3].value)
	require.False(t, words[3].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "in", flags[0].name)
	require.Equal(t, "here", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "from", flags[1].name)
	require.Equal(t, "someone", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("after:2018-1-1"))
	require.Empty(t, words)
	require.Len(t, flags, 1)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("-after:2018-1-1"))
	require.Empty(t, words)
	require.Len(t, flags, 1)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.True(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana after:2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana before:2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "before", flags[0].name)
	require.False(t, flags[0].exclude)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana -before:2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "before", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.True(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana after:2018-1-1 before:2018-1-10"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "before", flags[1].name)
	require.Equal(t, "2018-1-10", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana -after:2018-1-1 -before:2018-1-10"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.True(t, flags[0].exclude)
	require.Equal(t, "before", flags[1].name)
	require.Equal(t, "2018-1-10", flags[1].value)
	require.True(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("#apple #banana after:2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("#apple #banana before:2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "before", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("#apple #banana after:2018-1-1 before:2018-1-10"))
	require.Len(t, words, 2)
	require.Equal(t, "#apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "#banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "before", flags[1].name)
	require.Equal(t, "2018-1-10", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana after: 2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana before: 2018-1-1"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "before", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana after: 2018-1-1 before: 2018-1-10"))
	require.Len(t, words, 2)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "before", flags[1].name)
	require.Equal(t, "2018-1-10", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("apple banana after: 2018-1-1 before: 2018-1-10 #fruit"))
	require.Len(t, words, 3)
	require.Equal(t, "apple", words[0].value)
	require.False(t, words[0].exclude)
	require.Equal(t, "banana", words[1].value)
	require.False(t, words[1].exclude)
	require.Equal(t, "#fruit", words[2].value)
	require.False(t, words[2].exclude)
	require.Len(t, flags, 2)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-1-1", flags[0].value)
	require.False(t, flags[0].exclude)
	require.Equal(t, "before", flags[1].name)
	require.Equal(t, "2018-1-10", flags[1].value)
	require.False(t, flags[1].exclude)

	words, flags = parseSearchFlags(splitWords("test after:2018-7-1"))
	require.Len(t, words, 1)
	require.Equal(t, "test", words[0].value)
	require.False(t, words[0].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "after", flags[0].name)
	require.Equal(t, "2018-7-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("test on:2018-7-1"))
	require.Len(t, words, 1)
	require.Equal(t, "test", words[0].value)
	require.False(t, words[0].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "on", flags[0].name)
	require.Equal(t, "2018-7-1", flags[0].value)
	require.False(t, flags[0].exclude)

	words, flags = parseSearchFlags(splitWords("-on:2018-7-1 test"))
	require.Len(t, words, 1)
	require.Equal(t, "test", words[0].value)
	require.False(t, words[0].exclude)
	require.Len(t, flags, 1)
	require.Equal(t, "on", flags[0].name)
	require.Equal(t, "2018-7-1", flags[0].value)
	require.True(t, flags[0].exclude)
}

func TestParseSearchParams(t *testing.T) {
	sp := ParseSearchParams("", 0)
	require.Empty(t, sp)

	sp = ParseSearchParams("     ", 0)
	require.Empty(t, sp)

	sp = ParseSearchParams("words words", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "words words", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("word1 -word2", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "word1", sp[0].Terms)
	require.Equal(t, "word2", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("-word1 -word2", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "word1 word2", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("\"my stuff\"", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "\"my stuff\"", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("-\"my stuff\"", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "\"my stuff\"", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("#words #words", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "#words #words", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.True(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("#words words", 0)
	require.Len(t, sp, 2)
	require.Equal(t, "words", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Equal(t, "#words", sp[1].Terms)
	require.Equal(t, "", sp[1].ExcludedTerms)
	require.True(t, sp[1].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)
	require.Empty(t, sp[1].InChannels)
	require.Empty(t, sp[1].ExcludedChannels)
	require.Empty(t, sp[1].FromUsers)
	require.Empty(t, sp[1].ExcludedUsers)

	sp = ParseSearchParams("-#hashtag", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "#hashtag", sp[0].ExcludedTerms)
	require.True(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("-#hashtag1 -#hashtag2", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "#hashtag1 #hashtag2", sp[0].ExcludedTerms)
	require.True(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("#hashtag1 -#hashtag2", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "#hashtag1", sp[0].Terms)
	require.Equal(t, "#hashtag2", sp[0].ExcludedTerms)
	require.True(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("word1 #hashtag1 -#hashtag2 -word2", 0)
	require.Len(t, sp, 2)
	require.Equal(t, "word1", sp[0].Terms)
	require.Equal(t, "word2", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Equal(t, "#hashtag1", sp[1].Terms)
	require.Equal(t, "#hashtag2", sp[1].ExcludedTerms)
	require.True(t, sp[1].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)
	require.Empty(t, sp[1].InChannels)
	require.Empty(t, sp[1].ExcludedChannels)
	require.Empty(t, sp[1].FromUsers)
	require.Empty(t, sp[1].ExcludedUsers)

	sp = ParseSearchParams("in:channel", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("-in:channel", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Len(t, sp[0].ExcludedChannels, 1)
	require.Equal(t, "channel", sp[0].ExcludedChannels[0])
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("in: channel", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("testing in:channel", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("testing -in:channel", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Len(t, sp[0].ExcludedChannels, 1)
	require.Equal(t, "channel", sp[0].ExcludedChannels[0])
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("in:channel testing", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("in:channel in:otherchannel", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 2)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Equal(t, "otherchannel", sp[0].InChannels[1])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("testing in:channel from:someone", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Len(t, sp[0].FromUsers, 1)
	require.Equal(t, "someone", sp[0].FromUsers[0])
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("testing in:channel -from:someone", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Len(t, sp[0].ExcludedUsers, 1)
	require.Equal(t, "someone", sp[0].ExcludedUsers[0])

	sp = ParseSearchParams("testing in:channel from:someone -from:someoneelse", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Len(t, sp[0].InChannels, 1)
	require.Equal(t, "channel", sp[0].InChannels[0])
	require.Empty(t, sp[0].ExcludedChannels)
	require.Len(t, sp[0].FromUsers, 1)
	require.Equal(t, "someone", sp[0].FromUsers[0])
	require.Len(t, sp[0].ExcludedUsers, 1)
	require.Equal(t, "someoneelse", sp[0].ExcludedUsers[0])

	sp = ParseSearchParams("##hashtag +#plus+", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "#hashtag #plus", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.True(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("wildcar*", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "wildcar*", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.False(t, sp[0].IsHashtag)
	require.Empty(t, sp[0].InChannels)
	require.Empty(t, sp[0].ExcludedChannels)
	require.Empty(t, sp[0].FromUsers)
	require.Empty(t, sp[0].ExcludedUsers)

	sp = ParseSearchParams("after:2018-8-1 testing", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "2018-8-1", sp[0].AfterDate)
	require.Equal(t, "", sp[0].ExcludedAfterDate)

	sp = ParseSearchParams("-after:2018-8-1 testing", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "", sp[0].AfterDate)
	require.Equal(t, "2018-8-1", sp[0].ExcludedAfterDate)

	sp = ParseSearchParams("on:2018-8-1 testing", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "2018-8-1", sp[0].OnDate)
	require.Equal(t, "", sp[0].ExcludedDate)

	sp = ParseSearchParams("-on:2018-8-1 testing", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "testing", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "", sp[0].OnDate)
	require.Equal(t, "2018-8-1", sp[0].ExcludedDate)

	sp = ParseSearchParams("after:2018-8-1", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "2018-8-1", sp[0].AfterDate)
	require.Equal(t, "", sp[0].ExcludedAfterDate)

	sp = ParseSearchParams("before:2018-8-1", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "2018-8-1", sp[0].BeforeDate)
	require.Equal(t, "", sp[0].ExcludedBeforeDate)

	sp = ParseSearchParams("-before:2018-8-1", 0)
	require.Len(t, sp, 1)
	require.Equal(t, "", sp[0].Terms)
	require.Equal(t, "", sp[0].ExcludedTerms)
	require.Equal(t, "2018-8-1", sp[0].ExcludedBeforeDate)
	require.Equal(t, "", sp[0].BeforeDate)
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
