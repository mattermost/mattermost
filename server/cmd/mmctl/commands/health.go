// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	serveri18n "github.com/mattermost/mattermost/server/v8/i18n"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
	"github.com/mattermost/mattermost/server/v8/platform/shared/releases"
)

// The server evaluates hourly, so results older than two intervals mean evaluation stopped.
const healthEvaluationStaleAfter = 2 * time.Hour

// healthRunPollInterval is how often health run checks on the run it started. A variable so tests
// don't wait.
var healthRunPollInterval = 2 * time.Second

// healthRunWaitTimeout is how long health run waits for the run to finish. The server caps a run at a
// few minutes, so a run still going after this belongs to a node that died or was never picked up.
const healthRunWaitTimeout = 5 * time.Minute

var HealthCmd = &cobra.Command{
	Use:   "health",
	Short: "Inspect workspace health findings",
}

const healthPacketDisclaimer = "Evaluated locally from a Support Packet. The packet is a point-in-time snapshot: findings describe the server when the packet was generated, not its current state. Version support is judged as of today."

// Packets don't record the latest release, so --packet fetches it. Variables so tests can
// point them at a local server.
var (
	healthLatestVersionURL     = releases.LatestURL
	healthLatestVersionTimeout = 5 * time.Second
)

var HealthCheckCmd = &cobra.Command{
	Use:   "check",
	Short: "Report current health findings",
	Long: "Report the findings of the server's latest health evaluation. By default only firing findings and findings that could not be evaluated are shown.\n\n" +
		"With --packet, evaluate a Support Packet on this machine instead. No server connection is needed, and findings meant for support engineers are included.",
	Example: "  health check\n  health check --include-resolved --include-muted\n  health check --packet mm_support_packet.zip",
	Args:    cobra.NoArgs,
	RunE:    healthCheckRunE,
}

var HealthRunCmd = &cobra.Command{
	Use:   "run",
	Short: "Run the health check now and report its findings",
	Long: "Run the health check now, wait for it to finish, then report its findings as health check does. " +
		"If a run is already pending or in progress, wait for that one instead of starting another.",
	Example: "  health run\n  health run --include-resolved --include-muted",
	Args:    cobra.NoArgs,
	RunE:    withClient(healthRunCmdF),
}

func init() {
	HealthCheckCmd.Flags().Bool("include-resolved", false, "Include resolved findings")
	HealthCheckCmd.Flags().Bool("include-muted", false, "Include muted findings")
	HealthCheckCmd.Flags().String("packet", "", "Path to a Support Packet zip to evaluate without a server")
	HealthRunCmd.Flags().Bool("include-resolved", false, "Include resolved findings")
	HealthRunCmd.Flags().Bool("include-muted", false, "Include muted findings")

	HealthCmd.AddCommand(HealthCheckCmd, HealthRunCmd)
	RootCmd.AddCommand(HealthCmd)
}

// healthCheckRunE dispatches before any client is built: withClient connects eagerly, and
// --packet must work with no server.
func healthCheckRunE(cmd *cobra.Command, args []string) error {
	if packetPath, _ := cmd.Flags().GetString("packet"); packetPath != "" {
		return healthCheckPacketCmdF(cmd, args)
	}
	return withClient(healthCheckCmdF)(cmd, args)
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

func healthRunCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if err := runHealthCheckAndWait(cmd.Context(), c, healthRunWaitTimeout); err != nil {
		return err
	}
	return healthCheckCmdF(c, cmd, args)
}

// runHealthCheckAndWait starts a health check run, or joins the one already pending or in
// progress, and polls its job until it finishes, timeout passes, or ctx is canceled (by Ctrl+C).
func runHealthCheckAndWait(ctx context.Context, c client.Client, timeout time.Duration) error {
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	job, _, err := c.CreateJob(waitCtx, &model.Job{Type: model.JobTypeHealthCheck})
	if err != nil {
		return fmt.Errorf("failed to start a health check run: %w", err)
	}

	ticker := time.NewTicker(healthRunPollInterval)
	defer ticker.Stop()
	for {
		switch job.Status {
		case model.JobStatusPending, model.JobStatusInProgress:
		case model.JobStatusSuccess, model.JobStatusWarning:
			return nil
		default:
			if msg := job.Data["error"]; msg != "" {
				return fmt.Errorf("health check run %s failed: %s", job.Id, msg)
			}
			return fmt.Errorf("health check run %s failed", job.Id)
		}

		select {
		case <-waitCtx.Done():
			if err := ctx.Err(); err != nil {
				return err
			}
			return fmt.Errorf("timed out after %s waiting for health check run %s, which is still %s; run `mmctl health check` later to see its findings", timeout, job.Id, job.Status)
		case <-ticker.C:
		}

		latest, resp, err := c.GetJob(waitCtx, job.Id)
		if err != nil {
			// Report the timeout or cancellation, not the request it cut short. A 404 means a lagging
			// read replica hasn't seen the new job yet.
			if waitCtx.Err() != nil || (resp != nil && resp.StatusCode == http.StatusNotFound) {
				continue
			}
			return fmt.Errorf("failed to get the health check run status: %w", err)
		}
		job = latest
	}
}

// healthCheckPacketCmdF evaluates a Support Packet with the same engine and reconciler the
// server uses, against an in-memory store, and renders with the English catalog built into mmctl.
func healthCheckPacketCmdF(cmd *cobra.Command, args []string) error {
	packetPath, _ := cmd.Flags().GetString("packet")
	includeResolved, _ := cmd.Flags().GetBool("include-resolved")
	if includeMuted, _ := cmd.Flags().GetBool("include-muted"); includeMuted {
		return errors.New("--include-muted cannot be used with --packet: findings evaluated from a packet are never muted")
	}

	p, err := packet.ReadFile(packetPath)
	if err != nil {
		return fmt.Errorf("failed to read Support Packet: %w", err)
	}

	notes := []string{healthPacketDisclaimer}
	if note := fillLatestVersion(cmd.Context(), p.Snapshot); note != "" {
		notes = append(notes, note)
	}
	notes = append(notes, p.Warnings...)

	// Findings are stamped with when the packet was generated, not when mmctl ran.
	evaluatedAt := p.Snapshot.CollectedAt
	if evaluatedAt.IsZero() {
		evaluatedAt = time.Now()
	}
	now := func() time.Time { return evaluatedAt }

	registry := healthcheck.Builtin()
	store := healthcheck.NewMemoryStore()
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry, Now: now})
	reconciler := healthcheck.NewReconciler(healthcheck.ReconcilerOpts{Store: store, Registry: registry, Now: now})
	if _, err = reconciler.Reconcile(engine.Evaluate(p.Snapshot)); err != nil {
		return fmt.Errorf("failed to evaluate Support Packet: %w", err)
	}

	stored, err := store.List(model.HealthFindingFilter{})
	if err != nil {
		return fmt.Errorf("failed to list health findings: %w", err)
	}

	if err = i18n.TranslationsPreInitFromFileBytes("en.json", serveri18n.English); err != nil {
		return fmt.Errorf("failed to load translations: %w", err)
	}

	findings := make([]*model.HealthFinding, 0, len(stored))
	for _, finding := range stored {
		if rule, ok := registry.Get(finding.Code); ok {
			findings = append(findings, finding.Render(i18n.T, rule.RuleText))
		}
	}

	printHealthFindings(&model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: findings}, includeResolved, evaluatedAt, notes...)
	return nil
}

// fillLatestVersion fetches the latest release from GitHub when the snapshot doesn't record one.
// A failed fetch is not an error: the version-behind rules report unknown and the returned note
// says why.
func fillLatestVersion(ctx context.Context, snapshot *healthcheck.Snapshot) string {
	if snapshot.Version.Latest != "" {
		return ""
	}

	ctx, cancel := context.WithTimeout(ctx, healthLatestVersionTimeout)
	defer cancel()

	release, err := releases.FetchLatest(ctx, healthLatestVersionURL)
	if err != nil {
		return fmt.Sprintf("Could not fetch the latest release (%s): version-behind findings are unknown.", err)
	}

	snapshot.Version.Latest = strings.TrimPrefix(release.TagName, "v")
	return ""
}

// printHealthFindings prints already-rendered findings, leaving out resolved ones unless
// includeResolved is set. Notes open the plain output; with --json they go to stderr so the
// output stays valid JSON.
func printHealthFindings(list *model.HealthFindingList, includeResolved bool, now time.Time, notes ...string) {
	shown := make([]*model.HealthFinding, 0, len(list.Findings))
	for _, finding := range list.Findings {
		if includeResolved || finding.State != string(healthcheck.StateResolved) {
			shown = append(shown, finding)
		}
	}

	if printer.GetFormat() == printer.FormatJSON {
		for _, note := range notes {
			printer.PrintError(note)
		}
		printer.SetSingle(true)
		printer.PrintT("", &model.HealthFindingList{EvaluatedAt: list.EvaluatedAt, Findings: shown})
		return
	}

	printer.Print(strings.Join(slices.Concat(notes, []string{formatHealthFindings(list.EvaluatedAt, shown, now)}), "\n\n"))
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
