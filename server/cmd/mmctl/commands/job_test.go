// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"

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

func (s *MmctlUnitTestSuite) TestCreateJobCmdF() {
	s.Run("create job with data", func() {
		printer.Clean()
		data := map[string]string{"batch_size": "1000"}
		mockJob := &model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeMessageExport,
			Data: data,
		}

		cmd := &cobra.Command{}
		cmd.Flags().StringToString("data", nil, "")
		err := cmd.Flags().Set("data", "batch_size=1000")
		s.Require().NoError(err)

		s.client.
			EXPECT().
			CreateJob(context.TODO(), &model.Job{Type: model.JobTypeMessageExport, Data: data}).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err = createJobCmdF(s.client, cmd, []string{model.JobTypeMessageExport})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("forwards type not in AllJobTypes to the server", func() {
		printer.Clean()
		mockJob := &model.Job{Id: model.NewId(), Type: model.JobTypeAccessControlSync}

		cmd := &cobra.Command{}
		cmd.Flags().StringToString("data", nil, "")

		s.client.
			EXPECT().
			CreateJob(context.TODO(), &model.Job{Type: model.JobTypeAccessControlSync, Data: map[string]string{}}).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := createJobCmdF(s.client, cmd, []string{model.JobTypeAccessControlSync})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
	})

	s.Run("create job returns server error", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().StringToString("data", nil, "")

		s.client.
			EXPECT().
			CreateJob(context.TODO(), &model.Job{Type: model.JobTypeLdapSync, Data: map[string]string{}}).
			Return(nil, &model.Response{}, errors.New("some-error")).
			Times(1)

		err := createJobCmdF(s.client, cmd, []string{model.JobTypeLdapSync})
		s.Require().NotNil(err)
		s.Empty(printer.GetLines())
	})
}

func (s *MmctlUnitTestSuite) TestJobTypeCompletionF() {
	s.Run("suggests all job types for the first argument", func() {
		suggestions, directive := jobTypeCompletionF(&cobra.Command{}, []string{}, "")
		s.Equal(cobra.ShellCompDirectiveNoFileComp, directive)
		s.ElementsMatch(model.AllJobTypes[:], suggestions)
	})

	s.Run("suggests nothing once the type is provided", func() {
		suggestions, directive := jobTypeCompletionF(&cobra.Command{}, []string{model.JobTypeLdapSync}, "")
		s.Equal(cobra.ShellCompDirectiveNoFileComp, directive)
		s.Empty(suggestions)
	})
}

func (s *MmctlUnitTestSuite) TestShowJobCmdF() {
	s.Run("show job", func() {
		printer.Clean()
		id := model.NewId()
		mockJob := &model.Job{Id: id}

		s.client.
			EXPECT().
			GetJob(context.TODO(), id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := showJobCmdF(s.client, &cobra.Command{}, []string{id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("show job with invalid ID", func() {
		printer.Clean()

		err := showJobCmdF(s.client, &cobra.Command{}, []string{"invalid-id"})
		s.Require().NotNil(err)
		s.Empty(printer.GetLines())
	})
}

func (s *MmctlUnitTestSuite) TestCancelJobCmdF() {
	s.Run("cancel job", func() {
		printer.Clean()
		id := model.NewId()

		s.client.
			EXPECT().
			CancelJob(context.TODO(), id).
			Return(&model.Response{}, nil).
			Times(1)

		err := cancelJobCmdF(s.client, &cobra.Command{}, []string{id})
		s.Require().Nil(err)
		s.Empty(printer.GetErrorLines())
	})

	s.Run("cancel job with invalid ID", func() {
		printer.Clean()

		err := cancelJobCmdF(s.client, &cobra.Command{}, []string{"invalid-id"})
		s.Require().NotNil(err)
	})

	s.Run("cancel job returns server error", func() {
		printer.Clean()
		id := model.NewId()

		s.client.
			EXPECT().
			CancelJob(context.TODO(), id).
			Return(&model.Response{}, errors.New("some-error")).
			Times(1)

		err := cancelJobCmdF(s.client, &cobra.Command{}, []string{id})
		s.Require().NotNil(err)
	})
}
