// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type PropertyRootResolver struct{}

func (r *PropertyRootResolver) PlaybookProperty(ctx context.Context, args struct {
	PlaybookID string
	PropertyID string
}) (*PropertyFieldResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}

	if !c.licenceChecker.PlaybookAttributesAllowed() {
		return nil, errors.Wrapf(app.ErrLicensedFeature, "playbook attributes feature is not covered by current server license")
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	// Check permissions to view the playbook
	if err := c.permissions.PlaybookView(userID, args.PlaybookID); err != nil {
		return nil, err
	}

	// Get the property field using the service
	propertyField, err := c.propertyService.GetPropertyField(args.PropertyID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get property field")
	}

	// Verify the property field belongs to the specified playbook
	if propertyField.TargetID != args.PlaybookID {
		return nil, errors.New("property field does not belong to the specified playbook")
	}

	return &PropertyFieldResolver{propertyField: *propertyField}, nil
}

func (r *PropertyRootResolver) AddPlaybookPropertyField(ctx context.Context, args struct {
	PlaybookID    string
	PropertyField PropertyFieldGraphQLInput
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if !c.licenceChecker.PlaybookAttributesAllowed() {
		return "", errors.Wrapf(app.ErrLicensedFeature, "playbook attributes feature is not covered by current server license")
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	// Convert GraphQL input to PropertyField
	propertyField := convertPropertyFieldGraphQLInputToPropertyField(args.PropertyField)

	// Create the property field using the playbook service
	createdField, err := c.playbookService.CreatePropertyField(args.PlaybookID, *propertyField)
	if err != nil {
		return "", errors.Wrap(err, "failed to create property field")
	}

	return createdField.ID, nil
}

func (r *PropertyRootResolver) UpdatePlaybookPropertyField(ctx context.Context, args struct {
	PlaybookID      string
	PropertyFieldID string
	PropertyField   PropertyFieldGraphQLInput
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if !c.licenceChecker.PlaybookAttributesAllowed() {
		return "", errors.Wrapf(app.ErrLicensedFeature, "playbook attributes feature is not covered by current server license")
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	// Get the existing property field to ensure it exists and belongs to this playbook
	existingField, err := c.propertyService.GetPropertyField(args.PropertyFieldID)
	if err != nil {
		return "", errors.Wrap(err, "failed to get existing property field")
	}

	// Verify the property field belongs to the specified playbook
	if existingField.TargetID != args.PlaybookID {
		return "", errors.New("property field does not belong to the specified playbook")
	}

	// Convert GraphQL input to PropertyField
	propertyField := convertPropertyFieldGraphQLInputToPropertyField(args.PropertyField)
	propertyField.ID = args.PropertyFieldID

	// Update the property field using the playbook service
	updatedField, err := c.playbookService.UpdatePropertyField(args.PlaybookID, *propertyField)
	if err != nil {
		if errors.Is(err, app.ErrPropertyOptionsInUse) {
			return "", newGraphQLError(err)
		}
		if errors.Is(err, app.ErrPropertyFieldTypeChangeNotAllowed) {
			return "", newGraphQLError(err)
		}
		return "", errors.Wrap(err, "failed to update property field")
	}

	return updatedField.ID, nil
}

func (r *PropertyRootResolver) DeletePlaybookPropertyField(ctx context.Context, args struct {
	PlaybookID      string
	PropertyFieldID string
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if !c.licenceChecker.PlaybookAttributesAllowed() {
		return "", errors.Wrapf(app.ErrLicensedFeature, "playbook attributes feature is not covered by current server license")
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := c.playbookService.Get(args.PlaybookID)
	if err != nil {
		return "", err
	}

	if err := c.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		return "", err
	}

	if currentPlaybook.DeleteAt != 0 {
		return "", errors.New("archived playbooks can not be modified")
	}

	// Get the existing property field to ensure it exists and belongs to this playbook
	existingField, err := c.propertyService.GetPropertyField(args.PropertyFieldID)
	if err != nil {
		return "", errors.Wrap(err, "failed to get existing property field")
	}

	// Verify the property field belongs to the specified playbook
	if existingField.TargetID != args.PlaybookID {
		return "", errors.New("property field does not belong to the specified playbook")
	}

	// Delete the property field using the playbook service
	err = c.playbookService.DeletePropertyField(args.PlaybookID, args.PropertyFieldID)
	if err != nil {
		if errors.Is(err, app.ErrPropertyFieldInUse) {
			return "", newGraphQLError(err)
		}
		return "", errors.Wrap(err, "failed to delete property field")
	}

	return args.PropertyFieldID, nil
}

func (r *PropertyRootResolver) SetRunPropertyValue(ctx context.Context, args struct {
	RunID           string
	PropertyFieldID string
	Value           *JSONResolver
}) (string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return "", err
	}

	if !c.licenceChecker.PlaybookAttributesAllowed() {
		return "", errors.Wrapf(app.ErrLicensedFeature, "playbook attributes feature is not covered by current server license")
	}

	userID := c.r.Header.Get("Mattermost-User-ID")

	// Extract the json.RawMessage from the JSONResolver
	var value json.RawMessage
	if args.Value != nil {
		value = args.Value.value
	} else {
		value = json.RawMessage(`null`)
	}

	// Get the run to check permissions
	playbookRun, err := c.playbookRunService.GetPlaybookRun(args.RunID)
	if err != nil {
		return "", errors.Wrap(err, "failed to get playbook run")
	}

	// Check permissions to modify the run
	if err := c.permissions.RunManageProperties(userID, playbookRun.ID); err != nil {
		return "", err
	}

	// Verify the property field exists and belongs to the run
	propertyField, err := c.propertyService.GetPropertyField(args.PropertyFieldID)
	if err != nil {
		return "", errors.Wrap(err, "failed to get property field")
	}

	if propertyField.TargetType != "run" || propertyField.TargetID != playbookRun.ID {
		return "", errors.New("property field does not belong to this run")
	}

	// Set the property value via PlaybookRunService (which handles websockets)
	propertyValue, err := c.playbookRunService.SetRunPropertyValue(userID, playbookRun.ID, args.PropertyFieldID, value)
	if err != nil {
		return "", errors.Wrap(err, "failed to set property value")
	}

	return propertyValue.ID, nil
}

// convertPropertyFieldGraphQLInputToPropertyField converts a GraphQL PropertyFieldGraphQLInput to an app.PropertyField
func convertPropertyFieldGraphQLInputToPropertyField(input PropertyFieldGraphQLInput) *app.PropertyField {
	propertyField := &app.PropertyField{
		PropertyField: model.PropertyField{
			Name: input.Name,
			Type: input.Type,
		},
	}

	// Set default attrs if not provided
	if input.Attrs != nil {
		attrs := app.Attrs{}

		if input.Attrs.Visibility != nil {
			attrs.Visibility = *input.Attrs.Visibility
		} else {
			attrs.Visibility = app.PropertyFieldVisibilityDefault
		}

		if input.Attrs.SortOrder != nil {
			attrs.SortOrder = *input.Attrs.SortOrder
		}

		if input.Attrs.Options != nil {
			options := make(model.PropertyOptions[*model.PluginPropertyOption], 0, len(*input.Attrs.Options))
			for _, opt := range *input.Attrs.Options {
				var id string
				if opt.ID != nil {
					id = *opt.ID
				}
				option := model.NewPluginPropertyOption(id, opt.Name)
				if opt.Color != nil {
					option.SetValue("color", *opt.Color)
				}
				options = append(options, option)
			}
			attrs.Options = options
		}

		if input.Attrs.ParentID != nil {
			attrs.ParentID = *input.Attrs.ParentID
		}

		if input.Attrs.ValueType != nil {
			attrs.ValueType = *input.Attrs.ValueType
		}

		propertyField.Attrs = attrs
	} else {
		propertyField.Attrs = app.Attrs{
			Visibility: app.PropertyFieldVisibilityDefault,
		}
	}

	return propertyField
}
