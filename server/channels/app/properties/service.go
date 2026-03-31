// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	logger            *mlog.Logger
	groupCache        sync.Map // name -> *model.PropertyGroup
}

type ServiceConfig struct {
	PropertyGroupStore store.PropertyGroupStore
	PropertyFieldStore store.PropertyFieldStore
	PropertyValueStore store.PropertyValueStore
	CallerIDExtractor  CallerIDExtractor
	Logger             *mlog.Logger
}

func New(c ServiceConfig) (*PropertyService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	logger := c.Logger
	if logger == nil {
		var logErr error
		logger, logErr = mlog.NewLogger()
		if logErr != nil {
			return nil, fmt.Errorf("failed to initialize property service logger: %w", logErr)
		}
	}

	return &PropertyService{
		groupStore:        c.PropertyGroupStore,
		fieldStore:        c.PropertyFieldStore,
		valueStore:        c.PropertyValueStore,
		callerIDExtractor: c.CallerIDExtractor,
		propertyAccess:    nil,
		logger:            logger,
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

// requiresAccessControlForFieldID checks whether a field requires access
// control. It first checks the field's own group, then — for linked fields —
// also checks whether the source template's group requires access control.
// This ensures that a linked field in a non-AC group still routes through the
// access control service when its source lives in an AC group.
func (ps *PropertyService) requiresAccessControlForFieldID(groupID, fieldID string) (bool, error) {
	ac, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return false, err
	}
	if ac || fieldID == "" {
		return ac, nil
	}

	field, fErr := ps.fieldStore.Get("", fieldID)
	if fErr != nil {
		// Field not found — fall back to group-only check (already false)
		return false, nil
	}

	if field.LinkedFieldID == nil || *field.LinkedFieldID == "" {
		return false, nil
	}

	source, sErr := ps.fieldStore.Get("", *field.LinkedFieldID)
	if sErr != nil {
		// Source not found — linked to a deleted/missing field, no AC needed
		return false, nil
	}

	return ps.requiresAccessControlForGroupID(source.GroupID)
}

// requiresAccessControlForValueID checks whether a property value requires
// access control by loading the value to discover its field, then delegating
// to requiresAccessControlForFieldID.
func (ps *PropertyService) requiresAccessControlForValueID(groupID, valueID string) (bool, error) {
	ac, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil || ac || valueID == "" {
		return ac, err
	}

	value, vErr := ps.valueStore.Get(groupID, valueID)
	if vErr != nil {
		return false, nil
	}

	return ps.requiresAccessControlForFieldID(groupID, value.FieldID)
}

// requiresAccessControlForAnyFieldInGroup checks whether any field in the
// group links to a source whose group requires access control. Used for broad
// operations (search, delete-for-target) that don't target a specific field.
func (ps *PropertyService) requiresAccessControlForAnyFieldInGroup(groupID string) (bool, error) {
	ac, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil || ac {
		return ac, err
	}

	var cursor model.PropertyFieldSearchCursor
	for {
		fields, fErr := ps.fieldStore.SearchPropertyFields(model.PropertyFieldSearchOpts{
			GroupID: groupID,
			PerPage: 100,
			Cursor:  cursor,
		})
		if fErr != nil {
			return false, fmt.Errorf("failed to search fields for AC check: %w", fErr)
		}

		for _, f := range fields {
			if f.LinkedFieldID == nil || *f.LinkedFieldID == "" {
				continue
			}
			source, sErr := ps.fieldStore.Get("", *f.LinkedFieldID)
			if sErr != nil {
				continue
			}
			sourceAC, sacErr := ps.requiresAccessControlForGroupID(source.GroupID)
			if sacErr != nil {
				return false, sacErr
			}
			if sourceAC {
				return true, nil
			}
		}

		if len(fields) < 100 {
			break
		}
		last := fields[len(fields)-1]
		cursor = model.PropertyFieldSearchCursor{
			PropertyFieldID: last.ID,
			CreateAt:        last.CreateAt,
		}
	}

	return false, nil
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
