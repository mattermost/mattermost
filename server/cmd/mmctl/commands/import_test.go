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

	s.client.
		EXPECT().
		CreateJob(context.TODO(), mockJob).
		Return(mockJob, &model.Response{}, nil).
		Times(1)

	err := importProcessCmdF(s.client, &cobra.Command{}, []string{importFile})
	s.Require().Nil(err)
	s.Len(printer.GetLines(), 1)
	s.Empty(printer.GetErrorLines())
	s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
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
