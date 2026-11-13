// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"

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

		err := getBusyCmdF(s.client, newTestCmd(s.T(), SystemGetBusyCmd), []string{})
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

		err := getBusyCmdF(s.client, newTestCmd(s.T(), SystemGetBusyCmd), []string{})
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

		err := getBusyCmdF(s.client, newTestCmd(s.T(), SystemGetBusyCmd), []string{})
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

		err := clearBusyCmdF(s.client, newTestCmd(s.T(), SystemClearBusyCmd), []string{})
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

		err := clearBusyCmdF(s.client, newTestCmd(s.T(), SystemClearBusyCmd), []string{})
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

		err := systemVersionCmdF(s.client, newTestCmd(s.T(), SystemVersionCmd), []string{})
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

		err := systemVersionCmdF(s.client, newTestCmd(s.T(), SystemVersionCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

		err := systemStatusCmdF(s.client, newTestCmd(s.T(), SystemStatusCmd), []string{})
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

	s.Run("uses last path element of server filename", func() {
		const body = "support packet bytes"
		for _, tc := range serverFilenameCases() {
			s.Run(tc.name, func() {
				printer.Clean()

				root := s.T().TempDir()
				workDir := filepath.Join(root, "work")
				s.Require().NoError(os.Mkdir(workDir, 0o700))
				s.T().Chdir(workDir)

				absPath := filepath.Join(root, "outside", tc.baseName)
				s.Require().NoError(os.Mkdir(filepath.Dir(absPath), 0o700))

				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(s.T(), "/api/v4/system/support_packet", r.URL.Path)
					w.Header().Set("Content-Disposition", tc.disposition(absPath))
					_, _ = w.Write([]byte(body))
				}))
				s.T().Cleanup(server.Close)

				cmd := newTestCmd(s.T(), SystemSupportPacketCmd)

				err := systemSupportPacketCmdF(model.NewAPIv4Client(server.URL), cmd, []string{})
				assertDownloadUsedBaseName(s.T(), workDir, tc.baseName, unexpectedDownloadPaths(workDir, absPath, tc.baseName), []byte(body), err)
			})
		}
	})

	s.Run("uses default name when server filename is empty", func() {
		const body = "support packet bytes"
		const defaultName = "mm_support_packet.zip"
		for _, tc := range emptyServerFilenameCases() {
			s.Run(tc.name, func() {
				printer.Clean()

				root := s.T().TempDir()
				workDir := filepath.Join(root, "work")
				s.Require().NoError(os.Mkdir(workDir, 0o700))
				s.T().Chdir(workDir)

				absPath := filepath.Join(root, "outside", "packet.zip")
				s.Require().NoError(os.Mkdir(filepath.Dir(absPath), 0o700))

				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(s.T(), "/api/v4/system/support_packet", r.URL.Path)
					w.Header().Set("Content-Disposition", tc.disposition)
					_, _ = w.Write([]byte(body))
				}))
				s.T().Cleanup(server.Close)

				cmd := newTestCmd(s.T(), SystemSupportPacketCmd)

				err := systemSupportPacketCmdF(model.NewAPIv4Client(server.URL), cmd, []string{})
				assertDownloadUsedBaseName(s.T(), workDir, defaultName, unexpectedDownloadPaths(workDir, absPath, defaultName), []byte(body), err)
			})
		}
	})

	s.Run("returns an error when the response has no filename header", func() {
		printer.Clean()

		root := s.T().TempDir()
		workDir := filepath.Join(root, "work")
		s.Require().NoError(os.Mkdir(workDir, 0o700))
		s.T().Chdir(workDir)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(s.T(), "/api/v4/system/support_packet", r.URL.Path)
			_, _ = w.Write([]byte("support packet bytes"))
		}))
		s.T().Cleanup(server.Close)

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)

		err := systemSupportPacketCmdF(model.NewAPIv4Client(server.URL), cmd, []string{})
		s.Require().Error(err)

		entries, readErr := os.ReadDir(workDir)
		s.Require().NoError(readErr)
		s.Empty(entries)
	})

	s.Run("leaves existing default file unchanged", func() {
		printer.Clean()

		root := s.T().TempDir()
		workDir := filepath.Join(root, "work")
		s.Require().NoError(os.Mkdir(workDir, 0o700))
		s.T().Chdir(workDir)

		absPath := filepath.Join(root, "outside", "packet.zip")
		s.Require().NoError(os.Mkdir(filepath.Dir(absPath), 0o700))
		s.Require().NoError(os.WriteFile(filepath.Join(workDir, "packet.zip"), []byte("original"), 0o600))

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(s.T(), "/api/v4/system/support_packet", r.URL.Path)
			w.Header().Set("Content-Disposition", `attachment; filename="../packet.zip"`)
			_, _ = w.Write([]byte("support packet bytes"))
		}))
		s.T().Cleanup(server.Close)

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)

		err := systemSupportPacketCmdF(model.NewAPIv4Client(server.URL), cmd, []string{})
		s.Require().Error(err)
		assertDownloadUsedBaseName(s.T(), workDir, "packet.zip", unexpectedDownloadPaths(workDir, absPath, "packet.zip"), []byte("original"), nil)
	})

	s.Run("leaves existing default symlink target unchanged", func() {
		printer.Clean()

		root := s.T().TempDir()
		workDir := filepath.Join(root, "work")
		s.Require().NoError(os.Mkdir(workDir, 0o700))
		s.T().Chdir(workDir)

		target := filepath.Join(root, "outside", "target")
		s.Require().NoError(os.Mkdir(filepath.Dir(target), 0o700))
		s.Require().NoError(os.WriteFile(target, []byte("original"), 0o600))
		s.Require().NoError(os.Symlink(target, filepath.Join(workDir, "packet.zip")))

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(s.T(), "/api/v4/system/support_packet", r.URL.Path)
			w.Header().Set("Content-Disposition", `attachment; filename="packet.zip"`)
			_, _ = w.Write([]byte("support packet bytes"))
		}))
		s.T().Cleanup(server.Close)

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)

		err := systemSupportPacketCmdF(model.NewAPIv4Client(server.URL), cmd, []string{})
		s.Require().Error(err)

		got, readErr := os.ReadFile(target)
		s.Require().NoError(readErr)
		s.Equal([]byte("original"), got)

		info, statErr := os.Lstat(filepath.Join(workDir, "packet.zip"))
		s.Require().NoError(statErr)
		s.True(info.Mode()&os.ModeSymlink != 0)
	})

	s.Run("removes incomplete default file after a write failure", func() {
		printer.Clean()

		root := s.T().TempDir()
		workDir := filepath.Join(root, "work")
		s.Require().NoError(os.Mkdir(workDir, 0o700))
		s.T().Chdir(workDir)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(s.T(), "/api/v4/system/support_packet", r.URL.Path)
			w.Header().Set("Content-Disposition", `attachment; filename="packet.zip"`)
			w.Header().Set("Content-Length", "100")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("partial"))
		}))
		s.T().Cleanup(server.Close)

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)

		err := systemSupportPacketCmdF(model.NewAPIv4Client(server.URL), cmd, []string{})
		s.Require().Error(err)
		s.Require().NoFileExists(filepath.Join(workDir, "packet.zip"))
		s.Require().NoFileExists(filepath.Join(workDir, "mm_support_packet.zip"))
	})
}

// serverFilenameCases are Content-Disposition values whose last path element is baseName.
func serverFilenameCases() []struct {
	name        string
	disposition func(absPath string) string
	baseName    string
} {
	const baseName = "packet.zip"
	return []struct {
		name        string
		disposition func(absPath string) string
		baseName    string
	}{
		{
			name:        "plain filename",
			disposition: func(string) string { return `attachment; filename="packet.zip"` },
			baseName:    baseName,
		},
		{
			name:        "relative path",
			disposition: func(string) string { return `attachment; filename="../packet.zip"` },
			baseName:    baseName,
		},
		{
			name: "absolute path",
			disposition: func(absPath string) string {
				return fmt.Sprintf(`attachment; filename="%s"`, absPath)
			},
			baseName: baseName,
		},
		{
			name:        "backslash separators",
			disposition: func(string) string { return `attachment; filename="..\\packet.zip"` },
			baseName:    baseName,
		},
		{
			name:        "extended filename parameter",
			disposition: func(string) string { return `attachment; filename*=UTF-8''..%2Fpacket.zip` },
			baseName:    baseName,
		},
		{
			name:        "mixed separators",
			disposition: func(string) string { return `attachment; filename="foo\\../bar/..\\packet.zip"` },
			baseName:    baseName,
		},
		{
			name: "filename and extended parameter",
			disposition: func(string) string {
				return `attachment; filename="other.zip"; filename*=UTF-8''..%2Fpacket.zip`
			},
			baseName: baseName,
		},
		{
			name:        "percent-encoded filename",
			disposition: func(string) string { return `attachment; filename="%2e%2e%2fpacket.zip"` },
			baseName:    "%2e%2e%2fpacket.zip",
		},
	}
}

// emptyServerFilenameCases are Content-Disposition values that have no usable last path element.
func emptyServerFilenameCases() []struct {
	name        string
	disposition string
} {
	return []struct {
		name        string
		disposition string
	}{
		{name: "empty filename", disposition: `attachment; filename=""`},
		{name: "attachment without filename", disposition: `attachment`},
		{name: "dot filename", disposition: `attachment; filename="."`},
		{name: "dotdot filename", disposition: `attachment; filename=".."`},
		{name: "root filename", disposition: `attachment; filename="/"`},
		{name: "trailing separator", disposition: `attachment; filename="../"`},
	}
}

func unexpectedDownloadPaths(workDir, absPath, baseName string) []string {
	return []string{
		filepath.Join(filepath.Dir(workDir), baseName),
		absPath,
		filepath.Join(workDir, `..\`+baseName),
	}
}

// assertDownloadUsedBaseName checks that the command succeeded and that the
// file is written only as baseName inside workDir.
func assertDownloadUsedBaseName(t *testing.T, workDir, baseName string, unexpectedPaths []string, wantBody []byte, cmdErr error) {
	t.Helper()
	for _, p := range unexpectedPaths {
		require.NoFileExists(t, p)
	}
	require.NoError(t, cmdErr)
	got, err := os.ReadFile(filepath.Join(workDir, baseName))
	require.NoError(t, err)
	require.Equal(t, wantBody, got)
}
