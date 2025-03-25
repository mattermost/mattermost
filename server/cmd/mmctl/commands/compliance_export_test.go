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
			ListComplianceExports(context.TODO(), 0, DefaultPageSize).
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
			ListComplianceExports(context.TODO(), 0, DefaultPageSize).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err = complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No compliance export jobs found", printer.GetLines()[0])
	})

	s.Run("list with paging", func() {
		// Create 5 mock jobs
		mockJobs := make([]*model.Job, 5)
		for i := range 5 {
			mockJobs[i] = &model.Job{
				Id:       model.NewId(),
				CreateAt: model.GetMillis() - int64(i*1000),
			}
		}

		// Test paging with 2 jobs per page
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().Bool("all", true, "")
		cmd.Flags().Int("per-page", 2, "")

		// Expect 3 API calls (2 jobs each for first 2 pages, 1 job for last page)
		s.client.
			EXPECT().
			ListComplianceExports(context.TODO(), 0, 2).
			Return(mockJobs[0:2], &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			ListComplianceExports(context.TODO(), 1, 2).
			Return(mockJobs[2:4], &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			ListComplianceExports(context.TODO(), 2, 2).
			Return(mockJobs[4:5], &model.Response{}, nil).
			Times(1)

		err := complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 5)
		s.Len(printer.GetErrorLines(), 0)

		// Verify jobs are printed in correct order
		for i := range 5 {
			s.Equal(mockJobs[i].Id, printer.GetLines()[i].(*model.Job).Id)
		}
	})
}
