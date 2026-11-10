// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.uber.org/mock/gomock"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer/human"
)

func (s *MmctlUnitTestSuite) TestLogsCmd() {
	const (
		// testLogMlog is a line as the server writes it, testLogInfo one in an older format
		testLogMlog       = `{"timestamp":"2026-11-03 08:54:08.903 Z","level":"info","msg":"Server is listening on [::]:8065","caller":"app/server.go:490"}`
		testLogMlogStdout = `time="2026-11-03T08:54:08.903Z" level=info msg="Server is listening on [::]:8065" caller="app/server.go:490"`
		testLogInfo       = `{"level":"info","ts":1573516747,"caller":"app/server.go:490","msg":"Server is listening on [::]:8065"}`
		testLogInfoStdout = "level=info msg=\"Server is listening on [::]:8065\" caller=\"app/server.go:490\""
	)

	// runLogs runs a follower directly, to see the warnings logsCmdF prints through the printer
	runLogs := func(opts *logsOptions) (stdout, warnings []string, err error) {
		var out bytes.Buffer
		f := newLogFollower(s.client, opts, &out)
		f.warn = func(msg string) { warnings = append(warnings, msg) }
		err = f.run(s.T().Context())
		return testLogMessages(out.String()), warnings, err
	}

	// expectLogFormat expects the config read for LogSettings.FileJson. Without a value, the config
	// can't be read, as without the permission, and mmctl checks the last log line instead
	expectLogFormat := func(fileJSON *bool) {
		call := s.client.EXPECT().GetConfig(gomock.Any()).Times(1)
		if fileJSON == nil {
			call.Return(nil, &model.Response{StatusCode: http.StatusForbidden}, errors.New("forbidden"))
			return
		}
		call.Return(&model.Config{LogSettings: model.LogSettings{FileJson: fileJSON}}, &model.Response{}, nil)
	}

	// expectServerVersion expects the ping that reads the server version, which X-Version-Id carries
	expectServerVersion := func(version string) {
		s.client.
			EXPECT().
			GetPing(gomock.Any()).
			Return("OK", &model.Response{ServerVersion: version}, nil).
			Times(1)
	}

	s.Run("Display single log line", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 1, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {json.RawMessage(testLogMlog)}}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().NoError(err)
		s.Require().Equal([]string{testLogMlogStdout}, data)
	})

	s.Run("Accept the deprecated logrus flag", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))
		s.Require().NoError(cmd.Flags().Set("logrus", "true"))

		flag := cmd.Flags().Lookup("logrus")
		s.True(flag.Hidden)
		s.Equal("the logrus format is now the default", flag.Deprecated)

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 1, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {json.RawMessage(testLogMlog)}}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().NoError(err)
		s.Require().Equal([]string{testLogMlogStdout}, data)
	})

	s.Run("Color the output when forced", func() {
		s.T().Setenv("NO_COLOR", "")
		s.T().Setenv("CLICOLOR_FORCE", "1")
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 1, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {json.RawMessage(testLogMlog)}}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], "\x1b[36mINFO\x1b[0m[2026-11-03T08:54:08.903Z] Server is listening on [::]:8065")
	})

	s.Run("Map flags to the query", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "50"))
		s.Require().NoError(cmd.Flags().Set("level", "error,Info"))
		s.Require().NoError(cmd.Flags().Set("level", "error"))
		s.Require().NoError(cmd.Flags().Set("node", "node-1"))
		s.Require().NoError(cmd.Flags().Set("node", "node-2"))
		s.Require().NoError(cmd.Flags().Set("search", "8xyz7gqnfjb1jrkpd5xnqk5mbo"))
		s.Equal("search", cmd.Flags().ShorthandLookup("s").Name)
		s.Require().NoError(cmd.Flags().Set("since", "15m"))

		expectServerVersion("12.2.0.12345.abcdef.true")
		before := time.Now()
		var filter *model.LogFilter
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 50, gomock.Any()).
			DoAndReturn(func(_ context.Context, _, _ int, f *model.LogFilter) (map[string][]json.RawMessage, *model.Response, error) {
				filter = f
				return map[string][]json.RawMessage{"node-1": {testLogLine(time.Now(), "error", "8xyz7gqnfjb1jrkpd5xnqk5mbo failed")}}, &model.Response{}, nil
			}).
			Times(1)

		_, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)

		s.Require().NotNil(filter)
		s.Equal([]string{"node-1", "node-2"}, filter.ServerNames)
		s.Equal([]string{"panic", "fatal", "critical", "error", "info", "stdlog"}, filter.LogLevels)
		s.Equal("8xyz7gqnfjb1jrkpd5xnqk5mbo", filter.Search)
		dateFrom, err := time.Parse(model.LogFilterDateLayout, filter.DateFrom)
		s.Require().NoError(err)
		s.WithinRange(dateFrom, before.Add(-15*time.Minute-time.Second), time.Now().Add(-15*time.Minute))
		s.Empty(filter.DateTo)
	})

	s.Run("Fail when the query fails", func() {
		cmd := newTestCmd(s.T(), LogsCmd)

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		_, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, "Unable to retrieve logs. Error: mock error")
	})

	s.Run("Fall back to unfiltered logs with plain-text log files", func() {
		const plainLine = "2026-11-03 08:00:00.000 Z info Server is listening"

		expectLogFormat(nil)
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 2, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {}}, &model.Response{}, nil).
			Times(1)
		gomock.InOrder(
			s.client.
				EXPECT().
				GetLogs(gomock.Any(), 0, 1).
				Return([]string{plainLine}, &model.Response{}, nil).
				Times(1),
			s.client.
				EXPECT().
				GetLogs(gomock.Any(), 0, 2).
				Return([]string{plainLine, "\n" + plainLine}, &model.Response{}, nil).
				Times(1),
		)

		data, warnings, err := runLogs(&logsOptions{number: 2})
		s.Require().NoError(err)
		s.Equal([]string{plainLine, plainLine}, data)
		s.Equal([]string{"the server's log file is not in JSON format, printing the logs unfiltered instead"}, warnings)
	})

	s.Run("Fail with plain-text log files when the flags need the query", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("level", "error"))

		expectServerVersion("12.2.0.12345.abcdef.true")
		expectLogFormat(nil)
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {}}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetLogs(gomock.Any(), 0, 1).
			Return([]string{"2026-11-03 08:00:00.000 Z info Server is listening"}, &model.Response{}, nil).
			Times(1)

		_, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().ErrorIs(err, errPlainTextLogs)
		s.Contains(err.Error(), "LogSettings.FileJson")
	})

	s.Run("Refuse to follow plain-text log files without querying them", func() {
		expectLogFormat(new(false))

		data, warnings, err := runLogs(&logsOptions{number: DefaultPageSize, follow: true, interval: logsMinInterval})
		s.Require().ErrorIs(err, errPlainTextLogs)
		s.Empty(data)
		s.Empty(warnings)
	})

	s.Run("Fall back to unfiltered logs when the config says they're plain text", func() {
		const plainLine = "2026-11-03 08:00:00.000 Z info Server is listening"

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 2, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {}}, &model.Response{}, nil).
			Times(1)
		expectLogFormat(new(false))
		// No GetLogs for the last line: the config tells
		s.client.
			EXPECT().
			GetLogs(gomock.Any(), 0, 2).
			Return([]string{plainLine, "\n" + plainLine}, &model.Response{}, nil).
			Times(1)

		data, warnings, err := runLogs(&logsOptions{number: 2})
		s.Require().NoError(err)
		s.Equal([]string{plainLine, plainLine}, data)
		s.Equal([]string{"the server's log file is not in JSON format, printing the logs unfiltered instead"}, warnings)
	})

	s.Run("Print nothing when the config says the logs are JSON and nothing matches", func() {
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {}}, &model.Response{}, nil).
			Times(1)
		expectLogFormat(new(true))
		// No GetLogs: the config tells

		data, warnings, err := runLogs(&logsOptions{number: DefaultPageSize, levels: []string{"error"}})
		s.Require().NoError(err)
		s.Empty(data)
		s.Empty(warnings)
	})

	s.Run("Detect the log format behind cluster separators", func() {
		// GET /api/v4/logs on a cluster, as the server builds it, with one line per node
		rule := strings.Repeat("-", 107)
		clusterLines := func(local, remote string) []string {
			return []string{rule, rule, "node-1", rule, rule, local, "", "", rule, rule, "node-2", rule, rule, remote}
		}

		for _, tc := range []struct {
			name      string
			local     string
			remote    string
			plainText bool
		}{
			{"JSON log files", string(testLogLine(time.Now(), "info", "local")), "\n" + string(testLogLine(time.Now(), "info", "remote")), false},
			{"JSON log files, without a local file", "", string(testLogLine(time.Now(), "info", "remote")), false},
			{"plain-text log files", "2026-11-03 08:00:00.000 Z info local", "\n2026-11-03 08:00:00.000 Z info remote", true},
		} {
			s.Run(tc.name, func() {
				cmd := newTestCmd(s.T(), LogsCmd)
				s.Require().NoError(cmd.Flags().Set("search", "nothing"))
				expectServerVersion("12.2.0.12345.abcdef.true")
				expectLogFormat(nil)

				s.client.
					EXPECT().
					QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
					Return(map[string][]json.RawMessage{"node-1": {}, "node-2": {}}, &model.Response{}, nil).
					Times(1)
				s.client.
					EXPECT().
					GetLogs(gomock.Any(), 0, 1).
					Return(clusterLines(tc.local, tc.remote), &model.Response{}, nil).
					Times(1)

				data, _, err := testLogsCmdF(s.client, cmd, []string{})
				if tc.plainText {
					s.Require().ErrorIs(err, errPlainTextLogs)
					return
				}
				s.Require().NoError(err)
				s.Empty(data)
			})
		}
	})

	s.Run("Print nothing when no JSON entry matches", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("search", "nothing"))
		expectServerVersion("12.2.0.12345.abcdef.true")
		expectLogFormat(nil)

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {}}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetLogs(gomock.Any(), 0, 1).
			Return([]string{string(testLogLine(time.Now(), "info", "something"))}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Empty(data)
	})

	s.Run("Fall back to unfiltered logs when the server can't query them", func() {
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 1, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)
		s.client.
			EXPECT().
			GetLogs(gomock.Any(), 0, 1).
			Return([]string{testLogInfo}, &model.Response{}, nil).
			Times(1)

		data, warnings, err := runLogs(&logsOptions{number: 1})
		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], testLogInfoStdout)
		s.Equal([]string{"the server doesn't support querying the logs, printing them unfiltered instead"}, warnings)
	})

	s.Run("Fail when the server can't query the logs and the flags need it", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("follow", "true"))

		// Local mode doesn't report a version
		expectServerVersion("")
		expectLogFormat(nil)
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		_, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().ErrorIs(err, errQueryLogsNotFound)
	})

	s.Run("Cap the number of entries at the server's limit", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "50000"))

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, logsMaxPerPage, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {json.RawMessage(testLogMlog)}}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().NoError(err)
		s.Require().Equal([]string{testLogMlogStdout}, data)
	})

	s.Run("Reject invalid flags", func() {
		for _, tc := range []struct {
			name  string
			flags map[string]string
			err   string
		}{
			{"short interval", map[string]string{"follow": "true", "interval": "1s"}, "--interval must be at least 2s"},
			{"unknown level", map[string]string{"level": "fatal"}, `invalid level "fatal", must be one of: error, warn, info, debug`},
			{"long search", map[string]string{"search": strings.Repeat("a", 257)}, "the search text must be at most 256 characters long"},
			{"negative number", map[string]string{"number": "-1"}, "--number must not be negative"},
			{"negative since", map[string]string{"since": "-1m"}, "--since must not be negative"},
		} {
			s.Run(tc.name, func() {
				cmd := newTestCmd(s.T(), LogsCmd)
				for name, value := range tc.flags {
					s.Require().NoError(cmd.Flags().Set(name, value))
				}

				_, _, err := testLogsCmdF(s.client, cmd, []string{})
				s.Require().EqualError(err, tc.err)
			})
		}
	})

	s.Run("Stop following on interrupt", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("follow", "true"))
		ctx, cancel := context.WithCancel(s.T().Context())
		cmd.SetContext(ctx)

		expectServerVersion("12.2.0.12345.abcdef.true")
		expectLogFormat(new(true))
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			DoAndReturn(func(context.Context, int, int, *model.LogFilter) (map[string][]json.RawMessage, *model.Response, error) {
				cancel()
				return map[string][]json.RawMessage{"default": {testLogLine(time.Now(), "info", "first")}}, &model.Response{}, nil
			}).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], "first")
	})

	s.Run("Refuse the flags that need a v12.2 server on older servers", func() {
		for _, tc := range []struct {
			name  string
			flags map[string]string
			err   string
		}{
			{"follow", map[string]string{"follow": "true"}, "--follow needs a v12.2.0 or later server, and the server runs v12.1.1. Upgrade the server, or run mmctl logs without it"},
			{"level", map[string]string{"level": "error"}, "--level needs a v12.2.0 or later server, and the server runs v12.1.1. Upgrade the server, or run mmctl logs without it"},
			{"search", map[string]string{"search": "abc"}, "--search needs a v12.2.0 or later server, and the server runs v12.1.1. Upgrade the server, or run mmctl logs without it"},
			{"since", map[string]string{"since": "15m"}, "--since needs a v12.2.0 or later server, and the server runs v12.1.1. Upgrade the server, or run mmctl logs without it"},
			{"node", map[string]string{"node": "node-1"}, "--node needs a v12.2.0 or later server, and the server runs v12.1.1. Upgrade the server, or run mmctl logs without it"},
			{"several", map[string]string{"follow": "true", "level": "error", "search": "abc", "node": "node-1"}, "--follow, --level, --node and --search need a v12.2.0 or later server, and the server runs v12.1.1. Upgrade the server, or run mmctl logs without them"},
		} {
			s.Run(tc.name, func() {
				cmd := newTestCmd(s.T(), LogsCmd)
				for name, value := range tc.flags {
					s.Require().NoError(cmd.Flags().Set(name, value))
				}

				expectServerVersion("12.1.1.12345.abcdef.true")

				_, _, err := testLogsCmdF(s.client, cmd, []string{})
				s.Require().EqualError(err, tc.err)
			})
		}
	})

	s.Run("Allow the flags that need a v12.2 server", func() {
		for _, tc := range []struct {
			name    string
			version string
		}{
			{"on v12.2", "12.2.0.12345.abcdef.true"},
			{"on a later version", "13.0.0.dev.abcdef.false"},
			{"without a version", ""},
			{"with a version that can't be read", "dev"},
		} {
			s.Run(tc.name, func() {
				cmd := newTestCmd(s.T(), LogsCmd)
				s.Require().NoError(cmd.Flags().Set("level", "error"))

				expectServerVersion(tc.version)
				s.client.
					EXPECT().
					QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
					Return(map[string][]json.RawMessage{"default": {testLogLine(time.Now(), "error", "failed")}}, &model.Response{}, nil).
					Times(1)

				data, _, err := testLogsCmdF(s.client, cmd, []string{})
				s.Require().NoError(err)
				s.Require().Len(data, 1)
			})
		}
	})

	s.Run("Allow the flags that need a v12.2 server when the ping fails", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("search", "abc"))

		s.client.
			EXPECT().
			GetPing(gomock.Any()).
			Return("", &model.Response{}, errors.New("mock error")).
			Times(1)
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		_, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().EqualError(err, "Unable to retrieve logs. Error: mock error")
	})

	s.Run("Don't read the server version without the flags that need it", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))

		// No GetPing expected: -n works on older servers too
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, 1, gomock.Any()).
			Return(map[string][]json.RawMessage{"default": {testLogLine(time.Now(), "info", "started")}}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(data, 1)
	})

	s.Run("Error when using format flag", func() {
		// The root command only registers --format and --json in Run, so a bare command
		// stands in for LogsCmd here
		cmd := &cobra.Command{}
		cmd.Flags().String("format", "json", "")
		cmd.Flags().Lookup("format").Changed = true

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Error(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("the %q and %q flags cannot be used with this command", "--format", "--json"))
		s.Require().Len(data, 0)

		cmd.Flags().Lookup("format").Changed = false
		cmd.Flags().Bool("json", true, "")
		cmd.Flags().Lookup("json").Changed = true
		data, _, err = testLogsCmdF(s.client, cmd, []string{})

		s.Require().Error(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("the %q and %q flags cannot be used with this command", "--format", "--json"))
		s.Require().Len(data, 0)
	})

	s.Run("Error when setting json format with environment variable", func() {
		formatTmp := viper.GetString("format")

		cmd := newTestCmd(s.T(), LogsCmd)
		viper.Set("format", "json")

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().Error(err)
		s.Require().Equal(err.Error(), "json formatting cannot be applied on this command. Please check the value of \"MMCTL_FORMAT\"")
		s.Require().Len(data, 0)

		viper.Set("format", formatTmp)
	})
}

func (s *MmctlUnitTestSuite) TestLogFollower() {
	t0 := time.Date(2026, time.November, 3, 8, 0, 0, 0, time.UTC)

	// perPages holds the page size of each query the last follow made
	var perPages []int

	// follow runs a follower that polls every millisecond until polls runs out of responses.
	// The clock moves 5 seconds on every call, so the n-th fetch starts at t0+5s*n.
	follow := func(opts *logsOptions, polls ...func(f *model.LogFilter) (map[string][]json.RawMessage, error)) (filters []*model.LogFilter, stdout, stderr string) {
		ctx, cancel := context.WithCancel(s.T().Context())
		defer cancel()

		var mu sync.Mutex
		perPages = nil
		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ context.Context, _, perPage int, f *model.LogFilter) (map[string][]json.RawMessage, *model.Response, error) {
				mu.Lock()
				defer mu.Unlock()
				filters = append(filters, f)
				perPages = append(perPages, perPage)
				poll := polls[len(filters)-1]
				if len(filters) == len(polls) {
					cancel()
				}
				logs, err := poll(f)
				return logs, &model.Response{}, err
			}).
			Times(len(polls))

		opts.follow = true
		opts.interval = time.Millisecond
		var out, errOut bytes.Buffer
		f := newLogFollower(s.client, opts, &out)
		f.warn = func(msg string) { fmt.Fprintln(&errOut, msg) }
		f.newWriter = func(w io.Writer) human.LogWriter { return testMessageWriter{out: w} }
		f.logFormat = func(context.Context) (bool, bool) { return true, true }
		now := t0
		f.now = func() time.Time {
			current := now
			now = now.Add(5 * time.Second)
			return current
		}

		s.Require().NoError(f.run(ctx))
		return filters, out.String(), errOut.String()
	}

	respond := func(logs map[string][]json.RawMessage) func(*model.LogFilter) (map[string][]json.RawMessage, error) {
		return func(*model.LogFilter) (map[string][]json.RawMessage, error) { return logs, nil }
	}

	s.Run("Poll from the previous fetch, with an overlap, and drop repeats", func() {
		first := testLogLine(t0.Add(-time.Minute), "info", "first")
		second := testLogLine(t0.Add(2*time.Second), "info", "second")
		third := testLogLine(t0.Add(6*time.Second), "info", "third")

		filters, stdout, stderr := follow(&logsOptions{number: 10},
			respond(map[string][]json.RawMessage{"default": {first}}),
			respond(map[string][]json.RawMessage{"default": {first, second}}),
			respond(map[string][]json.RawMessage{"default": {second, third}}),
		)

		s.Require().Len(filters, 3)
		s.Empty(filters[0].DateFrom)
		s.Equal(t0.Add(-logsPollOverlap).Format(model.LogFilterDateLayout), filters[1].DateFrom)
		s.Equal(t0.Add(5*time.Second-logsPollOverlap).Format(model.LogFilterDateLayout), filters[2].DateFrom)

		// first is older than the second poll's start, which a server ignoring the filter would return
		s.Equal([]string{"first", "second", "third"}, testLogMessages(stdout))
		s.Empty(stderr)
	})

	s.Run("Drop entries older than a full first page", func() {
		older := testLogLine(t0.Add(-20*time.Second), "info", "older")
		first := testLogLine(t0.Add(-10*time.Second), "info", "first")
		second := testLogLine(t0.Add(-5*time.Second), "info", "second")
		third := testLogLine(t0.Add(2*time.Second), "info", "third")

		_, stdout, _ := follow(&logsOptions{number: 2},
			respond(map[string][]json.RawMessage{"default": {first, second}}),
			// The poll reaches back 30 seconds, past what --number asked for
			respond(map[string][]json.RawMessage{"default": {older, first, second, third}}),
		)

		s.Equal([]int{2, logsMaxPerPage}, perPages)
		s.Equal([]string{"first", "second", "third"}, testLogMessages(stdout))
	})

	s.Run("Print only new entries with --number 0", func() {
		older := testLogLine(t0.Add(-20*time.Second), "info", "older")
		last := testLogLine(t0.Add(-5*time.Second), "info", "last")
		next := testLogLine(t0.Add(2*time.Second), "info", "next")

		_, stdout, _ := follow(&logsOptions{number: 0},
			respond(map[string][]json.RawMessage{"default": {last}}),
			respond(map[string][]json.RawMessage{"default": {older, last, next}}),
		)

		s.Equal([]int{1, logsMaxPerPage}, perPages)
		s.Equal([]string{"next"}, testLogMessages(stdout))
	})

	s.Run("Keep identical entries logged in the same millisecond", func() {
		entry := testLogLine(t0, "info", "same")

		_, stdout, _ := follow(&logsOptions{number: 10},
			respond(map[string][]json.RawMessage{"default": {entry, entry}}),
			respond(map[string][]json.RawMessage{"default": {entry, entry, entry}}),
		)

		s.Equal([]string{"same", "same", "same"}, testLogMessages(stdout))
	})

	s.Run("Keep the start of a failed poll", func() {
		filters, stdout, stderr := follow(&logsOptions{number: 10},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0, "info", "first")}}),
			func(*model.LogFilter) (map[string][]json.RawMessage, error) {
				return nil, errors.New("connection refused")
			},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0.Add(7*time.Second), "info", "second")}}),
			respond(map[string][]json.RawMessage{"default": {}}),
		)

		s.Require().Len(filters, 4)
		s.Equal(t0.Add(-logsPollOverlap).Format(model.LogFilterDateLayout), filters[1].DateFrom)
		s.Equal(filters[1].DateFrom, filters[2].DateFrom)
		s.Equal(t0.Add(10*time.Second-logsPollOverlap).Format(model.LogFilterDateLayout), filters[3].DateFrom)
		s.Equal([]string{"first", "second"}, testLogMessages(stdout))
		s.Equal("unable to retrieve new logs, retrying in 1ms. Error: connection refused\n", stderr)
	})

	s.Run("Never poll before --since", func() {
		filters, _, _ := follow(&logsOptions{number: 10, since: 10 * time.Second},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0, "info", "first")}}),
			respond(map[string][]json.RawMessage{"default": {}}),
		)

		s.Require().Len(filters, 2)
		s.Equal(t0.Add(-10*time.Second).Format(model.LogFilterDateLayout), filters[0].DateFrom)
		s.Equal(filters[0].DateFrom, filters[1].DateFrom)
	})

	s.Run("Warn when a poll fills a page with new entries", func() {
		// A full page from the poll's start on: the entries before it never print
		page := make([]json.RawMessage, logsMaxPerPage)
		for i := range page {
			page[i] = testLogLine(t0.Add(time.Duration(i)*time.Millisecond), "info", fmt.Sprintf("entry %d", i))
		}

		_, stdout, stderr := follow(&logsOptions{number: 0},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0.Add(-2*time.Hour), "info", "last")}}),
			respond(map[string][]json.RawMessage{"default": page}),
		)

		s.Len(testLogMessages(stdout), logsMaxPerPage)
		s.Equal(fmt.Sprintf("node \"default\" logged more than %d matching entries since the previous poll, so the older ones were skipped. Poll more often with a shorter --interval, or narrow the logs with --level or --search\n", logsMaxPerPage), stderr)
	})

	s.Run("Don't warn about a full page that reaches past the poll's start", func() {
		// Servers older than v12.2 send the last page of remote nodes unfiltered
		page := make([]json.RawMessage, logsMaxPerPage)
		for i := range page {
			page[i] = testLogLine(t0.Add(-time.Hour+time.Duration(i)*time.Millisecond), "info", fmt.Sprintf("entry %d", i))
		}

		_, _, stderr := follow(&logsOptions{number: 0},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0.Add(-2*time.Hour), "info", "last")}}),
			respond(map[string][]json.RawMessage{"default": page}),
		)

		s.Empty(stderr)
	})

	s.Run("Don't warn about a full page that reaches back to entries printed before", func() {
		// The overlap repeats entries already printed, so a full page whose entries are all no
		// older than the poll's start can still leave nothing out
		printed := make([]json.RawMessage, 5000)
		for i := range printed {
			printed[i] = testLogLine(t0.Add(time.Duration(i)*time.Millisecond), "info", fmt.Sprintf("entry %d", i))
		}
		page := make([]json.RawMessage, logsMaxPerPage)
		for i := range page {
			page[i] = testLogLine(t0.Add(2500*time.Millisecond+time.Duration(i)*time.Millisecond), "info", fmt.Sprintf("entry %d", 2500+i))
		}

		filters, stdout, stderr := follow(&logsOptions{number: 0},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0.Add(-2*time.Hour), "info", "last")}}),
			respond(map[string][]json.RawMessage{"default": printed}),
			respond(map[string][]json.RawMessage{"default": page}),
		)

		// The last page starts after the poll's start, which alone used to warn
		from, err := time.Parse(model.LogFilterDateLayout, filters[2].DateFrom)
		s.Require().NoError(err)
		s.True(t0.Add(2500 * time.Millisecond).After(from))

		s.Empty(stderr)
		s.Len(testLogMessages(stdout), 2500+logsMaxPerPage)
	})

	s.Run("Warn about a full page newer than every entry printed before", func() {
		printed := []json.RawMessage{testLogLine(t0, "info", "printed")}
		page := make([]json.RawMessage, logsMaxPerPage)
		for i := range page {
			page[i] = testLogLine(t0.Add(time.Second+time.Duration(i)*time.Microsecond), "info", fmt.Sprintf("entry %d", i))
		}

		_, _, stderr := follow(&logsOptions{number: 0},
			respond(map[string][]json.RawMessage{"default": {testLogLine(t0.Add(-2*time.Hour), "info", "last")}}),
			respond(map[string][]json.RawMessage{"default": printed}),
			respond(map[string][]json.RawMessage{"default": page}),
		)

		s.Contains(stderr, "so the older ones were skipped")
	})

	s.Run("Report a failed node once until it recovers", func() {
		failed := json.RawMessage(`{"timestamp":"2026-11-03 08:00:00.000 Z","level":"error","msg":"Failed to fetch logs from node","error":"timeout","failed_node":true}`)
		local := testLogLine(t0, "info", "local")

		_, stdout, stderr := follow(&logsOptions{number: 10},
			respond(map[string][]json.RawMessage{"node-1": {local}, "node-2": {failed}}),
			respond(map[string][]json.RawMessage{"node-1": {local}, "node-2": {failed}}),
			respond(map[string][]json.RawMessage{"node-1": {local}, "node-2": {testLogLine(t0.Add(time.Second), "info", "remote")}}),
			respond(map[string][]json.RawMessage{"node-1": {local}, "node-2": {failed}}),
		)

		s.Equal([]string{"[node-1] local", "[node-2] remote"}, testLogMessages(stdout))
		warning := "unable to retrieve the logs of node \"node-2\". Error: timeout\n"
		s.Equal(warning+warning, stderr)
	})

	s.Run("Print the entries of several nodes in timestamp order, prefixed with their node", func() {
		_, stdout, _ := follow(&logsOptions{number: 10},
			respond(map[string][]json.RawMessage{
				"node-1": {testLogLine(t0, "info", "one"), testLogLine(t0.Add(2*time.Second), "info", "three")},
				"node-2": {testLogLine(t0.Add(time.Second), "info", "two\nsecond line")},
			}),
		)

		s.Equal("[node-1] one\n[node-2] two\n[node-2] second line\n[node-1] three\n", stdout)
	})

	s.Run("Apply the filters on the client too", func() {
		_, stdout, _ := follow(&logsOptions{number: 10, levels: logLevelGroups["error"], search: "Marker"},
			respond(map[string][]json.RawMessage{"default": {
				testLogLine(t0, "error", "has the marker"),
				testLogLine(t0, "info", "has the marker but not the level"),
				testLogLine(t0, "error", "has the level only"),
				testLogLine(t0, "fatal", "has the level", "user_id", "MARKER"),
				json.RawMessage(`{"timestamp":"2026-11-03 08:00:00.000 Z","level":"error","msg":"number","count":42}`),
			}}),
		)

		s.Equal([]string{"has the marker", "has the level"}, testLogMessages(stdout))
	})
}

func (s *MmctlUnitTestSuite) TestLogsUseColors() {
	for _, tc := range []struct {
		name       string
		env        map[string]string
		isTerminal bool
		want       bool
	}{
		{"terminal", nil, true, true},
		{"pipe", nil, false, false},
		{"NO_COLOR on a terminal", map[string]string{"NO_COLOR": "1"}, true, false},
		{"NO_COLOR wins over CLICOLOR_FORCE", map[string]string{"NO_COLOR": "1", "CLICOLOR_FORCE": "1"}, true, false},
		{"CLICOLOR_FORCE on a pipe", map[string]string{"CLICOLOR_FORCE": "1"}, false, true},
		{"CLICOLOR_FORCE=0 on a pipe", map[string]string{"CLICOLOR_FORCE": "0"}, false, false},
		{"CLICOLOR=0 on a terminal", map[string]string{"CLICOLOR": "0"}, true, false},
	} {
		s.Run(tc.name, func() {
			for _, name := range []string{"NO_COLOR", "CLICOLOR_FORCE", "CLICOLOR"} {
				s.T().Setenv(name, tc.env[name])
			}
			s.Equal(tc.want, logsUseColors(tc.isTerminal))
		})
	}
}

func (s *MmctlUnitTestSuite) TestSeenLogs() {
	t0 := time.Date(2026, time.November, 3, 8, 0, 0, 0, time.UTC)

	s.Run("Forget entries before the cutoff", func() {
		seen := newSeenLogs()
		seen.add("a", t0)
		seen.add("b", t0.Add(time.Second))
		seen.add("a", t0.Add(2*time.Second))

		seen.prune(t0.Add(time.Second))

		s.Equal(map[string]int{"a": 1, "b": 1}, seen.counts)
		s.Len(seen.entries, 2)
	})

	s.Run("Forget the oldest entries beyond the limit", func() {
		seen := newSeenLogs()
		for i := range logsMaxSeenPerNode + 10 {
			seen.add(fmt.Sprint(i), t0)
		}

		seen.prune(t0)

		s.Len(seen.entries, logsMaxSeenPerNode)
		s.Len(seen.counts, logsMaxSeenPerNode)
		s.NotContains(seen.counts, "9")
		s.Contains(seen.counts, "10")
	})
}

// testLogLine returns a log entry as the server writes it to a JSON log file.
func testLogLine(t time.Time, level, msg string, fields ...string) json.RawMessage {
	entry := map[string]string{
		"timestamp": t.Format(logr.DefTimestampFormat),
		"level":     level,
		"msg":       msg,
	}
	for i := 0; i+1 < len(fields); i += 2 {
		entry[fields[i]] = fields[i+1]
	}
	return json.RawMessage(model.ToJSON(entry))
}

// testMessageWriter prints only the message of each entry.
type testMessageWriter struct {
	out io.Writer
}

func (w testMessageWriter) Write(e human.LogEntry) {
	fmt.Fprintln(w.out, e.Message)
}

func testLogMessages(out string) []string {
	out = strings.TrimSuffix(out, "\n")
	if out == "" {
		return nil
	}
	return strings.Split(out, "\n")
}

// testLogsCmdF is a wrapper around the logsCmdF function to capture
// stdout and stderr for testing
func testLogsCmdF(client client.Client, cmd *cobra.Command, args []string) (stdout []string, stderr string, err error) {
	currStdout, currStderr := os.Stdout, os.Stderr
	outR, outW, _ := os.Pipe()
	errR, errW, _ := os.Pipe()
	os.Stdout, os.Stderr = outW, errW

	var outBuf, errBuf bytes.Buffer
	var wg sync.WaitGroup
	wg.Go(func() { _, _ = io.Copy(&outBuf, outR) })
	wg.Go(func() { _, _ = io.Copy(&errBuf, errR) })

	err = logsCmdF(client, cmd, args)

	outW.Close()
	errW.Close()
	os.Stdout, os.Stderr = currStdout, currStderr
	wg.Wait()

	if err != nil {
		return nil, errBuf.String(), err
	}

	// Split for individual lines, removing last as it is an empty string
	data := strings.Split(outBuf.String(), "\n")
	data = data[:len(data)-1]

	return data, errBuf.String(), nil
}
