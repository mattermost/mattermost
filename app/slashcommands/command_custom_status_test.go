// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetCustomStatus(t *testing.T) {
	for msg, expected := range map[string]model.CustomStatus{
		"":                         {Emoji: DefaultCustomStatusEmoji, Text: ""},
		"Hey":                      {Emoji: DefaultCustomStatusEmoji, Text: "Hey"},
		":cactus: Hurt":            {Emoji: "cactus", Text: "Hurt"},
		"👅":                        {Emoji: "tongue", Text: ""},
		"👅 Eating":                 {Emoji: "tongue", Text: "Eating"},
		"💪🏻 Working out":           {Emoji: "muscle", Text: "Working out"},
		"👙 Swimming":               {Emoji: "bikini", Text: "Swimming"},
		"👙Swimming":                {Emoji: DefaultCustomStatusEmoji, Text: "👙Swimming"},
		"👍🏿 Okay":                  {Emoji: "+1", Text: "Okay"},
		"🤴🏾 Dark king":             {Emoji: "prince", Text: "Dark king"},
		"⛹🏾‍♀️ Playing basketball": {Emoji: "basketball_woman", Text: "Playing basketball"},
		"🏋🏿‍♀️ Weightlifting":      {Emoji: "weight_lifting_woman", Text: "Weightlifting"},
		"🏄 Surfing":                {Emoji: "surfer", Text: "Surfing"},
		"👨‍👨‍👦‍👦 Family":           {Emoji: "family_man_man_boy_boy", Text: "Family"},
	} {
		actual := GetCustomStatus(msg)
		if actual.Emoji != expected.Emoji || actual.Text != expected.Text {
			t.Errorf("expected `%v`, got `%v`", expected, *actual)
		}
	}
}
