// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (ps *PropertyService) RegisterPropertyGroup(name string) (*model.PropertyGroup, error) {
	return ps.groupStore.Register(name)
}

func (ps *PropertyService) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
	return ps.groupStore.Get(name)
}
