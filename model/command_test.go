// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestCommandJson(t *testing.T) {

	command := &Command{Command: NewId(), Suggest: true}
	command.AddSuggestion(&SuggestCommand{Suggestion: NewId()})
	json := command.ToJson()
	result := CommandFromJson(strings.NewReader(json))

	if command.Command != result.Command {
		t.Fatal("Ids do not match")
	}

	if command.Suggestions[0].Suggestion != result.Suggestions[0].Suggestion {
		t.Fatal("Ids do not match")
	}
}
