// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	gomock "github.com/golang/mock/gomock"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestNukeUsersCmd() {
	s.Run("Delete all users", func() {
		printer.Clean()
		cmd := newTestCmd(s.T(), SystemNukeUsersCmd)
		s.Require().NoError(cmd.Flags().Set("confirm", "true"))

		s.client.
			EXPECT().
			PermanentDeleteAllUsers(gomock.Any()).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := nukeUsersCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(printer.GetLines()[0], "All users successfully deleted")
	})

	s.Run("Delete all users call fails", func() {
		printer.Clean()
		cmd := newTestCmd(s.T(), SystemNukeUsersCmd)
		s.Require().NoError(cmd.Flags().Set("confirm", "true"))

		s.client.
			EXPECT().
			PermanentDeleteAllUsers(gomock.Any()).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("mock error")).
			Times(1)

		err := nukeUsersCmdF(s.client, cmd, []string{})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestGetBusyCmd() {
	s.Run("GetBusy when not set", func() {
		printer.Clean()
		sbs := &model.ServerBusyState{}

		s.client.
			EXPECT().
			GetServerBusy(gomock.Any()).
			Return(sbs, &model.Response{}, nil).
			Times(1)

		err := getBusyCmdF(s.client, newTestCmd(s.T(), nil), []string{})
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
			GetServerBusy(gomock.Any()).
			Return(sbs, &model.Response{}, nil).
			Times(1)

		err := getBusyCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(sbs, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("GetBusy with error", func() {
		printer.Clean()
		s.client.
			EXPECT().
			GetServerBusy(gomock.Any()).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := getBusyCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestSetBusyCmd() {
	s.Run("SetBusy 900 seconds", func() {
		printer.Clean()
		const minutes = 15

		cmd := newTestCmd(s.T(), SystemSetBusyCmd)
		s.Require().NoError(cmd.Flags().Set("seconds", strconv.Itoa(minutes*60)))

		s.client.
			EXPECT().
			SetServerBusy(gomock.Any(), minutes*60).
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

		err := setBusyCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("SetBusy zero seconds", func() {
		printer.Clean()

		cmd := newTestCmd(s.T(), SystemSetBusyCmd)
		s.Require().NoError(cmd.Flags().Set("seconds", "0"))

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
			ClearServerBusy(gomock.Any()).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := clearBusyCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(map[string]string{"status": "ok"}, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("ClearBusy with error", func() {
		printer.Clean()
		s.client.
			EXPECT().
			ClearServerBusy(gomock.Any()).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("mock error")).
			Times(1)

		err := clearBusyCmdF(s.client, newTestCmd(s.T(), nil), []string{})
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
			GetPing(gomock.Any()).
			Return("", &model.Response{ServerVersion: expectedVersion}, nil).
			Times(1)

		err := systemVersionCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(map[string]string{"version": expectedVersion}, printer.GetLines()[0])
	})

	s.Run("Request to the server fails", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetPing(gomock.Any()).
			Return("", &model.Response{}, errors.New("mock error")).
			Times(1)

		err := systemVersionCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestServerStatusCmd() {
	systemPingOpts := model.SystemPingOptions{FullStatus: true, RESTSemantics: true}

	s.Run("Print server status - all healthy", func() {
		printer.Clean()

		expectedStatus := map[string]any{
			"status":           model.StatusOk,
			"database_status":  model.StatusOk,
			"filestore_status": model.StatusOk,
		}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(expectedStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], expectedStatus)
	})

	s.Run("Status fields missing - should succeed", func() {
		printer.Clean()

		expectedStatus := map[string]any{"status": "OK"}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(expectedStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], expectedStatus)
	})

	s.Run("Request to the server fails", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Missing database status is ignored", func() {
		printer.Clean()

		emptyDbStatus := map[string]any{
			"status":           model.StatusOk,
			"filestore_status": model.StatusOk,
		}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(emptyDbStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
	})

	s.Run("filestore database status is ignored", func() {
		printer.Clean()

		emptyDbStatus := map[string]any{
			"status":          model.StatusOk,
			"database_status": model.StatusOk,
		}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(emptyDbStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
	})

	s.Run("Unhealthy server status should return true", func() {
		printer.Clean()

		unhealthyStatus := map[string]any{
			"status":           model.StatusUnhealthy,
			"database_status":  model.StatusOk,
			"filestore_status": model.StatusOk,
		}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(unhealthyStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "server status is unhealthy")
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], unhealthyStatus)
	})

	s.Run("Unhealthy database status should return true", func() {
		printer.Clean()

		unhealthyStatus := map[string]any{
			"status":           model.StatusOk,
			"database_status":  model.StatusUnhealthy,
			"filestore_status": model.StatusOk,
		}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(unhealthyStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "database status is unhealthy")
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], unhealthyStatus)
	})

	s.Run("Unhealthy filestore status should return true", func() {
		printer.Clean()

		unhealthyStatus := map[string]any{
			"status":           model.StatusOk,
			"database_status":  model.StatusOk,
			"filestore_status": model.StatusUnhealthy,
		}
		s.client.
			EXPECT().
			GetPingWithOptions(gomock.Any(), systemPingOpts).
			Return(unhealthyStatus, &model.Response{}, nil).
			Times(1)

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), nil), []string{})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "filestore status is unhealthy")
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], unhealthyStatus)
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
			GenerateSupportPacket(gomock.Any()).
			Return(reader, "mm_support_packet.zip", &model.Response{}, nil).
			Times(1)

		defer func() {
			err := os.Remove("mm_support_packet.zip")
			s.NoError(err)
		}()

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)
		err := systemSupportPacketCmdF(s.client, cmd, []string{})
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
			GenerateSupportPacket(gomock.Any()).
			Return(reader, "mm_support_packet.zip", &model.Response{}, nil).
			Times(1)

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)
		s.Require().NoError(cmd.Flags().Set("output-file", "foo.zip"))

		defer func() {
			err := os.Remove("foo.zip")
			s.Require().NoError(err)
		}()

		err := systemSupportPacketCmdF(s.client, cmd, []string{})
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
			GenerateSupportPacket(gomock.Any()).
			Return(nil, "", &model.Response{}, errors.New("mock error")).
			Times(1)

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)
		err := systemSupportPacketCmdF(s.client, cmd, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Downloading Support Packet")
	})
}
