// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
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

			result, err := buildFieldAttrs(cmd)

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
}
