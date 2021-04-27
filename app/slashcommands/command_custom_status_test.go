// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetCustomStatus(t *testing.T) {
	for msg, expected := range map[string]model.CustomStatus{
		"":               model.CustomStatus{Emoji: DefaultCustomStatusEmoji, Text: ""},
		"Hey":            model.CustomStatus{Emoji: DefaultCustomStatusEmoji, Text: "Hey"},
		":cactus: Hurt":  model.CustomStatus{Emoji: "cactus", Text: "Hurt"},
		"👅":              model.CustomStatus{Emoji: "tongue", Text: ""},
		"👅 Eating":       model.CustomStatus{Emoji: "tongue", Text: "Eating"},
		"💪🏻 Working out": model.CustomStatus{Emoji: "muscle_light_skin_tone", Text: "Working out"},
		"👙 Swimming":     model.CustomStatus{Emoji: "bikini", Text: "Swimming"},
		"👙Swimming":      model.CustomStatus{Emoji: DefaultCustomStatusEmoji, Text: "👙Swimming"},
		"👍🏿 Okay":        model.CustomStatus{Emoji: "+1_dark_skin_tone", Text: "Okay"},
	} {
		actual := GetCustomStatus(msg)
		if actual.Emoji != expected.Emoji || actual.Text != expected.Text {
			t.Errorf("expected `%v`, got `%v`", expected, *actual)
		}
	}
}
