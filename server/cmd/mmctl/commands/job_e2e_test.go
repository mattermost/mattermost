// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestCreateJobCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	newCmd := func() *cobra.Command {
		cmd := &cobra.Command{}
		cmd.Flags().StringToString("data", nil, "")
		return cmd
	}

	s.Run("create a job without permissions", func() {
		printer.Clean()

		err := createJobCmdF(s.th.Client, newCmd(), []string{model.JobTypeExportProcess})
		s.Require().EqualError(err, "failed to create job: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("create a job", func(c client.Client) {
		printer.Clean()

		err := createJobCmdF(c, newCmd(), []string{model.JobTypeExportProcess})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(model.JobTypeExportProcess, printer.GetLines()[0].(*model.Job).Type)
	})

	s.RunForSystemAdminAndLocal("create a job with data", func(c client.Client) {
		printer.Clean()

		cmd := newCmd()
		err := cmd.Flags().Set("data", "include_attachments=true")
		s.Require().NoError(err)

		err = createJobCmdF(c, cmd, []string{model.JobTypeExportProcess})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal("true", printer.GetLines()[0].(*model.Job).Data["include_attachments"])
	})
}

func (s *MmctlE2ETestSuite) TestShowJobCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	job, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
		Type: model.JobTypeExportProcess,
	})
	s.Require().Nil(appErr)

	s.Run("show a job without permissions", func() {
		printer.Clean()

		err := showJobCmdF(s.th.Client, &cobra.Command{}, []string{job.Id})
		s.Require().EqualError(err, "failed to get job: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("show a job that does not exist", func(c client.Client) {
		printer.Clean()

		err := showJobCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().ErrorContains(err, "failed to get job: Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("show a job", func(c client.Client) {
		printer.Clean()

		err := showJobCmdF(c, &cobra.Command{}, []string{job.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(job, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlE2ETestSuite) TestCancelJobCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	s.Run("cancel a job without permissions", func() {
		printer.Clean()

		job, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		err := cancelJobCmdF(s.th.Client, &cobra.Command{}, []string{job.Id})
		s.Require().EqualError(err, "failed to cancel job: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("cancel a job that does not exist", func(c client.Client) {
		printer.Clean()

		err := cancelJobCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().ErrorContains(err, "failed to cancel job: Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("cancel a job", func(c client.Client) {
		printer.Clean()

		job, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		err := cancelJobCmdF(c, &cobra.Command{}, []string{job.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())

		// Refresh the job to confirm it was canceled.
		job, appErr = s.th.App.GetJob(s.th.Context, job.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(model.JobStatusCanceled, job.Status)
	})
}
