// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestSuggestCommandJson(t *testing.T) {
	command := &SuggestCommand{Suggestion: NewId()}
	json := command.ToJson()
	result := SuggestCommandFromJson(strings.NewReader(json))

	if command.Suggestion != result.Suggestion {
		t.Fatal("Ids do not match")
	}
}
