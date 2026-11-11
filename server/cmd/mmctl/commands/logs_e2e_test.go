// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
)

// syncBuffer is a bytes.Buffer safe to read while a follower writes to it.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// queriedClient signals once its first log query has returned.
type queriedClient struct {
	client.Client
	once    sync.Once
	queried chan struct{}
}

func (c *queriedClient) QueryLogs(ctx context.Context, page, perPage int, filter *model.LogFilter) (map[string][]json.RawMessage, *model.Response, error) {
	defer c.once.Do(func() { close(c.queried) })
	return c.Client.QueryLogs(ctx, page, perPage, filter)
}

func (s *MmctlE2ETestSuite) TestlogsCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	// logMarker writes a message only this test logs, and waits until the log file holds it
	logMarker := func() string {
		marker := "mmctl_logs_" + model.NewId()
		s.th.TestLogger.Info(marker)
		s.Require().NoError(s.th.TestLogger.Flush())
		return marker
	}

	s.RunForSystemAdminAndLocal("Display single log line", func(c client.Client) {
		marker := logMarker()
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))
		s.Require().NoError(cmd.Flags().Set("search", marker))

		data, _, err := testLogsCmdF(c, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], marker)
	})

	s.RunForSystemAdminAndLocal("Display entries in logrus format", func(c client.Client) {
		marker := logMarker()
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("search", marker))

		before := time.Now()
		data, _, err := testLogsCmdF(c, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], "level=info")
		s.Contains(data[0], "msg="+marker)
		s.NotContains(data[0], "timestamp=")

		// The time is when the server logged the entry, not when mmctl printed it
		s.Require().True(strings.HasPrefix(data[0], `time="`))
		logged, err := time.Parse(time.RFC3339Nano, strings.SplitN(data[0], `"`, 3)[1])
		s.Require().NoError(err)
		s.False(logged.After(before), "logged at %s, printed after %s", logged, before)
	})

	s.RunForSystemAdminAndLocal("Print every entry of a full first page, oldest first", func(c client.Client) {
		// The floor of a full first page is its first entry, which relies on the server
		// returning each node's entries oldest first
		prefix := "mmctl_logs_page_" + model.NewId()
		for i := range 3 {
			s.th.TestLogger.Info(fmt.Sprintf("%s_%d", prefix, i))
			// Timestamps have millisecond precision, and the entries need distinct ones
			time.Sleep(5 * time.Millisecond)
		}
		s.Require().NoError(s.th.TestLogger.Flush())

		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "3"))
		s.Require().NoError(cmd.Flags().Set("search", prefix))

		data, _, err := testLogsCmdF(c, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(data, 3)
		for i, line := range data {
			s.Contains(line, fmt.Sprintf("%s_%d", prefix, i))
		}
	})

	s.RunForSystemAdminAndLocal("Follow new log entries", func(c client.Client) {
		marker := "mmctl_logs_follow_" + model.NewId()
		opts := &logsOptions{number: DefaultPageSize, follow: true, interval: logsMinInterval, search: marker}
		queried := &queriedClient{Client: c, queried: make(chan struct{})}
		var stdout syncBuffer
		var warnings []string
		follower := newLogFollower(queried, opts, &stdout)
		follower.warn = func(msg string) { warnings = append(warnings, msg) }

		ctx, cancel := context.WithCancel(s.T().Context())
		done := make(chan error, 1)
		go func() {
			done <- follower.run(ctx)
		}()

		select {
		case <-queried.queried:
		case <-time.After(10 * time.Second):
			s.FailNow("the initial log query didn't return")
		}
		s.Empty(stdout.String(), "the marker isn't logged yet")

		s.th.TestLogger.Info(marker)
		s.Require().NoError(s.th.TestLogger.Flush())

		// A few intervals, as the log file may only show the marker some time after Flush
		s.Require().Eventually(func() bool {
			return strings.Contains(stdout.String(), marker)
		}, 3*opts.interval+time.Second, 50*time.Millisecond, "the followed logs should print the marker")

		cancel()
		s.Require().NoError(<-done)
		// Only read after the follower stopped
		s.Empty(warnings)
	})

	s.RunForSystemAdminAndLocal("Refuse to follow plain-text log files", func(c client.Client) {
		fileJSON := *s.th.App.Config().LogSettings.FileJson
		s.th.App.UpdateConfig(func(cfg *model.Config) { cfg.LogSettings.FileJson = new(false) })
		defer s.th.App.UpdateConfig(func(cfg *model.Config) { cfg.LogSettings.FileJson = new(fileJSON) })

		opts := &logsOptions{number: DefaultPageSize, follow: true, interval: logsMinInterval}
		err := newLogFollower(c, opts, io.Discard).run(s.T().Context())
		s.Require().ErrorIs(err, errPlainTextLogs)
	})

	s.RunForSystemAdminAndLocal("Print the logs unfiltered when the config says they're plain text", func(c client.Client) {
		// The file still holds the JSON lines from before, as it does right after FileJson is
		// turned off. The query would return them as the latest logs
		fileJSON := *s.th.App.Config().LogSettings.FileJson
		s.th.App.UpdateConfig(func(cfg *model.Config) { cfg.LogSettings.FileJson = new(false) })
		defer s.th.App.UpdateConfig(func(cfg *model.Config) { cfg.LogSettings.FileJson = new(fileJSON) })

		var stdout bytes.Buffer
		var warnings []string
		follower := newLogFollower(c, &logsOptions{number: 5}, &stdout)
		follower.warn = func(msg string) { warnings = append(warnings, msg) }
		s.Require().NoError(follower.run(s.T().Context()))
		s.Equal([]string{"the server's log file is not in JSON format, printing the logs unfiltered instead"}, warnings)
		s.NotEmpty(stdout.String())
	})

	s.Run("Should not allow normal user to retrieve logs", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))

		_, _, err := testLogsCmdF(s.th.Client, cmd, []string{})
		s.Require().Error(err)
	})
}
