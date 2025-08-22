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
		FlagChanges map[string]string // map of flag name -> value to set
		Expected    model.StringInterface
		ShouldError bool
		ErrorText   string
	}{
		{
			Name:        "Should return empty attrs when no flags are set",
			FlagChanges: map[string]string{},
			Expected:    model.StringInterface{},
			ShouldError: false,
		},
		{
			Name:        "Should create attrs with managed=admin when managed=true",
			FlagChanges: map[string]string{"managed": "true"},
			Expected:    model.StringInterface{"managed": "admin"},
			ShouldError: false,
		},
		{
			Name:        "Should create attrs with managed='' when managed=false",
			FlagChanges: map[string]string{"managed": "false"},
			Expected:    model.StringInterface{"managed": ""},
			ShouldError: false,
		},
		{
			Name:        "Should parse attrs JSON string and apply to StringInterface",
			FlagChanges: map[string]string{"attrs": `{"visibility":"always","required":true}`},
			Expected:    model.StringInterface{"visibility": "always", "required": true},
			ShouldError: false,
		},
		{
			Name:        "Should create CustomProfileAttributesSelectOption array with generated IDs for option flags",
			FlagChanges: map[string]string{"option": "Go"},
			Expected:    model.StringInterface{}, // We'll verify the structure in the test
			ShouldError: false,
		},
		{
			Name: "Should have individual flags override attrs JSON values",
			FlagChanges: map[string]string{
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
			FlagChanges: map[string]string{"attrs": `{"invalid": json}`},
			Expected:    nil,
			ShouldError: true,
			ErrorText:   "failed to parse attrs JSON",
		},
		{
			Name: "Should combine managed and option flags correctly",
			FlagChanges: map[string]string{
				"managed": "true",
				"option":  "Go",
			},
			Expected:    model.StringInterface{"managed": "admin"}, // Options verified separately
			ShouldError: false,
		},
		{
			Name: "Should handle multiple option flags",
			FlagChanges: map[string]string{
				"option": "Go", // Note: We'll need to set multiple values differently
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
					// Special handling for multiple options in specific test cases
					if tc.Name == "Should handle multiple option flags" {
						err := cmd.Flags().Set("option", "Go")
						s.Require().NoError(err)
						err = cmd.Flags().Set("option", "React")
						s.Require().NoError(err)
						err = cmd.Flags().Set("option", "Python")
						s.Require().NoError(err)
					} else {
						err := cmd.Flags().Set(flagName, flagValue)
						s.Require().NoError(err)
					}
				} else {
					err := cmd.Flags().Set(flagName, flagValue)
					s.Require().NoError(err)
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

				// Special validation for option-related test cases
				switch tc.Name {
				case "Should create CustomProfileAttributesSelectOption array with generated IDs for option flags":
					s.Require().Contains(result, "options")
					options, ok := result["options"].([]*model.CustomProfileAttributesSelectOption)
					s.Require().True(ok, "Options should be []*model.CustomProfileAttributesSelectOption")
					s.Require().Len(options, 1)
					s.Require().Equal("Go", options[0].Name)
					s.Require().NotEmpty(options[0].ID)
				case "Should combine managed and option flags correctly":
					s.Require().Contains(result, "managed")
					s.Require().Equal("admin", result["managed"])
					s.Require().Contains(result, "options")
					options, ok := result["options"].([]*model.CustomProfileAttributesSelectOption)
					s.Require().True(ok)
					s.Require().Len(options, 1)
					s.Require().Equal("Go", options[0].Name)
					s.Require().NotEmpty(options[0].ID)
				case "Should handle multiple option flags":
					s.Require().Contains(result, "options")
					options, ok := result["options"].([]*model.CustomProfileAttributesSelectOption)
					s.Require().True(ok)
					s.Require().Len(options, 3)

					optionNames := make([]string, len(options))
					for i, opt := range options {
						optionNames[i] = opt.Name
						s.Require().NotEmpty(opt.ID)
					}
					s.Require().Contains(optionNames, "Go")
					s.Require().Contains(optionNames, "React")
					s.Require().Contains(optionNames, "Python")
				default:
					// Standard validation for other test cases
					for key, expectedValue := range tc.Expected {
						s.Require().Contains(result, key)
						s.Require().Equal(expectedValue, result[key])
					}
					s.Require().Len(result, len(tc.Expected))
				}
			}
		})
	}
}
