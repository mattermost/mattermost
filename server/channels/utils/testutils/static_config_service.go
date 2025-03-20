// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testutils

import (
	"crypto/ecdsa"

	"github.com/mattermost/mattermost/server/public/model"
)

type StaticConfigService struct {
	Cfg *model.Config

	listeners map[string]func(old, current *model.Config)
}

func (s *StaticConfigService) Config() *model.Config {
	return s.Cfg
}

func (s *StaticConfigService) AddConfigListener(listener func(old, current *model.Config)) string {
	if s.listeners == nil {
		s.listeners = make(map[string]func(old, current *model.Config))
	}

	listenerID := model.NewId()
	s.listeners[listenerID] = listener
	return listenerID
}

func (s *StaticConfigService) RemoveConfigListener(listenerID string) {
	delete(s.listeners, listenerID)
}

func (s *StaticConfigService) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return &ecdsa.PrivateKey{}
}

func (s *StaticConfigService) PostActionCookieSecret() []byte {
	return make([]byte, 32)
}

func (s *StaticConfigService) UpdateConfig(newConfig *model.Config) {
	oldConfig := s.Config()
	s.Cfg = newConfig

	for _, listener := range s.listeners {
		listener(oldConfig, newConfig)
	}
}
