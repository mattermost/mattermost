// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

)

func (s *MmctlUnitTestSuite) TestListJobsCmdF() {
	s.Run("no jobs found", func() {
		printer.Clean()
		var mockJobs []*model.Job

		perPage := 10
		s.cmd.Flags().Int("page", 0, "")
		s.cmd.Flags().Int("per-page", perPage, "")
		s.cmd.Flags().Bool("all", false, "")
		s.cmd.Flags().StringSlice("ids", []string{}, "")
		s.cmd.Flags().String("status", "", "")
		s.cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJobs(s.T().Context(), "", "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, s.cmd, nil)
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

		perPage := 3
		s.cmd.Flags().Int("page", 0, "")
		s.cmd.Flags().Int("per-page", perPage, "")
		s.cmd.Flags().Bool("all", false, "")
		s.cmd.Flags().StringSlice("ids", []string{}, "")
		s.cmd.Flags().String("status", "", "")
		s.cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJobs(s.T().Context(), "", "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, s.cmd, nil)
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

		perPage := 3
		s.cmd.Flags().Int("page", 0, "")
		s.cmd.Flags().Int("per-page", perPage, "")
		s.cmd.Flags().Bool("all", false, "")
		s.cmd.Flags().StringSlice("ids", []string{id}, "")
		s.cmd.Flags().String("status", "", "")
		s.cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJob(s.T().Context(), id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, s.cmd, nil)
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

		perPage := 2
		s.cmd.Flags().Int("page", 0, "")
		s.cmd.Flags().Int("per-page", perPage, "")
		s.cmd.Flags().Bool("all", false, "")
		s.cmd.Flags().String("status", model.JobStatusSuccess, "")
		s.cmd.Flags().StringSlice("ids", []string{}, "")
		s.cmd.Flags().String("type", "", "")

		s.client.
			EXPECT().
			GetJobs(s.T().Context(), "", model.JobStatusSuccess, 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, s.cmd, nil)
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

		perPage := 2
		s.cmd.Flags().Int("page", 0, "")
		s.cmd.Flags().Int("per-page", perPage, "")
		s.cmd.Flags().Bool("all", false, "")
		s.cmd.Flags().String("type", model.JobTypeDataRetention, "")
		s.cmd.Flags().StringSlice("ids", []string{}, "")
		s.cmd.Flags().String("status", "", "")

		s.client.
			EXPECT().
			GetJobs(s.T().Context(), model.JobTypeDataRetention, "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := listJobsCmdF(s.client, s.cmd, nil)
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

		s.cmd.Flags().Bool("force", true, "")

		s.client.
			EXPECT().
			UpdateJobStatus(s.T().Context(), id, model.JobStatusPending, true).
			Return(&model.Response{}, nil).
			Times(1)

		err := updateJobCmdF(s.client, s.cmd, []string{id, model.JobStatusPending})
		s.Require().Nil(err)
	})
}
