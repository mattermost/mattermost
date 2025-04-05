// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	st "github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestComplianceExportListCmdE2E() {
	s.SetupMessageExportTestHelper()

	s.Run("no permissions", func() {
		printer.Clean()

		cmd := makeCmd()
		err := complianceExportListCmdF(s.th.Client, cmd, nil)
		s.Require().EqualError(err, "failed to get jobs: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	jobType := model.JobTypeMessageExport

	s.RunForSystemAdminAndLocal("List with no compliance export jobs", func(c client.Client) {
		// Ensure no jobs exist
		jobs, _, err := s.th.SystemAdminClient.GetJobsByType(context.Background(), jobType, 0, 1000)
		s.Require().NoError(err)

		for _, job := range jobs {
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}

		cmd := makeCmd()
		// Test default pagination
		printer.Clean()
		err = complianceExportListCmdF(c, cmd, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("No jobs found", printer.GetLines()[0])

		// Test with 1 per page
		printer.Clean()
		cmd = makeCmd()
		_ = cmd.Flags().Set("page", "0")
		_ = cmd.Flags().Set("per-page", "1")
		err = complianceExportListCmdF(c, cmd, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("No jobs found", printer.GetLines()[0])

		// Test with all items
		printer.Clean()
		cmd = makeCmd()
		_ = cmd.Flags().Set("all", "true")
		err = complianceExportListCmdF(c, cmd, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("No jobs found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("List compliance export jobs", func(c client.Client) {
		now := model.GetMillis()
		// Create 2 jobs
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusSuccess,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
		})
		s.Require().NoError(err)

		job2, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 100,
			Status:         model.JobStatusSuccess,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 100,
			LastActivityAt: now - 100,
		})
		s.Require().NoError(err)
		defer func() {
			// Ensure jobs are deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
			result, err = s.th.App.Srv().Store().Job().Delete(job2.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		// Test default pagination
		printer.Clean()
		cmd := makeCmd()
		err = complianceExportListCmdF(c, cmd, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(job2.Id, printer.GetLines()[0].(*model.Job).Id)
		s.Require().Equal(job.Id, printer.GetLines()[1].(*model.Job).Id)

		// Test with 1 per page
		printer.Clean()
		cmd = makeCmd()
		_ = cmd.Flags().Set("page", "0")
		_ = cmd.Flags().Set("per-page", "1")
		err = complianceExportListCmdF(c, cmd, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(job2.Id, printer.GetLines()[0].(*model.Job).Id)

		// Test with all items
		printer.Clean()
		cmd = makeCmd()
		_ = cmd.Flags().Set("all", "true")
		err = complianceExportListCmdF(c, cmd, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(job2.Id, printer.GetLines()[0].(*model.Job).Id)
		s.Require().Equal(job.Id, printer.GetLines()[1].(*model.Job).Id)
	})
}
