// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestListJobsCmdF() {
	s.Run("no jobs found", func() {
		printer.Clean()
		var mockJobs []*model.Job

		cmd := &cobra.Command{}
		perPage := 10
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")
		cmd.Flags().StringSlice("ids", []string{}, "")
		cmd.Flags().String("status", "", "")
		cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), "", "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.Run("3 jobs found", func() {
		printer.Clean()
		mockJobs := []*model.Job{
			{
				Id: model.NewId(),
			},
			{
				Id: model.NewId(),
			},
			{
				Id: model.NewId(),
			},
		}

		cmd := &cobra.Command{}
		perPage := 3
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")
		cmd.Flags().StringSlice("ids", []string{}, "")
		cmd.Flags().String("status", "", "")
		cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), "", "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockJobs))
		s.Empty(printer.GetErrorLines())
		for i, line := range printer.GetLines() {
			s.Equal(mockJobs[i], line.(*model.Job))
		}
	})

	s.Run("return 1 job using ids flag", func() {
		printer.Clean()
		id := model.NewId()
		mockJob := &model.Job{
			Id: id,
		}

		cmd := &cobra.Command{}
		perPage := 3
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")
		cmd.Flags().StringSlice("ids", []string{id}, "")
		cmd.Flags().String("status", "", "")
		cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJob(context.TODO(), id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		for _, line := range printer.GetLines() {
			s.Equal(mockJob, line.(*model.Job))
		}
	})

	s.Run("return 2 jobs by status", func() {
		printer.Clean()
		mockJobs := []*model.Job{
			{
				Id:     model.NewId(),
				Status: model.JobStatusSuccess,
			},
			{
				Id:     model.NewId(),
				Status: model.JobStatusSuccess,
			},
		}

		cmd := &cobra.Command{}
		perPage := 2
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")
		cmd.Flags().String("status", model.JobStatusSuccess, "")
		cmd.Flags().StringSlice("ids", []string{}, "")
		cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), "", model.JobStatusSuccess, 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockJobs))
		s.Empty(printer.GetErrorLines())
		for i, line := range printer.GetLines() {
			s.Equal(mockJobs[i], line.(*model.Job))
		}
	})

	s.Run("return 2 jobs by type", func() {
		printer.Clean()
		mockJobs := []*model.Job{
			{
				Id:   model.NewId(),
				Type: model.JobTypeDataRetention,
			},
			{
				Id:   model.NewId(),
				Type: model.JobTypeDataRetention,
			},
		}

		cmd := &cobra.Command{}
		perPage := 2
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")
		cmd.Flags().String("type", model.JobTypeDataRetention, "")
		cmd.Flags().StringSlice("ids", []string{}, "")
		cmd.Flags().String("status", "", "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), model.JobTypeDataRetention, "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockJobs))
		s.Empty(printer.GetErrorLines())
		for i, line := range printer.GetLines() {
			s.Equal(mockJobs[i], line.(*model.Job))
		}
	})
}

func (s *MmctlUnitTestSuite) TestUpdateJobCmdF() {
	s.Run("update job status", func() {
		printer.Clean()
		id := model.NewId()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("force", true, "")

		s.client.
			EXPECT().
			UpdateJobStatus(context.TODO(), id, model.JobStatusPending, true).
			Return(&model.Response{}, nil).
			Times(1)

		err := updateJobCmdF(s.client, cmd, []string{id, model.JobStatusPending})
		s.Require().Nil(err)
	})
}
