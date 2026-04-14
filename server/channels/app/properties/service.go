// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// CallerIDExtractor is a function type that extracts the caller ID from a request context.
// This avoids circular dependency between the properties and app packages.
type CallerIDExtractor func(rctx request.CTX) string

type PropertyService struct {
	groupStore        store.PropertyGroupStore
	fieldStore        store.PropertyFieldStore
	valueStore        store.PropertyValueStore
	propertyAccess    *PropertyAccessService
	callerIDExtractor CallerIDExtractor
	groupCache        sync.Map // name -> *model.PropertyGroup
}

type ServiceConfig struct {
	PropertyGroupStore store.PropertyGroupStore
	PropertyFieldStore store.PropertyFieldStore
	PropertyValueStore store.PropertyValueStore
	CallerIDExtractor  CallerIDExtractor
}

func New(c ServiceConfig) (*PropertyService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &PropertyService{
		groupStore:        c.PropertyGroupStore,
		fieldStore:        c.PropertyFieldStore,
		valueStore:        c.PropertyValueStore,
		callerIDExtractor: c.CallerIDExtractor,
		propertyAccess:    nil,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.PropertyGroupStore == nil || c.PropertyFieldStore == nil || c.PropertyValueStore == nil {
		return errors.New("required parameters are not provided")
	}
	return nil
}

func (ps *PropertyService) SetPropertyAccessService(pas *PropertyAccessService) {
	ps.propertyAccess = pas
}

// requiresAccessControlForGroupID checks if a group ID requires access control enforcement.
// Currently, only the CPA group requires access control, but this may change in the future.
func (ps *PropertyService) requiresAccessControlForGroupID(groupID string) (bool, error) {
	group, err := ps.Group(model.CustomProfileAttributesPropertyGroupName)
	if err != nil {
		return false, fmt.Errorf("failed to check access control for group %q: %w", groupID, err)
	}
	return groupID == group.ID, nil
}

// setPluginCheckerForTests sets the plugin checker on the underlying PropertyAccessService.
func (ps *PropertyService) setPluginCheckerForTests(pluginChecker PluginChecker) {
	if ps.propertyAccess != nil {
		ps.propertyAccess.setPluginCheckerForTests(pluginChecker)
	}
}

// extractCallerID gets the caller ID from a request context using the configured extractor.
func (ps *PropertyService) extractCallerID(rctx request.CTX) string {
	if ps.callerIDExtractor == nil || rctx == nil {
		return ""
	}
	return ps.callerIDExtractor(rctx)
}
