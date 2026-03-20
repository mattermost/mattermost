// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const (
	PropertyGroupPlaybooks    = "playbooks"
	PropertySearchPerPage     = 20
	PropertyBulkSearchPerPage = 1000
	MaxPropertiesPerPlaybook  = 20
)

type propertyService struct {
	api            *pluginapi.Client
	groupID        string
	conditionStore ConditionStore
}

func NewPropertyService(api *pluginapi.Client, conditionStore ConditionStore) (PropertyService, error) {
	service := &propertyService{
		api:            api,
		conditionStore: conditionStore,
	}

	// Get or create the property group
	groupID, err := service.ensurePropertyGroup()
	if err != nil {
		return nil, errors.Wrap(err, "failed to ensure property group")
	}
	service.groupID = groupID

	return service, nil
}

func (s *propertyService) CreatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	if err := propertyField.SanitizeAndValidate(); err != nil {
		return nil, errors.Wrap(err, "invalid property field")
	}

	// Check if adding a new property would exceed the limit
	if err := s.validatePropertyLimit(playbookID); err != nil {
		return nil, err
	}

	mmPropertyField := propertyField.ToMattermostPropertyField()
	mmPropertyField.GroupID = s.groupID
	mmPropertyField.TargetType = PropertyTargetTypePlaybook
	mmPropertyField.TargetID = playbookID

	createdField, err := s.api.Property.CreatePropertyField(mmPropertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create property field")
	}

	resultField, err := NewPropertyFieldFromMattermostPropertyField(createdField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert created property field")
	}

	return resultField, nil
}

// validatePropertyLimit checks if adding a new property would exceed the maximum allowed
func (s *propertyService) validatePropertyLimit(playbookID string) error {
	currentCount, err := s.GetPropertyFieldsCount(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to get current property count")
	}

	if currentCount >= MaxPropertiesPerPlaybook {
		return errors.Errorf("cannot create property field: playbook already has the maximum allowed number of properties (%d)", MaxPropertiesPerPlaybook)
	}

	return nil
}

func (s *propertyService) GetPropertyField(propertyID string) (*PropertyField, error) {
	mmPropertyField, err := s.api.Property.GetPropertyField(s.groupID, propertyID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property field")
	}

	resultField, err := NewPropertyFieldFromMattermostPropertyField(mmPropertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert property field")
	}

	return resultField, nil
}

func (s *propertyService) GetPropertyFields(playbookID string) ([]PropertyField, error) {
	return s.GetPropertyFieldsSince(playbookID, 0)
}

func (s *propertyService) GetPropertyFieldsSince(playbookID string, updatedSince int64) ([]PropertyField, error) {
	mmPropertyFields, err := s.getAllPropertyFieldsSince(PropertyTargetTypePlaybook, playbookID, updatedSince)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields")
	}

	propertyFields := make([]PropertyField, 0, len(mmPropertyFields))
	for _, mmField := range mmPropertyFields {
		propertyField, err := NewPropertyFieldFromMattermostPropertyField(mmField)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert property field")
		}
		propertyFields = append(propertyFields, *propertyField)
	}

	return propertyFields, nil
}

func (s *propertyService) GetPropertyFieldsCount(playbookID string) (int, error) {
	count, err := s.api.Property.CountPropertyFieldsForTarget(
		s.groupID,
		PropertyTargetTypePlaybook,
		playbookID,
		false, // only count active (non-deleted) properties
	)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count property fields for playbook")
	}
	return int(count), nil
}

func (s *propertyService) GetRunPropertyFields(runID string) ([]PropertyField, error) {
	return s.GetRunPropertyFieldsSince(runID, 0)
}

func (s *propertyService) GetRunPropertyFieldsSince(runID string, updatedSince int64) ([]PropertyField, error) {
	fieldsMap, err := s.getRunsPropertyFields([]string{runID}, PropertySearchPerPage, updatedSince)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get run property fields")
	}

	if fields, exists := fieldsMap[runID]; exists {
		return fields, nil
	}

	return []PropertyField{}, nil
}

func (s *propertyService) UpdatePropertyField(playbookID string, propertyField PropertyField) (*PropertyField, error) {
	if err := propertyField.SanitizeAndValidate(); err != nil {
		return nil, errors.Wrap(err, "invalid property field")
	}

	// Get the existing property field to preserve timestamps and other fields
	existingField, err := s.api.Property.GetPropertyField(s.groupID, propertyField.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get existing property field")
	}

	// Check if the type is changing and validate it's allowed
	if existingField.Type != propertyField.Type {
		if err := s.validatePropertyFieldTypeChange(existingField, propertyField, playbookID); err != nil {
			return nil, err
		}
	}

	// Check if any options are being removed and validate they are not in use
	if propertyField.SupportsOptions() {
		existingPropertyField, err := NewPropertyFieldFromMattermostPropertyField(existingField)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert existing property field")
		}

		removedOptionIDs := s.findRemovedOptions(existingPropertyField.Attrs.Options, propertyField.Attrs.Options)
		if len(removedOptionIDs) > 0 {
			optionsInUse, err := s.conditionStore.CountConditionsUsingPropertyOptions(playbookID, removedOptionIDs)
			if err != nil {
				return nil, errors.Wrap(err, "failed to check if property options are in use")
			}

			if len(optionsInUse) > 0 {
				optionNames := s.getOptionNames(existingPropertyField.Attrs.Options, optionsInUse)
				return nil, errors.Wrapf(ErrPropertyOptionsInUse, "cannot remove property options: %s. Please remove or update the conditions before removing these options", optionNames)
			}
		}
	}

	// Convert the input to Mattermost property field
	mmPropertyField := propertyField.ToMattermostPropertyField()

	// Preserve important fields from the existing property field
	mmPropertyField.GroupID = existingField.GroupID
	mmPropertyField.TargetType = existingField.TargetType
	mmPropertyField.TargetID = existingField.TargetID
	mmPropertyField.CreateAt = existingField.CreateAt
	mmPropertyField.UpdateAt = existingField.UpdateAt
	mmPropertyField.DeleteAt = existingField.DeleteAt

	updatedField, err := s.api.Property.UpdatePropertyField(s.groupID, mmPropertyField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update property field")
	}

	resultField, err := NewPropertyFieldFromMattermostPropertyField(updatedField)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert updated property field")
	}

	return resultField, nil
}

func (s *propertyService) findRemovedOptions(oldOptions, newOptions model.PropertyOptions[*model.PluginPropertyOption]) []string {
	newOptionIDs := make(map[string]bool)
	for _, option := range newOptions {
		newOptionIDs[option.GetID()] = true
	}

	var removedIDs []string
	for _, option := range oldOptions {
		if !newOptionIDs[option.GetID()] {
			removedIDs = append(removedIDs, option.GetID())
		}
	}

	return removedIDs
}

func (s *propertyService) getOptionNames(options model.PropertyOptions[*model.PluginPropertyOption], optionsInUse map[string]int) string {
	var names []string
	for _, option := range options {
		if count, exists := optionsInUse[option.GetID()]; exists {
			var countStr string
			if count == 1 {
				countStr = "1 condition"
			} else {
				countStr = fmt.Sprintf("%d conditions", count)
			}
			names = append(names, fmt.Sprintf("'%s' (used by %s)", option.GetName(), countStr))
		}
	}
	return strings.Join(names, ", ")
}

func (s *propertyService) validatePropertyFieldTypeChange(existingField *model.PropertyField, updatedField PropertyField, playbookID string) error {
	count, err := s.conditionStore.CountConditionsUsingPropertyField(playbookID, updatedField.ID)
	if err != nil {
		return errors.Wrap(err, "failed to check if property field is in use")
	}

	if count > 0 {
		return errors.Wrapf(ErrPropertyFieldTypeChangeNotAllowed, "cannot change type of property field '%s' from '%s' to '%s': it is referenced by %d condition(s). Please remove or update the conditions before changing the field type", updatedField.Name, existingField.Type, updatedField.Type, count)
	}

	return nil
}

func (s *propertyService) DeletePropertyField(playbookID string, propertyID string) error {
	count, err := s.conditionStore.CountConditionsUsingPropertyField(playbookID, propertyID)
	if err != nil {
		return errors.Wrap(err, "failed to check if property field is in use")
	}

	if count > 0 {
		field, err := s.GetPropertyField(propertyID)
		if err != nil {
			return errors.Wrap(err, "failed to get property field")
		}
		return errors.Wrapf(ErrPropertyFieldInUse, "cannot delete property field '%s': it is referenced by %d condition(s). Please remove or update the conditions before deleting this field", field.Name, count)
	}

	err = s.api.Property.DeletePropertyField(s.groupID, propertyID)
	if err != nil {
		return errors.Wrap(err, "failed to delete property field")
	}

	return nil
}

func (s *propertyService) ReorderPropertyFields(playbookID, fieldID string, targetPosition int) ([]PropertyField, error) {
	fields, err := s.GetPropertyFields(playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property fields")
	}

	reorderedFields, changedIndices, err := reorderPropertyFieldsLogic(fields, fieldID, targetPosition)
	if err != nil {
		return nil, err
	}

	if len(changedIndices) == 0 {
		return reorderedFields, nil
	}

	fieldsToUpdate := make([]*model.PropertyField, len(changedIndices))
	for i, idx := range changedIndices {
		fieldsToUpdate[i] = reorderedFields[idx].ToMattermostPropertyField()
	}

	_, err = s.api.Property.UpdatePropertyFields(s.groupID, fieldsToUpdate)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update sort_order for fields")
	}

	return reorderedFields, nil
}

func reorderPropertyFieldsLogic(fields []PropertyField, fieldID string, targetPosition int) ([]PropertyField, []int, error) {
	if targetPosition < 0 || targetPosition >= len(fields) {
		return nil, nil, errors.New("target position out of bounds")
	}

	var sourceIndex = -1
	for i, field := range fields {
		if field.ID == fieldID {
			sourceIndex = i
			break
		}
	}

	if sourceIndex == -1 {
		return nil, nil, errors.New("field not found")
	}

	if sourceIndex == targetPosition {
		return fields, []int{}, nil
	}

	movedField := fields[sourceIndex]
	copy(fields[sourceIndex:], fields[sourceIndex+1:])
	copy(fields[targetPosition+1:], fields[targetPosition:])
	fields[targetPosition] = movedField

	var changedIndices []int
	for i := range fields {
		newSortOrder := float64(i)
		if fields[i].Attrs.SortOrder != newSortOrder {
			fields[i].Attrs.SortOrder = newSortOrder
			changedIndices = append(changedIndices, i)
		}
	}

	return fields, changedIndices, nil
}

func (s *propertyService) getAllPropertyFields(targetType, targetID string) ([]*model.PropertyField, error) {
	return s.getAllPropertyFieldsSince(targetType, targetID, 0)
}

func (s *propertyService) getAllPropertyFieldsSince(targetType, targetID string, updatedSince int64) ([]*model.PropertyField, error) {
	opts := model.PropertyFieldSearchOpts{
		GroupID:       s.groupID,
		TargetType:    targetType,
		TargetIDs:     []string{targetID},
		SinceUpdateAt: updatedSince,
		PerPage:       PropertySearchPerPage,
	}

	var allFields []*model.PropertyField
	for {
		fields, err := s.api.Property.SearchPropertyFields(s.groupID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property fields")
		}

		allFields = append(allFields, fields...)

		if len(fields) < PropertySearchPerPage {
			break
		}

		lastField := fields[len(fields)-1]
		opts.Cursor = model.PropertyFieldSearchCursor{
			PropertyFieldID: lastField.ID,
			CreateAt:        lastField.CreateAt,
		}
	}

	sort.Slice(allFields, func(i, j int) bool {
		return PropertySortOrder(allFields[i]) < PropertySortOrder(allFields[j])
	})

	return allFields, nil
}

func (s *propertyService) CopyPlaybookPropertiesToRun(playbookID, runID string) (*PropertyCopyResult, error) {
	playbookProperties, err := s.getAllPropertyFields(PropertyTargetTypePlaybook, playbookID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook properties")
	}

	fieldMappings := make(map[string]string)
	optionMappings := make(map[string]string)
	var copiedFields []PropertyField

	for _, playbookProperty := range playbookProperties {
		runProperty, err := s.copyPropertyFieldForRun(playbookProperty, runID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to duplicate property field %s for run", playbookProperty.Name)
		}

		createdFieldMM, err := s.api.Property.CreatePropertyField(runProperty)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to create run property field for %s", playbookProperty.Name)
		}

		// Convert the created field back to our PropertyField type to access typed options
		createdField, err := NewPropertyFieldFromMattermostPropertyField(createdFieldMM)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to convert created property field %s", playbookProperty.Name)
		}

		// Track field ID mapping: old playbook field ID -> new run field ID
		fieldMappings[playbookProperty.ID] = createdField.ID

		// Add to copied fields array
		copiedFields = append(copiedFields, *createdField)

		// Track option ID mappings if field supports options
		if createdField.SupportsOptions() {
			playbookField, err := NewPropertyFieldFromMattermostPropertyField(playbookProperty)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to convert playbook property field %s", playbookProperty.Name)
			}

			// Map old option IDs to new option IDs
			for i, playbookOption := range playbookField.Attrs.Options {
				if i < len(createdField.Attrs.Options) {
					optionMappings[playbookOption.GetID()] = createdField.Attrs.Options[i].GetID()
				}
			}
		}
	}

	logrus.WithFields(logrus.Fields{
		"playbook_id":   playbookID,
		"run_id":        runID,
		"fields_copied": len(playbookProperties),
	}).Info("copied playbook properties to run")

	return &PropertyCopyResult{
		FieldMappings:  fieldMappings,
		OptionMappings: optionMappings,
		CopiedFields:   copiedFields,
	}, nil
}

func (s *propertyService) copyPropertyFieldForRun(playbookProperty *model.PropertyField, runID string) (*model.PropertyField, error) {
	propertyField, err := NewPropertyFieldFromMattermostPropertyField(playbookProperty)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to convert playbook property %s", playbookProperty.Name)
	}

	propertyField.ID = ""
	propertyField.TargetType = PropertyTargetTypeRun
	propertyField.TargetID = runID
	propertyField.Attrs.ParentID = playbookProperty.ID

	if propertyField.SupportsOptions() {
		for i := range propertyField.Attrs.Options {
			propertyField.Attrs.Options[i].SetID("")
		}
	}

	if err := propertyField.SanitizeAndValidate(); err != nil {
		return nil, errors.Wrapf(err, "failed to validate run property field for %s", playbookProperty.Name)
	}

	return propertyField.ToMattermostPropertyField(), nil
}

func (s *propertyService) GetRunPropertyValues(runID string) ([]PropertyValue, error) {
	return s.GetRunPropertyValuesSince(runID, 0)
}

func (s *propertyService) GetRunPropertyValuesSince(runID string, updatedSince int64) ([]PropertyValue, error) {
	valuesMap, err := s.getRunsPropertyValues([]string{runID}, PropertySearchPerPage, updatedSince)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get run property values")
	}

	if values, exists := valuesMap[runID]; exists {
		return values, nil
	}

	return []PropertyValue{}, nil
}

func (s *propertyService) GetRunPropertyValueByFieldID(runID, propertyFieldID string) (*PropertyValue, error) {
	opts := model.PropertyValueSearchOpts{
		GroupID:    s.groupID,
		TargetType: PropertyTargetTypeRun,
		TargetIDs:  []string{runID},
		FieldID:    propertyFieldID,
		PerPage:    1,
	}

	values, err := s.api.Property.SearchPropertyValues(s.groupID, opts)
	if err != nil {
		return nil, errors.Wrap(err, "failed to search property value")
	}

	if len(values) == 0 {
		return nil, nil
	}

	propertyValue := PropertyValue(*values[0])
	return &propertyValue, nil
}

func (s *propertyService) UpsertRunPropertyValue(runID, propertyFieldID string, value json.RawMessage) (*PropertyValue, error) {
	// Get the property field to validate against
	propertyField, err := s.api.Property.GetPropertyField(s.groupID, propertyFieldID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property field")
	}

	// Sanitize and validate the value based on field type
	sanitizedValue, err := s.sanitizeAndValidatePropertyValue(propertyField, value)
	if err != nil {
		return nil, errors.Wrap(err, "failed to sanitize and validate property value")
	}

	// Create the property value model
	propertyValue := &model.PropertyValue{
		GroupID:    s.groupID,
		FieldID:    propertyFieldID,
		TargetID:   runID,
		TargetType: PropertyTargetTypeRun,
		Value:      sanitizedValue,
	}

	// Use the plugin API to upsert the property value
	upsertedValue, err := s.api.Property.UpsertPropertyValue(propertyValue)
	if err != nil {
		return nil, errors.Wrap(err, "failed to upsert property value")
	}

	// Convert back to our PropertyValue type
	return (*PropertyValue)(upsertedValue), nil
}

func (s *propertyService) sanitizeAndValidatePropertyValue(propertyField *model.PropertyField, value json.RawMessage) (json.RawMessage, error) {
	if len(value) == 0 || string(value) == "null" {
		return value, nil
	}

	switch propertyField.Type {
	case model.PropertyFieldTypeText:
		var stringValue string
		if err := json.Unmarshal(value, &stringValue); err != nil {
			return nil, errors.New("text field value must be a string")
		}
		sanitizedString, err := s.sanitizeTextValue(stringValue)
		if err != nil {
			return nil, err
		}
		return json.Marshal(sanitizedString)
	case model.PropertyFieldTypeSelect:
		var stringValue string
		if err := json.Unmarshal(value, &stringValue); err != nil {
			return nil, errors.New("select field value must be a string")
		}
		return value, s.validateSelectValue(propertyField, stringValue)
	case model.PropertyFieldTypeMultiselect:
		var arrayValue []string
		if err := json.Unmarshal(value, &arrayValue); err != nil {
			return nil, errors.New("multiselect field value must be an array of strings")
		}
		return value, s.validateMultiselectValue(propertyField, arrayValue)
	default:
		return nil, errors.Errorf("property field type '%s' is not supported", propertyField.Type)
	}
}

func (s *propertyService) sanitizeTextValue(value string) (string, error) {
	return strings.TrimSpace(value), nil
}

func (s *propertyService) validateSelectValue(propertyField *model.PropertyField, value string) error {
	if value == "" {
		return nil
	}

	pf, err := NewPropertyFieldFromMattermostPropertyField(propertyField)
	if err != nil {
		return errors.Wrap(err, "failed to convert property field")
	}

	for _, option := range pf.Attrs.Options {
		if option.GetID() == value {
			return nil
		}
	}

	return errors.New("select field value must be a valid option ID")
}

func (s *propertyService) validateMultiselectValue(propertyField *model.PropertyField, value []string) error {
	if len(value) == 0 {
		return nil
	}

	pf, err := NewPropertyFieldFromMattermostPropertyField(propertyField)
	if err != nil {
		return errors.Wrap(err, "failed to convert property field")
	}

	validOptions := make(map[string]struct{})
	for _, option := range pf.Attrs.Options {
		validOptions[option.GetID()] = struct{}{}
	}

	for _, val := range value {
		if _, exists := validOptions[val]; !exists {
			return errors.Errorf("multiselect field value '%s' is not a valid option ID", val)
		}
	}

	return nil
}

func (s *propertyService) ensurePropertyGroup() (string, error) {
	registeredGroup, err := s.api.Property.RegisterPropertyGroup(PropertyGroupPlaybooks)
	if err != nil {
		return "", errors.Wrap(err, "failed to register property group")
	}

	return registeredGroup.ID, nil
}

// GetRunsPropertyFields retrieves all property fields for multiple runs efficiently
func (s *propertyService) GetRunsPropertyFields(runIDs []string) (map[string][]PropertyField, error) {
	return s.getRunsPropertyFields(runIDs, PropertyBulkSearchPerPage, 0)
}

// GetRunsPropertyValues retrieves all property values for multiple runs efficiently
func (s *propertyService) GetRunsPropertyValues(runIDs []string) (map[string][]PropertyValue, error) {
	return s.getRunsPropertyValues(runIDs, PropertyBulkSearchPerPage, 0)
}

// getRunsPropertyFields handles property field retrieval in a paginated way
func (s *propertyService) getRunsPropertyFields(runIDs []string, pageSize int, updatedSince int64) (map[string][]PropertyField, error) {
	if len(runIDs) == 0 {
		return make(map[string][]PropertyField), nil
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID:       s.groupID,
		TargetType:    PropertyTargetTypeRun,
		TargetIDs:     runIDs,
		SinceUpdateAt: updatedSince,
		PerPage:       pageSize,
	}

	result := make(map[string][]PropertyField)

	var allFields []*model.PropertyField
	for {
		fields, err := s.api.Property.SearchPropertyFields(s.groupID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property fields")
		}

		allFields = append(allFields, fields...)

		if len(fields) < pageSize {
			break
		}

		opts.Cursor.PropertyFieldID = fields[len(fields)-1].ID
		opts.Cursor.CreateAt = fields[len(fields)-1].CreateAt
	}

	for _, mmField := range allFields {
		pf, err := NewPropertyFieldFromMattermostPropertyField(mmField)
		if err != nil {
			logrus.WithError(err).Warn("Failed to convert property field")
			continue
		}
		result[mmField.TargetID] = append(result[mmField.TargetID], *pf)
	}

	return result, nil
}

// getRunsPropertyValues handles property value retrieval in a paginated way
func (s *propertyService) getRunsPropertyValues(runIDs []string, pageSize int, updatedSince int64) (map[string][]PropertyValue, error) {
	if len(runIDs) == 0 {
		return make(map[string][]PropertyValue), nil
	}

	opts := model.PropertyValueSearchOpts{
		GroupID:       s.groupID,
		TargetType:    PropertyTargetTypeRun,
		TargetIDs:     runIDs,
		SinceUpdateAt: updatedSince,
		PerPage:       pageSize,
	}

	result := make(map[string][]PropertyValue)

	var allValues []*model.PropertyValue
	for {
		values, err := s.api.Property.SearchPropertyValues(s.groupID, opts)
		if err != nil {
			return nil, errors.Wrap(err, "failed to search property values")
		}

		allValues = append(allValues, values...)

		if len(values) < pageSize {
			break
		}

		opts.Cursor.PropertyValueID = values[len(values)-1].ID
		opts.Cursor.CreateAt = values[len(values)-1].CreateAt
	}

	for _, mmValue := range allValues {
		pv := PropertyValue(*mmValue)
		result[mmValue.TargetID] = append(result[mmValue.TargetID], pv)
	}

	return result, nil
}
