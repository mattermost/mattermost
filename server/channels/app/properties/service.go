// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"

	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type PropertyService struct {
	groupStore store.PropertyGroupStore
	fieldStore store.PropertyFieldStore
	valueStore store.PropertyValueStore
}

type ServiceConfig struct {
	PropertyGroupStore store.PropertyGroupStore
	PropertyFieldStore store.PropertyFieldStore
	PropertyValueStore store.PropertyValueStore
}

func New(c ServiceConfig) (*PropertyService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &PropertyService{
		groupStore: c.PropertyGroupStore,
		fieldStore: c.PropertyFieldStore,
		valueStore: c.PropertyValueStore,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.PropertyGroupStore == nil || c.PropertyFieldStore == nil || c.PropertyValueStore == nil {
		return errors.New("required parameters are not provided")
	}
	return nil
}
