// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestCPAValueListCmd() {
	s.Run("Should list all CPA values with plain text output format", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		mockValues := map[string]json.RawMessage{
			"field1": json.RawMessage(`"Engineering"`),
			"field2": json.RawMessage(`["Go", "React", "Python"]`),
		}

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAValues(context.TODO(), "user123").
			Return(mockValues, &model.Response{}, nil).
			Times(1)

		err := cpaValueListCmdF(s.client, &cobra.Command{}, []string{"testuser@example.com"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		s.Require().NotEmpty(lines)
	})

	s.Run("Should handle empty value list scenario", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAValues(context.TODO(), "user123").
			Return(map[string]json.RawMessage{}, &model.Response{}, nil).
			Times(1)

		err := cpaValueListCmdF(s.client, &cobra.Command{}, []string{"testuser@example.com"})
		s.Require().NoError(err)

		lines := printer.GetLines()
		// When there are no values, no output should be produced
		s.Require().Len(lines, 0)
	})

	s.Run("Should handle API error when ListCPAValues fails", func() {
		printer.Clean()

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		expectedError := errors.New("API error")

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAValues(context.TODO(), "user123").
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		err := cpaValueListCmdF(s.client, &cobra.Command{}, []string{"testuser@example.com"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to get CPA values for user")
		s.Require().Contains(err.Error(), "API error")
	})

	s.Run("Should handle getUserFromArg error", func() {
		printer.Clean()

		notFoundError := errors.New("user not found")
		notFoundResponse := &model.Response{StatusCode: http.StatusNotFound}

		// getUserFromArg tries email first, then username, then user ID
		// All should return NotFoundError so it tries all methods
		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "nonexistent@example.com", "").
			Return(nil, notFoundResponse, notFoundError).
			Times(1)

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), "nonexistent@example.com", "").
			Return(nil, notFoundResponse, notFoundError).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), "nonexistent@example.com", "").
			Return(nil, notFoundResponse, notFoundError).
			Times(1)

		err := cpaValueListCmdF(s.client, &cobra.Command{}, []string{"nonexistent@example.com"})
		s.Require().Error(err)
	})
}

func (s *MmctlUnitTestSuite) TestCPAValueSetCmd() {
	s.Run("Should successfully set single CPA value", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		mockFields := []*model.PropertyField{
			{
				ID:   "field123",
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		mockUpdatedValues := map[string]json.RawMessage{
			"field123": json.RawMessage(`"Engineering"`),
		}

		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{"Engineering"}, "")

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAValuesForUser(context.TODO(), "user123", gomock.Any()).
			Return(mockUpdatedValues, &model.Response{}, nil).
			Times(1)

		err := cpaValueSetCmdF(s.client, cmd, []string{"testuser@example.com", "field123"})
		s.Require().NoError(err)
	})

	s.Run("Should successfully set multiple CPA values", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		mockFields := []*model.PropertyField{
			{
				ID:   "field123",
				Name: "Skills",
				Type: model.PropertyFieldTypeMultiselect,
			},
		}

		mockUpdatedValues := map[string]json.RawMessage{
			"field123": json.RawMessage(`["Go", "React", "Python"]`),
		}

		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{"Go", "React", "Python"}, "")

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAValuesForUser(context.TODO(), "user123", gomock.Any()).
			Return(mockUpdatedValues, &model.Response{}, nil).
			Times(1)

		err := cpaValueSetCmdF(s.client, cmd, []string{"testuser@example.com", "field123"})
		s.Require().NoError(err)
	})

	s.Run("Should handle field not found error", func() {
		printer.Clean()

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		mockFields := []*model.PropertyField{
			{
				ID:   "different_field",
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{"Engineering"}, "")

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		err := cpaValueSetCmdF(s.client, cmd, []string{"testuser@example.com", "nonexistent_field"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "field nonexistent_field not found")
	})

	s.Run("Should handle API error when PatchCPAValuesForUser fails", func() {
		printer.Clean()

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		mockFields := []*model.PropertyField{
			{
				ID:   "field123",
				Name: "Department",
				Type: model.PropertyFieldTypeText,
			},
		}

		expectedError := errors.New("permission denied")

		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{"Engineering"}, "")

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(mockFields, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			PatchCPAValuesForUser(context.TODO(), "user123", gomock.Any()).
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		err := cpaValueSetCmdF(s.client, cmd, []string{"testuser@example.com", "field123"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to set CPA value")
		s.Require().Contains(err.Error(), "permission denied")
	})

	s.Run("Should handle ListCPAFields API error", func() {
		printer.Clean()

		mockUser := &model.User{
			Id:       "user123",
			Username: "testuser",
		}

		expectedError := errors.New("fields API error")

		cmd := &cobra.Command{}
		cmd.Flags().StringSlice("value", []string{"Engineering"}, "")

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), "testuser@example.com", "").
			Return(mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			ListCPAFields(context.TODO()).
			Return(nil, &model.Response{}, expectedError).
			Times(1)

		err := cpaValueSetCmdF(s.client, cmd, []string{"testuser@example.com", "field123"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "failed to get CPA fields")
		s.Require().Contains(err.Error(), "fields API error")
	})
}
