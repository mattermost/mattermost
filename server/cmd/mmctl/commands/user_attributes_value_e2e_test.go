// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// cleanCPAValuesForUser removes all CPA values for a user
func (s *MmctlE2ETestSuite) cleanCPAValuesForUser(userID string) {
	existingValues, appErr := s.th.App.ListCPAValues(userID)
	s.Require().Nil(appErr)

	// Clear all existing values by setting them to null
	updates := make(map[string]json.RawMessage)
	for _, value := range existingValues {
		updates[value.FieldID] = json.RawMessage("null")
	}

	if len(updates) > 0 {
		_, appErr = s.th.App.PatchCPAValues(userID, updates, false)
		s.Require().Nil(appErr)
	}
}

func (s *MmctlE2ETestSuite) TestCPAValueList() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	s.Run("List CPA values with no values", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Test listing when no values are set
		err := cpaValueListCmdF(c, &cobra.Command{}, []string{s.th.BasicUser.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("List CPA values with existing values", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Create a text field
		textField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(textField)
		s.Require().Nil(appErr)

		// Set a text value using the app layer
		updates := map[string]json.RawMessage{
			createdField.ID: json.RawMessage(`"Engineering"`),
		}
		_, appErr = s.th.App.PatchCPAValues(s.th.BasicUser.Id, updates, false)
		s.Require().Nil(appErr)

		// Test listing the values with plain format (human-readable)
		printer.SetFormat(printer.FormatPlain)
		err := cpaValueListCmdF(c, &cobra.Command{}, []string{s.th.BasicUser.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Check that the human-readable format is used
		output := printer.GetLines()[0].(string)
		s.Require().Equal("Department (text): Engineering", output)

		// Test with JSON format to ensure raw data is preserved
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		err = cpaValueListCmdF(c, &cobra.Command{}, []string{s.th.BasicUser.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Check that JSON format outputs raw data structure
		outputMap := printer.GetLines()[0].(map[string]any)
		s.Require().Contains(outputMap, createdField.ID)
		s.Require().Equal(`"Engineering"`, string(outputMap[createdField.ID].(json.RawMessage)))
	})
}

func (s *MmctlE2ETestSuite) TestCPAValueSet() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	s.Run("Set value for text type field", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Create a text field
		textField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(textField)
		s.Require().Nil(appErr)

		// Set a text value
		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{}, "")
		err := cmd.Flags().Set("value", "Engineering")
		s.Require().Nil(err)

		err = cpaValueSetCmdF(c, cmd, []string{s.th.BasicUser.Email, createdField.ID})
		s.Require().Nil(err)

		// Verify the value was set
		values, appErr := s.th.App.ListCPAValues(s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		s.Require().Len(values, 1)
		s.Require().Equal(createdField.ID, values[0].FieldID)
		s.Require().Equal(`"Engineering"`, string(values[0].Value))
	})

	s.Run("Set value for select type field", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Create a select field with options
		selectField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Level",
				Type:       model.PropertyFieldTypeSelect,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
				Options: []*model.CustomProfileAttributesSelectOption{
					{ID: model.NewId(), Name: "Junior"},
					{ID: model.NewId(), Name: "Senior"},
					{ID: model.NewId(), Name: "Lead"},
				},
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(selectField)
		s.Require().Nil(appErr)

		// Set a select value using the option name
		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{}, "")
		err := cmd.Flags().Set("value", "Senior")
		s.Require().Nil(err)

		err = cpaValueSetCmdF(c, cmd, []string{s.th.BasicUser.Email, createdField.ID})
		s.Require().Nil(err)

		// Verify the value was set (should be stored as option ID)
		values, appErr := s.th.App.ListCPAValues(s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		s.Require().Len(values, 1)
		s.Require().Equal(createdField.ID, values[0].FieldID)

		// Find the Senior option ID for verification
		var seniorOptionID string
		for _, option := range createdField.Attrs.Options {
			if option.Name == "Senior" {
				seniorOptionID = option.ID
				break
			}
		}
		s.Require().Equal(`"`+seniorOptionID+`"`, string(values[0].Value))
	})

	s.Run("Set value for multiselect type field", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Create a multiselect field with options
		multiselectField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Skills",
				Type:       model.PropertyFieldTypeMultiselect,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
				Options: []*model.CustomProfileAttributesSelectOption{
					{ID: model.NewId(), Name: "Go"},
					{ID: model.NewId(), Name: "React"},
					{ID: model.NewId(), Name: "Python"},
					{ID: model.NewId(), Name: "JavaScript"},
				},
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(multiselectField)
		s.Require().Nil(appErr)

		// Set multiple values using option names
		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{}, "")

		err := cmd.Flags().Set("value", "Go")
		s.Require().Nil(err)
		err = cmd.Flags().Set("value", "React")
		s.Require().Nil(err)
		err = cmd.Flags().Set("value", "Python")
		s.Require().Nil(err)

		err = cpaValueSetCmdF(c, cmd, []string{s.th.BasicUser.Email, createdField.ID})
		s.Require().Nil(err)

		// Verify the values were set (should be stored as option IDs)
		values, appErr := s.th.App.ListCPAValues(s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		s.Require().Len(values, 1)
		s.Require().Equal(createdField.ID, values[0].FieldID)

		// Find the option IDs for verification
		var goOptionID, reactOptionID, pythonOptionID string
		for _, option := range createdField.Attrs.Options {
			switch option.Name {
			case "Go":
				goOptionID = option.ID
			case "React":
				reactOptionID = option.ID
			case "Python":
				pythonOptionID = option.ID
			}
		}

		// The multiselect values should be stored as an array of option IDs
		// The JSON serialization may include spaces, so we need to compare the content, not exact string
		actualValue := string(values[0].Value)
		s.Require().Contains(actualValue, goOptionID)
		s.Require().Contains(actualValue, reactOptionID)
		s.Require().Contains(actualValue, pythonOptionID)
	})

	s.Run("Set a single value for multiselect type field", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Create a multiselect field with options
		multiselectField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Programming Languages",
				Type:       model.PropertyFieldTypeMultiselect,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
				Options: []*model.CustomProfileAttributesSelectOption{
					{ID: model.NewId(), Name: "Go"},
					{ID: model.NewId(), Name: "Python"},
					{ID: model.NewId(), Name: "JavaScript"},
				},
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(multiselectField)
		s.Require().Nil(appErr)

		// Set a single value using option name
		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{}, "")

		err := cmd.Flags().Set("value", "Python")
		s.Require().Nil(err)

		err = cpaValueSetCmdF(c, cmd, []string{s.th.BasicUser.Email, createdField.ID})
		s.Require().Nil(err)

		// Verify the value was set (should be stored as an array with single option ID)
		values, appErr := s.th.App.ListCPAValues(s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		s.Require().Len(values, 1)
		s.Require().Equal(createdField.ID, values[0].FieldID)

		// Find the option ID for verification
		var pythonOptionID string
		for _, option := range createdField.Attrs.Options {
			if option.Name == "Python" {
				pythonOptionID = option.ID
				break
			}
		}

		// The multiselect value should be stored as an array with single option ID
		// Even for single value, multiselect fields store values as arrays
		actualValue := string(values[0].Value)
		s.Require().Contains(actualValue, pythonOptionID)
		s.Require().Contains(actualValue, "[")
		s.Require().Contains(actualValue, "]")
		// Verify it doesn't contain other option IDs
		for _, option := range createdField.Attrs.Options {
			if option.Name != "Python" {
				s.Require().NotContains(actualValue, option.ID)
			}
		}
	})

	s.Run("Set value for user type field", func() {
		c := s.th.SystemAdminClient
		printer.Clean()
		s.cleanCPAFields()
		s.cleanCPAValuesForUser(s.th.BasicUser.Id)

		// Create a user field
		userField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Manager",
				Type:       model.PropertyFieldTypeUser,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(userField)
		s.Require().Nil(appErr)

		// Set a user value using the system admin user ID
		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{}, "")
		err := cmd.Flags().Set("value", s.th.SystemAdminUser.Id)
		s.Require().Nil(err)

		err = cpaValueSetCmdF(c, cmd, []string{s.th.BasicUser.Email, createdField.ID})
		s.Require().Nil(err)

		// Verify the value was set
		values, appErr := s.th.App.ListCPAValues(s.th.BasicUser.Id)
		s.Require().Nil(appErr)
		s.Require().Len(values, 1)
		s.Require().Equal(createdField.ID, values[0].FieldID)
		s.Require().Equal(`"`+s.th.SystemAdminUser.Id+`"`, string(values[0].Value))
	})
}
