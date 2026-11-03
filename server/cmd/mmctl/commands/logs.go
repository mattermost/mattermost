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
	"maps"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mattermost/logr/v2"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/term"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer/human"
)

const (
	// logsMaxPerPage is the most entries the server returns per node for one query.
	logsMaxPerPage = 10000
	// logsMinInterval keeps --follow from polling the server too often.
	logsMinInterval = 2 * time.Second
	// logsPollOverlap is how much further back than the previous fetch a poll reaches, to cover
	// clock skew between mmctl and the servers, and entries flushed late.
	logsPollOverlap = 30 * time.Second
	// logsMaxSeenPerNode bounds the keys kept per node to drop entries already printed.
	logsMaxSeenPerNode = 2 * logsMaxPerPage
)

// logLevelGroups are the level groups the System Console offers, and the server levels each stands for.
var logLevelGroups = map[string][]string{
	"error": {"panic", "fatal", "critical", "error"},
	"warn":  {"warn"},
	"info":  {"info", "stdlog"},
	"debug": {"debug", "trace"},
}

var logLevelGroupNames = []string{"error", "warn", "info", "debug"}

var errPlainTextLogs = errors.New("the server's log file is not in JSON format, which is needed to filter and follow the logs. Enable LogSettings.FileJson, or use --plain to print the raw log lines")

var errQueryLogsNotFound = errors.New("the server doesn't support querying the logs over this connection, which is needed to filter and follow them. Upgrade the server, or use --plain to print the raw log lines")

var LogsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Display logs in a human-readable format",
	Long: `Display logs in a human-readable format. As the logs format depends on the server, the "--format" flag cannot be used with this command.

The logs are read from every node of the cluster, and filtered on each node. This needs the server to write its log file in JSON format (LogSettings.FileJson). Use "--plain" to read the raw log lines instead, as earlier versions of mmctl did.

Entries are colored when printed to a terminal. Set NO_COLOR to turn the colors off, or CLICOLOR_FORCE to keep them when the output is piped.`,
	Example: `  # print the last 200 entries of each node
  $ mmctl logs

  # keep printing new error and warning entries until interrupted
  $ mmctl logs --follow --level error,warn

  # follow the entries of a single request, by its request ID
  $ mmctl logs -f --search 8xyz7gqnfjb1jrkpd5xnqk5mbo

  # print what a node logged in the last 15 minutes
  $ mmctl logs --node node-1 --since 15m`,
	Args: cobra.NoArgs,
	RunE: withClient(logsCmdF),
}

func init() {
	LogsCmd.Flags().IntP("number", "n", DefaultPageSize, fmt.Sprintf("Number of log entries to retrieve initially, per node. At most %d.", logsMaxPerPage))
	// The logrus format is the only one left, so the flag is only kept for existing scripts
	LogsCmd.Flags().BoolP("logrus", "l", false, "Use logrus for formatting.")
	_ = LogsCmd.Flags().MarkDeprecated("logrus", "the logrus format is now the default")
	LogsCmd.Flags().BoolP("follow", "f", false, "Keep polling the server and print new log entries until interrupted.")
	LogsCmd.Flags().Duration("interval", 5*time.Second, fmt.Sprintf("How often to poll for new log entries with --follow. At least %s.", logsMinInterval))
	LogsCmd.Flags().StringSlice("level", nil, "Only show entries of these level groups: "+strings.Join(logLevelGroupNames, ", ")+".")
	LogsCmd.Flags().StringArray("node", nil, "Only show the logs of this cluster node. Can be repeated.")
	LogsCmd.Flags().StringP("search", "s", "", "Only show entries with a value, other than the level and timestamp, that contains this text, ignoring case.")
	LogsCmd.Flags().Duration("since", 0, "Only show entries logged within this duration, e.g. 15m.")
	LogsCmd.Flags().Bool("plain", false, "Print the raw log lines of every node. Supports none of --follow, --level, --node, --search and --since.")
	RootCmd.AddCommand(LogsCmd)
}

type logsOptions struct {
	number   int
	plain    bool
	follow   bool
	interval time.Duration
	// levels are the server levels the chosen level groups stand for.
	levels []string
	nodes  []string
	search string
	since  time.Duration
	// colors colors the level of each entry
	colors bool
}

func logsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if cmd.Flags().Changed("format") || cmd.Flags().Changed("json") {
		return fmt.Errorf("the %q and %q flags cannot be used with this command", "--format", "--json")
	} else if viper.GetString("format") == printer.FormatJSON {
		return fmt.Errorf("json formatting cannot be applied on this command. Please check the value of %q", "MMCTL_FORMAT")
	}

	opts, err := logsOptionsFromFlags(cmd)
	if err != nil {
		return err
	}

	opts.colors = logsUseColors(term.IsTerminal(int(os.Stdout.Fd())))

	ctx := cmd.Context()
	if ctx == nil {
		ctx = context.Background()
	}

	if opts.plain {
		return printPlainLogs(ctx, c, opts, os.Stdout)
	}
	return newLogFollower(c, opts, os.Stdout, os.Stderr).run(ctx)
}

func logsOptionsFromFlags(cmd *cobra.Command) (*logsOptions, error) {
	// A flag that isn't defined, as on a bare command in tests, reads as its zero value
	opts := &logsOptions{}
	opts.number, _ = cmd.Flags().GetInt("number")
	opts.plain, _ = cmd.Flags().GetBool("plain")
	opts.follow, _ = cmd.Flags().GetBool("follow")
	opts.interval, _ = cmd.Flags().GetDuration("interval")
	opts.nodes, _ = cmd.Flags().GetStringArray("node")
	opts.search, _ = cmd.Flags().GetString("search")
	opts.since, _ = cmd.Flags().GetDuration("since")

	if opts.number < 0 || opts.number > logsMaxPerPage {
		return nil, fmt.Errorf("--number must be between 0 and %d", logsMaxPerPage)
	}

	if utf8.RuneCountInString(opts.search) > model.LogFilterSearchMaxLength {
		return nil, fmt.Errorf("the search text must be at most %d characters long", model.LogFilterSearchMaxLength)
	}

	groups, _ := cmd.Flags().GetStringSlice("level")
	var seenGroups []string
	for _, group := range groups {
		group = strings.ToLower(strings.TrimSpace(group))
		levels, ok := logLevelGroups[group]
		if !ok {
			return nil, fmt.Errorf("invalid level %q, must be one of: %s", group, strings.Join(logLevelGroupNames, ", "))
		}
		if !slices.Contains(seenGroups, group) {
			seenGroups = append(seenGroups, group)
			opts.levels = append(opts.levels, levels...)
		}
	}

	if opts.since < 0 {
		return nil, errors.New("--since must not be negative")
	}

	if opts.plain && opts.needsQuery() {
		return nil, errors.New("--plain cannot be used with --follow, --level, --node, --search or --since")
	}

	if opts.follow && opts.interval < logsMinInterval {
		return nil, fmt.Errorf("--interval must be at least %s", logsMinInterval)
	}

	return opts, nil
}

// needsQuery reports whether the options need POST /api/v4/logs/query, which GET /api/v4/logs can't serve.
func (o *logsOptions) needsQuery() bool {
	return o.follow || len(o.levels) > 0 || len(o.nodes) > 0 || o.search != "" || o.since > 0
}

func (o *logsOptions) newWriter(out io.Writer) human.LogWriter {
	return human.NewLogrusWriter(out, o.colors)
}

// logsUseColors reports whether to color the output, following https://no-color.org and
// https://bixense.com/clicolors. mmctl decides once, as logrus can't tell the output is a
// terminal once the node prefix wraps it.
func logsUseColors(isTerminal bool) bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	if force := os.Getenv("CLICOLOR_FORCE"); force != "" && force != "0" {
		return true
	}
	if os.Getenv("CLICOLOR") == "0" {
		return false
	}
	return isTerminal
}

// printPlainLogs prints the raw log lines of every node, as returned by GET /api/v4/logs.
func printPlainLogs(ctx context.Context, c client.Client, opts *logsOptions, out io.Writer) error {
	logLines, _, err := c.GetLogs(ctx, 0, opts.number)
	if err != nil {
		return errors.New("Unable to retrieve logs. Error: " + err.Error())
	}

	reader := bytes.NewReader([]byte(strings.Join(logLines, "")))
	human.ProcessLogs(reader, opts.newWriter(out))

	return nil
}

// logFollower queries the logs with POST /api/v4/logs/query, prints them, and with --follow
// keeps polling for new entries.
type logFollower struct {
	c      client.Client
	opts   *logsOptions
	out    io.Writer
	errOut io.Writer
	now    func() time.Time
	// newWriter returns the writer that formats the entries printed to out
	newWriter func(io.Writer) human.LogWriter

	levels map[string]bool
	search string

	// nodes holds every node a response listed. Once there are several, lines are prefixed with their node
	nodes          map[string]bool
	writer         human.LogWriter
	prefixedWriter map[string]human.LogWriter

	// seen holds, per node, the entries printed within the window a poll can repeat
	seen map[string]*seenLogs
	// failed holds the nodes last reported as unreachable, so they're reported once until they recover
	failed map[string]bool
}

func newLogFollower(c client.Client, opts *logsOptions, out, errOut io.Writer) *logFollower {
	f := &logFollower{
		c:              c,
		opts:           opts,
		out:            out,
		errOut:         errOut,
		now:            time.Now,
		newWriter:      opts.newWriter,
		levels:         make(map[string]bool, len(opts.levels)),
		search:         strings.ToLower(opts.search),
		nodes:          make(map[string]bool),
		prefixedWriter: make(map[string]human.LogWriter),
		seen:           make(map[string]*seenLogs),
		failed:         make(map[string]bool),
	}
	for _, level := range opts.levels {
		f.levels[level] = true
	}
	return f
}

func (f *logFollower) run(ctx context.Context) error {
	start := f.now()
	var since time.Time
	if f.opts.since > 0 {
		since = start.Add(-f.opts.since)
	}

	logs, resp, err := f.fetch(ctx, since, f.opts.number)
	if err != nil {
		if ctx.Err() != nil {
			return nil
		}
		// Servers older than v12.2 don't serve the query over the local socket
		if resp != nil && resp.StatusCode == http.StatusNotFound {
			if f.opts.needsQuery() {
				return errQueryLogsNotFound
			}
			fmt.Fprintln(f.errOut, "Warning: the server doesn't support querying the logs, printing the raw log lines instead.")
			return printPlainLogs(ctx, f.c, f.opts, f.out)
		}
		return errors.New("Unable to retrieve logs. Error: " + err.Error())
	}
	if !f.print(logs, since, start) {
		if err := f.checkJSONLogs(ctx); err != nil {
			return err
		}
	}

	if !f.opts.follow {
		return nil
	}

	// Only a successful fetch moves this, so a failed poll's gap is covered by the next one
	lastStart := start
	ticker := time.NewTicker(f.opts.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}

		from := lastStart.Add(-logsPollOverlap)
		if from.Before(since) {
			from = since
		}
		pollStart := f.now()
		logs, _, err := f.fetch(ctx, from, logsMaxPerPage)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			fmt.Fprintf(f.errOut, "Warning: unable to retrieve new logs, retrying in %s. Error: %s\n", f.opts.interval, err)
			continue
		}
		lastStart = pollStart
		f.print(logs, from, pollStart)

		// The next poll starts no earlier than this, so older entries can't be repeated
		cutoff := lastStart.Add(-logsPollOverlap)
		for _, seen := range f.seen {
			seen.prune(cutoff)
		}
	}
}

func (f *logFollower) fetch(ctx context.Context, from time.Time, perPage int) (map[string][]json.RawMessage, *model.Response, error) {
	filter := &model.LogFilter{
		ServerNames: f.opts.nodes,
		LogLevels:   f.opts.levels,
		Search:      f.opts.search,
	}
	if !from.IsZero() {
		filter.DateFrom = from.UTC().Format(model.LogFilterDateLayout)
	}

	return f.c.QueryLogs(ctx, 0, perPage, filter)
}

// checkJSONLogs fails when the server writes its log file as plain text, which the query skips.
// It's only called when a query returned no entries, as that's the only way plain-text logs show.
func (f *logFollower) checkJSONLogs(ctx context.Context) error {
	// The first line is the last one the node handling the request logged
	lines, _, err := f.c.GetLogs(ctx, 0, 1)
	if err != nil || len(lines) == 0 {
		return nil
	}
	if line := strings.TrimSpace(lines[0]); line != "" && !strings.HasPrefix(line, "{") {
		return errPlainTextLogs
	}
	return nil
}

type pendingLog struct {
	node string
	time time.Time
	line string
}

// print prints the entries not printed before, in timestamp order. Entries before from are
// dropped, as servers older than v12.2 may ignore the filters on remote nodes. It reports
// whether the response held any entry the nodes logged.
func (f *logFollower) print(logs map[string][]json.RawMessage, from, fetchedAt time.Time) bool {
	var hasEntries bool
	var pending []pendingLog

	for _, node := range slices.Sorted(maps.Keys(logs)) {
		f.nodes[node] = true
		seen := f.seen[node]
		if seen == nil {
			seen = newSeenLogs()
			f.seen[node] = seen
		}
		// Counted rather than collected, so an identical entry logged again in the same millisecond is kept
		repeats := maps.Clone(seen.counts)

		nodeFailed := false
		// Entries without a timestamp sort with the entry before them
		lastTime := fetchedAt
		for _, raw := range logs[node] {
			entry := parseLogQueryEntry(raw)
			if entry.failedNode {
				nodeFailed = true
				if !f.failed[node] {
					f.failed[node] = true
					fmt.Fprintf(f.errOut, "Warning: unable to retrieve the logs of node %q. Error: %s\n",
						printer.SanitizeForTerminal(node), printer.SanitizeForTerminal(entry.error))
				}
				continue
			}
			hasEntries = true

			if entry.hasTime {
				lastTime = entry.time
			} else {
				entry.time = lastTime
			}

			if !f.keep(entry, from) {
				continue
			}
			if repeats[entry.key] > 0 {
				repeats[entry.key]--
				continue
			}
			seen.add(entry.key, entry.time)
			pending = append(pending, pendingLog{node: node, time: entry.time, line: string(raw)})
		}
		if !nodeFailed {
			delete(f.failed, node)
		}
	}

	slices.SortStableFunc(pending, func(a, b pendingLog) int {
		return a.time.Compare(b.time)
	})
	for _, p := range pending {
		f.writerFor(p.node).Write(human.ParseLogMessage(p.line))
	}

	return hasEntries
}

// keep applies the filters on the client, as a backstop for servers that ignore them.
func (f *logFollower) keep(entry logQueryEntry, from time.Time) bool {
	if entry.hasTime && !from.IsZero() && entry.time.Before(from) {
		return false
	}
	if len(f.levels) > 0 && !f.levels[entry.level] {
		return false
	}
	if f.search != "" && !entry.matches(f.search) {
		return false
	}
	return true
}

func (f *logFollower) writerFor(node string) human.LogWriter {
	if len(f.nodes) <= 1 {
		if f.writer == nil {
			f.writer = f.newWriter(f.out)
		}
		return f.writer
	}

	w, ok := f.prefixedWriter[node]
	if !ok {
		w = f.newWriter(&linePrefixWriter{out: f.out, prefix: "[" + printer.SanitizeForTerminal(node) + "] "})
		f.prefixedWriter[node] = w
	}
	return w
}

// logQueryEntry is a log entry as returned by POST /api/v4/logs/query.
type logQueryEntry struct {
	// key identifies the entry by all of its fields: concurrent requests log the same
	// message, caller and millisecond
	key        string
	fields     map[string]any
	level      string
	time       time.Time
	hasTime    bool
	failedNode bool
	error      string
}

func parseLogQueryEntry(raw json.RawMessage) logQueryEntry {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var fields map[string]any
	if err := dec.Decode(&fields); err != nil || fields == nil {
		return logQueryEntry{key: string(raw), fields: map[string]any{"msg": string(raw)}}
	}

	entry := logQueryEntry{fields: fields}
	// Map keys are marshaled in sorted order, so the key doesn't depend on the field order
	if key, err := json.Marshal(fields); err == nil {
		entry.key = string(key)
	} else {
		entry.key = string(raw)
	}
	entry.level, _ = fields["level"].(string)
	entry.failedNode, _ = fields["failed_node"].(bool)
	entry.error, _ = fields["error"].(string)
	if ts, ok := fields["timestamp"].(string); ok {
		if t, err := time.Parse(logr.DefTimestampFormat, ts); err == nil {
			entry.time = t
			entry.hasTime = true
		}
	}
	return entry
}

// matches reports whether a value other than the level and timestamp contains the lower-cased
// search, ignoring case, as the server does.
func (e logQueryEntry) matches(search string) bool {
	for key, value := range e.fields {
		if key == "level" || key == "timestamp" {
			continue
		}
		s, ok := value.(string)
		if !ok {
			b, err := json.Marshal(value)
			if err != nil {
				continue
			}
			s = string(b)
		}
		if strings.Contains(strings.ToLower(s), search) {
			return true
		}
	}
	return false
}

type seenLog struct {
	key  string
	time time.Time
}

// seenLogs counts the entries of a node printed within the window a poll can repeat.
type seenLogs struct {
	entries []seenLog
	counts  map[string]int
}

func newSeenLogs() *seenLogs {
	return &seenLogs{counts: make(map[string]int)}
}

func (s *seenLogs) add(key string, t time.Time) {
	s.entries = append(s.entries, seenLog{key: key, time: t})
	s.counts[key]++
}

// prune forgets the entries logged before cutoff, and the oldest ones beyond logsMaxSeenPerNode,
// so memory stays flat however long the logs are followed.
func (s *seenLogs) prune(cutoff time.Time) {
	kept := s.entries[:0]
	for _, e := range s.entries {
		if e.time.Before(cutoff) {
			s.forget(e.key)
		} else {
			kept = append(kept, e)
		}
	}
	if over := len(kept) - logsMaxSeenPerNode; over > 0 {
		for _, e := range kept[:over] {
			s.forget(e.key)
		}
		kept = append(kept[:0], kept[over:]...)
	}
	clear(s.entries[len(kept):])
	s.entries = kept
}

func (s *seenLogs) forget(key string) {
	if s.counts[key] <= 1 {
		delete(s.counts, key)
	} else {
		s.counts[key]--
	}
}

// linePrefixWriter writes prefix at the start of every line.
type linePrefixWriter struct {
	out     io.Writer
	prefix  string
	midLine bool
}

func (w *linePrefixWriter) Write(p []byte) (int, error) {
	n := len(p)
	var buf bytes.Buffer
	for len(p) > 0 {
		if !w.midLine {
			buf.WriteString(w.prefix)
			w.midLine = true
		}
		i := bytes.IndexByte(p, '\n')
		if i < 0 {
			buf.Write(p)
			break
		}
		buf.Write(p[:i+1])
		p = p[i+1:]
		w.midLine = false
	}
	if _, err := w.out.Write(buf.Bytes()); err != nil {
		return 0, err
	}
	return n, nil
}
