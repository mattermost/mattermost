// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestExtractRunCmdF() {
	s.SetupTestHelper().InitBasic()
	serverPath := os.Getenv("MM_SERVER_PATH")
	docName := "sample-doc.pdf"
	docFilePath := filepath.Join(serverPath, "tests", docName)

	s.Run("no permissions", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int64("from", 0, "")
		cmd.Flags().Int64("to", model.GetMillis()/1000, "")

		err := extractRunCmdF(s.th.Client, cmd, []string{})
		s.Require().NotNil(err)
		s.Require().Equal("failed to create content extraction job: : You do not have the appropriate permissions.", err.Error())
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("run extraction job", func(c client.Client) {
		printer.Clean()

		file, err := os.Open(docFilePath)
		s.Require().NoError(err)
		defer file.Close()

		info, err := file.Stat()
		s.Require().NoError(err)

		us, _, err := s.th.SystemAdminClient.CreateUpload(context.Background(), &model.UploadSession{
			ChannelId: s.th.BasicChannel.Id,
			Filename:  info.Name(),
			FileSize:  info.Size(),
		})
		s.Require().NoError(err)
		s.Require().NotNil(us)

		_, _, err = s.th.SystemAdminClient.UploadData(context.Background(), us.Id, file)
		s.Require().NoError(err)

		cmd := &cobra.Command{}
		cmd.Flags().Int64("from", 0, "")
		cmd.Flags().Int64("to", model.GetMillis()/1000, "")

		err = extractRunCmdF(c, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
	})
}

func (s *MmctlE2ETestSuite) TestExtractJobShowCmdF() {
	s.SetupTestHelper().InitBasic()

	job, appErr := s.th.App.CreateJob(&model.Job{
		Type: model.JobTypeExtractContent,
		Data: map[string]string{},
	})
	s.Require().Nil(appErr)

	s.Run("no permissions", func() {
		printer.Clean()

		job1, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExtractContent,
			Data: map[string]string{},
		})
		s.Require().Nil(appErr)

		err := extractJobShowCmdF(s.th.Client, &cobra.Command{}, []string{job1.Id})
		s.Require().NotNil(err)
		s.Require().Equal("failed to get content extraction job: : You do not have the appropriate permissions.", err.Error())
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("not found", func(c client.Client) {
		printer.Clean()

		err := extractJobShowCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "failed to get content extraction job: : Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("found", func(c client.Client) {
		printer.Clean()

		err := extractJobShowCmdF(c, &cobra.Command{}, []string{job.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(job, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlE2ETestSuite) TestExtractJobListCmdF() {
	s.SetupTestHelper().InitBasic()

	s.Run("no permissions", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := extractJobListCmdF(s.th.Client, cmd, nil)
		s.Require().NotNil(err)
		s.Require().Equal("failed to get jobs: : You do not have the appropriate permissions.", err.Error())
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("no content extraction jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := extractJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("some content extraction jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		perPage := 2
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		_, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExtractContent,
			Data: map[string]string{},
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job2, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExtractContent,
			Data: map[string]string{},
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job3, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExtractContent,
			Data: map[string]string{},
		})
		s.Require().Nil(appErr)

		err := extractJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), perPage)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(job3, printer.GetLines()[0].(*model.Job))
		s.Require().Equal(job2, printer.GetLines()[1].(*model.Job))
	})
}
