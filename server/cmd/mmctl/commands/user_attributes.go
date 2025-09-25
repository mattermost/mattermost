// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"fmt"
	"maps"

	"github.com/mattermost/mattermost/server/public/model"
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

// Helper function to build field attributes from command flags
func buildFieldAttrs(cmd *cobra.Command) (model.StringInterface, error) {
	attrs := make(model.StringInterface)

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
		for _, optionName := range options {
			selectOptions = append(selectOptions, &model.CustomProfileAttributesSelectOption{
				ID:   model.NewId(),
				Name: optionName,
			})
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
