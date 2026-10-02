// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// The server evaluates hourly, so results older than two intervals mean evaluation stopped.
const healthEvaluationStaleAfter = 2 * time.Hour

var HealthCmd = &cobra.Command{
	Use:   "health",
	Short: "Inspect workspace health findings",
}

var HealthCheckCmd = &cobra.Command{
	Use:     "check",
	Short:   "Report current health findings",
	Long:    "Report the findings of the server's latest health evaluation. By default only firing findings and findings that could not be evaluated are shown.",
	Example: "  health check\n  health check --include-resolved --include-muted",
	Args:    cobra.NoArgs,
	RunE:    withClient(healthCheckCmdF),
}

func init() {
	HealthCheckCmd.Flags().Bool("include-resolved", false, "Include resolved findings")
	HealthCheckCmd.Flags().Bool("include-muted", false, "Include muted findings")

	HealthCmd.AddCommand(HealthCheckCmd)
	RootCmd.AddCommand(HealthCmd)
}

func healthCheckCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	includeResolved, _ := cmd.Flags().GetBool("include-resolved")
	includeMuted, _ := cmd.Flags().GetBool("include-muted")

	filter := model.HealthFindingFilter{}
	if includeMuted {
		filter.Muted = model.MutedIncluded
	}

	list, _, err := c.GetHealthFindings(context.TODO(), filter)
	if err != nil {
		return fmt.Errorf("failed to get health findings: %w", err)
	}

	printHealthFindings(list, includeResolved, time.Now())
	return nil
}

// printHealthFindings prints already-rendered findings, leaving out resolved ones unless
// includeResolved is set.
func printHealthFindings(list *model.HealthFindingList, includeResolved bool, now time.Time) {
	shown := make([]*model.HealthFinding, 0, len(list.Findings))
	for _, finding := range list.Findings {
		if includeResolved || finding.State != string(healthcheck.StateResolved) {
			shown = append(shown, finding)
		}
	}

	if printer.GetFormat() == printer.FormatJSON {
		printer.SetSingle(true)
		printer.PrintT("", &model.HealthFindingList{EvaluatedAt: list.EvaluatedAt, Findings: shown})
		return
	}

	printer.Print(formatHealthFindings(list.EvaluatedAt, shown, now))
}

func formatHealthFindings(evaluatedAt int64, shown []*model.HealthFinding, now time.Time) string {
	if evaluatedAt == 0 {
		return "Not evaluated yet. The first check runs within an hour of enabling the feature."
	}

	slices.SortStableFunc(shown, compareHealthFindings)

	var firing, unknown, resolved []*model.HealthFinding
	for _, finding := range shown {
		switch healthcheck.State(finding.State) {
		case healthcheck.StateFiring:
			firing = append(firing, finding)
		case healthcheck.StateUnknown:
			unknown = append(unknown, finding)
		case healthcheck.StateResolved:
			resolved = append(resolved, finding)
		}
	}

	blocks := []string{formatHealthEvaluationTime(evaluatedAt, now)}

	for i := 0; i < len(firing); {
		area := firing[i].Area
		lines := []string{healthAreaHeading(area)}
		for ; i < len(firing) && firing[i].Area == area; i++ {
			lines = append(lines, healthFindingLines(firing[i], true)...)
		}
		blocks = append(blocks, strings.Join(lines, "\n"))
	}

	if len(unknown) > 0 {
		lines := []string{"Could not evaluate"}
		for _, finding := range unknown {
			lines = append(lines, healthFindingLines(finding, false)...)
		}
		blocks = append(blocks, strings.Join(lines, "\n"))
	}

	if len(resolved) > 0 {
		lines := []string{"Resolved"}
		for _, finding := range resolved {
			lines = append(lines, "  "+healthFindingTitle(finding))
		}
		blocks = append(blocks, strings.Join(lines, "\n"))
	}

	blocks = append(blocks, formatHealthCounts(firing, unknown))

	return strings.Join(blocks, "\n\n")
}

func formatHealthEvaluationTime(evaluatedAtMillis int64, now time.Time) string {
	evaluatedAt := time.UnixMilli(evaluatedAtMillis)
	age := now.Sub(evaluatedAt)
	minutes := int(age.Minutes())
	unit := "minutes"
	if minutes == 1 {
		unit = "minute"
	}

	header := fmt.Sprintf("Last evaluated %s (%d %s ago)", evaluatedAt.Format("2006-01-02 15:04"), minutes, unit)
	if age > healthEvaluationStaleAfter {
		header += ". Evaluation appears to have stopped."
	}
	return header
}

// healthFindingLines prints an unknown finding's message too: for an unknown it is the reason
// the rule could not be evaluated.
func healthFindingLines(finding *model.HealthFinding, withRemediation bool) []string {
	lines := []string{fmt.Sprintf("  %-10s%s", strings.ToUpper(finding.Severity), healthFindingTitle(finding))}
	if finding.Message != "" {
		lines = append(lines, "            "+finding.Message)
	}
	if withRemediation && finding.Remediation != "" {
		lines = append(lines, "            → "+finding.Remediation)
	}
	return lines
}

func healthFindingTitle(finding *model.HealthFinding) string {
	title := finding.Title
	if finding.Scope != "" {
		title += " on " + finding.Scope
	}
	if finding.IsMuted() {
		title += " [muted]"
	}
	return title
}

func formatHealthCounts(firing, unknown []*model.HealthFinding) string {
	if len(firing) == 0 && len(unknown) == 0 {
		return "No findings."
	}

	bySeverity := map[healthcheck.Severity]int{}
	for _, finding := range firing {
		bySeverity[healthcheck.Severity(finding.Severity)]++
	}

	var counts []string
	if n := bySeverity[healthcheck.SeverityCritical]; n > 0 {
		counts = append(counts, fmt.Sprintf("%d critical", n))
	}
	if n := bySeverity[healthcheck.SeverityWarning]; n == 1 {
		counts = append(counts, "1 warning")
	} else if n > 1 {
		counts = append(counts, fmt.Sprintf("%d warnings", n))
	}
	if n := bySeverity[healthcheck.SeverityInfo]; n > 0 {
		counts = append(counts, fmt.Sprintf("%d info", n))
	}
	if len(unknown) > 0 {
		counts = append(counts, fmt.Sprintf("%d could not be evaluated", len(unknown)))
	}

	return strings.Join(counts, ", ")
}

func compareHealthFindings(a, b *model.HealthFinding) int {
	return cmp.Or(
		cmp.Compare(healthAreaRank(a.Area), healthAreaRank(b.Area)),
		cmp.Compare(healthSeverityRank(a.Severity), healthSeverityRank(b.Severity)),
		strings.Compare(a.Title, b.Title),
		strings.Compare(a.Scope, b.Scope),
	)
}

func healthAreaRank(area model.HealthArea) int {
	if i := slices.Index(model.AllHealthAreas(), area); i >= 0 {
		return i
	}
	return len(model.AllHealthAreas())
}

func healthSeverityRank(severity string) int {
	switch healthcheck.Severity(severity) {
	case healthcheck.SeverityCritical:
		return 0
	case healthcheck.SeverityWarning:
		return 1
	case healthcheck.SeverityInfo:
		return 2
	default:
		return 3
	}
}

func healthAreaHeading(area model.HealthArea) string {
	switch area {
	case model.AreaAuth:
		return "Authentication"
	case model.AreaDatabase:
		return "Database"
	case model.AreaSearch:
		return "Search"
	case model.AreaJobs:
		return "Jobs"
	case model.AreaCluster:
		return "Cluster"
	case model.AreaNotifications:
		return "Notifications"
	case model.AreaCompliance:
		return "Compliance"
	case model.AreaPlatform:
		return "Platform"
	case model.AreaLicense:
		return "License"
	case model.AreaVersion:
		return "Version"
	default:
		return string(area)
	}
}
