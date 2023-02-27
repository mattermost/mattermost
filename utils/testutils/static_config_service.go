// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testutils

import (
	"crypto/ecdsa"

	"github.com/mattermost/mattermost-server/v6/model"
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

func (StaticConfigService) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return &ecdsa.PrivateKey{}
}
func (StaticConfigService) PostActionCookieSecret() []byte {
	return make([]byte, 32)
}
