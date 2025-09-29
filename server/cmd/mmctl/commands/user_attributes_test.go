// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestHasAttrsChanges() {
	testCases := []struct {
		Name        string
		FlagChanges map[string]string // map of flag name -> value to set
		Expected    bool
	}{
		{
			Name:        "Should return true when managed flag is changed",
			FlagChanges: map[string]string{"managed": "true"},
			Expected:    true,
		},
		{
			Name:        "Should return true when attrs flag is changed",
			FlagChanges: map[string]string{"attrs": `{"visibility":"always"}`},
			Expected:    true,
		},
		{
			Name:        "Should return true when option flag is changed",
			FlagChanges: map[string]string{"option": "Go"},
			Expected:    true,
		},
		{
			Name: "Should return true when multiple relevant flags are changed",
			FlagChanges: map[string]string{
				"managed": "true",
				"attrs":   `{"visibility":"always"}`,
				"option":  "Go",
			},
			Expected: true,
		},
		{
			Name:        "Should return false when no relevant flags are changed",
			FlagChanges: map[string]string{}, // No flags set
			Expected:    false,
		},
		{
			Name:        "Should return false for other unrelated flag changes like name",
			FlagChanges: map[string]string{"name": "New Name"},
			Expected:    false,
		},
		{
			Name: "Should return true when managed flag is changed along with unrelated flags",
			FlagChanges: map[string]string{
				"managed": "true",
				"name":    "New Name",
			},
			Expected: true,
		},
		{
			Name: "Should return true when attrs flag is changed along with unrelated flags",
			FlagChanges: map[string]string{
				"attrs": `{"visibility":"always"}`,
				"name":  "New Name",
			},
			Expected: true,
		},
		{
			Name: "Should return true when option flag is changed along with unrelated flags",
			FlagChanges: map[string]string{
				"option": "Go",
				"name":   "New Name",
			},
			Expected: true,
		},
	}

	for _, tc := range testCases {
		s.Run(tc.Name, func() {
			cmd := &cobra.Command{}

			// Set up all the flags that might be used
			cmd.Flags().Bool("managed", false, "")
			cmd.Flags().String("attrs", "", "")
			cmd.Flags().StringSlice("option", []string{}, "")
			cmd.Flags().String("name", "", "")

			// Apply the flag changes for this test case
			for flagName, flagValue := range tc.FlagChanges {
				err := cmd.Flags().Set(flagName, flagValue)
				s.Require().NoError(err)
			}

			result := hasAttrsChanges(cmd)
			s.Require().Equal(tc.Expected, result)
		})
	}
}

func (s *MmctlUnitTestSuite) TestBuildFieldAttrs() {
	testCases := []struct {
		Name        string
		FlagChanges map[string]any // map of flag name -> value or []string for options
		Expected    model.StringInterface
		ShouldError bool
		ErrorText   string
	}{
		{
			Name:        "Should return empty attrs when no flags are set",
			FlagChanges: map[string]any{},
			Expected:    model.StringInterface{},
			ShouldError: false,
		},
		{
			Name:        "Should create attrs with managed=admin when managed=true",
			FlagChanges: map[string]any{"managed": "true"},
			Expected:    model.StringInterface{"managed": "admin"},
			ShouldError: false,
		},
		{
			Name:        "Should create attrs with managed='' when managed=false",
			FlagChanges: map[string]any{"managed": "false"},
			Expected:    model.StringInterface{"managed": ""},
			ShouldError: false,
		},
		{
			Name:        "Should parse attrs JSON string and apply to StringInterface",
			FlagChanges: map[string]any{"attrs": `{"visibility":"always","required":true}`},
			Expected:    model.StringInterface{"visibility": "always", "required": true},
			ShouldError: false,
		},
		{
			Name:        "Should create CustomProfileAttributesSelectOption array with generated IDs for option flags",
			FlagChanges: map[string]any{"option": []string{"Go"}},
			Expected:    model.StringInterface{},
			ShouldError: false,
		},
		{
			Name: "Should have individual flags override attrs JSON values",
			FlagChanges: map[string]any{
				"attrs":   `{"visibility":"always","managed":""}`,
				"managed": "true", // Should override the managed="" from attrs
			},
			Expected: model.StringInterface{
				"visibility": "always",
				"managed":    "admin", // Individual flag should override
			},
			ShouldError: false,
		},
		{
			Name:        "Should handle error for invalid attrs JSON syntax",
			FlagChanges: map[string]any{"attrs": `{"invalid": json}`},
			Expected:    nil,
			ShouldError: true,
			ErrorText:   "failed to parse attrs JSON",
		},
		{
			Name: "Should combine managed and option flags correctly",
			FlagChanges: map[string]any{
				"managed": "true",
				"option":  []string{"Go"},
			},
			Expected:    model.StringInterface{"managed": "admin"},
			ShouldError: false,
		},
		{
			Name: "Should handle multiple option flags",
			FlagChanges: map[string]any{
				"option": []string{"Go", "React", "Python"},
			},
			Expected:    model.StringInterface{},
			ShouldError: false,
		},
	}

	for _, tc := range testCases {
		s.Run(tc.Name, func() {
			cmd := &cobra.Command{}

			// Set up all the flags that might be used
			cmd.Flags().Bool("managed", false, "")
			cmd.Flags().String("attrs", "", "")
			cmd.Flags().StringSlice("option", []string{}, "")

			// Apply the flag changes for this test case
			for flagName, flagValue := range tc.FlagChanges {
				if flagName == "option" {
					// Handle option flag with list of values
					if options, ok := flagValue.([]string); ok {
						for _, optionName := range options {
							err := cmd.Flags().Set("option", optionName)
							s.Require().NoError(err)
						}
					}
				} else {
					// Handle other flags as strings
					if stringValue, ok := flagValue.(string); ok {
						err := cmd.Flags().Set(flagName, stringValue)
						s.Require().NoError(err)
					}
				}
			}

			result, err := buildFieldAttrs(cmd, nil)

			if tc.ShouldError {
				s.Require().Error(err)
				s.Require().Contains(err.Error(), tc.ErrorText)
				s.Require().Nil(result)
			} else {
				s.Require().NoError(err)
				s.Require().NotNil(result)

				// Check if we expect options based on FlagChanges
				var expectedOptions []string
				if optionValue, exists := tc.FlagChanges["option"]; exists {
					if options, ok := optionValue.([]string); ok {
						expectedOptions = options
					}
				}

				// Validate options if specified
				if len(expectedOptions) > 0 {
					s.Require().Contains(result, "options")
					options, ok := result["options"].([]*model.CustomProfileAttributesSelectOption)
					s.Require().True(ok, "Options should be []*model.CustomProfileAttributesSelectOption")

					optionNames := make([]string, len(options))
					for i, opt := range options {
						optionNames[i] = opt.Name
						s.Require().NotEmpty(opt.ID)
					}
					s.Require().ElementsMatch(expectedOptions, optionNames)
				}

				// Standard validation for expected fields
				for key, expectedValue := range tc.Expected {
					s.Require().Contains(result, key)
					s.Require().Equal(expectedValue, result[key])
				}
			}
		})
	}

	// Test cases with existing attributes (for edit scenarios)
	s.Run("WithExistingAttrs", func() {
		existingAttrsTestCases := []struct {
			Name            string
			ExistingAttrs   model.StringInterface
			FlagChanges     map[string]any
			ExpectedAttrs   model.StringInterface
			ExpectedOptions []string // For option validation
			ShouldError     bool
			ErrorText       string
		}{
			{
				Name: "Should preserve existing attrs when no flags changed",
				ExistingAttrs: model.StringInterface{
					"visibility": "always",
					"required":   true,
					"managed":    "admin",
				},
				FlagChanges: map[string]any{},
				ExpectedAttrs: model.StringInterface{
					"visibility": "always",
					"required":   true,
					"managed":    "admin",
				},
				ShouldError: false,
			},
			{
				Name: "Should preserve existing attrs and only update managed flag",
				ExistingAttrs: model.StringInterface{
					"visibility": "always",
					"required":   true,
					"managed":    "admin",
					"options": []*model.CustomProfileAttributesSelectOption{
						{ID: "existing1", Name: "Option1"},
						{ID: "existing2", Name: "Option2"},
					},
				},
				FlagChanges: map[string]any{"managed": "false"},
				ExpectedAttrs: model.StringInterface{
					"visibility": "always",
					"required":   true,
					"managed":    "",
					"options": []*model.CustomProfileAttributesSelectOption{
						{ID: "existing1", Name: "Option1"},
						{ID: "existing2", Name: "Option2"},
					},
				},
				ShouldError: false,
			},
			{
				Name: "Should preserve existing option IDs when re-specifying same options",
				ExistingAttrs: model.StringInterface{
					"managed": "admin",
					"options": []*model.CustomProfileAttributesSelectOption{
						{ID: "existing1", Name: "Option1"},
						{ID: "existing2", Name: "Option2"},
					},
				},
				FlagChanges:     map[string]any{"option": []string{"Option1", "Option2"}},
				ExpectedOptions: []string{"Option1", "Option2"},
				ExpectedAttrs: model.StringInterface{
					"managed": "admin",
				},
				ShouldError: false,
			},
			{
				Name: "Should preserve existing option IDs and add new options",
				ExistingAttrs: model.StringInterface{
					"visibility": "always",
					"options": []*model.CustomProfileAttributesSelectOption{
						{ID: "existing1", Name: "Option1"},
						{ID: "existing2", Name: "Option2"},
					},
				},
				FlagChanges:     map[string]any{"option": []string{"Option1", "Option2", "Option3"}},
				ExpectedOptions: []string{"Option1", "Option2", "Option3"},
				ExpectedAttrs: model.StringInterface{
					"visibility": "always",
				},
				ShouldError: false,
			},
			{
				Name: "Should remove options not specified in new option list",
				ExistingAttrs: model.StringInterface{
					"managed": "",
					"options": []*model.CustomProfileAttributesSelectOption{
						{ID: "existing1", Name: "Option1"},
						{ID: "existing2", Name: "Option2"},
						{ID: "existing3", Name: "Option3"},
					},
				},
				FlagChanges:     map[string]any{"option": []string{"Option2", "Option4"}},
				ExpectedOptions: []string{"Option2", "Option4"},
				ExpectedAttrs: model.StringInterface{
					"managed": "",
				},
				ShouldError: false,
			},
			{
				Name: "Should handle attrs JSON merge with existing attrs",
				ExistingAttrs: model.StringInterface{
					"visibility": "always",
					"required":   true,
					"managed":    "admin",
				},
				FlagChanges: map[string]any{"attrs": `{"required":false,"newfield":"newvalue"}`},
				ExpectedAttrs: model.StringInterface{
					"visibility": "always",
					"required":   false,
					"managed":    "admin",
					"newfield":   "newvalue",
				},
				ShouldError: false,
			},
			{
				Name: "Should handle managed flag override after attrs JSON",
				ExistingAttrs: model.StringInterface{
					"visibility": "always",
					"managed":    "admin",
				},
				FlagChanges: map[string]any{
					"attrs":   `{"managed":"user","newfield":"value"}`,
					"managed": "true",
				},
				ExpectedAttrs: model.StringInterface{
					"visibility": "always",
					"managed":    "admin", // managed flag should override attrs
					"newfield":   "value",
				},
				ShouldError: false,
			},
		}

		for _, tc := range existingAttrsTestCases {
			s.Run(tc.Name, func() {
				cmd := &cobra.Command{}
				cmd.Flags().Bool("managed", false, "")
				cmd.Flags().String("attrs", "", "")
				cmd.Flags().StringSlice("option", []string{}, "")

				// Set flags based on test case
				for flagName, flagValue := range tc.FlagChanges {
					switch flagName {
					case "option":
						if options, ok := flagValue.([]string); ok {
							for _, opt := range options {
								err := cmd.Flags().Set(flagName, opt)
								s.Require().NoError(err)
							}
						}
					default:
						err := cmd.Flags().Set(flagName, fmt.Sprintf("%v", flagValue))
						s.Require().NoError(err)
					}
				}

				result, err := buildFieldAttrs(cmd, tc.ExistingAttrs)

				if tc.ShouldError {
					s.Require().Error(err)
					s.Require().Contains(err.Error(), tc.ErrorText)
					s.Require().Nil(result)
				} else {
					s.Require().NoError(err)
					s.Require().NotNil(result)

					// Validate options if specified
					if len(tc.ExpectedOptions) > 0 {
						s.Require().Contains(result, "options")
						options, ok := result["options"].([]*model.CustomProfileAttributesSelectOption)
						s.Require().True(ok, "Options should be []*model.CustomProfileAttributesSelectOption")

						optionNames := make([]string, len(options))
						optionIDs := make([]string, len(options))
						for i, opt := range options {
							optionNames[i] = opt.Name
							optionIDs[i] = opt.ID
							s.Require().NotEmpty(opt.ID)
						}
						s.Require().ElementsMatch(tc.ExpectedOptions, optionNames)

						// Verify ID preservation for existing options
						if existingOptions, ok := tc.ExistingAttrs["options"]; ok {
							if existingList, ok := existingOptions.([]*model.CustomProfileAttributesSelectOption); ok {
								existingMap := make(map[string]string)
								for _, existing := range existingList {
									existingMap[existing.Name] = existing.ID
								}

								for i, option := range options {
									if existingID, exists := existingMap[option.Name]; exists {
										s.Require().Equal(existingID, optionIDs[i],
											"Option %s should preserve existing ID %s", option.Name, existingID)
									}
								}
							}
						}
					}

					// Validate non-option attributes
					for key, expectedValue := range tc.ExpectedAttrs {
						if key != "options" { // Skip options as they're validated separately
							s.Require().Contains(result, key)
							s.Require().Equal(expectedValue, result[key])
						}
					}
				}
			})
		}
	})
}
