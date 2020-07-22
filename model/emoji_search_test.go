// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEmojiSearchJson(t *testing.T) {
	emojiSearch := EmojiSearch{Term: NewId()}
	json := emojiSearch.ToJson()
	remojiSearch := EmojiSearchFromJson(strings.NewReader(json))

	require.Equal(t, emojiSearch.Term, remojiSearch.Term, "Terms do not match")
}
