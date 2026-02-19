// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"errors"

	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type ViewService struct {
	store store.ViewStore
}

type ServiceConfig struct {
	ViewStore store.ViewStore
}

func New(c ServiceConfig) (*ViewService, error) {
	if c.ViewStore == nil {
		return nil, errors.New("ViewStore is required")
	}

	return &ViewService{store: c.ViewStore}, nil
}
