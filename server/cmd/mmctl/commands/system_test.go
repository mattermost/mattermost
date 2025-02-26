// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestGetBusyCmd() {
	s.Run("GetBusy when not set", func() {
		printer.Clean()
		sbs := &model.ServerBusyState{}

		s.client.
			EXPECT().
			GetServerBusy(context.TODO()).
			Return(sbs, &model.Response{}, nil).
			Times(1)

		err := getBusyCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(sbs, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("GetBusy when set", func() {
		printer.Clean()
		const minutes = 15
		expires := time.Now().Add(time.Minute * minutes).Unix()
		sbs := &model.ServerBusyState{Busy: true, Expires: expires}

		s.client.
			EXPECT().
			GetServerBusy(context.TODO()).
			Return(sbs, &model.Response{}, nil).
			Times(1)

		err := getBusyCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(sbs, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("GetBusy with error", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetServerBusy(context.TODO()).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := getBusyCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestSetBusyCmd() {
	s.Run("SetBusy 900 seconds", func() {
		printer.Clean()
		const minutes = 15

		cmd := &cobra.Command{}
		cmd.Flags().Uint("seconds", minutes*60, "")

		s.client.
			EXPECT().
			SetServerBusy(context.TODO(), minutes*60).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := setBusyCmdF(s.client, cmd, []string{strconv.Itoa(minutes * 60)})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(map[string]string{"status": "ok"}, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("SetBusy with missing arg", func() {
		printer.Clean()

		err := setBusyCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("SetBusy zero seconds", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Uint("seconds", 0, "")

		err := setBusyCmdF(s.client, cmd, []string{strconv.Itoa(0)})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestClearBusyCmd() {
	s.Run("ClearBusy", func() {
		printer.Clean()
		s.client.
			EXPECT().
			ClearServerBusy(context.TODO()).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := clearBusyCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(map[string]string{"status": "ok"}, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("ClearBusy with error", func() {
		printer.Clean()
		s.client.
			EXPECT().
			ClearServerBusy(context.TODO()).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("mock error")).
			Times(1)

		err := clearBusyCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestServerVersionCmd() {
	s.Run("Print server version", func() {
		printer.Clean()

		expectedVersion := "1.23.4.dev"
		s.client.
			EXPECT().
			GetPing(context.TODO()).
			Return("", &model.Response{ServerVersion: expectedVersion}, nil).
			Times(1)

		err := systemVersionCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], map[string]string{"version": expectedVersion})
	})

	s.Run("Request to the server fails", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetPing(context.TODO()).
			Return("", &model.Response{}, errors.New("mock error")).
			Times(1)

		err := systemVersionCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestServerStatusCmd() {
	s.Run("Print server status", func() {
		printer.Clean()

		expectedStatus := map[string]string{"status": "OK"}
		s.client.
			EXPECT().
			GetPingWithOptions(context.TODO(), model.SystemPingOptions{
				FullStatus:    true,
				RESTSemantics: true,
			}).
			Return(expectedStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], expectedStatus)
	})

	s.Run("Request to the server fails", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetPingWithOptions(context.TODO(), model.SystemPingOptions{
				FullStatus:    true,
				RESTSemantics: true,
			}).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := systemStatusCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestSupportPacketCmdF() {
	printer.SetFormat(printer.FormatPlain)
	s.T().Cleanup(func() { printer.SetFormat(printer.FormatJSON) })

	s.Run("Download Support Packet with default filename", func() {
		printer.Clean()

		reader := io.NopCloser(strings.NewReader("some bytes"))
		s.client.
			EXPECT().
			GenerateSupportPacket(context.TODO()).
			Return(reader, "mm_support_packet.zip", &model.Response{}, nil).
			Times(1)

		defer func() {
			err := os.Remove("mm_support_packet.zip")
			s.NoError(err)
		}()

		err := systemSupportPacketCmdF(s.client, SystemSupportPacketCmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], "Downloading Support Packet")
		s.Require().Equal(printer.GetLines()[1], "Downloaded Support Packet to mm_support_packet.zip")

		b, err := os.ReadFile("mm_support_packet.zip")
		s.NoError(err)
		s.Equal(b, []byte("some bytes"))
	})

	s.Run("Download Support Packet with custom filename", func() {
		printer.Clean()

		reader := io.NopCloser(strings.NewReader("some bytes"))
		s.client.
			EXPECT().
			GenerateSupportPacket(context.TODO()).
			Return(reader, "mm_support_packet.zip", &model.Response{}, nil).
			Times(1)

		systemSupportPacketCmd := &cobra.Command{}
		systemSupportPacketCmd.Flags().StringP("output-file", "o", "", "Define the output file name")
		err := systemSupportPacketCmd.ParseFlags([]string{"-o", "foo.zip"})
		s.Require().NoError(err)

		defer func() {
			err = os.Remove("foo.zip")
			s.Require().NoError(err)
		}()

		err = systemSupportPacketCmdF(s.client, systemSupportPacketCmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], "Downloading Support Packet")
		s.Require().Equal(printer.GetLines()[1], "Downloaded Support Packet to foo.zip")

		b, err := os.ReadFile("foo.zip")
		s.Require().NoError(err)
		s.Equal(string(b), "some bytes")
	})

	s.Run("Request to the server fails", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GenerateSupportPacket(context.TODO()).
			Return(nil, "", &model.Response{}, errors.New("mock error")).
			Times(1)

		err := systemSupportPacketCmdF(s.client, SystemSupportPacketCmd, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Downloading Support Packet")
	})
}
