// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestReactionIsValid(t *testing.T) {
	reaction := Reaction{
		UserId:    NewId(),
		PostId:    NewId(),
		EmojiName: "emoji",
		CreateAt:  GetMillis(),
	}

	if err := reaction.IsValid(); err != nil {
		t.Fatal(err)
	}

	reaction.UserId = ""
	if err := reaction.IsValid(); err == nil {
		t.Fatal("user id should be invalid")
	}

	reaction.UserId = "1234garbage"
	if err := reaction.IsValid(); err == nil {
		t.Fatal("user id should be invalid")
	}

	reaction.UserId = NewId()
	reaction.PostId = ""
	if err := reaction.IsValid(); err == nil {
		t.Fatal("post id should be invalid")
	}

	reaction.PostId = "1234garbage"
	if err := reaction.IsValid(); err == nil {
		t.Fatal("post id should be invalid")
	}

	reaction.PostId = NewId()
	reaction.EmojiName = strings.Repeat("a", 64)
	if err := reaction.IsValid(); err != nil {
		t.Fatal(err)
	}

	reaction.EmojiName = "emoji-"
	if err := reaction.IsValid(); err != nil {
		t.Fatal(err)
	}

	reaction.EmojiName = "emoji_"
	if err := reaction.IsValid(); err != nil {
		t.Fatal(err)
	}

	reaction.EmojiName = "+1"
	if err := reaction.IsValid(); err != nil {
		t.Fatal(err)
	}

	reaction.EmojiName = "emoji:"
	if err := reaction.IsValid(); err == nil {
		t.Fatal(err)
	}

	reaction.EmojiName = ""
	if err := reaction.IsValid(); err == nil {
		t.Fatal("emoji name should be invalid")
	}

	reaction.EmojiName = strings.Repeat("a", 65)
	if err := reaction.IsValid(); err == nil {
		t.Fatal("emoji name should be invalid")
	}

	reaction.CreateAt = 0
	if err := reaction.IsValid(); err == nil {
		t.Fatal("create at should be invalid")
	}
}

func TestCountReactions(t *testing.T) {
	userId := NewId()
	userId2 := NewId()

	reactions := []*Reaction{
		{
			UserId:    userId,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			EmojiName: "frowning",
		},
		{
			UserId:    userId2,
			EmojiName: "smile",
		},
		{
			UserId:    userId2,
			EmojiName: "neutral_face",
		},
	}

	reactionCounts := CountReactions(reactions)
	if len(reactionCounts) != 3 {
		t.Fatal("should've received counts for 3 reactions")
	} else if reactionCounts["smile"] != 2 {
		t.Fatal("should've received 2 smile reactions")
	} else if reactionCounts["frowning"] != 1 {
		t.Fatal("should've received 1 frowning reaction")
	} else if reactionCounts["neutral_face"] != 1 {
		t.Fatal("should've received 2 neutral_face reaction")
	}
}
