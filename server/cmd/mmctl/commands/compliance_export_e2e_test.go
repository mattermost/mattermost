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

func (s *MmctlE2ETestSuite) TestComplianceExportShowCmdE2E() {
	s.SetupMessageExportTestHelper()

	now := model.GetMillis()

	// Create a job
	job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
		Id:             st.NewTestID(),
		CreateAt:       now - 1000,
		Status:         model.JobStatusSuccess,
		Type:           model.JobTypeMessageExport,
		StartAt:        now - 1000,
		LastActivityAt: now - 1000,
	})
	s.Require().NoError(err)
	defer func() {
		// Ensure job is deleted from the database
		var result string
		result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
		s.Require().NoError(err, "Failed to delete job (result: %v)", result)
	}()

	s.Run("no permissions", func() {
		printer.Clean()

		cmd := makeCmd()
		err := complianceExportShowCmdF(s.th.Client, cmd, []string{job.Id})
		s.Require().EqualError(err, "failed to get compliance export job: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Show non-existent job", func(c client.Client) {
		printer.Clean()

		cmd := makeCmd()
		err := complianceExportShowCmdF(c, cmd, []string{"non-existent-job-id"})
		s.Require().EqualError(err, "failed to get compliance export job: Sorry, we could not find the page., There doesn't appear to be an api call for the url='/api/v4/jobs/non-existent-job-id'.  Typo? are you missing a team_id or user_id as part of the url?")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Show existing job", func(c client.Client) {
		now := model.GetMillis()
		// Create a job
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusSuccess,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
		})
		s.Require().NoError(err)
		defer func() {
			// Ensure job is deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		printer.Clean()
		cmd := makeCmd()
		err = complianceExportShowCmdF(c, cmd, []string{job.Id})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(job.Id, printer.GetLines()[0].(*model.Job).Id)
	})
}

func (s *MmctlE2ETestSuite) TestComplianceExportCancelCmdE2E() {
	s.SetupMessageExportTestHelper()

	s.Run("no permissions", func() {
		printer.Clean()

		now := model.GetMillis()
		// Create a job
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusInProgress,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
		})
		s.Require().NoError(err)
		defer func() {
			// Ensure job is deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		cmd := makeCmd()
		err = complianceExportCancelCmdF(s.th.Client, cmd, []string{job.Id})
		s.Require().EqualError(err, "failed to get compliance export job: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Cancel non-existent job", func(c client.Client) {
		printer.Clean()

		cmd := makeCmd()
		err := complianceExportCancelCmdF(c, cmd, []string{"non-existent-job-id"})
		s.Require().EqualError(err, "failed to get compliance export job: Sorry, we could not find the page., There doesn't appear to be an api call for the url='/api/v4/jobs/non-existent-job-id'.  Typo? are you missing a team_id or user_id as part of the url?")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Cancel existing job", func(c client.Client) {
		now := model.GetMillis()
		// Create a job
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusInProgress,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
		})
		s.Require().NoError(err)
		defer func() {
			// Ensure job is deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		printer.Clean()
		cmd := makeCmd()
		err = complianceExportCancelCmdF(c, cmd, []string{job.Id})
		s.Require().NoError(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())

		// Verify job was cancelled
		job, _, err = s.th.SystemAdminClient.GetJob(context.Background(), job.Id)
		s.Require().NoError(err)
		s.Require().Equal(model.JobStatusCanceled, job.Status)
	})

	s.RunForSystemAdminAndLocal("Error cancelling job in non-cancellable state", func(c client.Client) {
		now := model.GetMillis()
		// Create a job
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusInProgress,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
		})
		s.Require().NoError(err)
		_, err = s.th.SystemAdminClient.UpdateJobStatus(context.Background(), job.Id, model.JobStatusCanceled, true)
		s.Require().NoError(err)
		defer func() {
			// Ensure job is deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		printer.Clean()
		cmd := makeCmd()
		err = complianceExportCancelCmdF(c, cmd, []string{job.Id})
		s.Require().EqualError(err, "failed to cancel compliance export job: Could not request cancellation for job that is not in a cancelable state.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})
}
