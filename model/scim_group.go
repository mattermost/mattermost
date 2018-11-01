// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

// SCIMGroup represents a generic group in an external
// system for cross-domain identity management such as LDAP.
type SCIMGroup struct {
	PrimaryKey        string  `json:"primary_key"`
	Name              string  `json:"name"`
	MattermostGroupID *string `json:"mattermost_group_id"`
}
