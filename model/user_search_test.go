// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"strings"
	"testing"
)

func TestUserSearchJson(t *testing.T) {
	userSearch := UserSearch{Term: NewId(), TeamId: NewId()}
	json := userSearch.ToJson()
	ruserSearch := UserSearchFromJson(bytes.NewReader(json))

	if userSearch.Term != ruserSearch.Term {
		t.Fatal("Terms do not match")
	}

	userSearchWithSpaces := UserSearch{Term: " a string ", TeamId: NewId()}
	jsonWithSpaces := userSearchWithSpaces.ToJson()
	ruserSearchWithSpaces := UserSearchFromJson(bytes.NewReader(jsonWithSpaces))

	if !strings.EqualFold(ruserSearchWithSpaces.Term, "a string") {
		t.Fatal("Term should not have leading or trailing spaces")
	}
}
