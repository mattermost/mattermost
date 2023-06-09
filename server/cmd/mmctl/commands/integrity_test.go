// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"

	"github.com/hashicorp/go-multierror"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestIntegrityCmd() {
	s.Run("Integrity check succeeds", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		mockData := model.RelationalIntegrityCheckData{
			ParentName:   "parent",
			ChildName:    "child",
			ParentIdAttr: "parentIdAttr",
			ChildIdAttr:  "childIdAttr",
			Records: []model.OrphanedRecord{
				{
					ParentId: model.NewString("parentId"),
					ChildId:  model.NewString("childId"),
				},
			},
		}
		mockResults := []model.IntegrityCheckResult{
			{
				Data: mockData,
				Err:  nil,
			},
		}
		s.client.
			EXPECT().
			CheckIntegrity(context.Background()).
			Return(mockResults, &model.Response{}, nil).
			Times(1)

		err := integrityCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(mockData, printer.GetLines()[0])
	})

	s.Run("Integrity check fails", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		s.client.
			EXPECT().
			CheckIntegrity(context.Background()).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := integrityCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal("unable to perform integrity check. Error: mock error", err.Error())
	})

	s.Run("Integrity check with errors", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().Bool("confirm", true, "")

		mockData := model.RelationalIntegrityCheckData{
			ParentName:   "parent",
			ChildName:    "child",
			ParentIdAttr: "parentIdAttr",
			ChildIdAttr:  "childIdAttr",
			Records: []model.OrphanedRecord{
				{
					ParentId: model.NewString("parentId"),
					ChildId:  model.NewString("childId"),
				},
			},
		}
		mockResults := []model.IntegrityCheckResult{
			{
				Data: nil,
				Err:  errors.New("test error"),
			},
			{
				Data: mockData,
				Err:  nil,
			},
		}
		s.client.
			EXPECT().
			CheckIntegrity(context.Background()).
			Return(mockResults, &model.Response{}, nil).
			Times(1)
		var expected error
		expected = multierror.Append(expected, errors.New("test error"))

		err := integrityCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Equal(mockData, printer.GetLines()[0])
		s.Require().Equal("test error", printer.GetErrorLines()[0])
	})
}
