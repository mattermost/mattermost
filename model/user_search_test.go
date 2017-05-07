// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestUserSearchJson(t *testing.T) {
	userSearch := UserSearch{Term: NewId(), TeamId: NewId()}
	json := userSearch.ToJson()
	ruserSearch := UserSearchFromJson(strings.NewReader(json))

	if userSearch.Term != ruserSearch.Term {
		t.Fatal("Terms do not match")
	}
}
