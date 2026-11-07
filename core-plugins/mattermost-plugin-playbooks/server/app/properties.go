// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	// Attributes keys
	PropertyAttrsSortOrder  = "sort_order"
	PropertyAttrsVisibility = "visibility"
	PropertyAttrsParentID   = "parent_id"
	PropertyAttrsValueType  = "value_type"

	// Visibility
	PropertyFieldVisibilityHidden  = "hidden"
	PropertyFieldVisibilityWhenSet = "when_set"
	PropertyFieldVisibilityAlways  = "always"
	PropertyFieldVisibilityDefault = PropertyFieldVisibilityWhenSet

	PropertyOptionNameMaxLength  = 128
	PropertyOptionColorMaxLength = 128

	// Target types
	PropertyTargetTypePlaybook = "playbook"
	PropertyTargetTypeRun      = "run"
)

type PropertyCopyResult struct {
	FieldMappings  map[string]string
	OptionMappings map[string]string
	CopiedFields   []PropertyField
}

type Attrs struct {
	Visibility string                                             `json:"visibility"`
	SortOrder  float64                                            `json:"sort_order"`
	Options    model.PropertyOptions[*model.PluginPropertyOption] `json:"options"`
	ParentID   string                                             `json:"parent_id"`
	ValueType  string                                             `json:"value_type"`
}

func PropertySortOrder(p *model.PropertyField) int {
	value, ok := p.Attrs[PropertyAttrsSortOrder]
	if !ok {
		return 0
	}

	order, ok := value.(float64)
	if !ok {
		return 0
	}

	return int(order)
}

type PropertyField struct {
	model.PropertyField
	Attrs Attrs `json:"attrs"`
}

type PropertyValue model.PropertyValue

// SupportsOptions checks the PropertyField type and determines if the type
// supports the use of options
func (p *PropertyField) SupportsOptions() bool {
	switch p.Type {
	case model.PropertyFieldTypeSelect,
		model.PropertyFieldTypeMultiselect,
		model.PropertyFieldTypeUser,
		model.PropertyFieldTypeMultiuser:
		return true
	default:
		return false
	}
}

func (p *PropertyField) SanitizeAndValidate() error {
	// first we clean unused attributes depending on the field type
	if !p.SupportsOptions() {
		p.Attrs.Options = nil
	}

	switch p.Type {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect:
		options := p.Attrs.Options

		// add an ID to options with no ID
		for i := range options {
			if options[i].GetID() == "" {
				options[i].SetID(model.NewId())
			}
		}

		// Validate option names and colors
		for _, option := range options {
			if len(option.GetName()) > PropertyOptionNameMaxLength {
				return errors.New("option name exceeds maximum length")
			}
			if colorValue := option.GetValue("color"); colorValue != "" {
				if len(colorValue) > PropertyOptionColorMaxLength {
					return errors.New("option color exceeds maximum length")
				}
			}
		}

		if err := options.IsValid(); err != nil {
			return errors.Wrap(err, "invalid options for property field")
		}
		p.Attrs.Options = options
	}

	visibility := PropertyFieldVisibilityDefault
	if visibilityAttr := p.Attrs.Visibility; visibilityAttr != "" {
		switch visibilityAttr {
		case PropertyFieldVisibilityHidden, PropertyFieldVisibilityWhenSet, PropertyFieldVisibilityAlways:
			visibility = visibilityAttr
		default:
			return errors.New("unknown visibility value")
		}
	}
	p.Attrs.Visibility = visibility

	if p.Attrs.ValueType != "" && p.Attrs.ValueType != "url" {
		p.Attrs.ValueType = ""
	}

	return nil
}

func (p *PropertyField) ToMattermostPropertyField() *model.PropertyField {
	mmpf := p.PropertyField

	mmpf.Attrs = model.StringInterface{
		PropertyAttrsVisibility:             p.Attrs.Visibility,
		PropertyAttrsSortOrder:              p.Attrs.SortOrder,
		model.PropertyFieldAttributeOptions: p.Attrs.Options,
		PropertyAttrsParentID:               p.Attrs.ParentID,
		PropertyAttrsValueType:              p.Attrs.ValueType,
	}
	return &mmpf
}

func NewPropertyFieldFromMattermostPropertyField(mmpf *model.PropertyField) (*PropertyField, error) {
	attrsJSON, err := json.Marshal(mmpf.Attrs)
	if err != nil {
		return nil, err
	}

	var attrs Attrs
	err = json.Unmarshal(attrsJSON, &attrs)
	if err != nil {
		return nil, err
	}

	return &PropertyField{
		PropertyField: *mmpf,
		Attrs:         attrs,
	}, nil
}

// PropertyServiceReader defines read-only operations for property services used by handlers
type PropertyServiceReader interface {
	// GetPropertyField gets a single property field by ID
	GetPropertyField(propertyID string) (*PropertyField, error)

	// GetPropertyFields gets all property fields for a playbook
	GetPropertyFields(playbookID string) ([]PropertyField, error)

	// GetPropertyFieldsSince gets all property fields for a playbook since a given timestamp
	// updatedSince: optional timestamp in milliseconds - only return fields updated after this time (0 = all)
	GetPropertyFieldsSince(playbookID string, updatedSince int64) ([]PropertyField, error)

	// GetRunPropertyFields gets all property fields for a run
	GetRunPropertyFields(runID string) ([]PropertyField, error)

	// GetRunPropertyFieldsSince gets all property fields for a run since a given timestamp
	// updatedSince: optional timestamp in milliseconds - only return fields updated after this time (0 = all)
	GetRunPropertyFieldsSince(runID string, updatedSince int64) ([]PropertyField, error)

	// GetRunPropertyValues gets all property values for a run
	GetRunPropertyValues(runID string) ([]PropertyValue, error)

	// GetRunPropertyValuesSince gets all property values for a run since a given timestamp
	// updatedSince: optional timestamp in milliseconds - only return values updated after this time (0 = all)
	GetRunPropertyValuesSince(runID string, updatedSince int64) ([]PropertyValue, error)
}

type PropertyService interface {
	CreatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error)
	GetPropertyField(propertyID string) (*PropertyField, error)
	GetPropertyFields(playbookID string) ([]PropertyField, error)
	GetPropertyFieldsSince(playbookID string, updatedSince int64) ([]PropertyField, error)
	GetPropertyFieldsCount(playbookID string) (int, error)
	GetRunPropertyFields(runID string) ([]PropertyField, error)
	GetRunPropertyFieldsSince(runID string, updatedSince int64) ([]PropertyField, error)
	GetRunPropertyValues(runID string) ([]PropertyValue, error)
	GetRunPropertyValuesSince(runID string, updatedSince int64) ([]PropertyValue, error)
	GetRunPropertyValueByFieldID(runID, propertyFieldID string) (*PropertyValue, error)
	UpdatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error)
	DeletePropertyField(playbookID string, propertyID string) error
	ReorderPropertyFields(playbookID, fieldID string, targetPosition int) ([]PropertyField, error)
	CopyPlaybookPropertiesToRun(playbookID, runID string) (*PropertyCopyResult, error)
	UpsertRunPropertyValue(runID, propertyFieldID string, value json.RawMessage) (*PropertyValue, error)

	// Bulk methods for retrieving properties for multiple runs
	GetRunsPropertyFields(runIDs []string) (map[string][]PropertyField, error)
	GetRunsPropertyValues(runIDs []string) (map[string][]PropertyValue, error)
}
