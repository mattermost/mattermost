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

// fieldACResult holds the result of resolveFieldAccessControl, bundling
// the access-control decision with the entities that were fetched.
type fieldACResult struct {
	requiresAC bool
	field      *model.PropertyField // fetched field (nil only when fieldID was empty or not found)
	source     *model.PropertyField // linked source template (nil when field is not linked)
}

// resolveFieldAccessControl determines whether a field requires access
// control and returns the fetched field (and linked source, if any).
// The field is always fetched when fieldID is non-empty, regardless of
// whether the group-level check alone was sufficient to determine AC.
func (ps *PropertyService) resolveFieldAccessControl(groupID, fieldID string) (fieldACResult, error) {
	ac, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return fieldACResult{}, err
	}
	if fieldID == "" {
		return fieldACResult{requiresAC: ac}, nil
	}

	field, fErr := ps.fieldStore.Get("", fieldID)
	if fErr != nil {
		return fieldACResult{requiresAC: ac}, nil
	}

	if ac || field.LinkedFieldID == nil || *field.LinkedFieldID == "" {
		return fieldACResult{requiresAC: ac, field: field}, nil
	}

	source, sErr := ps.fieldStore.Get("", *field.LinkedFieldID)
	if sErr != nil {
		return fieldACResult{field: field}, nil
	}

	sourceAC, sacErr := ps.requiresAccessControlForGroupID(source.GroupID)
	if sacErr != nil {
		return fieldACResult{}, sacErr
	}

	return fieldACResult{requiresAC: sourceAC, field: field, source: source}, nil
}

// valueACResult holds the result of resolveValueAccessControl, bundling
// the access-control decision with the entities that were fetched.
type valueACResult struct {
	requiresAC bool
	value      *model.PropertyValue // fetched value (nil only when valueID was empty or not found)
	field      *model.PropertyField // fetched field for the value
}

// resolveValueAccessControl determines whether a value requires access
// control by loading the value to discover its field, then delegating
// to resolveFieldAccessControl. Always fetches value and field when
// valueID is non-empty.
func (ps *PropertyService) resolveValueAccessControl(groupID, valueID string) (valueACResult, error) {
	ac, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return valueACResult{}, err
	}
	if valueID == "" {
		return valueACResult{requiresAC: ac}, nil
	}

	value, vErr := ps.valueStore.Get(groupID, valueID)
	if vErr != nil {
		return valueACResult{requiresAC: ac}, nil
	}

	result, fErr := ps.resolveFieldAccessControl(groupID, value.FieldID)
	if fErr != nil {
		return valueACResult{}, fErr
	}

	return valueACResult{
		requiresAC: result.requiresAC,
		value:      value,
		field:      result.field,
	}, nil
}

// batchFieldACResult holds the result of resolveFieldAccessControlBatch.
type batchFieldACResult struct {
	requiresAC bool
	fields     map[string]*model.PropertyField // fieldID -> field (nil only when fieldIDs was empty)
}

// resolveFieldAccessControlBatch determines whether any of the given
// fields require access control. It always batch-fetches the fields
// and their linked sources.
func (ps *PropertyService) resolveFieldAccessControlBatch(groupID string, fieldIDs []string) (batchFieldACResult, error) {
	if len(fieldIDs) == 0 {
		return batchFieldACResult{}, nil
	}

	ac, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return batchFieldACResult{}, err
	}

	// Batch-fetch all fields
	fields, fErr := ps.fieldStore.GetMany("", fieldIDs)
	if fErr != nil {
		return batchFieldACResult{}, fmt.Errorf("resolveFieldAccessControlBatch: failed to fetch fields: %w", fErr)
	}

	fieldMap := make(map[string]*model.PropertyField, len(fields))
	var sourceIDs []string
	for _, f := range fields {
		fieldMap[f.ID] = f
		if f.LinkedFieldID != nil && *f.LinkedFieldID != "" {
			sourceIDs = append(sourceIDs, *f.LinkedFieldID)
		}
	}

	if ac || len(sourceIDs) == 0 {
		return batchFieldACResult{requiresAC: ac, fields: fieldMap}, nil
	}

	// Batch-fetch all linked sources
	sources, sErr := ps.fieldStore.GetMany("", sourceIDs)
	if sErr != nil {
		return batchFieldACResult{fields: fieldMap}, nil
	}

	for _, source := range sources {
		sourceAC, sacErr := ps.requiresAccessControlForGroupID(source.GroupID)
		if sacErr != nil {
			return batchFieldACResult{}, sacErr
		}
		if sourceAC {
			return batchFieldACResult{requiresAC: true, fields: fieldMap}, nil
		}
	}

	return batchFieldACResult{fields: fieldMap}, nil
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
