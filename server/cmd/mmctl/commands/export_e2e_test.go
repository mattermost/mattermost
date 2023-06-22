// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestExportListCmdF() {
	s.SetupTestHelper()
	serverPath := os.Getenv("MM_SERVER_PATH")
	importName := "import_test.zip"
	importFilePath := filepath.Join(serverPath, "tests", importName)
	exportPath, err := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
		*s.th.App.Config().ExportSettings.Directory))
	s.Require().Nil(err)

	s.Run("MM-T3914 - no permissions", func() {
		printer.Clean()

		err := exportListCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().EqualError(err, "failed to list exports: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3913 - no exports", func(c client.Client) {
		printer.Clean()

		err := exportListCmdF(c, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No export files found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("MM-T3912 - some exports", func(c client.Client) {
		cmd := &cobra.Command{}

		numExports := 3
		for i := 0; i < numExports; i++ {
			exportName := fmt.Sprintf("export_%d.zip", i)
			err := utils.CopyFile(importFilePath, filepath.Join(exportPath, exportName))
			s.Require().Nil(err)
		}

		printer.Clean()

		exports, appErr := s.th.App.ListExports()
		s.Require().Nil(appErr)

		err := exportListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), len(exports))
		for i, name := range printer.GetLines() {
			s.Require().Equal(exports[i], name.(string))
		}
	})
}

func (s *MmctlE2ETestSuite) TestExportDeleteCmdF() {
	s.SetupTestHelper()
	serverPath := os.Getenv("MM_SERVER_PATH")
	importName := "import_test.zip"
	importFilePath := filepath.Join(serverPath, "tests", importName)
	exportPath, err := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
		*s.th.App.Config().ExportSettings.Directory))
	s.Require().Nil(err)

	exportName := "export.zip"
	s.Run("MM-T3876 - no permissions", func() {
		printer.Clean()

		err := exportDeleteCmdF(s.th.Client, &cobra.Command{}, []string{exportName})
		s.Require().EqualError(err, "failed to delete export: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3843 - delete export", func(c client.Client) {
		cmd := &cobra.Command{}

		err := utils.CopyFile(importFilePath, filepath.Join(exportPath, exportName))
		s.Require().Nil(err)

		printer.Clean()

		exports, appErr := s.th.App.ListExports()
		s.Require().Nil(appErr)
		s.Require().NotEmpty(exports)
		s.Require().Equal(exportName, exports[0])

		err = exportDeleteCmdF(c, cmd, []string{exportName})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Equal(fmt.Sprintf(`Export file "%s" has been deleted`, exportName), printer.GetLines()[0])

		exports, appErr = s.th.App.ListExports()
		s.Require().Nil(appErr)
		s.Require().Empty(exports)

		printer.Clean()

		// idempotence check
		err = exportDeleteCmdF(c, cmd, []string{exportName})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Equal(fmt.Sprintf(`Export file "%s" has been deleted`, exportName), printer.GetLines()[0])
	})
}

func (s *MmctlE2ETestSuite) TestExportCreateCmdF() {
	s.SetupTestHelper()

	s.Run("MM-T3877 - no permissions", func() {
		printer.Clean()

		err := exportCreateCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().EqualError(err, "failed to create export process job: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3839 - create export", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}

		err := exportCreateCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal("true", printer.GetLines()[0].(*model.Job).Data["include_attachments"])
	})

	s.RunForSystemAdminAndLocal("MM-T3878 - create export without attachments", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}

		cmd.Flags().Bool("no-attachments", true, "")

		err := exportCreateCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Empty(printer.GetLines()[0].(*model.Job).Data)
	})
}

func (s *MmctlE2ETestSuite) TestExportDownloadCmdF() {
	s.SetupTestHelper()
	serverPath := os.Getenv("MM_SERVER_PATH")
	importName := "import_test.zip"
	importFilePath := filepath.Join(serverPath, "tests", importName)
	exportPath, err := filepath.Abs(filepath.Join(*s.th.App.Config().FileSettings.Directory,
		*s.th.App.Config().ExportSettings.Directory))
	s.Require().Nil(err)

	exportName := "export.zip"

	s.Run("MM-T3879 - no permissions", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("num-retries", 5, "")

		err := exportDownloadCmdF(s.th.Client, cmd, []string{exportName})
		s.Require().EqualError(err, "failed to download export after 5 retries")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3880 - existing, non empty file", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("num-retries", 5, "")

		downloadPath, err := filepath.Abs(exportName)
		s.Require().Nil(err)
		err = utils.CopyFile(importFilePath, downloadPath)
		s.Require().Nil(err)
		defer os.Remove(downloadPath)

		err = exportDownloadCmdF(c, cmd, []string{exportName, downloadPath})
		s.Require().EqualError(err, "export file already exists")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3882 - export does not exist", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("num-retries", 5, "")

		downloadPath, err := filepath.Abs(exportName)
		s.Require().Nil(err)
		defer os.Remove(downloadPath)

		err = exportDownloadCmdF(c, cmd, []string{exportName, downloadPath})
		s.Require().EqualError(err, "failed to download export after 5 retries")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3883 - existing, empty file", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("num-retries", 5, "")

		exportFilePath := filepath.Join(exportPath, exportName)
		err := utils.CopyFile(importFilePath, exportFilePath)
		s.Require().Nil(err)
		defer os.Remove(exportFilePath)

		downloadPath, err := filepath.Abs(exportName)
		s.Require().Nil(err)
		defer os.Remove(downloadPath)
		f, err := os.Create(downloadPath)
		s.Require().Nil(err)
		defer f.Close()

		err = exportDownloadCmdF(c, cmd, []string{exportName, downloadPath})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3842 - full download", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("num-retries", 5, "")

		exportFilePath := filepath.Join(exportPath, exportName)
		err := utils.CopyFile(importFilePath, exportFilePath)
		s.Require().Nil(err)
		defer os.Remove(exportFilePath)

		downloadPath, err := filepath.Abs(exportName)
		s.Require().Nil(err)
		defer os.Remove(downloadPath)

		err = exportDownloadCmdF(c, cmd, []string{exportName, downloadPath})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())

		expected, err := ioutil.ReadFile(exportFilePath)
		s.Require().Nil(err)
		actual, err := ioutil.ReadFile(downloadPath)
		s.Require().Nil(err)

		s.Require().Equal(expected, actual)
	})
}

func (s *MmctlE2ETestSuite) TestExportJobShowCmdF() {
	s.SetupTestHelper().InitBasic()

	job, appErr := s.th.App.CreateJob(&model.Job{
		Type: model.JobTypeExportProcess,
	})
	s.Require().Nil(appErr)

	s.Run("MM-T3885 - no permissions", func() {
		printer.Clean()

		job1, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		err := exportJobShowCmdF(s.th.Client, &cobra.Command{}, []string{job1.Id})
		s.Require().EqualError(err, "failed to get export job: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3886 - not found", func(c client.Client) {
		printer.Clean()

		err := exportJobShowCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().ErrorContains(err, "failed to get export job: : Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3841 - found", func(c client.Client) {
		printer.Clean()

		err := exportJobShowCmdF(c, &cobra.Command{}, []string{job.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(job, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlE2ETestSuite) TestExportJobListCmdF() {
	s.SetupTestHelper().InitBasic()

	s.Run("MM-T3887 - no permissions", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := exportJobListCmdF(s.th.Client, cmd, nil)
		s.Require().EqualError(err, "failed to get jobs: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("MM-T3888 - no export jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := exportJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("MM-T3840 - some export jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		perPage := 2
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		_, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job2, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job3, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		err := exportJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), perPage)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(job3, printer.GetLines()[0].(*model.Job))
		s.Require().Equal(job2, printer.GetLines()[1].(*model.Job))
	})
}

func (s *MmctlE2ETestSuite) TestExportJobCancelCmdF() {
	s.SetupTestHelper().InitBasic()

	s.Run("Cancel an export job without permissions", func() {
		printer.Clean()

		cmd := &cobra.Command{}

		job, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		err := exportJobCancelCmdF(s.th.Client, cmd, []string{job.Id})
		s.Require().EqualError(err, "failed to get export job: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("No export jobs to cancel", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}

		err := exportJobCancelCmdF(c, cmd, []string{model.NewId()})
		s.Require().ErrorContains(err, "failed to get export job: : Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Cancel an export job", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}

		job1, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job2, appErr := s.th.App.CreateJob(&model.Job{
			Type: model.JobTypeExportProcess,
		})
		s.Require().Nil(appErr)

		err := exportJobCancelCmdF(c, cmd, []string{job1.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())

		// Get job1 again to refresh its status
		job1, appErr = s.th.App.GetJob(job1.Id)
		s.Require().Nil(appErr)

		// Get job2 again to ensure its status did not change
		job2, _ = s.th.App.GetJob(job2.Id)
		s.Require().Nil(appErr)

		s.Require().Equal(job1.Status, model.JobStatusCanceled)
		s.Require().NotEqual(job2.Status, model.JobStatusCanceled)
	})
}
