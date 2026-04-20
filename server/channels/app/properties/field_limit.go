// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

var (
	ErrFieldLimitReached      = errors.New("per-object-type field limit reached")
	ErrGroupFieldLimitReached = errors.New("group field limit reached")
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
				return nil, fmt.Errorf("failed to count fields: %w", err)
			}
			if count >= limit {
				return nil, fmt.Errorf("limit_reached: field limit of %d reached for object type %q: %w", limit, field.ObjectType, ErrFieldLimitReached)
			}
		}
	}

	// Check global group limit
	if config.GlobalLimit > 0 {
		count, err := h.propertyService.countActivePropertyFieldsForGroup(field.GroupID)
		if err != nil {
			return nil, fmt.Errorf("failed to count group fields: %w", err)
		}
		if count >= config.GlobalLimit {
			return nil, fmt.Errorf("group_limit_reached: global field limit of %d reached for group: %w", config.GlobalLimit, ErrGroupFieldLimitReached)
		}
	}

	return field, nil
}
