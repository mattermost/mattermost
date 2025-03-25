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
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 0, DefaultPageSize).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		cmd := makeCmd()
		err := complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No jobs found", printer.GetLines()[0])

		// Test with 10 per page
		printer.Clean()
		cmd = makeCmd()
		_ = cmd.Flags().Set("per-page", "10")
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 0, 10).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err = complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No jobs found", printer.GetLines()[0])

		// Test with all items
		printer.Clean()
		cmd = makeCmd()
		_ = cmd.Flags().Set("all", "true")
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 0, DefaultPageSize).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err = complianceExportListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No jobs found", printer.GetLines()[0])
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
		cmd := makeCmd()
		_ = cmd.Flags().Set("all", "true")
		_ = cmd.Flags().Set("per-page", "2")

		// Expect 4 API calls (2 jobs each for first 2 pages, 1 job for last page, then a call with 0 jobs)
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 0, 2).
			Return(mockJobs[0:2], &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 1, 2).
			Return(mockJobs[2:4], &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 2, 2).
			Return(mockJobs[4:5], &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetJobs(context.TODO(), "message_export", "", 3, 2).
			Return(mockJobs[5:], &model.Response{}, nil).
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

func (s *MmctlUnitTestSuite) TestComplianceExportShowCmdF() {
	s.Run("show job successfully", func() {
		printer.Clean()
		mockJob := &model.Job{
			Id:       model.NewId(),
			CreateAt: model.GetMillis(),
			Type:     model.JobTypeMessageExport,
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), mockJob.Id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := makeCmd()
		err := complianceExportShowCmdF(s.client, cmd, []string{mockJob.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("show job with error", func() {
		printer.Clean()
		mockError := &model.AppError{
			Message: "failed to get job",
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), "invalid-job-id").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		cmd := makeCmd()
		err := complianceExportShowCmdF(s.client, cmd, []string{"invalid-job-id"})
		s.Require().NotNil(err)
		s.EqualError(err, "failed to get compliance export job: failed to get job")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestComplianceExportCancelCmdF() {
	s.Run("cancel job successfully", func() {
		printer.Clean()
		mockJob := &model.Job{
			Id:       model.NewId(),
			CreateAt: model.GetMillis(),
			Type:     model.JobTypeMessageExport,
			Status:   model.JobStatusPending,
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), mockJob.Id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CancelJob(context.TODO(), mockJob.Id).
			Return(&model.Response{}, nil).
			Times(1)

		cmd := makeCmd()
		err := complianceExportCancelCmdF(s.client, cmd, []string{mockJob.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("cancel job with get error", func() {
		printer.Clean()
		mockError := &model.AppError{
			Message: "failed to get job",
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), "invalid-job-id").
			Return(nil, &model.Response{}, mockError).
			Times(1)

		cmd := makeCmd()
		err := complianceExportCancelCmdF(s.client, cmd, []string{"invalid-job-id"})
		s.Require().NotNil(err)
		s.EqualError(err, "failed to get compliance export job: failed to get job")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("cancel job with cancel error", func() {
		printer.Clean()
		mockJob := &model.Job{
			Id:       model.NewId(),
			CreateAt: model.GetMillis(),
			Type:     model.JobTypeMessageExport,
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), mockJob.Id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		mockError := &model.AppError{
			Message: "failed to cancel job",
		}

		s.client.
			EXPECT().
			CancelJob(context.TODO(), mockJob.Id).
			Return(&model.Response{}, mockError).
			Times(1)

		cmd := makeCmd()
		err := complianceExportCancelCmdF(s.client, cmd, []string{mockJob.Id})
		s.Require().NotNil(err)
		s.EqualError(err, "failed to cancel compliance export job: failed to cancel job")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func makeCmd() *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().Int("page", 0, "")
	cmd.Flags().Int("per-page", DefaultPageSize, "")
	cmd.Flags().Bool("all", false, "")
	return cmd
}
