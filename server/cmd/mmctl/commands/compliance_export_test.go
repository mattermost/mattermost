// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"os"
	"testing"

	gomock "github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestComplianceExportListCmdF() {
	s.Run("list default pagination", func() {
		s.SetupTest() // Reset mocks before test
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
		s.SetupTest() // Reset mocks before test
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
		s.SetupTest() // Reset mocks before test
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
		s.SetupTest() // Reset mocks before test
		printer.Clean()
		id := model.NewId()

		s.client.
			EXPECT().
			CancelJob(context.TODO(), id).
			Return(&model.Response{}, nil).
			Times(1)

		cmd := makeCmd()
		err := complianceExportCancelCmdF(s.client, cmd, []string{id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("cancel job with get error", func() {
		s.SetupTest() // Reset mocks before test
		printer.Clean()
		mockError := &model.AppError{
			Message: "failed to get job",
		}

		s.client.
			EXPECT().
			CancelJob(context.TODO(), "invalid-job-id").
			Return(&model.Response{}, mockError).
			Times(1)

		cmd := makeCmd()
		err := complianceExportCancelCmdF(s.client, cmd, []string{"invalid-job-id"})
		s.Require().NotNil(err)
		s.EqualError(err, "failed to cancel compliance export job: failed to get job")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("cancel job with cancel error", func() {
		s.SetupTest() // Reset mocks before test
		printer.Clean()
		id := model.NewId()

		mockError := &model.AppError{
			Message: "failed to cancel job",
		}

		s.client.
			EXPECT().
			CancelJob(context.TODO(), id).
			Return(&model.Response{}, mockError).
			Times(1)

		cmd := makeCmd()
		err := complianceExportCancelCmdF(s.client, cmd, []string{id})
		s.Require().NotNil(err)
		s.EqualError(err, "failed to cancel compliance export job: failed to cancel job")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestComplianceExportDownloadCmdF() {
	mockJob := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Type:     model.JobTypeMessageExport,
	}

	s.Run("download job file successfully", func() {
		printer.Clean()
		s.T().Cleanup(func() {
			err := os.Remove("suggested-filename.zip")
			s.NoError(err)
		})

		s.client.
			EXPECT().
			DownloadComplianceExport(gomock.Any(), mockJob.Id, gomock.Any()).
			Return("suggested-filename.zip", nil).
			Times(1)

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 5, "")
		err := complianceExportDownloadCmdF(s.client, cmd, []string{mockJob.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal(fmt.Sprintf("Compliance export file downloaded to %q", "suggested-filename.zip"), printer.GetLines()[0])
	})

	s.Run("download job file with explicit path", func() {
		printer.Clean()
		s.T().Cleanup(func() {
			err := os.Remove("custom-path.zip")
			s.NoError(err)
		})

		s.client.
			EXPECT().
			DownloadComplianceExport(context.TODO(), mockJob.Id, gomock.Any()).
			Return("", nil).
			Times(1)

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 5, "")
		err := complianceExportDownloadCmdF(s.client, cmd, []string{mockJob.Id, "custom-path.zip"})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal(fmt.Sprintf("Compliance export file downloaded to %q", "custom-path.zip"), printer.GetLines()[0])
	})

	s.Run("download job with error", func() {
		printer.Clean()
		mockError := &model.AppError{
			Message: "failed to download file",
		}

		s.client.
			EXPECT().
			DownloadComplianceExport(context.TODO(), mockJob.Id, gomock.Any()).
			Return("", mockError).
			Times(6) // Initial attempt + 5 retries

		cmd := makeCmd()
		cmd.Flags().Int("num-retries", 5, "")
		err := complianceExportDownloadCmdF(s.client, cmd, []string{mockJob.Id})
		s.Require().NotNil(err)
		s.EqualError(err, "failed to download compliance export after 5 retries: failed to download file")
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)

		// Ensure output file does not exist
		_, err = os.Stat(mockJob.Id + "BAR.zip")
		s.Error(err)
		s.True(os.IsNotExist(err))
	})
}

func TestGetStartAndEnd(t *testing.T) {
	type args struct {
		dateStr string
		start   int
		end     int
	}
	tests := []struct {
		name          string
		args          args
		expectedStart int64
		expectedEnd   int64
		wantErr       bool
	}{
		// check with: https://www.epochconverter.com/
		{
			name: "parse a date in EDT (-0400)",
			args: args{
				dateStr: "2024-10-21 -0400",
			},
			expectedStart: 1729483200000,
			expectedEnd:   1729569599999,
		},
		{
			name: "parse a date in UTC (+0)",
			args: args{
				dateStr: "2024-10-21 +0000",
			},
			expectedStart: 1729468800000,
			expectedEnd:   1729555199999,
		},
		{
			name: "parse a date in CDT (-0500)",
			args: args{
				dateStr: "2024-10-21 -0500",
			},
			expectedStart: 1729486800000,
			expectedEnd:   1729573199999,
		},
		{
			name: "bad format",
			args: args{
				dateStr: "2024-10-21 CT",
			},
			wantErr: true,
		},
		{
			name: "bad format",
			args: args{
				dateStr: "2024-1-2 CDT",
			},
			wantErr: true,
		},
		{
			name:    "it's ok to not have date, start, or end",
			args:    args{},
			wantErr: false,
		},
		{
			name: "needs both start and end pt1",
			args: args{
				start: 12345,
			},
			wantErr: true,
		},
		{
			name: "needs both start and end pt2",
			args: args{
				end: 12345,
			},
			wantErr: true,
		},
		{
			name: "start and end",
			args: args{
				start: 12345,
				end:   678912,
			},
			expectedStart: 12345,
			expectedEnd:   678912,
			wantErr:       false,
		},
		{
			name: "date and start",
			args: args{
				dateStr: "2024-10-21 -0400",
				start:   12345,
			},
			wantErr: true,
		},
		{
			name: "date and end",
			args: args{
				dateStr: "2024-10-21 -0400",
				end:     678912,
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotStart, gotEnd, err := getStartAndEnd(tt.args.dateStr, tt.args.start, tt.args.end)
			if (err != nil) != tt.wantErr {
				t.Errorf("getStartAndEnd() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if gotStart != tt.expectedStart {
				t.Errorf("getStartAndEnd() got = %v, want %v", gotStart, tt.expectedStart)
			}
			if gotEnd != tt.expectedEnd {
				t.Errorf("getStartAndEnd() got1 = %v, want %v", gotEnd, tt.expectedEnd)
			}
		})
	}
}

func makeCmd() *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().Int("page", 0, "")
	cmd.Flags().Int("per-page", DefaultPageSize, "")
	cmd.Flags().Bool("all", false, "")
	return cmd
}
