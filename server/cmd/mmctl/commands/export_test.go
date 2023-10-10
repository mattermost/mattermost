// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestExportCreateCmdF() {
	s.Run("create export", func() {
		printer.Clean()
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{"include_attachments": "true"},
		}

		s.client.
			EXPECT().
			CreateJob(context.Background(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := exportCreateCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("create export without attachments", func() {
		printer.Clean()
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: make(map[string]string),
		}

		s.client.
			EXPECT().
			CreateJob(context.Background(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("no-attachments", true, "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlUnitTestSuite) TestExportDeleteCmdF() {
	printer.Clean()

	exportName := "export.zip"

	s.client.
		EXPECT().
		DeleteExport(context.Background(), exportName).
		Return(&model.Response{StatusCode: http.StatusOK}, nil).
		Times(1)

	err := exportDeleteCmdF(s.client, &cobra.Command{}, []string{exportName})
	s.Require().Nil(err)
	s.Len(printer.GetLines(), 1)
	s.Len(printer.GetErrorLines(), 0)
	s.Equal(fmt.Sprintf(`Export file "%s" has been deleted`, exportName), printer.GetLines()[0])
}

func (s *MmctlUnitTestSuite) TestExportListCmdF() {
	s.Run("no exports", func() {
		printer.Clean()
		var mockExports []string

		s.client.
			EXPECT().
			ListExports(context.Background()).
			Return(mockExports, &model.Response{}, nil).
			Times(1)

		err := exportListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No export files found", printer.GetLines()[0])
	})

	s.Run("some exports", func() {
		printer.Clean()
		mockExports := []string{
			"export1.zip",
			"export2.zip",
			"export3.zip",
		}

		s.client.
			EXPECT().
			ListExports(context.Background()).
			Return(mockExports, &model.Response{}, nil).
			Times(1)

		err := exportListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockExports))
		s.Len(printer.GetErrorLines(), 0)
		for i, line := range printer.GetLines() {
			s.Equal(mockExports[i], line)
		}
	})
}
