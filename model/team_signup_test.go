// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestTeamSignupJson(t *testing.T) {
	team := Team{Id: NewId(), DisplayName: NewId()}
	o := TeamSignup{Team: team, Data: "data"}
	json := o.ToJson()
	ro := TeamSignupFromJson(strings.NewReader(json))

	if o.Team.Id != ro.Team.Id {
		t.Fatal("Ids do not match")
	}
}
