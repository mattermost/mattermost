// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/zip"
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *MmctlUnitTestSuite) TestImportListAvailableCmdF() {
	s.Run("no imports", func() {
		printer.Clean()
		var mockImports []string

		s.client.
			EXPECT().
			ListImports(context.TODO()).
			Return(mockImports, &model.Response{}, nil).
			Times(1)

		err := importListAvailableCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No import files found", printer.GetLines()[0])
	})

	s.Run("some imports", func() {
		printer.Clean()
		mockImports := []string{
			"import1.zip",
			"import2.zip",
			"import3.zip",
		}

		s.client.
			EXPECT().
			ListImports(context.TODO()).
			Return(mockImports, &model.Response{}, nil).
			Times(1)

		err := importListAvailableCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockImports))
		s.Len(printer.GetErrorLines(), 0)
		for i, line := range printer.GetLines() {
			s.Equal(mockImports[i], line)
		}
	})
}

func (s *MmctlUnitTestSuite) TestImportListIncompleteCmdF() {
	s.Run("no incomplete uploads", func() {
		printer.Clean()
		var mockUploads []*model.UploadSession

		s.client.
			EXPECT().
			GetUploadsForUser(context.TODO(), "me").
			Return(mockUploads, &model.Response{}, nil).
			Times(1)

		err := importListIncompleteCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal("No incomplete import uploads found", printer.GetLines()[0])
	})

	s.Run("some incomplete uploads", func() {
		printer.Clean()
		mockUploads := []*model.UploadSession{
			{
				Id:   model.NewId(),
				Type: model.UploadTypeImport,
			},
			{
				Id:   model.NewId(),
				Type: model.UploadTypeAttachment,
			},
			{
				Id:   model.NewId(),
				Type: model.UploadTypeImport,
			},
		}

		s.client.
			EXPECT().
			GetUploadsForUser(context.TODO(), "me").
			Return(mockUploads, &model.Response{}, nil).
			Times(1)

		err := importListIncompleteCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 2)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockUploads[0], printer.GetLines()[0].(*model.UploadSession))
		s.Equal(mockUploads[2], printer.GetLines()[1].(*model.UploadSession))
	})
}

func (s *MmctlUnitTestSuite) TestImportJobShowCmdF() {
	s.Run("not found", func() {
		printer.Clean()

		jobID := model.NewId()

		s.client.
			EXPECT().
			GetJob(context.TODO(), jobID).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		err := importJobShowCmdF(s.client, &cobra.Command{}, []string{jobID})
		s.Require().NotNil(err)
		s.Empty(printer.GetLines())
		s.Empty(printer.GetErrorLines())
	})

	s.Run("found", func() {
		printer.Clean()
		mockJob := &model.Job{
			Id: model.NewId(),
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), mockJob.Id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := importJobShowCmdF(s.client, &cobra.Command{}, []string{mockJob.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlUnitTestSuite) TestImportJobListCmdF() {
	s.Run("no import jobs", func() {
		printer.Clean()
		var mockJobs []*model.Job

		cmd := &cobra.Command{}
		perPage := 10
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := importJobListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.Run("some import jobs", func() {
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

		s.client.
			EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := importJobListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockJobs))
		s.Empty(printer.GetErrorLines())
		for i, line := range printer.GetLines() {
			s.Equal(mockJobs[i], line.(*model.Job))
		}
	})
}

func (s *MmctlUnitTestSuite) TestImportProcessCmdF() {
	noCheckpoint := func() {
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusError, 0, 10).
			Return(nil, &model.Response{}, nil).
			Times(1)
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusInProgress, 0, 10).
			Return(nil, &model.Response{}, nil).
			Times(1)
	}

	s.Run("default workers", func() {
		printer.Clean()
		importFile := "import.zip"
		mockJob := &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{
				"import_file":     importFile,
				"local_mode":      "false",
				"extract_content": "false",
			},
		}

		noCheckpoint()
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	// The job-data key is the only link between the flag and the importer, which
	// enforces the choice server-side. A typo here drops the operator's choice
	// silently and the scoped import then fails as if the flag were never passed.
	s.Run("--imported-users is carried into job data", func() {
		for _, posture := range []string{"active", "inactive"} {
			printer.Clean()
			importFile := "import.zip"
			mockJob := &model.Job{
				Type: model.JobTypeImportProcess,
				Data: map[string]string{
					"import_file":     importFile,
					"local_mode":      "false",
					"extract_content": "false",
					"imported_users":  posture,
				},
			}

			noCheckpoint()
			s.client.
				EXPECT().
				CreateJob(context.TODO(), mockJob).
				Return(mockJob, &model.Response{}, nil).
				Times(1)

			cmd := &cobra.Command{}
			cmd.Flags().Bool("bypass-upload", false, "")
			cmd.Flags().Bool("extract-content", false, "")
			cmd.Flags().Int("workers", 0, "")
			cmd.Flags().String("imported-users", "", "")
			_ = cmd.Flags().Set("imported-users", posture)

			err := importProcessCmdF(s.client, cmd, []string{importFile})
			s.Require().Nil(err)
			s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
		}
	})

	// Omitting the flag must leave the key absent rather than writing an empty
	// value, so a full-instance import is unaffected and a scoped one still gets
	// the server-side "choice required" error.
	s.Run("--imported-users omitted leaves the key out of job data", func() {
		printer.Clean()
		importFile := "import.zip"
		mockJob := &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{
				"import_file":     importFile,
				"local_mode":      "false",
				"extract_content": "false",
			},
		}

		noCheckpoint()
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("imported-users", "", "")

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().Nil(err)
		s.NotContains(mockJob.Data, "imported_users")
	})

	s.Run("--imported-users rejects a value that is neither active nor inactive", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("imported-users", "", "")
		_ = cmd.Flags().Set("imported-users", "deactivated")

		err := importProcessCmdF(s.client, cmd, []string{"import.zip"})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "invalid --imported-users value")
		s.Empty(printer.GetLines())
	})

	s.Run("workers exceeds max", func() {
		printer.Clean()
		importFile := "import.zip"
		tooMany := runtime.NumCPU()*4 + 1

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		_ = cmd.Flags().Set("workers", strconv.Itoa(tooMany))

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "exceeds maximum allowed")
		s.Empty(printer.GetLines())
		s.Empty(printer.GetErrorLines())
	})

	s.Run("custom workers", func() {
		printer.Clean()
		importFile := "import.zip"
		mockJob := &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{
				"import_file":     importFile,
				"local_mode":      "false",
				"extract_content": "false",
				"workers":         "2",
			},
		}

		noCheckpoint()
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		_ = cmd.Flags().Set("workers", "2")

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("destination team by ID", func() {
		printer.Clean()
		importFile := "import.zip"
		mockTeam := &model.Team{Id: "teamid1", Name: "myteam"}
		mockJob := &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{
				"import_file":           importFile,
				"local_mode":            "false",
				"extract_content":       "false",
				"destination_team_name": "myteam",
			},
		}

		noCheckpoint()
		s.client.
			EXPECT().
			GetTeam(context.TODO(), "teamid1", "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-team-name", "", "")
		cmd.Flags().String("destination-team-id", "teamid1", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("--destination-team-name and --destination-team-id are mutually exclusive", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-team-name", "myteam", "")
		cmd.Flags().String("destination-team-id", "teamid1", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{"import.zip"})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "mutually exclusive")
		s.Empty(printer.GetLines())
	})

	s.Run("non-existent destination team ID fails immediately", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeam(context.TODO(), "nosuchid", "").
			Return(nil, &model.Response{}, fmt.Errorf("not found")).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-team-name", "", "")
		cmd.Flags().String("destination-team-id", "nosuchid", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{"import.zip"})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "nosuchid")
		s.Empty(printer.GetLines())
	})

	s.Run("destination channel by name", func() {
		printer.Clean()
		importFile := "import.zip"
		mockJob := &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{
				"import_file":              importFile,
				"local_mode":               "false",
				"extract_content":          "false",
				"destination_channel_name": "mychannel",
			},
		}

		noCheckpoint()
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-channel-name", "mychannel", "")
		cmd.Flags().String("destination-channel-id", "", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("destination channel by ID", func() {
		printer.Clean()
		importFile := "import.zip"
		mockChannel := &model.Channel{Id: "chanid1", Name: "mychannel"}
		mockJob := &model.Job{
			Type: model.JobTypeImportProcess,
			Data: map[string]string{
				"import_file":              importFile,
				"local_mode":               "false",
				"extract_content":          "false",
				"destination_channel_name": "mychannel",
			},
		}

		noCheckpoint()
		s.client.
			EXPECT().
			GetChannel(context.TODO(), "chanid1").
			Return(mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-channel-name", "", "")
		cmd.Flags().String("destination-channel-id", "chanid1", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{importFile})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("--destination-channel-name and --destination-channel-id are mutually exclusive", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-channel-name", "mychannel", "")
		cmd.Flags().String("destination-channel-id", "chanid1", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{"import.zip"})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "mutually exclusive")
		s.Empty(printer.GetLines())
	})

	s.Run("non-existent destination channel ID fails immediately", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetChannel(context.TODO(), "nosuchid").
			Return(nil, &model.Response{}, fmt.Errorf("not found")).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("bypass-upload", false, "")
		cmd.Flags().Bool("extract-content", false, "")
		cmd.Flags().Int("workers", 0, "")
		cmd.Flags().String("destination-channel-name", "", "")
		cmd.Flags().String("destination-channel-id", "nosuchid", "")
		cmd.Flags().Bool("skip-preflight", false, "")

		err := importProcessCmdF(s.client, cmd, []string{"import.zip"})
		s.Require().NotNil(err)
		s.Contains(err.Error(), "nosuchid")
		s.Empty(printer.GetLines())
	})
}

func (s *MmctlUnitTestSuite) TestReadYesNo() {
	// EOF is spelled as an empty reader: ReadString returns "" with io.EOF, which
	// must fall back to the default rather than counting as an answer.
	testCases := []struct {
		name     string
		input    string
		def      bool
		expected bool
	}{
		{"explicit y", "y\n", false, true},
		{"explicit yes", "YES\n", false, true},
		{"explicit n", "n\n", true, false},
		{"explicit no", "No\n", true, false},
		{"surrounding whitespace is trimmed", "  y  \n", false, true},
		{"bare enter takes the default", "\n", true, true},
		{"bare enter takes a negative default", "\n", false, false},
		{"unrecognised answer takes the default", "maybe\n", false, false},
		{"eof takes the default", "", false, false},
		{"eof cannot manufacture consent on a negative default", "", false, false},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			s.Equal(tc.expected, readYesNo(strings.NewReader(tc.input), tc.def))
		})
	}
}

// TestFindImportCheckpoint covers the fix for a hard-killed import_process job
// (OOM, container restart) never transitioning to JobStatusError — only a
// recovered Go panic does that. Without also checking JobStatusInProgress
// jobs, a checkpoint saved by a crashed job would never be found on retry.
func (s *MmctlUnitTestSuite) TestFindImportCheckpoint() {
	importFile := "import.zip"

	s.Run("finds checkpoint on a failed job", func() {
		mockJob := &model.Job{
			Data: map[string]string{
				"import_file":     importFile,
				"checkpoint":      "42",
				"checkpoint_file": importFile,
			},
		}
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusError, 0, 10).
			Return([]*model.Job{mockJob}, &model.Response{}, nil).
			Times(1)

		checkpoint, checkpointFile, _, maybeRunning := findImportCheckpoint(s.client, importFile)
		s.Equal(42, checkpoint)
		s.Equal(importFile, checkpointFile)
		s.False(maybeRunning, "a job in the error state has definitively stopped")
	})

	s.Run("finds checkpoint on a stale in_progress job (process was killed)", func() {
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusError, 0, 10).
			Return(nil, &model.Response{}, nil).
			Times(1)

		staleJob := &model.Job{
			LastActivityAt: model.GetMillis() - (2 * staleInProgressThreshold).Milliseconds(),
			Data: map[string]string{
				"import_file":     importFile,
				"checkpoint":      "17",
				"checkpoint_file": importFile,
			},
		}
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusInProgress, 0, 10).
			Return([]*model.Job{staleJob}, &model.Response{}, nil).
			Times(1)

		checkpoint, checkpointFile, _, maybeRunning := findImportCheckpoint(s.client, importFile)
		s.Equal(17, checkpoint)
		s.Equal(importFile, checkpointFile)
		s.True(maybeRunning, "an in_progress job is only guessed to be abandoned, so the caller must be warned it may still be running")
	})

	s.Run("ignores a recently-active in_progress job — likely still genuinely running", func() {
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusError, 0, 10).
			Return(nil, &model.Response{}, nil).
			Times(1)

		freshJob := &model.Job{
			LastActivityAt: model.GetMillis(),
			Data: map[string]string{
				"import_file":     importFile,
				"checkpoint":      "17",
				"checkpoint_file": importFile,
			},
		}
		s.client.EXPECT().
			GetJobs(context.TODO(), model.JobTypeImportProcess, model.JobStatusInProgress, 0, 10).
			Return([]*model.Job{freshJob}, &model.Response{}, nil).
			Times(1)

		checkpoint, _, _, _ := findImportCheckpoint(s.client, importFile)
		s.Equal(0, checkpoint, "a job that's still actively checkpointing must not be offered for resume")
	})
}

func (s *MmctlUnitTestSuite) TestImportValidateCmdF() {
	importFilePath := filepath.Join(os.TempDir(), "import.zip")

	importBase := `{"type":"version","version":1}
{"type":"team","team":{"name":"reiciendis-0","display_name":"minus","type":"O","description":"doloremque dignissimos velit eum quae non omnis. dolores rerum cupiditate porro quia aperiam necessitatibus natus aut. velit eveniet porro explicabo tempora voluptas beatae. eum saepe a aut. perferendis aut ab ipsum! molestias animi ut porro dolores vel. ","allow_open_invite":false}}
{"type":"team","team":{"name":"ad-1","display_name":"eligendi","type":"O","description":"et iste illum reprehenderit aliquid in rem itaque in maxime eius.","allow_open_invite":false}}
{"type":"channel","channel":{"team":"ad-1","name":"iusto-9","display_name":"incidunt","type":"P","header":"officia accusamus aut aliquid dolor qui. quia magni pariatur numquam nesciunt. maxime dolorum sit neque commodi dolorum qui dicta sit. labore laudantium quisquam voluptatem commodi magnam. est aliquid perspiciatis sequi adipisci modi sit nam. totam iste quidem sed mollitia earum. vel voluptates labore cumque eaque qui!","purpose":"sit et accusamus repudiandae id. ut et officiis eos quod. sit soluta aliquid pariatur consectetur nostrum aut magni. numquam quas aspernatur et voluptatum et ipsam animi."}}
{"type":"user","user":{"username":"ashley.berry","email":"user-12@sample.mattermost.com","auth_service":null,"nickname":"","first_name":"Ashley","last_name":"Berry","position":"Registered Nurse","roles":"system_user","locale":"en","delete_at":0,"teams":[{"name":"reiciendis-0","roles":"team_admin team_user","channels":[{"name":"town-square","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"doloremque-0","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"voluptas-9","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"minus-8","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"rem-7","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"odit-3","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":true}]},{"name":"ad-1","roles":"team_user","channels":[{"name":"iusto-9","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"amet-0","roles":"channel_admin channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"minus-6","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"autem-2","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"town-square","roles":"channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false},{"name":"aut-8","roles":"channel_admin channel_user","notify_props":{"desktop":"default","mobile":"default","mark_unread":"all"},"favorite":false}]}],"military_time":"false","link_previews":"true","message_display":"compact","channel_display_mode":"full","tutorial_step":"2","notify_props":{"desktop":"mention","desktop_sound":"true","email":"true","mobile":"mention","mobile_push_status":"away","channel":"true","comments":"never","mention_keys":""}}}
{"type":"direct_channel","direct_channel":{"members":["ashley.berry","ashley.berry"],"favorited_by":null,"header":""}}`

	s.Run("empty file", func() {
		file, err := os.Create(importFilePath)
		s.Require().NoError(err)

		zipWr := zip.NewWriter(file)
		wr, err := zipWr.Create("import.jsonl")
		s.Require().NoError(err)

		_, err = wr.Write([]byte(``))
		s.Require().NoError(err)

		err = zipWr.Close()
		s.Require().NoError(err)

		err = file.Close()
		s.Require().NoError(err)

		printer.Clean()
		err = importValidateCmdF(nil, ImportValidateCmd, []string{importFilePath})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 5)
		s.Empty(printer.GetErrorLines())
		s.Equal(Statistics{}, printer.GetLines()[2].(Statistics))
		s.Equal("Validation complete\n", printer.GetLines()[4])
	})

	s.Run("post size under default limit", func() {
		file, err := os.Create(importFilePath)
		s.Require().NoError(err)

		zipWr := zip.NewWriter(file)
		wr, err := zipWr.Create("import.jsonl")
		s.Require().NoError(err)

		msg := strings.Repeat("t", model.PostMessageMaxRunesV2)

		_, err = wr.Write([]byte(importBase))
		s.Require().NoError(err)

		_, err = wr.Write(fmt.Appendf(nil, `
{"type":"post","post":{"team":"ad-1","channel":"iusto-9","user":"ashley.berry","message":"%s","props":{},"create_at":1603398068740,"reactions":null,"replies":null}}`, msg))
		s.Require().NoError(err)

		err = zipWr.Close()
		s.Require().NoError(err)

		err = file.Close()
		s.Require().NoError(err)

		printer.Clean()
		err = importValidateCmdF(nil, ImportValidateCmd, []string{importFilePath})
		s.Require().Nil(err)

		s.Empty(printer.GetErrorLines())
		s.Equal(Statistics{
			Teams:          2,
			Channels:       1,
			DirectChannels: 1,
			Users:          1,
			Posts:          1,
		}, printer.GetLines()[0].(Statistics))
		res := printer.GetLines()[1].(ImportValidationResult)
		s.Require().Empty(res.Errors)
		s.Equal("Validation complete\n", printer.GetLines()[2])
	})

	s.Run("post size above default limit", func() {
		file, err := os.Create(importFilePath)
		s.Require().NoError(err)

		zipWr := zip.NewWriter(file)
		wr, err := zipWr.Create("import.jsonl")
		s.Require().NoError(err)

		msg := strings.Repeat("t", model.PostMessageMaxRunesV2+1)

		_, err = wr.Write([]byte(importBase))
		s.Require().NoError(err)

		_, err = wr.Write(fmt.Appendf(nil, `
{"type":"post","post":{"team":"ad-1","channel":"iusto-9","user":"ashley.berry","message":"%s","props":{},"create_at":1603398068740,"reactions":null,"replies":null}}`, msg))
		s.Require().NoError(err)

		err = zipWr.Close()
		s.Require().NoError(err)

		err = file.Close()
		s.Require().NoError(err)

		printer.Clean()
		err = importValidateCmdF(nil, ImportValidateCmd, []string{importFilePath})
		s.Require().Nil(err)

		s.Empty(printer.GetErrorLines())
		s.Equal(Statistics{
			Teams:          2,
			Channels:       1,
			DirectChannels: 1,
			Users:          1,
			Posts:          1,
		}, printer.GetLines()[0].(Statistics))
		res := printer.GetLines()[1].(ImportValidationResult)
		s.Require().Len(res.Errors, 1)

		s.Require().Equal("app.import.validate_post_import_data.message_length.error", res.Errors[0].Err.(*model.AppError).Id)

		s.Equal("Validation complete\n", printer.GetLines()[2])
	})

	s.Run("post size below config limit", func() {
		file, err := os.Create(importFilePath)
		s.Require().NoError(err)

		zipWr := zip.NewWriter(file)
		wr, err := zipWr.Create("import.jsonl")
		s.Require().NoError(err)

		msg := strings.Repeat("t", model.PostMessageMaxRunesV2*2)

		_, err = wr.Write([]byte(importBase))
		s.Require().NoError(err)

		_, err = wr.Write(fmt.Appendf(nil, `
{"type":"post","post":{"team":"ad-1","channel":"iusto-9","user":"ashley.berry","message":"%s","props":{},"create_at":1603398068740,"reactions":null,"replies":null}}`, msg))
		s.Require().NoError(err)

		err = zipWr.Close()
		s.Require().NoError(err)

		err = file.Close()
		s.Require().NoError(err)

		printer.Clean()

		s.client.
			EXPECT().
			GetUsers(context.TODO(), 0, 200, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 0, 200).
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetClientConfig(context.TODO(), "").
			Return(map[string]string{
				"MaxPostSize": fmt.Sprintf("%d", model.PostMessageMaxRunesV2*2),
			}, &model.Response{}, nil).
			Times(1)

		err = importValidateCmdF(s.client, ImportValidateCmd, []string{importFilePath})
		s.Require().Nil(err)

		s.Empty(printer.GetErrorLines())
		s.Equal(Statistics{
			Teams:          2,
			Channels:       1,
			DirectChannels: 1,
			Users:          1,
			Posts:          1,
		}, printer.GetLines()[0].(Statistics))
		res := printer.GetLines()[1].(ImportValidationResult)
		s.Require().Empty(res.Errors)
		s.Equal("Validation complete\n", printer.GetLines()[2])
	})

	s.Run("direct post size below config limit", func() {
		file, err := os.Create(importFilePath)
		s.Require().NoError(err)

		zipWr := zip.NewWriter(file)
		wr, err := zipWr.Create("import.jsonl")
		s.Require().NoError(err)

		msg := strings.Repeat("t", model.PostMessageMaxRunesV2*2)

		_, err = wr.Write([]byte(importBase))
		s.Require().NoError(err)

		_, err = wr.Write(fmt.Appendf(nil, `
{"type":"direct_post","direct_post":{"channel_members":["ashley.berry","ashley.berry"],"user":"ashley.berry","message":"%s","props":{},"create_at":1603398112372,"flagged_by":null,"reactions":null,"replies":null,"attachments":null}}`, msg))
		s.Require().NoError(err)

		err = zipWr.Close()
		s.Require().NoError(err)

		err = file.Close()
		s.Require().NoError(err)

		printer.Clean()

		s.client.
			EXPECT().
			GetUsers(context.TODO(), 0, 200, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 0, 200).
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetClientConfig(context.TODO(), "").
			Return(map[string]string{
				"MaxPostSize": fmt.Sprintf("%d", model.PostMessageMaxRunesV2*2),
			}, &model.Response{}, nil).
			Times(1)

		err = importValidateCmdF(s.client, ImportValidateCmd, []string{importFilePath})
		s.Require().Nil(err)

		s.Empty(printer.GetErrorLines())
		s.Equal(Statistics{
			Teams:          2,
			Channels:       1,
			Users:          1,
			DirectChannels: 1,
			DirectPosts:    1,
		}, printer.GetLines()[0].(Statistics))
		res := printer.GetLines()[1].(ImportValidationResult)
		s.Require().Empty(res.Errors)
		s.Equal("Validation complete\n", printer.GetLines()[2])
	})

	s.Run("invalid file attachment path", func() {
		file, err := os.Create(importFilePath)
		s.Require().NoError(err)

		zipWr := zip.NewWriter(file)
		wr, err := zipWr.Create("import.jsonl")
		s.Require().NoError(err)

		_, err = wr.Write([]byte(importBase))
		s.Require().NoError(err)

		_, err = wr.Write([]byte(`
{"type":"post","post":{"team":"ad-1","channel":"iusto-9","user":"ashley.berry","message":"message","props":{},"create_at":1603398068740,"reactions":null,"replies":null,"attachments":[{"path": "data/../../invalid.jpg"}]}}`))
		s.Require().NoError(err)

		err = zipWr.Close()
		s.Require().NoError(err)

		err = file.Close()
		s.Require().NoError(err)

		printer.Clean()

		s.client.
			EXPECT().
			GetUsers(context.TODO(), 0, 200, "").
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetAllTeams(context.TODO(), "", 0, 200).
			Return(nil, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetClientConfig(context.TODO(), "").
			Return(map[string]string{
				"MaxPostSize": fmt.Sprintf("%d", model.PostMessageMaxRunesV2*2),
			}, &model.Response{}, nil).
			Times(1)

		err = importValidateCmdF(s.client, ImportValidateCmd, []string{importFilePath})
		s.Require().Nil(err)

		s.Empty(printer.GetErrorLines())
		s.Equal(Statistics{
			Teams:          2,
			Channels:       1,
			DirectChannels: 1,
			Users:          1,
			Posts:          1,
		}, printer.GetLines()[0].(Statistics))
		res := printer.GetLines()[1].(ImportValidationResult)
		s.Require().Len(res.Errors, 2)
		s.Require().Equal("app.import.validate_post_import_data.attachment.error", res.Errors[0].Err.(*model.AppError).Id)
		s.Equal("Validation complete\n", printer.GetLines()[2])
	})
}

func (s *MmctlUnitTestSuite) TestDeleteImportCmdF() {
	s.Run("delete command succeeds", func() {
		printer.Clean()
		s.client.
			EXPECT().
			DeleteImport(context.TODO(), "import.zip").
			Return(&model.Response{}, nil).
			Times(2)

		err := importDeleteCmdF(s.client, &cobra.Command{}, []string{"import.zip"})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Equal("Import file \"import.zip\" has been deleted", printer.GetLines()[0])

		//idempotency check
		err = importDeleteCmdF(s.client, &cobra.Command{}, []string{"import.zip"})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 2)
		s.Equal("Import file \"import.zip\" has been deleted", printer.GetLines()[1])
	})
}
