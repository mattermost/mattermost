// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"

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
	cpaGroupID        string
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
		cpaGroupID:        "",
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

// requiresAccessControl checks if a group ID requires access control enforcement.
// Currently, only the CPA group requires access control, but this may change in the future.
func (ps *PropertyService) requiresAccessControl(groupID string) (bool, error) {
	if ps.cpaGroupID == "" {
		group, err := ps.GetPropertyGroup(model.CustomProfileAttributesPropertyGroupName)
		if err != nil {
			return false, nil
		}
		ps.cpaGroupID = group.ID
	}
	return groupID == ps.cpaGroupID, nil
}

// SetPluginCheckerForTests sets the plugin checker on the underlying PropertyAccessService.
// This is exported to allow tests to configure plugin checking without direct PAS access.
func (ps *PropertyService) SetPluginCheckerForTests(pluginChecker PluginChecker) {
	if ps.propertyAccess != nil {
		ps.propertyAccess.SetPluginCheckerForTests(pluginChecker)
	}
}

// extractCallerID gets the caller ID from a request context using the configured extractor.
func (ps *PropertyService) extractCallerID(rctx request.CTX) string {
	if ps.callerIDExtractor == nil || rctx == nil {
		return ""
	}
	return ps.callerIDExtractor(rctx)
}
