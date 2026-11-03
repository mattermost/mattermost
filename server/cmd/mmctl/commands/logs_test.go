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

	s.Run("Fail with plain-text log files", func() {
		cmd := newTestCmd(s.T(), LogsCmd)

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
		s.Contains(err.Error(), "--plain")
	})

	s.Run("Print nothing when no JSON entry matches", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("search", "nothing"))

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

	s.Run("Fall back to plain logs when the server can't query them", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("number", "1"))

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

		data, stderr, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], testLogInfoStdout)
		s.Contains(stderr, "printing the raw log lines instead")
	})

	s.Run("Fail when the server can't query the logs and the flags need it", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("follow", "true"))

		s.client.
			EXPECT().
			QueryLogs(gomock.Any(), 0, DefaultPageSize, gomock.Any()).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		_, _, err := testLogsCmdF(s.client, cmd, []string{})
		s.Require().ErrorIs(err, errQueryLogsNotFound)
	})

	s.Run("Display plain logs", func() {
		cmd := newTestCmd(s.T(), LogsCmd)
		s.Require().NoError(cmd.Flags().Set("plain", "true"))
		s.Require().NoError(cmd.Flags().Set("number", "1"))

		s.client.
			EXPECT().
			GetLogs(gomock.Any(), 0, 1).
			Return([]string{testLogInfo}, &model.Response{}, nil).
			Times(1)

		data, _, err := testLogsCmdF(s.client, cmd, []string{})

		s.Require().NoError(err)
		s.Require().Len(data, 1)
		s.Contains(data[0], testLogInfoStdout)
	})

	s.Run("Reject invalid flags", func() {
		for _, tc := range []struct {
			name  string
			flags map[string]string
			err   string
		}{
			{"plain with follow", map[string]string{"plain": "true", "follow": "true"}, "--plain cannot be used with --follow, --level, --node, --search or --since"},
			{"plain with level", map[string]string{"plain": "true", "level": "error"}, "--plain cannot be used with --follow, --level, --node, --search or --since"},
			{"short interval", map[string]string{"follow": "true", "interval": "1s"}, "--interval must be at least 2s"},
			{"unknown level", map[string]string{"level": "fatal"}, `invalid level "fatal", must be one of: error, warn, info, debug`},
			{"long search", map[string]string{"search": strings.Repeat("a", 257)}, "the search text must be at most 256 characters long"},
			{"too many entries", map[string]string{"number": "10001"}, "--number must be between 0 and 10000"},
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
		f := newLogFollower(s.client, opts, &out, &errOut)
		f.newWriter = func(w io.Writer) human.LogWriter { return testMessageWriter{out: w} }
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
		s.Equal("Warning: unable to retrieve new logs, retrying in 1ms. Error: connection refused\n", stderr)
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
		warning := "Warning: unable to retrieve the logs of node \"node-2\". Error: timeout\n"
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
