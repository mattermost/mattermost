// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testutils

import (
	"github.com/mattermost/mattermost-server/model"
)

type StaticConfigService struct {
	Cfg *model.Config
}

func (s StaticConfigService) Config() *model.Config {
	return s.Cfg
}

func (StaticConfigService) AddConfigListener(func(old, current *model.Config)) string {
	return ""
}

func (StaticConfigService) RemoveConfigListener(string) {

}
