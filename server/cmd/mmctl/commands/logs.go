// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer/human"
)

const (
	logsPerPage     = 100 // logsPerPage is the number of log entries to fetch per API call
	timeStampFormat = "2006-01-02 15:04:05.000 Z07:00"
)

var LogsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Display logs in a human-readable format",
	Long:  "Display logs in a human-readable format. As the logs format depends on the server, the \"--format\" flag cannot be used with this command.",
	RunE:  withClient(logsCmdF),
}

func init() {
	LogsCmd.Flags().IntP("number", "n", DefaultPageSize, "Number of log lines to retrieve.")
	LogsCmd.Flags().BoolP("logrus", "l", false, "Use logrus for formatting.")
	LogsCmd.Flags().BoolP("follow", "f", false, "Fetch and watch logs.")
	RootCmd.AddCommand(LogsCmd)
}

func logsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if cmd.Flags().Changed("format") || cmd.Flags().Changed("json") {
		return fmt.Errorf("the %q and %q flags cannot be used with this command", "--format", "--json")
	} else if viper.GetString("format") == printer.FormatJSON {
		return fmt.Errorf("json formatting cannot be applied on this command. Please check the value of %q", "MMCTL_FORMAT")
	}

	number, _ := cmd.Flags().GetInt("number")
	logLines, _, err := c.GetLogs(context.TODO(), 0, number)
	if err != nil {
		return errors.New("Unable to retrieve logs. Error: " + err.Error())
	}

	if watch, _ := cmd.Flags().GetBool("follow"); watch {
		var oldestEntry string
		now := time.Now()
		ctx := context.Background()

		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return nil
			case <-ticker.C:
				var page int
				for {
					logs, err := fetchLogs(ctx, c, page, logsPerPage, now)
					if err != nil {
						return fmt.Errorf("failed to fetch log entries: %w", err)
					}

					var allNew bool
					logs, oldestEntry, allNew = checkOldestEntry(logs, oldestEntry)
					processLogEntries(logs, cmd)

					if !allNew {
						// No more logs to fetch
						break
					}
					page++
				}
			}
		}
	}
	processLogEntries(logLines, cmd)
	return nil
}

func processLogEntries(logLines []string, cmd *cobra.Command) {
	reader := bytes.NewReader([]byte(strings.Join(logLines, "")))

	var writer human.LogWriter
	if logrus, _ := cmd.Flags().GetBool("logrus"); logrus {
		writer = human.NewLogrusWriter(os.Stdout)
	} else {
		writer = human.NewSimpleWriter(os.Stdout)
	}
	human.ProcessLogs(reader, writer)
}

func fetchLogs(ctx context.Context, client client.Client, page, perPage int, since time.Time) ([]string, error) {
	logs, _, err := client.GetLogs(ctx, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs from Mattermost: %w", err)
	}

	logs, err = filterLogEntries(logs, since)
	if err != nil {
		return nil, fmt.Errorf("failed to filter log entries: %w", err)
	}
	return logs, nil
}

func checkOldestEntry(logs []string, oldest string) ([]string, string, bool) {
	if len(logs) == 0 {
		return nil, oldest, false
	}

	newOldestEntry := logs[(len(logs) - 1)]

	i := slices.Index(logs, oldest)
	switch i {
	case -1:
		// Every log entry is new
		return logs, newOldestEntry, true
	case len(logs) - 1:
		// No new log entries
		return nil, oldest, false
	default:
		// Filter out oldest log entry
		return logs[i+1:], newOldestEntry, false
	}
}

func filterLogEntries(logs []string, since time.Time) ([]string, error) {
	type logEntry struct {
		Timestamp string `json:"timestamp"`
	}

	var filtered []string

	for _, lg := range logs {
		var le logEntry
		err := json.Unmarshal([]byte(lg), &le)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal log entry into JSON: %w", err)
		}

		let, err := time.Parse(timeStampFormat, le.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("unknown timestamp format: %w", err)
		}
		if let.Before(since) {
			continue
		}
		filtered = append(filtered, lg)
	}

	return filtered, nil
}
