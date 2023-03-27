// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

// Team is information global to a team
// swagger:model
type Team struct {
	// ID of the team
	// required: true
	ID string `json:"id"`

	// Title of the team
	// required: false
	Title string `json:"title"`

	// Token required to register new users
	// required: true
	SignupToken string `json:"signupToken"`

	// Team settings
	// required: false
	Settings map[string]interface{} `json:"settings"`

	// ID of user who last modified this
	// required: true
	ModifiedBy string `json:"modifiedBy"`

	// Updated time in miliseconds since the current epoch
	// required: true
	UpdateAt int64 `json:"updateAt"`
}

func TeamFromJSON(data io.Reader) *Team {
	var team *Team
	_ = json.NewDecoder(data).Decode(&team)
	return team
}

func TeamsFromJSON(data io.Reader) []*Team {
	var teams []*Team
	_ = json.NewDecoder(data).Decode(&teams)
	return teams
}
