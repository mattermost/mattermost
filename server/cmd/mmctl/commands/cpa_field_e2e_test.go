// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// cleanCPAFields removes all existing CPA fields to ensure clean test state
func (s *MmctlE2ETestSuite) cleanCPAFields() {
	existingFields, appErr := s.th.App.ListCPAFields()
	s.Require().Nil(appErr)
	for _, field := range existingFields {
		appErr := s.th.App.DeleteCPAField(field.ID)
		s.Require().Nil(appErr)
	}
}

func (s *MmctlE2ETestSuite) TestCPAFieldListCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	s.RunForSystemAdminAndLocal("List CPA fields with no entries", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		err := cpaFieldListCmdF(c, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0) // No fields should be present initially
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("List CPA fields with entries", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		// Create a couple of test CPA fields
		textField := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "admin",
			},
		}

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
				},
			},
		}

		createdTextField, appErr := s.th.App.CreateCPAField(textField)
		s.Require().Nil(appErr)
		s.Require().NotNil(createdTextField)

		createdSelectField, appErr := s.th.App.CreateCPAField(selectField)
		s.Require().Nil(appErr)
		s.Require().NotNil(createdSelectField)

		// Now test the list command
		err := cpaFieldListCmdF(c, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2) // Should have 2 fields now
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify the output contains our created fields
		lines := printer.GetLines()
		s.Require().Len(lines, 2, "Should have exactly 2 output lines for 2 fields")
	})
}

func (s *MmctlE2ETestSuite) TestCPAFieldCreateCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	s.RunForSystemAdminAndLocal("Create managed text field", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		// Create command with arguments and managed flag
		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")

		// Set the managed flag to true
		err := cmd.Flags().Set("managed", "true")
		s.Require().Nil(err)

		err = cpaFieldCreateCmdF(c, cmd, []string{"Department", "text"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify the success message
		output := printer.GetLines()[0].(string)
		s.Require().Contains(output, "Field Department correctly created")

		// Verify field was actually created in the database
		fields, appErr := s.th.App.ListCPAFields()
		s.Require().Nil(appErr)
		s.Require().Len(fields, 1)
		s.Require().Equal("Department", fields[0].Name)
		s.Require().Equal(model.PropertyFieldTypeText, fields[0].Type)
		s.Require().Equal("admin", fields[0].Attrs["managed"])
	})

	s.RunForSystemAdminAndLocal("Create multiselect field with options", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		// Create command with arguments and option flags
		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")

		// Set the option flags
		err := cmd.Flags().Set("option", "Go")
		s.Require().Nil(err)
		err = cmd.Flags().Set("option", "React")
		s.Require().Nil(err)
		err = cmd.Flags().Set("option", "Python")
		s.Require().Nil(err)

		err = cpaFieldCreateCmdF(c, cmd, []string{"Skills", "multiselect"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify the success message
		output := printer.GetLines()[0].(string)
		s.Require().Contains(output, "Field Skills correctly created")

		// Verify field was actually created in the database with correct options
		fields, appErr := s.th.App.ListCPAFields()
		s.Require().Nil(appErr)
		s.Require().Len(fields, 1)
		s.Require().Equal("Skills", fields[0].Name)
		s.Require().Equal(model.PropertyFieldTypeMultiselect, fields[0].Type)

		// Convert to CPAField for easier option inspection
		cpaField, err := model.NewCPAFieldFromPropertyField(fields[0])
		s.Require().Nil(err)

		// Verify the options were created
		s.Require().Len(cpaField.Attrs.Options, 3)

		// Extract option names to verify they match what we set
		var optionNames []string
		for _, option := range cpaField.Attrs.Options {
			optionNames = append(optionNames, option.Name)
		}
		s.Require().Contains(optionNames, "Go")
		s.Require().Contains(optionNames, "React")
		s.Require().Contains(optionNames, "Python")
	})
}

func (s *MmctlE2ETestSuite) TestCPAFieldEditCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	s.RunForSystemAdminAndLocal("Edit nonexistent field should fail", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")

		err := cmd.Flags().Set("name", "New Name")
		s.Require().Nil(err)

		err = cpaFieldEditCmdF(c, cmd, []string{"nonexistent-field-id"})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "failed to update CPA field")
	})

	s.RunForSystemAdminAndLocal("Edit field using --name and --option flags", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		// First create a field to edit
		field := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Skills",
				Type:       model.PropertyFieldTypeSelect,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Options: []*model.CustomProfileAttributesSelectOption{
					{ID: model.NewId(), Name: "Go"},
				},
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(field)
		s.Require().Nil(appErr)

		// Now edit the field
		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")

		err := cmd.Flags().Set("name", "Programming Languages")
		s.Require().Nil(err)
		err = cmd.Flags().Set("option", "Go")
		s.Require().Nil(err)
		err = cmd.Flags().Set("option", "Python")
		s.Require().Nil(err)

		err = cpaFieldEditCmdF(c, cmd, []string{createdField.ID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify the success message
		output := printer.GetLines()[0].(string)
		s.Require().Contains(output, "Field Programming Languages successfully updated")

		// Verify field was actually updated
		updatedField, appErr := s.th.App.GetCPAField(createdField.ID)
		s.Require().Nil(appErr)
		s.Require().Equal("Programming Languages", updatedField.Name)

		// Convert to CPAField to check options
		cpaField, err := model.NewCPAFieldFromPropertyField(updatedField)
		s.Require().Nil(err)
		s.Require().Len(cpaField.Attrs.Options, 2)

		var optionNames []string
		for _, option := range cpaField.Attrs.Options {
			optionNames = append(optionNames, option.Name)
		}
		s.Require().Contains(optionNames, "Go")
		s.Require().Contains(optionNames, "Python")
	})

	s.RunForSystemAdminAndLocal("Edit field using --managed flag", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		// First create a field to edit
		field := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
			},
			Attrs: model.CPAAttrs{
				Managed: "",
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(field)
		s.Require().Nil(appErr)

		// Now edit the field with --managed flag
		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")

		err := cmd.Flags().Set("managed", "true")
		s.Require().Nil(err)

		err = cpaFieldEditCmdF(c, cmd, []string{createdField.ID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify field was actually updated
		updatedField, appErr := s.th.App.GetCPAField(createdField.ID)
		s.Require().Nil(appErr)

		// Convert to CPAField to check attrs
		cpaField, err := model.NewCPAFieldFromPropertyField(updatedField)
		s.Require().Nil(err)

		// Verify that managed flag was set correctly
		s.Require().Equal("admin", cpaField.Attrs.Managed)
	})
}

func (s *MmctlE2ETestSuite) TestCPAFieldDeleteCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	s.RunForSystemAdminAndLocal("Delete existing field", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		// First create a field to delete
		field := &model.CPAField{
			PropertyField: model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
			},
		}

		createdField, appErr := s.th.App.CreateCPAField(field)
		s.Require().Nil(appErr)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")

		err := cmd.Flags().Set("confirm", "true")
		s.Require().Nil(err)

		err = cpaFieldDeleteCmdF(c, cmd, []string{createdField.ID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify the success message
		output := printer.GetLines()[0].(string)
		s.Require().Contains(output, "Successfully deleted CPA field")

		// Verify field was actually deleted by checking if it exists in the list
		fields, appErr := s.th.App.ListCPAFields()
		s.Require().Nil(appErr)

		// Field should not be in the list anymore
		fieldExists := false
		for _, field := range fields {
			if field.ID == createdField.ID {
				fieldExists = true
				break
			}
		}
		s.Require().False(fieldExists, "Field should have been deleted but still exists in the list")
	})

	s.RunForSystemAdminAndLocal("Delete nonexistent field", func(c client.Client) {
		printer.Clean()
		s.cleanCPAFields()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")

		err := cmd.Flags().Set("confirm", "true")
		s.Require().Nil(err)

		err = cpaFieldDeleteCmdF(c, cmd, []string{"nonexistent-field-id"})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "failed to delete CPA field")
	})
}
