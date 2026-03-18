// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func (s *MmctlUnitTestSuite) TestCPAFieldListCmd() {
	s.Run("Should list all CPA fields with plain text output format", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		// Mock property fields from API
		mockFields := []*model.PropertyField{
			{
				ID:   "field1",
				Name: "Department",
				Type: model.PropertyFieldTypeText,
				Attrs: model.StringInterface{
					"managed": "admin",
				},
			},
			{
				ID:   "field2",
				Name: "Skills",
				Type: model.PropertyFieldTypeMultiselect,
				Attrs: model.StringInterface{
					"managed": "",
					"options": []map[string]any{
						{"id": "opt1", "name": "Go"},
						{"id": "opt2", "name": "React"},
					},
				},
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		err := cpaFieldListCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().NotEmpty(lines)
	})

	s.Run("Should handle empty fields list scenario", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return([]*model.PropertyField{}, &model.Response{}, nil).
			Times(1)

		err := cpaFieldListCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Empty(lines)
	})

	s.Run("Should handle API error when ListCPAFields fails", func() {
		printer.Clean()

		expectedError := errors.New("API error")
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		err := cpaFieldListCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to get CPA fields")
		s.Require().Contains(err.Error(), "API error")
	})

	s.Run("Should handle conversion error when NewCPAFieldFromPropertyField fails", func() {
		printer.Clean()

		// Create a property field with invalid attrs that will cause conversion to fail
		invalidField := &model.PropertyField{
			ID:   "invalid",
			Name: "Invalid Field",
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				"options": "invalid-json-structure", // This should cause JSON unmarshaling to fail
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return([]*model.PropertyField{invalidField}, &model.Response{}, nil).
			Times(1)

		err := cpaFieldListCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to convert field")
		s.Require().Contains(err.Error(), "Invalid Field")
	})

	s.Run("Should show correct field properties", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		// Test admin-managed field
		adminField := &model.PropertyField{
			ID:   "admin-field",
			Name: "Admin Department",
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				"managed": "admin",
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return([]*model.PropertyField{adminField}, &model.Response{}, nil).
			Times(1)

		err := cpaFieldListCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)

		// Verify that exactly one field is printed (since printer.SetSingle(true) is used)
		s.Require().Len(printer.GetLines(), 1)

		// The output should be a string containing the field information
		output, ok := printer.GetLines()[0].(string)
		s.Require().True(ok, "Expected output to be a string")
		s.Require().Contains(output, "admin-field", "Output should contain field ID")
		s.Require().Contains(output, "Admin Department", "Output should contain field name")
		s.Require().Contains(output, "text", "Output should contain field type")
		s.Require().Contains(output, "admin-managed", "Output should show admin-managed status")
	})

	s.Run("Should show options for select/multiselect fields", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		// Create field with options
		selectField := &model.PropertyField{
			ID:   "select-field",
			Name: "Level",
			Type: model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				"managed": "",
				"options": json.RawMessage(`[{"id":"opt1","name":"Junior"},{"id":"opt2","name":"Senior"}]`),
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return([]*model.PropertyField{selectField}, &model.Response{}, nil).
			Times(1)

		err := cpaFieldListCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)

		// Verify that exactly one field is printed
		s.Require().Len(printer.GetLines(), 1)

		// The output should be a string containing the field information and options
		output, ok := printer.GetLines()[0].(string)
		s.Require().True(ok, "Expected output to be a string")
		s.Require().Contains(output, "select-field", "Output should contain field ID")
		s.Require().Contains(output, "Level", "Output should contain field name")
		s.Require().Contains(output, "select", "Output should contain field type")
		s.Require().Contains(output, "user-managed", "Output should show user-managed status")
		s.Require().Contains(output, "Junior, Senior", "Output should contain option names")
	})
}

func (s *MmctlUnitTestSuite) TestCPAFieldCreateCmd() {
	s.Run("Should successfully create text field with name and type only", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		expectedField := &model.PropertyField{
			ID:         "created-field-id",
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      make(model.StringInterface),
		}

		s.client.
			EXPECT().
			CreateCPAField(context.TODO(), &model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
				Attrs:      make(model.StringInterface),
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Department", "text"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department correctly created")
	})

	s.Run("Should successfully create admin-managed field with managed=true flag", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		expectedField := &model.PropertyField{
			ID:         "admin-field-id",
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"managed": "admin",
			},
		}

		s.client.
			EXPECT().
			CreateCPAField(context.TODO(), &model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
				Attrs: model.StringInterface{
					"managed": "admin",
				},
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		_ = cmd.Flags().Set("managed", "true")
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Department", "text"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department correctly created")
	})

	s.Run("Should successfully create select field with multiple option flags", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		expectedField := &model.PropertyField{
			ID:         "select-field-id",
			Name:       "Level",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				"options": []*model.CustomProfileAttributesSelectOption{
					{ID: "opt1", Name: "Junior"},
					{ID: "opt2", Name: "Senior"},
				},
			},
		}

		// We need to match on a field that has options, but we can't predict the generated IDs
		s.client.
			EXPECT().
			CreateCPAField(context.TODO(), gomock.Any()).
			DoAndReturn(func(ctx context.Context, field *model.PropertyField) (*model.PropertyField, *model.Response, error) {
				// Verify the structure of the field being created
				s.Require().Equal("Level", field.Name)
				s.Require().Equal(model.PropertyFieldTypeSelect, field.Type)
				s.Require().Equal("user", field.TargetType)

				// Check that options were created with the right names
				options, ok := field.Attrs["options"].([]*model.CustomProfileAttributesSelectOption)
				s.Require().True(ok)
				s.Require().Len(options, 2)
				s.Require().Equal("Junior", options[0].Name)
				s.Require().Equal("Senior", options[1].Name)
				s.Require().NotEmpty(options[0].ID)
				s.Require().NotEmpty(options[1].ID)

				return expectedField, &model.Response{}, nil
			}).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("option", "Junior")
		_ = cmd.Flags().Set("option", "Senior")
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Level", "select"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Level correctly created")
	})

	s.Run("Should successfully create field with attrs JSON string", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		expectedField := &model.PropertyField{
			ID:         "attrs-field-id",
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"visibility": "always",
				"required":   true,
			},
		}

		s.client.
			EXPECT().
			CreateCPAField(context.TODO(), &model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
				Attrs: model.StringInterface{
					"visibility": "always",
					"required":   true,
				},
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("attrs", "", "")
		_ = cmd.Flags().Set("attrs", `{"visibility":"always","required":true}`)
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Department", "text"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department correctly created")
	})

	s.Run("Should have individual flags override attrs JSON precedence", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		expectedField := &model.PropertyField{
			ID:         "override-field-id",
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"visibility": "always",
				"managed":    "admin", // Individual flag should override this
			},
		}

		s.client.
			EXPECT().
			CreateCPAField(context.TODO(), &model.PropertyField{
				Name:       "Department",
				Type:       model.PropertyFieldTypeText,
				TargetType: "user",
				Attrs: model.StringInterface{
					"visibility": "always",
					"managed":    "admin", // Should be overridden by the --managed flag
				},
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().Bool("managed", false, "")
		_ = cmd.Flags().Set("attrs", `{"visibility":"always","managed":""}`)
		_ = cmd.Flags().Set("managed", "true")
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Department", "text"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department correctly created")
	})

	s.Run("Should handle error for invalid attrs JSON syntax", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("attrs", "", "")
		_ = cmd.Flags().Set("attrs", `{"invalid": json}`) // Invalid JSON
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Department", "text"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to parse attrs JSON")
	})

	s.Run("Should handle API error when CreateCPAField client call fails", func() {
		printer.Clean()

		expectedError := errors.New("API error")
		s.client.
			EXPECT().
			CreateCPAField(context.TODO(), gomock.Any()).
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		cmd := &cobra.Command{}
		err := cpaFieldCreateCmdF(s.client, cmd, []string{"Department", "text"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to create CPA field")
		s.Require().Contains(err.Error(), "API error")
	})
}

func (s *MmctlUnitTestSuite) TestCPAFieldEditCmd() {
	s.Run("Should successfully update field name with --name flag", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		mockFields := []*model.PropertyField{
			{
				ID:   fieldID,
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "New Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      make(model.StringInterface),
		}

		newName := "New Department"
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, &model.PropertyFieldPatch{
				Name: &newName,
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		_ = cmd.Flags().Set("name", "New Department")
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field New Department successfully updated")
	})

	s.Run("Should successfully update managed flag to true", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"managed": "admin",
			},
		}

		expectedAttrs := model.StringInterface{
			"managed": "admin",
		}

		mockFields := []*model.PropertyField{expectedField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, &model.PropertyFieldPatch{
				Attrs: &expectedAttrs,
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("managed", "true")
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department successfully updated")
	})

	s.Run("Should successfully update managed flag to false", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"managed": "",
			},
		}

		expectedAttrs := model.StringInterface{
			"managed": "",
		}

		mockFields := []*model.PropertyField{expectedField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, &model.PropertyFieldPatch{
				Attrs: &expectedAttrs,
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("managed", "false")
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department successfully updated")
	})

	s.Run("Should successfully update with attrs JSON string", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"visibility": "always",
				"required":   true,
			},
		}

		expectedAttrs := model.StringInterface{
			"visibility": "always",
			"required":   true,
		}

		mockFields := []*model.PropertyField{expectedField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, &model.PropertyFieldPatch{
				Attrs: &expectedAttrs,
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("attrs", `{"visibility":"always","required":true}`)
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department successfully updated")
	})

	s.Run("Should successfully update with multiple option flags", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "Skills",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				"options": []*model.CustomProfileAttributesSelectOption{
					{ID: "opt1", Name: "Go"},
					{ID: "opt2", Name: "React"},
					{ID: "opt3", Name: "Python"},
				},
			},
		}

		mockFields := []*model.PropertyField{expectedField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, gomock.Any()).
			DoAndReturn(func(ctx context.Context, receivedFieldID string, patch *model.PropertyFieldPatch) (*model.PropertyField, *model.Response, error) {
				s.Require().Equal(fieldID, receivedFieldID)
				s.Require().NotNil(patch.Attrs)

				options, ok := (*patch.Attrs)["options"].([]*model.CustomProfileAttributesSelectOption)
				s.Require().True(ok)
				s.Require().Len(options, 3)
				s.Require().Equal("Go", options[0].Name)
				s.Require().Equal("React", options[1].Name)
				s.Require().Equal("Python", options[2].Name)
				s.Require().NotEmpty(options[0].ID)
				s.Require().NotEmpty(options[1].ID)
				s.Require().NotEmpty(options[2].ID)

				return expectedField, &model.Response{}, nil
			}).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("option", "Go")
		_ = cmd.Flags().Set("option", "React")
		_ = cmd.Flags().Set("option", "Python")
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Skills successfully updated")
	})

	s.Run("Should have individual flags override attrs JSON", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "Department",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"visibility": "always",
				"managed":    "admin", // individual flag should override attrs
			},
		}

		mockFields := []*model.PropertyField{expectedField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, gomock.Any()).
			DoAndReturn(func(ctx context.Context, receivedFieldID string, patch *model.PropertyFieldPatch) (*model.PropertyField, *model.Response, error) {
				s.Require().Equal(fieldID, receivedFieldID)
				s.Require().NotNil(patch.Attrs)

				// individual flags should take precedence over attrs
				s.Require().Equal("admin", (*patch.Attrs)["managed"])
				s.Require().Equal("always", (*patch.Attrs)["visibility"])

				return expectedField, &model.Response{}, nil
			}).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("managed", "true")
		_ = cmd.Flags().Set("attrs", `{"visibility":"always","managed":""}`)
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Department successfully updated")
	})

	s.Run("Should skip attrs when no changes provided", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		newName := "New Name"
		fieldID := model.NewId()
		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "New Name",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      make(model.StringInterface),
		}

		mockFields := []*model.PropertyField{expectedField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		// Should only pass name, no attrs
		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, &model.PropertyFieldPatch{
				Name: &newName,
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		_ = cmd.Flags().Set("name", "New Name")
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field New Name successfully updated")
	})

	s.Run("Should handle error for invalid attrs JSON syntax", func() {
		printer.Clean()

		fieldID := model.NewId()
		mockField := &model.PropertyField{
			ID:   fieldID,
			Name: "Department",
			Type: model.PropertyFieldTypeText,
		}
		mockFields := []*model.PropertyField{mockField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("attrs", `{"invalid": json}`) // Invalid JSON
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to parse attrs JSON")
	})

	s.Run("Should handle API error when PatchCPAField client call fails", func() {
		printer.Clean()

		fieldID := model.NewId()
		mockField := &model.PropertyField{
			ID:   fieldID,
			Name: "Department",
			Type: model.PropertyFieldTypeText,
		}
		mockFields := []*model.PropertyField{mockField}
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		expectedError := errors.New("API error")
		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, gomock.Any()).
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		_ = cmd.Flags().Set("name", "New Name")
		err := cpaFieldEditCmdF(s.client, cmd, []string{fieldID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to update CPA field")
		s.Require().Contains(err.Error(), "API error")
	})

	s.Run("Should successfully edit field by name", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("json", false)

		fieldID := model.NewId()
		mockFields := []*model.PropertyField{
			{
				ID:   fieldID,
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		expectedField := &model.PropertyField{
			ID:         fieldID,
			Name:       "Team",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				"managed": "admin",
			},
		}

		newName := "Team"
		expectedAttrs := model.StringInterface{
			"managed": "admin",
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAField(context.TODO(), fieldID, &model.PropertyFieldPatch{
				Name:  &newName,
				Attrs: &expectedAttrs,
			}).
			Return(expectedField, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("name", "", "")
		cmd.Flags().Bool("managed", false, "")
		cmd.Flags().String("attrs", "", "")
		cmd.Flags().StringSlice("option", []string{}, "")
		_ = cmd.Flags().Set("name", "Team")
		_ = cmd.Flags().Set("managed", "true")
		err := cpaFieldEditCmdF(s.client, cmd, []string{"Department"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Field Team successfully updated")
	})
}

func (s *MmctlUnitTestSuite) TestCPAFieldDeleteCmd() {
	s.Run("Should successfully delete field with --confirm flag", func() {
		printer.Clean()

		fieldID := model.NewId()
		mockFields := []*model.PropertyField{
			{
				ID:   fieldID,
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteCPAField(context.TODO(), fieldID).
			Return(&model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		_ = cmd.Flags().Set("confirm", "true")
		err := cpaFieldDeleteCmdF(s.client, cmd, []string{fieldID})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Successfully deleted CPA field: "+fieldID)
	})

	s.Run("Should successfully delete field by name with --confirm flag", func() {
		printer.Clean()

		fieldID := model.NewId()
		mockFields := []*model.PropertyField{
			{
				ID:   fieldID,
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			DeleteCPAField(context.TODO(), fieldID).
			Return(&model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		_ = cmd.Flags().Set("confirm", "true")
		err := cpaFieldDeleteCmdF(s.client, cmd, []string{"Department"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().Len(lines, 1)
		s.Require().Contains(lines[0], "Successfully deleted CPA field: Department")
	})

	s.Run("Should handle getFieldFromArg error when field not found", func() {
		printer.Clean()

		fieldID := model.NewId()
		mockFields := []*model.PropertyField{
			{
				ID:   fieldID,
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		_ = cmd.Flags().Set("confirm", "true")
		err := cpaFieldDeleteCmdF(s.client, cmd, []string{"NonexistentField"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), `failed to get field for "NonexistentField"`)
	})

	s.Run("Should handle ListCPAFields API error in getFieldFromArg", func() {
		printer.Clean()

		expectedError := errors.New("API error")
		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		_ = cmd.Flags().Set("confirm", "true")
		err := cpaFieldDeleteCmdF(s.client, cmd, []string{"field-name"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to get CPA fields")
		s.Require().Contains(err.Error(), "API error")
	})

	s.Run("Should error when --confirm flag is not provided in non-interactive shell", func() {
		printer.Clean()

		// No client call expected since confirmation fails in non-interactive shell
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		err := cpaFieldDeleteCmdF(s.client, cmd, []string{"field-id"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "could not proceed, either enable --confirm flag or use an interactive shell to complete operation: this is not an interactive shell")
	})

	s.Run("Should handle API error when DeleteCPAField client call fails", func() {
		printer.Clean()

		fieldID := model.NewId()
		mockFields := []*model.PropertyField{
			{
				ID:   fieldID,
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		expectedError := errors.New("API error")
		s.client.
			EXPECT().
			DeleteCPAField(context.TODO(), fieldID).
			Return(&model.Response{}, expectedError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", false, "")
		_ = cmd.Flags().Set("confirm", "true")
		err := cpaFieldDeleteCmdF(s.client, cmd, []string{fieldID})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to delete CPA field")
		s.Require().Contains(err.Error(), "API error")
	})
}
