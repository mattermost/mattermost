// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestImportUploadCmdF() {
	s.SetupTestHelper().InitBasic()
	serverPath := os.Getenv("MM_SERVER_PATH")
	importName := "import_test.zip"
	importFilePath := filepath.Join(serverPath, "tests", importName)

	s.Run("no permissions", func() {
		printer.Clean()

		err := importUploadCmdF(s.th.Client, &cobra.Command{}, []string{importFilePath})
		s.Require().NotNil(err)
		s.Require().Equal("failed to create upload session: : You do not have the appropriate permissions.", err.Error())
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("invalid file", func(c client.Client) {
		printer.Clean()

		err := importUploadCmdF(s.th.Client, &cobra.Command{}, []string{"invalid_file"})
		s.Require().NotNil(err)
		s.Require().Equal("failed to open import file: open invalid_file: no such file or directory", err.Error())
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("full upload", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		if c == s.th.LocalClient {
			cmd.Flags().Bool("local", true, "")
		}

		err := importUploadCmdF(c, cmd, []string{importFilePath})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(importName, printer.GetLines()[0].(*model.UploadSession).Filename)
		s.Require().Equal(importName, printer.GetLines()[1].(*model.FileInfo).Name)
	})

	s.RunForSystemAdminAndLocal("resume upload", func(c client.Client) {
		printer.Clean()

		userID := "me"
		cmd := &cobra.Command{}
		if c == s.th.LocalClient {
			cmd.Flags().Bool("local", true, "")
			userID = "nouser"
		}

		us, _, err := c.CreateUpload(context.TODO(), &model.UploadSession{
			Filename: importName,
			FileSize: 276051,
			Type:     model.UploadTypeImport,
			UserId:   userID,
		})
		s.Require().NoError(err)

		cmd.Flags().Bool("resume", true, "")
		cmd.Flags().String("upload", us.Id, "")

		err = importUploadCmdF(c, cmd, []string{importFilePath})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(importName, printer.GetLines()[0].(*model.FileInfo).Name)
	})
}

func (s *MmctlE2ETestSuite) TestImportProcessCmdF() {
	s.SetupTestHelper().InitBasic()
	serverPath := os.Getenv("MM_SERVER_PATH")
	importName := "import_test.zip"
	importFilePath := filepath.Join(serverPath, "tests", importName)

	s.Run("no permissions", func() {
		printer.Clean()

		err := importProcessCmdF(s.th.Client, &cobra.Command{}, []string{"importName"})
		s.Require().NotNil(err)
		s.Require().Equal("failed to create import process job: : You do not have the appropriate permissions.", err.Error())
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("process file", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		if c == s.th.LocalClient {
			cmd.Flags().Bool("local", true, "")
		}

		err := importUploadCmdF(c, cmd, []string{importFilePath})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Empty(printer.GetErrorLines())

		us := printer.GetLines()[0].(*model.UploadSession)
		printer.Clean()

		err = importProcessCmdF(c, cmd, []string{us.Id + "_" + importName})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(us.Id+"_"+importName, printer.GetLines()[0].(*model.Job).Data["import_file"])
	})
}

func (s *MmctlE2ETestSuite) TestImportListAvailableCmdF() {
	s.SetupTestHelper().InitBasic()
	serverPath := os.Getenv("MM_SERVER_PATH")
	importName := "import_test.zip"
	importFilePath := filepath.Join(serverPath, "tests", importName)

	s.Run("no permissions", func() {
		printer.Clean()

		err := importListAvailableCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "failed to list imports: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("no imports", func(c client.Client) {
		printer.Clean()

		err := importListAvailableCmdF(c, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No import files found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("some imports", func(c client.Client) {
		cmd := &cobra.Command{}
		if c == s.th.LocalClient {
			cmd.Flags().Bool("local", true, "")
		}

		numImports := 3
		for i := 0; i < numImports; i++ {
			err := importUploadCmdF(c, cmd, []string{importFilePath})
			s.Require().Nil(err)
		}
		printer.Clean()

		imports, appErr := s.th.App.ListImports()
		s.Require().Nil(appErr)

		err := importListAvailableCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), len(imports))
		s.Require().Empty(printer.GetErrorLines())
		for i, name := range printer.GetLines() {
			s.Require().Equal(imports[i], name.(string))
		}
	})
}

func (s *MmctlE2ETestSuite) TestImportListIncompleteCmdF() {
	s.SetupTestHelper().InitBasic()

	s.RunForAllClients("no incomplete import uploads", func(c client.Client) {
		printer.Clean()

		err := importListIncompleteCmdF(c, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No incomplete import uploads found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("some incomplete import uploads", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		userID := "nouser"
		if c == s.th.SystemAdminClient {
			user, _, err := s.th.SystemAdminClient.GetMe(context.Background(), "")
			s.Require().NoError(err)
			userID = user.Id
		} else {
			cmd.Flags().Bool("local", true, "")
		}

		us1, appErr := s.th.App.CreateUploadSession(s.th.Context, &model.UploadSession{
			Id:       model.NewId(),
			UserId:   userID,
			Type:     model.UploadTypeImport,
			Filename: "import1.zip",
			FileSize: 1024 * 1024,
		})
		s.Require().Nil(appErr)
		us1.Path = ""

		time.Sleep(time.Millisecond)

		_, appErr = s.th.App.CreateUploadSession(s.th.Context, &model.UploadSession{
			Id:        model.NewId(),
			UserId:    userID,
			ChannelId: s.th.BasicChannel.Id,
			Type:      model.UploadTypeAttachment,
			Filename:  "somefile",
			FileSize:  1024 * 1024,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		us3, appErr := s.th.App.CreateUploadSession(s.th.Context, &model.UploadSession{
			Id:       model.NewId(),
			UserId:   userID,
			Type:     model.UploadTypeImport,
			Filename: "import2.zip",
			FileSize: 1024 * 1024,
		})
		s.Require().Nil(appErr)
		us3.Path = ""

		err := importListIncompleteCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(us1, printer.GetLines()[0].(*model.UploadSession))
		s.Require().Equal(us3, printer.GetLines()[1].(*model.UploadSession))
	})
}

func (s *MmctlE2ETestSuite) TestImportJobShowCmdF() {
	s.SetupTestHelper().InitBasic()
	ctx := request.EmptyContext(s.th.App.Log())

	job, appErr := s.th.App.CreateJob(ctx, &model.Job{
		Type: model.JobTypeImportProcess,
		Data: map[string]string{"import_file": "import1.zip"},
	})
	s.Require().Nil(appErr)
	job.Logger = nil

	s.Run("no permissions", func() {
		printer.Clean()

		job1, appErr := s.th.App.CreateJob(ctx, &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{"import_file": "import1.zip"},
		})
		s.Require().Nil(appErr)

		err := importJobShowCmdF(s.th.Client, &cobra.Command{}, []string{job1.Id})
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "failed to get import job: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("not found", func(c client.Client) {
		printer.Clean()

		err := importJobShowCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "failed to get import job: : Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("found", func(c client.Client) {
		printer.Clean()

		err := importJobShowCmdF(c, &cobra.Command{}, []string{job.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(job, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlE2ETestSuite) TestImportJobListCmdF() {
	s.SetupTestHelper().InitBasic()
	ctx := request.EmptyContext(s.th.App.Log())

	s.Run("no permissions", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := importJobListCmdF(s.th.Client, cmd, nil)
		s.Require().NotNil(err)
		s.Require().ErrorContains(err, "failed to get jobs: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("no import jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := importJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("some import jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		perPage := 2
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		_, appErr := s.th.App.CreateJob(ctx, &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{"import_file": "import1.zip"},
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job2, appErr := s.th.App.CreateJob(ctx, &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{"import_file": "import2.zip"},
		})
		s.Require().Nil(appErr)
		job2.Logger = nil

		time.Sleep(time.Millisecond)

		job3, appErr := s.th.App.CreateJob(ctx, &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{"import_file": "import3.zip"},
		})
		s.Require().Nil(appErr)
		job3.Logger = nil

		err := importJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), perPage)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(job3, printer.GetLines()[0].(*model.Job))
		s.Require().Equal(job2, printer.GetLines()[1].(*model.Job))
	})
}
