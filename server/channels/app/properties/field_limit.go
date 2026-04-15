// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// FieldLimitConfig defines limits for a specific property group.
type FieldLimitConfig struct {
	// PerObjectType maps ObjectType values to their maximum field count.
	// For example: {"user": 20} means at most 20 fields with ObjectType="user".
	PerObjectType map[string]int64

	// GlobalLimit is the maximum total number of fields across the entire group,
	// regardless of ObjectType. Zero means no global limit.
	GlobalLimit int64
}

// FieldLimitHook enforces per-group field creation limits. It checks both
// per-object-type limits and global group limits before allowing a field
// to be created. The hook only applies to groups that have been configured
// with limits.
type FieldLimitHook struct {
	BasePropertyHook
	propertyService *PropertyService
	limits          map[string]*FieldLimitConfig // groupID -> config
}

var _ PropertyHook = (*FieldLimitHook)(nil)

// NewFieldLimitHook creates a hook that enforces field limits. Call
// AddGroupLimit to configure limits for specific groups.
func NewFieldLimitHook(ps *PropertyService) *FieldLimitHook {
	return &FieldLimitHook{
		propertyService: ps,
		limits:          make(map[string]*FieldLimitConfig),
	}
}

// AddGroupLimit registers a limit configuration for the given group ID.
func (h *FieldLimitHook) AddGroupLimit(groupID string, config *FieldLimitConfig) {
	h.limits[groupID] = config
}

func (h *FieldLimitHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	config, ok := h.limits[field.GroupID]
	if !ok {
		return field, nil
	}

	// Check per-object-type limit
	if field.ObjectType != "" {
		if limit, hasLimit := config.PerObjectType[field.ObjectType]; hasLimit {
			count, err := h.propertyService.countActivePropertyFieldsForGroupObjectType(field.GroupID, field.ObjectType)
			if err != nil {
				return nil, fmt.Errorf("PreCreatePropertyField: failed to count fields: %w", err)
			}
			if count >= limit {
				return nil, model.NewAppError(
					"PreCreatePropertyField",
					"app.property_field.create.limit_reached.app_error",
					map[string]any{"Limit": limit, "ObjectType": field.ObjectType},
					fmt.Sprintf("field limit of %d reached for object type %q", limit, field.ObjectType),
					http.StatusUnprocessableEntity,
				)
			}
		}
	}

	// Check global group limit
	if config.GlobalLimit > 0 {
		count, err := h.propertyService.countActivePropertyFieldsForGroup(field.GroupID)
		if err != nil {
			return nil, fmt.Errorf("PreCreatePropertyField: failed to count group fields: %w", err)
		}
		if count >= config.GlobalLimit {
			return nil, model.NewAppError(
				"PreCreatePropertyField",
				"app.property_field.create.group_limit_reached.app_error",
				map[string]any{"Limit": config.GlobalLimit},
				fmt.Sprintf("global field limit of %d reached for group", config.GlobalLimit),
				http.StatusUnprocessableEntity,
			)
		}
	}

	return field, nil
}
