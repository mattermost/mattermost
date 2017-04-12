// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestInitialLoadJson(t *testing.T) {
	u := &User{Id: NewId()}
	o := InitialLoad{User: u}
	json := o.ToJson()
	ro := InitialLoadFromJson(strings.NewReader(json))

	if o.User.Id != ro.User.Id {
		t.Fatal("Ids do not match")
	}
}
