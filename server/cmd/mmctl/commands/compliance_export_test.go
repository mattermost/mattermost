// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestComplianceExportListCmdF() {
	s.Run("list default pagination", func() {
		printer.Clean()
		var mockJobs []*model.Job

		// Test with default pagination
		cmd := &cobra.Command{}
		s.client.
			EXPECT().
			ListComplianceExports(context.TODO(), 0, 200).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No compliance export jobs found", printer.GetLines()[0])

		// Test with 10 per page
		printer.Clean()
		cmd = &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 10, "")
		s.client.
			EXPECT().
			ListComplianceExports(context.TODO(), 0, 10).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err = complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No compliance export jobs found", printer.GetLines()[0])

		// Test with all items
		printer.Clean()
		cmd = &cobra.Command{}
		cmd.Flags().Bool("all", true, "")
		s.client.
			EXPECT().
			ListComplianceExports(context.TODO(), 0, 0).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err = complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No compliance export jobs found", printer.GetLines()[0])
	})
}
