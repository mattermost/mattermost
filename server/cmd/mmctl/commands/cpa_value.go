// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

var CPAValueListCmd = &cobra.Command{
	Use:   "list [user]",
	Short: "List CPA values for a user",
	Long:  "List all Custom Profile Attribute values for a specific user.",
	Example: `  cpa value list john.doe@company.com
  cpa value list johndoe`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(cpaValueListCmdF),
}

var CPAValueSetCmd = &cobra.Command{
	Use:   "set [user] [field]",
	Short: "Set a CPA value for a user",
	Long:  "Set a Custom Profile Attribute field value for a specific user by field ID or name.",
	Example: `  cpa value set john.doe@company.com kx8m2w4r9p3q7n5t1j6h8s4c9e --value Engineering
  cpa value set johndoe Department --value Engineering
  cpa value set user123 Skills --value Go --value React --value Python`,
	Args: cobra.ExactArgs(2),
	RunE: withClient(cpaValueSetCmdF),
}

func init() {
	// Set flags
	CPAValueSetCmd.Flags().StringSlice("value", []string{}, "Value(s) to set for the field. Can be specified multiple times for multiselect/multiuser fields")
	_ = CPAValueSetCmd.MarkFlagRequired("value")

	// Add subcommands to CPAValueCmd
	CPAValueCmd.AddCommand(
		CPAValueListCmd,
		CPAValueSetCmd,
	)
}

func cpaValueListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	userArg := args[0]

	// Setup template context for field and value resolution
	if err := setupCPATemplateContext(c); err != nil {
		return err
	}

	// Resolve user
	user, err := getUserFromArg(c, userArg)
	if err != nil {
		return err
	}

	// Get all values for the user
	values, _, err := c.ListCPAValues(context.TODO(), user.Id)
	if err != nil {
		return fmt.Errorf("failed to get CPA values for user %s: %w", user.Username, err)
	}

	for fieldID, value := range values {
		keypair := map[string]any{
			fieldID: value,
		}
		printer.PrintT("{{range $k, $v := .}}{{fieldName $k}} ({{fieldType $k}}): {{resolveValue $k $v}}{{end}}", keypair)
	}
	return nil
}

func cpaValueSetCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	userArg := args[0]
	fieldArg := args[1]

	// Get values from flag
	values, err := cmd.Flags().GetStringSlice("value")
	if err != nil {
		return fmt.Errorf("failed to get values: %w", err)
	}

	// Resolve user
	user, err := getUserFromArg(c, userArg)
	if err != nil {
		return err
	}

	// Resolve field
	field, err := getFieldFromArg(c, fieldArg)
	if err != nil {
		return err
	}

	// Setup template context for field and value resolution
	if err := setupCPATemplateContext(c); err != nil {
		return err
	}

	// Resolve option names to IDs for select/multiselect fields
	resolvedValues, err := resolveOptionNamesToIDs(field, values)
	if err != nil {
		return fmt.Errorf("failed to resolve option values: %w", err)
	}

	// Prepare the value for marshaling
	var valueToMarshal any
	if field.Type == model.PropertyFieldTypeMultiselect || field.Type == model.PropertyFieldTypeMultiuser {
		// Multiple values
		valueToMarshal = resolvedValues
	} else {
		// Single value
		valueToMarshal = resolvedValues[0]
	}

	// Set the value using PatchCPAValues
	valueJSON, err := json.Marshal(valueToMarshal)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	patchValues := map[string]json.RawMessage{
		field.ID: valueJSON,
	}

	updatedValues, _, vErr := c.PatchCPAValuesForUser(context.TODO(), user.Id, patchValues)
	if vErr != nil {
		return fmt.Errorf("failed to set CPA value: %w", vErr)
	}

	printer.SetSingle(true)
	for fieldID, value := range updatedValues {
		keypair := map[string]any{
			fieldID: value,
		}
		printer.PrintT("{{range $k, $v := .}}Successfully updated value for field {{fieldName $k}}: {{resolveValue $k $v}}{{end}}", keypair)
	}
	return nil
}

// resolveOptionNamesToIDs converts option names to option IDs for select/multiselect fields
func resolveOptionNamesToIDs(field *model.PropertyField, values []string) ([]string, error) {
	// For non-select fields, return values as-is
	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeMultiselect {
		return values, nil
	}

	// Convert PropertyField to CPAField to access options
	cpaField, err := model.NewCPAFieldFromPropertyField(field)
	if err != nil {
		return nil, err
	}

	var resolvedValues []string
	for _, value := range values {
		optionID := findOptionIDByName(cpaField.Attrs.Options, value)
		if optionID == "" {
			// If not found as name, assume it's already an ID (backward compatibility)
			resolvedValues = append(resolvedValues, value)
		} else {
			resolvedValues = append(resolvedValues, optionID)
		}
	}
	return resolvedValues, nil
}

// findOptionIDByName finds the option ID for a given option name
func findOptionIDByName(options []*model.CustomProfileAttributesSelectOption, name string) string {
	for _, option := range options {
		if option.Name == name {
			return option.ID
		}
	}
	return ""
}
