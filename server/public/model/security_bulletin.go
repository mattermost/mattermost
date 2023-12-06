// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type SecurityBulletin struct {
	Id               string `json:"id"`
	AppliesToVersion string `json:"applies_to_version"`
}

type SecurityBulletins []SecurityBulletin
