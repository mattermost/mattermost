// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type SCIMGroup struct {
	PrimaryKey      string
	Name            string
	MattermostGroup *Group
}
