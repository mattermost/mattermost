// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8"
	st "github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
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

func (s *MmctlE2ETestSuite) TestComplianceExportDownloadCmdE2E() {
	s.SetupMessageExportTestHelper()

	s.Run("no permissions", func() {
		printer.Clean()

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

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 0, "")
		err = complianceExportDownloadCmdF(s.th.Client, cmd, []string{job.Id})
		s.Require().EqualError(err, "failed to download compliance export file: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("Download non-existent job", func(c client.Client) {
		printer.Clean()

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 0, "")
		err := complianceExportDownloadCmdF(c, cmd, []string{"non-existent-job-id"})
		s.Require().EqualError(err, "failed to download compliance export file: Sorry, we could not find the page., There doesn't appear to be an api call for the url='/api/v4/jobs/non-existent-job-id/download'.  Typo? are you missing a team_id or user_id as part of the url?")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("existing, non empty compliance export", func(c client.Client) {
		printer.Clean()

		importFilePath := filepath.Join(server.GetPackagePath(), "test.zip")
		f, err := os.Create(importFilePath)
		s.Require().Nil(err)
		_, err = f.WriteString("test data")
		s.Require().Nil(err)
		_ = f.Close()

		defer func() {
			_ = os.Remove(importFilePath)
		}()

		cmd := &cobra.Command{}
		cmd.Flags().Int("num-retries", 0, "")

		err = complianceExportDownloadCmdF(c, cmd, []string{"jobId", importFilePath})
		s.Require().EqualError(err, "compliance export file already exists")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("download with explicit path", func(c client.Client) {
		printer.Clean()

		downloadPath := "explicit_path.zip"
		defer os.Remove(downloadPath)

		serverDataDir, err := filepath.Abs(*s.th.App.Config().FileSettings.Directory)
		s.Require().Nil(err)

		exportDir := "job_test_export"
		// Create a compliance export with two zip files
		exportFilePath := filepath.Join(serverDataDir, exportDir)
		err = os.Mkdir(exportFilePath, 0755)
		s.Require().Nil(err)
		defer func() {
			_ = os.RemoveAll(exportFilePath)
		}()

		// Create first zip file
		zipPath1 := exportFilePath + "/export1.zip"
		f1, err := os.Create(zipPath1)
		s.Require().Nil(err)
		_, err = f1.WriteString("test data 1")
		s.Require().Nil(err)
		_ = f1.Close()

		// Create second zip file
		zipPath2 := exportFilePath + "/export2.zip"
		f2, err := os.Create(zipPath2)
		s.Require().Nil(err)
		_, err = f2.WriteString("test data 2")
		s.Require().Nil(err)
		_ = f2.Close()

		defer func() {
			_ = os.RemoveAll(exportFilePath)
		}()

		now := model.GetMillis()
		// Create a job
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusSuccess,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
			Data:           model.StringMap{"export_dir": exportDir, "is_downloadable": "true"},
		})
		s.Require().NoError(err)
		defer func() {
			// Ensure job is deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 0, "")

		err = complianceExportDownloadCmdF(c, cmd, []string{job.Id, downloadPath})
		s.Require().NoError(err)
		s.Require().Contains(printer.GetLines()[0], fmt.Sprintf("Compliance export file downloaded to %q", downloadPath))
		s.Require().Empty(printer.GetErrorLines())

		// Verify the file was downloaded
		_, err = os.Stat(downloadPath)
		s.Require().Nil(err)
		defer os.Remove(downloadPath)

		// Verify the file is a zip with a directory with two zip files
		zipReader, err := zip.OpenReader(downloadPath)
		s.Require().NoError(err)
		defer zipReader.Close()

		// Check that we have the expected files in the zip
		foundExport1 := false
		foundExport2 := false
		for _, file := range zipReader.File {
			if file.Name == "export1.zip" {
				foundExport1 = true
				// Verify contents of export1.zip
				rc, err := file.Open()
				s.Require().NoError(err)
				content, err := io.ReadAll(rc)
				s.Require().NoError(err)
				s.Require().Equal("test data 1", string(content))
				rc.Close()
			} else if file.Name == "export2.zip" {
				foundExport2 = true
				// Verify contents of export2.zip
				rc, err := file.Open()
				s.Require().NoError(err)
				content, err := io.ReadAll(rc)
				s.Require().NoError(err)
				s.Require().Equal("test data 2", string(content))
				rc.Close()
			} else {
				s.Failf("unexpected file found in downloaded zip", file.Name)
			}
		}
		s.Require().True(foundExport1, "export1.zip not found in downloaded file")
		s.Require().True(foundExport2, "export2.zip not found in downloaded file")
	})

	s.RunForSystemAdminAndLocal("download with explicit path", func(c client.Client) {
		printer.Clean()

		serverDataDir, err := filepath.Abs(*s.th.App.Config().FileSettings.Directory)
		s.Require().Nil(err)

		exportDir := "job_test_export"
		expectedDownloadPath := exportDir + ".zip"
		// Create a compliance export with two zip files
		exportFilePath := filepath.Join(serverDataDir, exportDir)
		err = os.Mkdir(exportFilePath, 0755)
		s.Require().Nil(err)
		defer func() {
			_ = os.RemoveAll(exportFilePath)

			// also remove the downloaded file
			defer os.Remove(expectedDownloadPath)
		}()

		// Create first zip file
		zipPath1 := exportFilePath + "/export1.zip"
		f1, err := os.Create(zipPath1)
		s.Require().Nil(err)
		_, err = f1.WriteString("test data 1")
		s.Require().Nil(err)
		_ = f1.Close()

		// Create second zip file
		zipPath2 := exportFilePath + "/export2.zip"
		f2, err := os.Create(zipPath2)
		s.Require().Nil(err)
		_, err = f2.WriteString("test data 2")
		s.Require().Nil(err)
		_ = f2.Close()

		defer func() {
			_ = os.RemoveAll(exportFilePath)
		}()

		now := model.GetMillis()
		// Create a job
		job, _, err := s.th.SystemAdminClient.CreateJob(context.Background(), &model.Job{
			Id:             st.NewTestID(),
			CreateAt:       now - 1000,
			Status:         model.JobStatusSuccess,
			Type:           model.JobTypeMessageExport,
			StartAt:        now - 1000,
			LastActivityAt: now - 1000,
			Data:           model.StringMap{"export_dir": exportDir, "is_downloadable": "true"},
		})
		s.Require().NoError(err)
		defer func() {
			// Ensure job is deleted from the database
			var result string
			result, err = s.th.App.Srv().Store().Job().Delete(job.Id)
			s.Require().NoError(err, "Failed to delete job (result: %v)", result)
		}()

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 0, "")

		err = complianceExportDownloadCmdF(c, cmd, []string{job.Id})
		s.Require().NoError(err)
		s.Require().Contains(printer.GetLines()[0], fmt.Sprintf("Compliance export file downloaded to %q", expectedDownloadPath))
		s.Require().Empty(printer.GetErrorLines())

		// Verify the file was downloaded
		_, err = os.Stat(expectedDownloadPath)
		s.Require().Nil(err)

		// Verify the file is a zip with a directory with two zip files
		zipReader, err := zip.OpenReader(expectedDownloadPath)
		s.Require().NoError(err)
		defer zipReader.Close()

		// Check that we have the expected files in the zip
		foundExport1 := false
		foundExport2 := false
		for _, file := range zipReader.File {
			if file.Name == "export1.zip" {
				foundExport1 = true
				// Verify contents of export1.zip
				rc, err := file.Open()
				s.Require().NoError(err)
				content, err := io.ReadAll(rc)
				s.Require().NoError(err)
				s.Require().Equal("test data 1", string(content))
				rc.Close()
			} else if file.Name == "export2.zip" {
				foundExport2 = true
				// Verify contents of export2.zip
				rc, err := file.Open()
				s.Require().NoError(err)
				content, err := io.ReadAll(rc)
				s.Require().NoError(err)
				s.Require().Equal("test data 2", string(content))
				rc.Close()
			} else {
				s.Failf("unexpected file found in downloaded zip", file.Name)
			}
		}
		s.Require().True(foundExport1, "export1.zip not found in downloaded file")
		s.Require().True(foundExport2, "export2.zip not found in downloaded file")
	})
}
