// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
)

const (
	testLogInfo       = `{"level":"info","ts":1573516747,"caller":"app/server.go:490","msg":"Server is listening on [::]:8065"}`
	testLogInfoStdout = "info app/server.go:490 Server is listening on [::]:8065"
	testLogrusStdout  = "level=info msg=\"Server is listening on [::]:8065\" caller=\"app/server.go:490\""
)

func (s *MmctlUnitTestSuite) TestLogsCmd() {
	s.Run("Display single log line", func() {
		mockSingleLogLine := []string{testLogInfo}
		cmd := &cobra.Command{}
		cmd.Flags().Int("number", 1, "")

		s.client.
			EXPECT().
			GetLogs(context.Background(), 0, 1).
			Return(mockSingleLogLine, &model.Response{}, nil).
			Times(1)

		data, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Nil(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], testLogInfoStdout)
	})

	s.Run("Display logs", func() {
		mockSingleLogLine := []string{testLogInfo}
		cmd := &cobra.Command{}

		s.client.
			EXPECT().
			GetLogs(context.Background(), 0, 0).
			Return(mockSingleLogLine, &model.Response{}, nil).
			Times(1)

		data, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Nil(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], testLogInfoStdout)
	})

	s.Run("Display logs logrus format", func() {
		mockSingleLogLine := []string{testLogInfo}
		cmd := &cobra.Command{}
		cmd.Flags().Bool("logrus", true, "")
		cmd.Flags().Int("number", 1, "")

		s.client.
			EXPECT().
			GetLogs(context.Background(), 0, 1).
			Return(mockSingleLogLine, &model.Response{}, nil).
			Times(1)

		data, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Nil(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], testLogrusStdout)
	})

	s.Run("Error when using format flag", func() {
		cmd := &cobra.Command{}
		cmd.Flags().String("format", "json", "")
		cmd.Flags().Lookup("format").Changed = true

		data, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Error(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("the %q and %q flags cannot be used with this command", "--format", "--json"))
		s.Require().Len(data, 0)

		cmd.Flags().Lookup("format").Changed = false
		cmd.Flags().Bool("json", true, "")
		cmd.Flags().Lookup("json").Changed = true
		data, err = testLogsCmdF(s.client, cmd, []string{})

		s.Require().Error(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("the %q and %q flags cannot be used with this command", "--format", "--json"))
		s.Require().Len(data, 0)
	})

	s.Run("Error when setting json format with environment variable", func() {
		formatTmp := viper.GetString("format")

		cmd := &cobra.Command{}
		viper.Set("format", "json")

		data, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Error(err)
		s.Require().Equal(err.Error(), "json formatting cannot be applied on this command. Please check the value of \"MMCTL_FORMAT\"")
		s.Require().Len(data, 0)

		viper.Set("format", formatTmp)
	})
}

// testLogsCmdF is a wrapper around the logsCmdF function to capture
// stdout for testing
func testLogsCmdF(client client.Client, cmd *cobra.Command, args []string) ([]string, error) {
	// Redirect stdout
	currStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	// Call logsCmdF
	err := logsCmdF(client, cmd, args)
	if err != nil {
		return nil, err
	}

	// Stop capturing, set stdout back
	w.Close()
	os.Stdout = currStdout

	// Copy to buffer
	var buf bytes.Buffer
	_, err = io.Copy(&buf, r)
	if err != nil {
		return nil, err
	}

	// Split for individual lines, removing last as it is an empty string
	data := strings.Split(buf.String(), "\n")
	data = data[:len(data)-1]

	return data, err
}
