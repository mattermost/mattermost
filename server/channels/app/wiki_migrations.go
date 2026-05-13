// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	pagePropertiesSetupDoneKey = "page_properties_setup_done"
	pageMigrationVersion       = "v1"

	pagePropertyNameWiki   = "wiki"
	pagePropertyNameStatus = "status"

	anonymousCallerID = ""
)

func (s *Server) doSetupPageProperties() error {
	var nfErr *store.ErrNotFound
	data, err := s.Store().System().GetByName(pagePropertiesSetupDoneKey)
	if err != nil && !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	if data != nil && data.Value == pageMigrationVersion {
		return nil
	}

	group, err := s.PropertyService().RegisterPropertyGroup(&model.PropertyGroup{Name: "pages", Version: model.PropertyGroupVersionV2})
	if err != nil {
		return fmt.Errorf("failed to register Pages group: %w", err)
	}

	existingProperties, appErr := s.PropertyService().PropertyAccessService().SearchPropertyFields(anonymousCallerID, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
	if appErr != nil {
		return fmt.Errorf("failed to search for existing page properties: %w", appErr)
	}

	existingPropertiesMap := map[string]*model.PropertyField{}
	for _, property := range existingProperties {
		existingPropertiesMap[property.Name] = property
	}

	expectedPropertiesMap := map[string]*model.PropertyField{
		pagePropertyNameWiki: {
			GroupID:          group.ID,
			Name:             pagePropertyNameWiki,
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypePost,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			Protected:        true,
			PermissionField:  model.NewPointer(model.PermissionLevelNone),
			PermissionValues: model.NewPointer(model.PermissionLevelMember),
			Attrs:            map[string]any{},
		},
		pagePropertyNameStatus: {
			GroupID:          group.ID,
			Name:             pagePropertyNameStatus,
			Type:             model.PropertyFieldTypeSelect,
			ObjectType:       model.PropertyFieldObjectTypePost,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			Protected:        true,
			PermissionField:  model.NewPointer(model.PermissionLevelNone),
			PermissionValues: model.NewPointer(model.PermissionLevelMember),
			Attrs: map[string]any{
				"options": []map[string]string{
					{"id": "rough_draft", "name": model.PageStatusRoughDraft, "color": "light_grey"},
					{"id": "in_progress", "name": model.PageStatusInProgress, "color": "blue"},
					{"id": "in_review", "name": model.PageStatusInReview, "color": "yellow"},
					{"id": "done", "name": model.PageStatusDone, "color": "green"},
				},
			},
		},
	}

	var propertiesToUpdate []*model.PropertyField
	var propertiesToCreate []*model.PropertyField

	for name, expectedProperty := range expectedPropertiesMap {
		if property, exists := existingPropertiesMap[name]; exists {
			property.Type = expectedProperty.Type
			property.ObjectType = expectedProperty.ObjectType
			property.TargetType = expectedProperty.TargetType
			property.Protected = expectedProperty.Protected
			property.PermissionField = expectedProperty.PermissionField
			property.PermissionValues = expectedProperty.PermissionValues
			property.Attrs = expectedProperty.Attrs
			propertiesToUpdate = append(propertiesToUpdate, property)
		} else {
			propertiesToCreate = append(propertiesToCreate, expectedProperty)
		}
	}

	for _, property := range propertiesToCreate {
		if _, err := s.PropertyService().PropertyAccessService().CreatePropertyField(anonymousCallerID, property); err != nil {
			// Handle race condition: property may have been created by a concurrent migration run
			// (concurrent server startup or replica lag hiding an already-committed property).
			existing, fetchErr := s.PropertyService().PropertyAccessService().GetPropertyFieldByName(anonymousCallerID, group.ID, "", property.Name)
			if fetchErr != nil || existing == nil {
				return fmt.Errorf("failed to create page property: %q, error: %w", property.Name, err)
			}
			existing.Type = property.Type
			existing.ObjectType = property.ObjectType
			existing.TargetType = property.TargetType
			existing.Protected = property.Protected
			existing.PermissionField = property.PermissionField
			existing.PermissionValues = property.PermissionValues
			existing.Attrs = property.Attrs
			propertiesToUpdate = append(propertiesToUpdate, existing)
		}
	}

	if len(propertiesToUpdate) > 0 {
		if _, _, err := s.PropertyService().PropertyAccessService().UpdatePropertyFields(anonymousCallerID, group.ID, propertiesToUpdate); err != nil {
			return fmt.Errorf("failed to update page property fields: %w", err)
		}
	}

	if err := s.Store().System().SaveOrUpdate(&model.System{Name: pagePropertiesSetupDoneKey, Value: pageMigrationVersion}); err != nil {
		return fmt.Errorf("failed to save page properties setup done flag in system store %w", err)
	}

	return nil
}
