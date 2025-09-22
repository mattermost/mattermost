// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var CPAFieldListCmd = &cobra.Command{
	Use:     "list",
	Short:   "List CPA fields",
	Long:    "List all Custom Profile Attribute fields with their properties.",
	Example: `  cpa field list`,
	Args:    cobra.NoArgs,
	RunE:    withClient(cpaFieldListCmdF),
}

var CPAFieldCreateCmd = &cobra.Command{
	Use:   "create [name] [type]",
	Short: "Create a CPA field",
	Long:  `Create a new Custom Profile Attribute field with the specified name and type.`,
	Example: `  cpa field create "Department" text --managed
  cpa field create "Skills" multiselect --option Go --option React --option Python
  cpa field create "Level" select --attrs '{"visibility":"always"}'`,
	Args: cobra.ExactArgs(2),
	RunE: withClient(cpaFieldCreateCmdF),
}

var CPAFieldEditCmd = &cobra.Command{
	Use:   "edit [field-id]",
	Short: "Edit a CPA field",
	Long:  "Edit an existing Custom Profile Attribute field.",
	Example: `  cpa field edit n4qdbtro4j8x3n8z81p48ww9gr --name "Department Name" --managed
  cpa field edit 8kj9xm4p6f3y7n2z9q5w8r1t4v --option Go --option React --option Python --option Java
  cpa field edit 3h7k9m2x5b8v4n6p1q9w7r3t2y --managed=false`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(cpaFieldEditCmdF),
}

var CPAFieldDeleteCmd = &cobra.Command{
	Use:   "delete [field-id]",
	Short: "Delete a CPA field",
	Long:  "Delete a Custom Profile Attribute field. This will automatically delete all user values for this field.",
	Example: `  cpa field delete n4qdbtro4j8x3n8z81p48ww9gr --confirm
  cpa field delete 8kj9xm4p6f3y7n2z9q5w8r1t4v --confirm`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(cpaFieldDeleteCmdF),
}

func init() {
	// Create flags
	CPAFieldCreateCmd.Flags().Bool("managed", false, "Mark field as admin-managed (overrides --attrs)")
	CPAFieldCreateCmd.Flags().String("attrs", "", "Full attrs JSON object for advanced configuration")
	CPAFieldCreateCmd.Flags().StringSlice("option", []string{}, "Add an option for select/multiselect fields (overrides --attrs, can be repeated)")

	// Edit flags
	CPAFieldEditCmd.Flags().String("name", "", "Update field name")
	CPAFieldEditCmd.Flags().Bool("managed", false, "Mark field as admin-managed (overrides --attrs)")
	CPAFieldEditCmd.Flags().String("attrs", "", "Update full attrs JSON object")
	CPAFieldEditCmd.Flags().StringSlice("option", []string{}, "Add an option for select/multiselect fields (overrides --attrs, can be repeated)")

	// Delete flags
	CPAFieldDeleteCmd.Flags().Bool("confirm", false, "Bypass confirmation prompt")

	// Add subcommands to CPAFieldCmd
	CPAFieldCmd.AddCommand(
		CPAFieldListCmd,
		CPAFieldCreateCmd,
		CPAFieldEditCmd,
		CPAFieldDeleteCmd,
	)
}

func cpaFieldListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	fields, _, err := c.ListCPAFields(context.TODO())
	if err != nil {
		return fmt.Errorf("failed to get CPA fields: %w", err)
	}

	// Convert to CPAField objects
	var filteredFields []*model.CPAField
	for _, field := range fields {
		cpaField, err := model.NewCPAFieldFromPropertyField(field)
		if err != nil {
			return fmt.Errorf("failed to convert field %s to CPA field: %w", field.Name, err)
		}

		filteredFields = append(filteredFields, cpaField)
	}

	jsonOutput := viper.GetBool("json")

	if jsonOutput {
		printer.SetFormat(printer.FormatJSON)
		printer.Print(filteredFields)
		return nil
	}

	printer.SetSingle(true)
	for i, field := range filteredFields {
		managed := "user-managed"
		if field.IsAdminManaged() {
			managed = "admin-managed"
		}

		tpl := `id: {{.ID}}
name: {{.Name}}
type: {{.Type}}
managed: ` + managed

		if len(field.Attrs.Options) > 0 {
			tpl += `
options: {{.OptionsStr}}`
		}

		if i > 0 {
			tpl = "------------------------------\n" + tpl
		}

		// Create display struct with options string
		optionsStr := "[]"
		if len(field.Attrs.Options) > 0 {
			optionNames := make([]string, len(field.Attrs.Options))
			for j, opt := range field.Attrs.Options {
				optionNames[j] = opt.Name
			}
			optionsStr = fmt.Sprintf("[%s]", strings.Join(optionNames, ", "))
		}

		fieldOut := struct {
			*model.CPAField
			OptionsStr string
		}{
			CPAField:   field,
			OptionsStr: optionsStr,
		}

		printer.PrintT(tpl, fieldOut)
	}
	return nil
}

func cpaFieldCreateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	name := args[0]
	fieldType := args[1]

	// Build PropertyField object
	field := &model.PropertyField{
		Name:       name,
		Type:       model.PropertyFieldType(fieldType),
		TargetType: "user", // CPA fields target users
		Attrs:      make(model.StringInterface),
	}

	// Build attrs from flags
	attrs, err := buildFieldAttrs(cmd)
	if err != nil {
		return err
	}
	if len(attrs) > 0 {
		field.Attrs = attrs
	}

	// Create the field
	createdField, _, err := c.CreateCPAField(context.TODO(), field)
	if err != nil {
		return fmt.Errorf("failed to create CPA field: %w", err)
	}

	printer.SetSingle(true)
	// Handle output format
	if jsonOutput := viper.GetBool("json"); jsonOutput {
		// Convert to CPAField for JSON display
		cpaField, err := model.NewCPAFieldFromPropertyField(createdField)
		if err != nil {
			// Fall back to showing the PropertyField
			cpaField = &model.CPAField{PropertyField: *createdField}
		}

		printer.SetFormat(printer.FormatJSON)
		printer.Print(cpaField)
	} else {
		// Print success message for plain text output
		printer.Print(fmt.Sprintf("Field %s correctly created", createdField.Name))
	}

	return nil
}

func cpaFieldEditCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	fieldID := args[0]

	// Build patch object
	patch := &model.PropertyFieldPatch{}

	// Update name if provided
	if name, err := cmd.Flags().GetString("name"); err == nil && cmd.Flags().Changed("name") {
		patch.Name = &name
	}

	// Build attrs from flags if any changes
	if hasAttrsChanges(cmd) {
		attrs, err := buildFieldAttrs(cmd)
		if err != nil {
			return err
		}
		if len(attrs) > 0 {
			patch.Attrs = &attrs
		}
	}

	// Update the field
	updatedField, _, err := c.PatchCPAField(context.TODO(), fieldID, patch)
	if err != nil {
		return fmt.Errorf("failed to update CPA field: %w", err)
	}

	printer.SetSingle(true)
	// Handle output format
	if jsonOutput := viper.GetBool("json"); jsonOutput {
		// Convert to CPAField for JSON display
		cpaField, err := model.NewCPAFieldFromPropertyField(updatedField)
		if err != nil {
			// Fall back to showing the PropertyField
			cpaField = &model.CPAField{PropertyField: *updatedField}
		}

		printer.SetFormat(printer.FormatJSON)
		printer.Print(cpaField)
	} else {
		// Print success message for plain text output
		printer.Print(fmt.Sprintf("Field %s successfully updated", updatedField.Name))
	}

	return nil
}

func cpaFieldDeleteCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	fieldID := args[0]

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		if err := getConfirmation("Are you sure you want to delete this CPA field?", true); err != nil {
			return err
		}
	}

	// Delete the field
	_, err := c.DeleteCPAField(context.TODO(), fieldID)
	if err != nil {
		return fmt.Errorf("failed to delete CPA field: %w", err)
	}

	printer.SetSingle(true)
	printer.Print(fmt.Sprintf("Successfully deleted CPA field: %s", fieldID))
	return nil
}
