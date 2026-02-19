// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type ViewService struct {
	store                store.ViewStore
	boardPropertyFieldID string
}

type ServiceConfig struct {
	ViewStore          store.ViewStore
	PropertyGroupStore store.PropertyGroupStore
	PropertyFieldStore store.PropertyFieldStore
}

func New(c ServiceConfig) (*ViewService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	group, err := c.PropertyGroupStore.Get(model.BoardsPropertyGroupName)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve boards property group: %w", err)
	}

	field, err := c.PropertyFieldStore.GetFieldByName(group.ID, "", model.BoardsPropertyFieldNameBoard)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch board property field: %w", err)
	}

	return &ViewService{
		store:                c.ViewStore,
		boardPropertyFieldID: field.ID,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.ViewStore == nil {
		return errors.New("ViewStore is required")
	}

	if c.PropertyGroupStore == nil {
		return errors.New("PropertyGroupStore is required")
	}

	if c.PropertyFieldStore == nil {
		return errors.New("PropertyFieldStore is required")
	}

	return nil
}
