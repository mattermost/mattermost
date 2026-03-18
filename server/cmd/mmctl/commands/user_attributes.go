// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

var UserAttributesCmd = &cobra.Command{
	Use:     "attributes",
	Aliases: []string{"attrs", "cpa"},
	Short:   "Management of User Attributes",
	Long:    "Management of User Attributes fields and values.",
}

var UserAttributesFieldCmd = &cobra.Command{
	Use:   "field",
	Short: "Management of User Attributes fields",
	Long:  "Create, list, edit, and delete User Attribute fields.",
}

var UserAttributesValueCmd = &cobra.Command{
	Use:   "value",
	Short: "Management of User Attributes values",
	Long:  "List, set, and delete User Attribute values for users.",
}

func init() {
	UserAttributesCmd.AddCommand(
		UserAttributesFieldCmd,
		UserAttributesValueCmd,
	)

	UserCmd.AddCommand(UserAttributesCmd)
}

// Helper function to build field attributes from command flags. If existingAttrs is
// provided, it will be used as the base and merged with flag changes
func buildFieldAttrs(cmd *cobra.Command, existingAttrs model.StringInterface) (model.StringInterface, error) {
	var attrs = make(model.StringInterface)
	if existingAttrs != nil {
		maps.Copy(attrs, existingAttrs)
	}

	// First parse --attrs if provided
	if attrsStr, err := cmd.Flags().GetString("attrs"); err == nil && attrsStr != "" && cmd.Flags().Changed("attrs") {
		var attrsMap map[string]any
		if err := json.Unmarshal([]byte(attrsStr), &attrsMap); err != nil {
			return nil, fmt.Errorf("failed to parse attrs JSON: %w", err)
		}
		// Copy to our attrs map
		maps.Copy(attrs, attrsMap)
	}

	// Individual flags override --attrs (applied on top)
	if cmd.Flags().Changed("managed") {
		managed, _ := cmd.Flags().GetBool("managed")
		if managed {
			attrs["managed"] = "admin"
		} else {
			attrs["managed"] = ""
		}
	}

	// Handle --option flags for select/multiselect fields
	if options, err := cmd.Flags().GetStringSlice("option"); err == nil && len(options) > 0 && cmd.Flags().Changed("option") {
		var selectOptions []*model.CustomProfileAttributesSelectOption

		existingOptionsMap := make(map[string]*model.CustomProfileAttributesSelectOption)
		if existingOptions, ok := attrs["options"]; ok {
			existingOptionsJSON, err := json.Marshal(existingOptions)
			if err == nil {
				var existingSelectOptions []*model.CustomProfileAttributesSelectOption
				if err := json.Unmarshal(existingOptionsJSON, &existingSelectOptions); err == nil {
					for _, option := range existingSelectOptions {
						existingOptionsMap[option.Name] = option
					}
				}
			}
		}

		for _, optionName := range options {
			if existingOption, exists := existingOptionsMap[optionName]; exists {
				selectOptions = append(selectOptions, existingOption)
			} else {
				selectOptions = append(selectOptions, &model.CustomProfileAttributesSelectOption{
					ID:   model.NewId(),
					Name: optionName,
				})
			}
		}
		attrs["options"] = selectOptions
	}

	return attrs, nil
}

func hasAttrsChanges(cmd *cobra.Command) bool {
	return cmd.Flags().Changed("managed") ||
		cmd.Flags().Changed("attrs") ||
		cmd.Flags().Changed("option")
}

func getFieldFromArg(c client.Client, fieldArg string) (*model.PropertyField, error) {
	fields, _, err := c.ListCPAFields(context.TODO())
	if err != nil {
		return nil, fmt.Errorf("failed to get CPA fields: %w", err)
	}

	if model.IsValidId(fieldArg) {
		for _, field := range fields {
			if field.ID == fieldArg {
				return field, nil
			}
		}
	}

	for _, field := range fields {
		if field.Name == fieldArg {
			return field, nil
		}
	}

	return nil, fmt.Errorf("failed to get field for %q", fieldArg)
}

// setupCPATemplateContext sets up template functions for field and value resolution
func setupCPATemplateContext(c client.Client) error {
	// Get all fields once for the entire command
	fields, _, err := c.ListCPAFields(context.TODO())
	if err != nil {
		return fmt.Errorf("failed to get CPA fields for template context: %w", err)
	}

	fieldMap := make(map[string]*model.PropertyField)
	for _, field := range fields {
		fieldMap[field.ID] = field
	}

	// Set template function to resolve field ID to field name
	printer.SetTemplateFunc("fieldName", func(fieldID string) string {
		if field, exists := fieldMap[fieldID]; exists {
			return field.Name
		}
		return fieldID // fallback to field ID if not found
	})

	// Set template function to get field type
	printer.SetTemplateFunc("fieldType", func(fieldID string) string {
		if field, exists := fieldMap[fieldID]; exists {
			return string(field.Type)
		}
		return "unknown"
	})

	// Set template function to resolve field value to human-readable format
	printer.SetTemplateFunc("resolveValue", func(fieldID string, rawValue json.RawMessage) string {
		field, exists := fieldMap[fieldID]
		if !exists {
			return string(rawValue)
		}

		return resolveDisplayValue(field, rawValue)
	})

	return nil
}

// resolveDisplayValue converts raw field values to human-readable display format
func resolveDisplayValue(field *model.PropertyField, rawValue json.RawMessage) string {
	switch field.Type {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect:
		return resolveOptionDisplayValue(field, rawValue)
	default:
		var value any
		if err := json.Unmarshal(rawValue, &value); err != nil {
			return string(rawValue)
		}
		return fmt.Sprintf("%v", value)
	}
}

// resolveOptionDisplayValue converts option IDs to option names for select/multiselect fields
func resolveOptionDisplayValue(field *model.PropertyField, rawValue json.RawMessage) string {
	// Convert PropertyField to CPAField to access options
	cpaField, err := model.NewCPAFieldFromPropertyField(field)
	if err != nil {
		return string(rawValue)
	}

	if len(cpaField.Attrs.Options) == 0 {
		return string(rawValue)
	}

	// Create option lookup map
	optionMap := make(map[string]string)
	for _, option := range cpaField.Attrs.Options {
		optionMap[option.ID] = option.Name
	}

	if field.Type == model.PropertyFieldTypeSelect {
		// Single select - expect a string
		var optionID string
		if err := json.Unmarshal(rawValue, &optionID); err != nil {
			return string(rawValue)
		}
		if optionName, exists := optionMap[optionID]; exists {
			return optionName
		}
		return optionID
	}

	// Multiselect - expect an array
	var optionIDs []string
	if err := json.Unmarshal(rawValue, &optionIDs); err != nil {
		return string(rawValue)
	}

	optionNames := make([]string, 0, len(optionIDs))
	for _, optionID := range optionIDs {
		if optionName, exists := optionMap[optionID]; exists {
			optionNames = append(optionNames, optionName)
		} else {
			optionNames = append(optionNames, optionID)
		}
	}
	return fmt.Sprintf("[%s]", strings.Join(optionNames, ", "))
}
