// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/config"
)

// newGetLogsTestService returns a PlatformService whose mattermost.log holds content.
func newGetLogsTestService(tb testing.TB, content []byte) *PlatformService {
	tb.Helper()

	dir := tb.TempDir()
	require.NoError(tb, os.WriteFile(config.GetLogFileLocation(dir), content, 0600))

	ps := newLogPathTestService(tb, dir, func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = true
		*cfg.LogSettings.FileLocation = dir
	})
	ps.logger = mlog.CreateConsoleTestLogger(tb)

	return ps
}

func logLine(timestamp, level, msg string) string {
	return fmt.Sprintf(`{"timestamp":%q,"level":%q,"msg":%q}`, timestamp, level, msg)
}

// referenceLogLines splits content the way GetLogsSkipSend always has: a single trailing
// newline is dropped and every line but the first keeps the '\n' that precedes it.
func referenceLogLines(content string) []string {
	content = strings.TrimSuffix(content, "\n")

	var lines []string
	start := 0
	for i := 1; i < len(content); i++ {
		if content[i] == '\n' {
			lines = append(lines, content[start:i])
			start = i
		}
	}

	return append(lines, content[start:])
}

// referenceLogPage returns the given page of lines, oldest first, counting pages from the end.
func referenceLogPage(lines []string, page, perPage int) []string {
	end := len(lines) - page*perPage
	if end <= 0 {
		return nil
	}

	return lines[max(0, end-perPage):end]
}

func TestGetLogsSkipSendLines(t *testing.T) {
	for _, tc := range []struct {
		name     string
		content  string
		expected []string
	}{
		{"single line", "a", []string{"a"}},
		{"single line with trailing newline", "a\n", []string{"a"}},
		{"trailing newline", "a\nb\nc\n", []string{"a", "\nb", "\nc"}},
		{"no trailing newline", "a\nb\nc", []string{"a", "\nb", "\nc"}},
		{"only one trailing newline is dropped", "a\nb\n\n", []string{"a", "\nb", "\n"}},
		{"blank lines are kept", "a\n\nb\n\n", []string{"a", "\n", "\nb", "\n"}},
		{"leading newline", "\na\nb\n", []string{"\na", "\nb"}},
		{"only newlines", "\n\n\n", []string{"\n", "\n"}},
		{"crlf", "a\r\nb\r\n", []string{"a\r", "\nb\r"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ps := newGetLogsTestService(t, []byte(tc.content))

			lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 0, 100, &model.LogFilter{})
			require.Nil(t, appErr)
			assert.Equal(t, tc.expected, lines)
			assert.Equal(t, tc.expected, referenceLogLines(tc.content))
		})
	}
}

func TestGetLogsSkipSendEmptyFile(t *testing.T) {
	// An empty file, or one holding a single newline, has always been reported as a read error.
	for _, content := range []string{"", "\n"} {
		t.Run(fmt.Sprintf("%q", content), func(t *testing.T) {
			ps := newGetLogsTestService(t, []byte(content))

			lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 0, 100, &model.LogFilter{})
			assert.Nil(t, lines)
			require.NotNil(t, appErr)
			assert.Equal(t, "api.admin.file_read_error", appErr.Id)
			assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		})
	}
}

func TestGetLogsSkipSendFileDisabled(t *testing.T) {
	ps := newGetLogsTestService(t, []byte("a\nb\n"))
	ps.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.EnableFile = false
	})

	lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 0, 100, &model.LogFilter{})
	require.Nil(t, appErr)
	assert.Equal(t, []string{""}, lines)
}

func TestGetLogsSkipSendMissingFile(t *testing.T) {
	ps := newGetLogsTestService(t, nil)
	require.NoError(t, os.Remove(config.GetLogFileLocation(*ps.Config().LogSettings.FileLocation)))

	lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 0, 100, &model.LogFilter{})
	assert.Nil(t, lines)
	require.NotNil(t, appErr)
	assert.Equal(t, "api.admin.file_read_error", appErr.Id)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
}

func TestGetLogsSkipSendPaging(t *testing.T) {
	ps := newGetLogsTestService(t, []byte("1\n2\n3\n4\n5\n"))

	for _, tc := range []struct {
		page, perPage int
		expected      []string
	}{
		{0, 2, []string{"\n4", "\n5"}},
		{1, 2, []string{"\n2", "\n3"}},
		{2, 2, []string{"1"}},
		{3, 2, nil},
		{0, 5, []string{"1", "\n2", "\n3", "\n4", "\n5"}},
		{0, 6, []string{"1", "\n2", "\n3", "\n4", "\n5"}},
		{1, 5, nil},
		{0, 0, nil},
	} {
		t.Run(fmt.Sprintf("page %d per page %d", tc.page, tc.perPage), func(t *testing.T) {
			lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), tc.page, tc.perPage, &model.LogFilter{})
			require.Nil(t, appErr)
			assert.Equal(t, tc.expected, lines)
		})
	}
}

func TestGetLogsSkipSendFilters(t *testing.T) {
	content := strings.Join([]string{
		logLine("2026-10-21 09:00:00.000 Z", "info", "one"),
		logLine("2026-10-21 09:30:00.000 Z", "error", "two"),
		"not json",
		logLine("2026-10-21 10:00:00.000 Z", "info", "three"),
		logLine("bad timestamp", "info", "four"),
		logLine("2026-10-21 10:30:00.000 Z", "error", "five"),
		logLine("2026-10-21 11:00:00.000 Z", "debug", "six"),
	}, "\n") + "\n"
	all := referenceLogLines(content)
	require.Len(t, all, 7)

	for _, tc := range []struct {
		name          string
		filter        model.LogFilter
		page, perPage int
		expected      []string
	}{
		{
			name:     "no filter",
			perPage:  100,
			expected: all,
		},
		{
			name:     "level filter keeps unparseable lines",
			filter:   model.LogFilter{LogLevels: []string{"error"}},
			perPage:  100,
			expected: []string{all[1], all[2], all[5]},
		},
		{
			name:     "level filter limits to per page",
			filter:   model.LogFilter{LogLevels: []string{"error"}},
			perPage:  2,
			expected: []string{all[2], all[5]},
		},
		{
			// The skipped page is counted in raw lines, before any filtering.
			name:     "level filter on second page skips unfiltered lines",
			filter:   model.LogFilter{LogLevels: []string{"error"}},
			page:     1,
			perPage:  2,
			expected: []string{all[1], all[2]},
		},
		{
			name:     "date filter keeps unparseable lines and timestamps",
			filter:   model.LogFilter{DateFrom: "2026-10-21 09:30:00.000 +00:00", DateTo: "2026-10-21 10:30:00.000 +00:00"},
			perPage:  100,
			expected: []string{all[1], all[2], all[3], all[4], all[5]},
		},
		{
			name:     "date from only",
			filter:   model.LogFilter{DateFrom: "2026-10-21 10:00:00.000 +00:00"},
			perPage:  100,
			expected: []string{all[2], all[3], all[4], all[5], all[6]},
		},
		{
			name:     "date to only",
			filter:   model.LogFilter{DateTo: "2026-10-21 09:30:00.000 +00:00"},
			perPage:  100,
			expected: []string{all[0], all[1], all[2], all[4]},
		},
		{
			name:     "level and date filters",
			filter:   model.LogFilter{LogLevels: []string{"info"}, DateFrom: "2026-10-21 09:30:00.000 +00:00"},
			perPage:  100,
			expected: []string{all[2], all[3], all[4]},
		},
		{
			name:     "date from later than every entry",
			filter:   model.LogFilter{DateFrom: "2026-10-22 00:00:00.000 +00:00"},
			perPage:  100,
			expected: []string{all[2], all[4]},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ps := newGetLogsTestService(t, []byte(content))

			lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), tc.page, tc.perPage, &tc.filter)
			require.Nil(t, appErr)
			assert.Equal(t, tc.expected, lines)
		})
	}
}

func TestGetLogsSkipSendNullLine(t *testing.T) {
	// "null" decodes without an error but leaves no entry to filter, so it is kept like any other
	// unparseable line.
	ps := newGetLogsTestService(t, []byte("null\n"+logLine("2026-10-21 10:00:00.000 Z", "info", "one")))

	lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 0, 100, &model.LogFilter{
		LogLevels: []string{"error"},
		DateFrom:  "2026-10-21 09:00:00.000 +00:00",
	})
	require.Nil(t, appErr)
	assert.Equal(t, []string{"null"}, lines)
}

// TestGetLogsSkipSendLargeFile covers lines that straddle read blocks or are longer than one.
func TestGetLogsSkipSendLargeFile(t *testing.T) {
	var sb strings.Builder
	for i := range 3000 {
		// line lengths vary so that newlines land on and around block boundaries
		fmt.Fprintf(&sb, "line %d %s\n", i, strings.Repeat("x", (i*37)%200))
		if i == 1500 {
			fmt.Fprintf(&sb, "long %s\n", strings.Repeat("y", 3*logReadBlockSize+17))
		}
	}
	// newest line has no trailing newline
	sb.WriteString("last")
	content := sb.String()
	require.Greater(t, len(content), 5*logReadBlockSize)

	all := referenceLogLines(content)
	require.Len(t, all, 3002)

	ps := newGetLogsTestService(t, []byte(content))

	for _, tc := range []struct{ page, perPage int }{
		{0, 10000},
		{0, 1},
		{0, 1000},
		{1, 1000},
		{2, 1000},
		{3, 1000},
		{1, 1500},
		{2, 1500},
		{1499, 1},
		{1500, 1},
		{1501, 1},
	} {
		t.Run(fmt.Sprintf("page %d per page %d", tc.page, tc.perPage), func(t *testing.T) {
			lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), tc.page, tc.perPage, &model.LogFilter{})
			require.Nil(t, appErr)
			assert.Equal(t, referenceLogPage(all, tc.page, tc.perPage), lines)
		})
	}
}

func TestGetLogsSkipSendDateFromEarlyExit(t *testing.T) {
	const dateFrom = "2026-10-21 10:00:00.000 +00:00"
	filter := &model.LogFilter{DateFrom: dateFrom}
	inRange := logLine("2026-10-21 10:00:00.000 Z", "info", "in range")
	older := logLine("2026-10-21 09:59:59.999 Z", "info", "older")

	for _, tc := range []struct {
		name      string
		logLevels []string
		// lines are oldest first
		lines    []string
		expected []string
	}{
		{
			name:     "enough consecutive older entries end the scan",
			lines:    slices.Concat([]string{inRange, "not json"}, slices.Repeat([]string{older}, logDateFromStopEntries), []string{inRange}),
			expected: []string{"\n" + inRange},
		},
		{
			name:     "fewer consecutive older entries do not end the scan",
			lines:    slices.Concat([]string{inRange, "not json"}, slices.Repeat([]string{older}, logDateFromStopEntries-1), []string{inRange}),
			expected: []string{inRange, "\nnot json", "\n" + inRange},
		},
		{
			name:     "an entry in range restarts the count",
			lines:    slices.Concat([]string{inRange}, slices.Repeat([]string{older}, logDateFromStopEntries/2), []string{inRange}, slices.Repeat([]string{older}, logDateFromStopEntries/2)),
			expected: []string{inRange, "\n" + inRange},
		},
		{
			name:     "unparseable lines and timestamps are not counted",
			lines:    slices.Concat([]string{inRange}, slices.Repeat([]string{older, "not json", logLine("bad timestamp", "info", "")}, logDateFromStopEntries-1)),
			expected: slices.Concat([]string{inRange}, slices.Repeat([]string{"\nnot json", "\n" + logLine("bad timestamp", "info", "")}, logDateFromStopEntries-1)),
		},
		{
			name:      "level filtered entries are counted",
			logLevels: []string{"info"},
			lines:     slices.Concat([]string{inRange}, slices.Repeat([]string{logLine("2026-10-21 09:59:59.999 Z", "error", "older")}, logDateFromStopEntries)),
			expected:  nil,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ps := newGetLogsTestService(t, []byte(strings.Join(tc.lines, "\n")))

			lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 0, 1000, &model.LogFilter{DateFrom: dateFrom, LogLevels: tc.logLevels})
			require.Nil(t, appErr)
			assert.Equal(t, tc.expected, lines)
		})
	}

	t.Run("skipped page is not counted", func(t *testing.T) {
		content := strings.Join(slices.Concat([]string{inRange}, slices.Repeat([]string{older}, logDateFromStopEntries+1)), "\n")
		ps := newGetLogsTestService(t, []byte(content))

		// skipping the two newest older entries leaves one fewer than ends the scan
		lines, appErr := ps.GetLogsSkipSend(request.TestContext(t), 1, 2, filter)
		require.Nil(t, appErr)
		assert.Equal(t, []string{inRange}, lines)
	})
}

// dateToTestLogFile returns count mlog JSON lines one second apart, oldest first and starting at
// start, of varying length so that probes and block boundaries land at different points in lines.
func dateToTestLogFile(start time.Time, count int) []string {
	lines := make([]string, count)
	for i := range lines {
		level := "info"
		if i%7 == 0 {
			level = "error"
		}
		lines[i] = logLine(start.Add(time.Duration(i)*time.Second).Format(logr.DefTimestampFormat), level, fmt.Sprintf("entry %d %s", i, strings.Repeat("x", (i*53)%400)))
	}
	return lines
}

// referenceFilteredLogs returns the page GetLogsSkipSend returns when it reads every line.
func referenceFilteredLogs(rctx request.CTX, all []string, perPage int, filter *model.LogFilter) []string {
	search := newLogSearch(filter)

	var lines []string
	for i := len(all) - 1; i >= 0 && len(lines) < perPage; i-- {
		filtered := isLogFilteredBySearch(search, []byte(all[i]))
		var entry *model.LogEntry
		if err := json.Unmarshal([]byte(all[i]), &entry); err == nil && entry != nil {
			filtered = filtered || isLogFilteredByLevel(filter, entry) || isLogFilteredByDate(rctx, filter, entry)
		}
		if !filtered {
			lines = append(lines, all[i])
		}
	}

	slices.Reverse(lines)
	return lines
}

func TestGetLogsSkipSendDateTo(t *testing.T) {
	rctx := request.TestContext(t)
	start := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	at := func(seconds float64) string {
		return start.Add(time.Duration(seconds * float64(time.Second))).Format(model.LogFilterDateLayout)
	}

	base := dateToTestLogFile(start, 20000)

	// newService returns the content of lines, its lines as GetLogsSkipSend splits them, and a
	// service that reads it.
	newService := func(t *testing.T, lines []string) (string, []string, *PlatformService) {
		content := strings.Join(lines, "\n")
		return content, referenceLogLines(content), newGetLogsTestService(t, []byte(content))
	}

	t.Run("same as reading every line", func(t *testing.T) {
		_, all, ps := newService(t, base)

		for _, filter := range []model.LogFilter{
			{DateTo: at(-1)},
			{DateTo: at(0)},
			{DateTo: at(0.5)},
			{DateTo: at(1)},
			{DateTo: at(150)},
			{DateTo: at(2000)},
			{DateTo: at(10000.5)},
			{DateTo: at(19999)},
			{DateTo: at(20000)},
			{DateFrom: at(1000), DateTo: at(1100)},
			{DateFrom: at(1000), DateTo: at(1000)},
			{DateFrom: at(3000), DateTo: at(9000)},
			{DateFrom: at(5000), DateTo: at(5500), LogLevels: []string{"error"}},
			{DateTo: at(7000), Search: "entry 69"},
			{DateFrom: at(20001), DateTo: at(30000)},
		} {
			for _, perPage := range []int{1, 50, 1000} {
				lines, appErr := ps.GetLogsSkipSend(rctx, 0, perPage, &filter)
				require.Nil(t, appErr)
				assert.Equal(t, referenceFilteredLogs(rctx, all, perPage, &filter), lines, "filter %+v, per page %d", filter, perPage)
			}
		}
	})

	t.Run("entries out of order near date to", func(t *testing.T) {
		// an entry in range written after newer ones
		late := logLine(at(9999), "info", "late")
		lines := slices.Insert(slices.Clone(base), 10100, late)
		_, _, ps := newService(t, lines)

		filter := &model.LogFilter{DateTo: at(9999)}
		result, appErr := ps.GetLogsSkipSend(rctx, 0, 2, filter)
		require.Nil(t, appErr)
		require.Len(t, result, 2)
		assert.Equal(t, "\n"+lines[9999], result[0])
		assert.Equal(t, "\n"+late, result[1])
	})

	t.Run("unparseable lines at a probe point", func(t *testing.T) {
		// more than a block, so the probe that lands on them falls back to reading every line
		lines := slices.Insert(slices.Clone(base), 10000, slices.Repeat([]string{"not json"}, logReadBlockSize/4)...)
		_, all, ps := newService(t, lines)

		// the file is read from the end, so the unparseable lines are kept as they always have been
		filter := &model.LogFilter{DateTo: at(5000)}
		result, appErr := ps.GetLogsSkipSend(rctx, 0, 100, filter)
		require.Nil(t, appErr)
		assert.Equal(t, referenceFilteredLogs(rctx, all, 100, filter), result)
		assert.Equal(t, "\nnot json", result[len(result)-1])
	})

	t.Run("long entries", func(t *testing.T) {
		lines := slices.Clone(base)
		for i := 0; i < len(lines); i += 97 {
			lines[i] = logLine(start.Add(time.Duration(i)*time.Second).Format(logr.DefTimestampFormat), "error", strings.Repeat("z", 5*logSeekProbeSize+i%logSeekProbeSize))
		}
		content, all, ps := newService(t, lines)

		for _, filter := range []model.LogFilter{
			{DateTo: at(2000)},
			{DateTo: at(9700.5)},
			{DateFrom: at(5000), DateTo: at(6000), LogLevels: []string{"error"}},
		} {
			dateTo, err := time.Parse(model.LogFilterDateLayout, filter.DateTo)
			require.NoError(t, err)
			assert.Less(t, logScanEnd(strings.NewReader(content), int64(len(content)), dateTo), int64(len(content)), "filter %+v", filter)

			result, appErr := ps.GetLogsSkipSend(rctx, 0, 1000, &filter)
			require.Nil(t, appErr)
			assert.Equal(t, referenceFilteredLogs(rctx, all, 1000, &filter), result, "filter %+v", filter)
		}
	})

	t.Run("a later page counts lines from the end of the file", func(t *testing.T) {
		_, all, ps := newService(t, base)

		// skipping the newest 1000 lines leaves 19000 in which to find entries up to 15000
		result, appErr := ps.GetLogsSkipSend(rctx, 1, 1000, &model.LogFilter{DateTo: at(15000)})
		require.Nil(t, appErr)
		assert.Equal(t, all[14001:15001], result)
	})
}

func TestReverseLineReader(t *testing.T) {
	contents := []string{
		"a",
		"a\nb",
		"\n",
		"\n\n\n",
		"\nabc\n\ndef",
		"abc\ndefgh\nij\n\nklmnopq\nr",
		strings.Repeat("x", 100) + "\n" + strings.Repeat("y", 7) + "\n" + strings.Repeat("z", 33),
	}
	for i := range 20 {
		var sb strings.Builder
		for j := range 30 {
			sb.WriteString(strings.Repeat("x", (i*7+j*13)%19))
			sb.WriteByte('\n')
		}
		contents = append(contents, sb.String())
	}

	for _, content := range contents {
		// expected is every line of content, newest first
		expected := referenceLogLines(content + "\n")
		slices.Reverse(expected)

		for _, blockSize := range []int{1, 2, 3, 7, 16, len(content), len(content) + 1, logReadBlockSize} {
			reader := newReverseLineReader(strings.NewReader(content), int64(len(content)), blockSize)

			var lines []string
			for {
				line, err := reader.Next()
				if err == io.EOF {
					break
				}
				require.NoError(t, err)
				lines = append(lines, string(line))
			}

			require.Equal(t, expected, lines, "content %q, block size %d", content, blockSize)
		}
	}

	t.Run("empty", func(t *testing.T) {
		reader := newReverseLineReader(strings.NewReader(""), 0, logReadBlockSize)
		_, err := reader.Next()
		assert.Equal(t, io.EOF, err)
	})

	t.Run("read error", func(t *testing.T) {
		// size is past the end of the reader
		reader := newReverseLineReader(strings.NewReader("abc"), 10, logReadBlockSize)
		_, err := reader.Next()
		assert.Equal(t, io.ErrUnexpectedEOF, err)
	})
}

func TestOpenLogFile(t *testing.T) {
	content := []byte("a\nb\n")

	t.Run("reads the log file", func(t *testing.T) {
		ps := newGetLogsTestService(t, content)

		file, err := ps.OpenLogFile(request.TestContext(t))
		require.NoError(t, err)
		defer file.Close()

		data, err := io.ReadAll(file)
		require.NoError(t, err)
		assert.Equal(t, content, data)
	})

	t.Run("file logging disabled", func(t *testing.T) {
		ps := newGetLogsTestService(t, content)
		ps.UpdateConfig(func(cfg *model.Config) {
			*cfg.LogSettings.EnableFile = false
		})

		file, err := ps.OpenLogFile(request.TestContext(t))
		assert.Nil(t, file)
		assert.ErrorContains(t, err, "Unable to retrieve mattermost logs because LogSettings.EnableFile is set to false")
	})

	t.Run("missing file", func(t *testing.T) {
		ps := newGetLogsTestService(t, content)
		logFile := config.GetLogFileLocation(*ps.Config().LogSettings.FileLocation)
		require.NoError(t, os.Remove(logFile))

		file, err := ps.OpenLogFile(request.TestContext(t))
		assert.Nil(t, file)
		assert.ErrorContains(t, err, "failed read mattermost log file at path "+logFile)
	})

	t.Run("path outside the log root", func(t *testing.T) {
		ps := newGetLogsTestService(t, content)
		outsideDir := t.TempDir()
		require.NoError(t, os.WriteFile(config.GetLogFileLocation(outsideDir), []byte("secret data"), 0600))
		ps.UpdateConfig(func(cfg *model.Config) {
			*cfg.LogSettings.FileLocation = outsideDir
		})

		file, err := ps.OpenLogFile(request.TestContext(t))
		assert.Nil(t, file)
		assert.ErrorContains(t, err, "outside allowed logging directory")
	})
}

// benchmarkLogFile returns roughly size bytes of mlog JSON lines, one millisecond apart, along
// with the times of the first and last. One line in 5000 is an error.
func benchmarkLogFile(b *testing.B, size int) ([]byte, time.Time, time.Time) {
	b.Helper()

	var sb strings.Builder
	sb.Grow(size + 1024)
	ts := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	first := ts.Add(time.Millisecond)
	for i := 0; sb.Len() < size; i++ {
		ts = ts.Add(time.Millisecond)
		level := "info"
		switch {
		case i%5000 == 0:
			level = "error"
		case i%10 == 0:
			level = "debug"
		}
		fmt.Fprintf(&sb, `{"timestamp":%q,"level":%q,"msg":"Received HTTP request","caller":"web/handlers.go:187","method":"GET","url":"/api/v4/users/me","request_id":"%026d","user_id":"%026d","status_code":"200"}`+"\n",
			ts.Format(logr.DefTimestampFormat), level, i, i%1000)
	}

	return []byte(sb.String()), first, ts
}

func BenchmarkGetLogsSkipSend(b *testing.B) {
	content, _, last := benchmarkLogFile(b, 64<<20)
	ps := newGetLogsTestService(b, content)
	rctx := request.TestContext(b)

	for _, bc := range []struct {
		name   string
		page   int
		filter model.LogFilter
	}{
		{name: "default page"},
		{name: "third page", page: 2},
		{name: "rare level", filter: model.LogFilter{LogLevels: []string{"error"}}},
		{name: "recent date from", filter: model.LogFilter{DateFrom: last.Add(-5 * time.Second).Format(model.LogFilterDateLayout)}},
		{name: "common search", filter: model.LogFilter{Search: "HTTP request"}},
		{name: "rare search", filter: model.LogFilter{Search: "no such entry"}},
		{name: "rare search with escaped characters", filter: model.LogFilter{Search: `"no such entry"`}},
	} {
		b.Run(bc.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_, appErr := ps.GetLogsSkipSend(rctx, bc.page, 10000, &bc.filter)
				require.Nil(b, appErr)
			}
		})
	}
}

func BenchmarkGetLogsSkipSendPastDateRange(b *testing.B) {
	// a range in the first 10% of a 100 MiB file, which a scan from the end reads about 90 MiB to reach
	content, first, last := benchmarkLogFile(b, 100<<20)
	ps := newGetLogsTestService(b, content)
	rctx := request.TestContext(b)
	span := last.Sub(first)
	filter := &model.LogFilter{
		DateFrom: first.Add(span / 20).Format(model.LogFilterDateLayout),
		DateTo:   first.Add(span / 10).Format(model.LogFilterDateLayout),
	}

	b.ReportAllocs()
	for b.Loop() {
		_, appErr := ps.GetLogsSkipSend(rctx, 0, 10000, filter)
		require.Nil(b, appErr)
	}
}
