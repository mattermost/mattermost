// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
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
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/report"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
	"github.com/mattermost/mattermost/server/v8/platform/shared/releases"
)

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

var HealthExportCmd = &cobra.Command{
	Use:   "export <html|md>",
	Short: "Export health findings as an HTML or Markdown report",
	Long: "Export the server's latest health findings as an HTML or Markdown report to share, written to stdout or to the file given with --output. The report includes resolved and muted findings. --json can't be used with this command.\n\n" +
		"With --packet, evaluate a Support Packet on this machine instead. No server connection is needed.",
	Example:   "  health export html --output health-report.html\n  health export md --packet mm_support_packet.zip",
	Args:      cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs),
	ValidArgs: []string{"html", "md"},
	RunE:      healthExportRunE,
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
	HealthExportCmd.Flags().StringP("output", "o", "", "File to write the report to, instead of stdout")
	HealthExportCmd.Flags().String("packet", "", "Path to a Support Packet zip to evaluate without a server")

	HealthCmd.AddCommand(HealthCheckCmd, HealthRunCmd, HealthExportCmd)
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

	return printHealthFindings(list, includeResolved, report.Options{GeneratedAt: time.Now()})
}

// healthExportRunE dispatches before any client is built, as healthCheckRunE does.
func healthExportRunE(cmd *cobra.Command, args []string) error {
	if printer.GetFormat() == printer.FormatJSON {
		return errors.New("--json cannot be used with health export")
	}

	packetPath, _ := cmd.Flags().GetString("packet")
	if packetPath == "" {
		return withClient(healthExportCmdF)(cmd, args)
	}

	// An export is meant to be shared, so it leaves out the findings meant for support engineers.
	list, opts, err := evaluateHealthPacket(cmd.Context(), packetPath, model.HealthFindingFilter{Surfaces: []string{string(healthcheck.SurfaceProduct)}})
	if err != nil {
		return err
	}
	return exportHealthReport(cmd, args[0], list, opts)
}

func healthExportCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	list, _, err := c.GetHealthFindings(context.TODO(), model.HealthFindingFilter{Muted: model.MutedIncluded})
	if err != nil {
		return fmt.Errorf("failed to get health findings: %w", err)
	}

	opts := report.Options{GeneratedAt: time.Now()}
	if config, _, configErr := c.GetClientConfig(context.TODO(), ""); configErr == nil {
		opts.SiteURL = config["SiteURL"]
		opts.ServerVersion = config["Version"]
	}
	if license, _, licenseErr := c.GetOldClientLicense(context.TODO(), ""); licenseErr == nil && license["IsLicensed"] == "true" {
		opts.License = model.LicenseSkuDisplayName(license["SkuShortName"], license["IsGovSku"] == "true")
		opts.Company = license["Company"]
	}
	return exportHealthReport(cmd, args[0], list, opts)
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

func healthCheckPacketCmdF(cmd *cobra.Command, args []string) error {
	packetPath, _ := cmd.Flags().GetString("packet")
	includeResolved, _ := cmd.Flags().GetBool("include-resolved")
	if includeMuted, _ := cmd.Flags().GetBool("include-muted"); includeMuted {
		return errors.New("--include-muted cannot be used with --packet: findings evaluated from a packet are never muted")
	}

	list, opts, err := evaluateHealthPacket(cmd.Context(), packetPath, model.HealthFindingFilter{})
	if err != nil {
		return err
	}
	return printHealthFindings(list, includeResolved, opts)
}

// evaluateHealthPacket evaluates a Support Packet with the same engine and reconciler the server
// uses, against an in-memory store, and renders the findings filter selects with the English
// catalog built into mmctl. The returned options describe the packet's server.
func evaluateHealthPacket(ctx context.Context, packetPath string, filter model.HealthFindingFilter) (*model.HealthFindingList, report.Options, error) {
	p, err := packet.ReadFile(packetPath)
	if err != nil {
		return nil, report.Options{}, fmt.Errorf("failed to read Support Packet: %w", err)
	}

	notes := []string{healthPacketDisclaimer}
	if note := fillLatestVersion(ctx, p.Snapshot); note != "" {
		notes = append(notes, note)
	}
	notes = append(notes, p.Warnings...)

	// Findings are stamped with when the packet was generated, not when mmctl ran. The report
	// shows an unknown collection time rather than claiming the data is from now.
	evaluatedAt := p.Snapshot.CollectedAt
	var collectedAt int64
	if evaluatedAt.IsZero() {
		evaluatedAt = time.Now()
	} else {
		collectedAt = evaluatedAt.UnixMilli()
	}
	now := func() time.Time { return evaluatedAt }

	registry := healthcheck.Builtin()
	store := healthcheck.NewMemoryStore()
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry, Now: now})
	reconciler := healthcheck.NewReconciler(healthcheck.ReconcilerOpts{Store: store, Registry: registry, Now: now})
	if _, err = reconciler.Reconcile(engine.Evaluate(p.Snapshot)); err != nil {
		return nil, report.Options{}, fmt.Errorf("failed to evaluate Support Packet: %w", err)
	}

	stored, err := store.List(filter)
	if err != nil {
		return nil, report.Options{}, fmt.Errorf("failed to list health findings: %w", err)
	}

	if err = i18n.TranslationsPreInitFromFileBytes("en.json", serveri18n.English); err != nil {
		return nil, report.Options{}, fmt.Errorf("failed to load translations: %w", err)
	}

	findings := make([]*model.HealthFinding, 0, len(stored))
	for _, finding := range stored {
		if rule, ok := registry.Get(finding.Code); ok {
			findings = append(findings, finding.Render(i18n.T, rule.RuleText))
		}
	}

	list := &model.HealthFindingList{EvaluatedAt: collectedAt, Findings: findings}
	opts := report.Options{
		GeneratedAt: time.Now(),
		PointInTime: true,
		Notes:       notes,
	}
	opts.SiteURL, _ = p.Snapshot.ConfigString(func(cfg *model.Config) *string { return cfg.ServiceSettings.SiteURL })
	opts.ServerVersion = p.Snapshot.Version.Current
	if license, ok := p.Snapshot.License(); ok {
		opts.License = model.LicenseSkuDisplayName(license.SkuShortName, license.IsGovSKU)
		opts.Company = license.Company
	}
	return list, opts, nil
}

// exportHealthReport renders the report as format, to the --output file or to stdout.
func exportHealthReport(cmd *cobra.Command, format string, list *model.HealthFindingList, opts report.Options) error {
	output, _ := cmd.Flags().GetString("output")

	r, err := buildHealthReport(list, opts)
	if err != nil {
		return err
	}

	write := r.WriteHTML
	if format == "md" {
		write = r.WriteMarkdown
	}
	var b bytes.Buffer
	if err := write(&b); err != nil {
		return fmt.Errorf("failed to render the health report: %w", err)
	}

	if output == "" {
		printer.Print(strings.TrimSuffix(b.String(), "\n"))
		return nil
	}
	if err := os.WriteFile(output, b.Bytes(), 0600); err != nil {
		return fmt.Errorf("failed to write the health report: %w", err)
	}
	printer.PrintT("Wrote the health report to {{ .file }}", map[string]string{"file": output})
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
func printHealthFindings(list *model.HealthFindingList, includeResolved bool, opts report.Options) error {
	shown := make([]*model.HealthFinding, 0, len(list.Findings))
	for _, finding := range list.Findings {
		if includeResolved || finding.State != string(healthcheck.StateResolved) {
			shown = append(shown, finding)
		}
	}
	list = &model.HealthFindingList{EvaluatedAt: list.EvaluatedAt, Findings: shown}

	if printer.GetFormat() == printer.FormatJSON {
		for _, note := range opts.Notes {
			printer.PrintError(note)
		}
		printer.SetSingle(true)
		printer.PrintT("", list)
		return nil
	}

	r, err := buildHealthReport(list, opts)
	if err != nil {
		return err
	}
	printer.Print(formatHealthReport(r))
	return nil
}

// buildHealthReport builds the report with the English catalog built into mmctl, showing times
// in this machine's time zone.
func buildHealthReport(list *model.HealthFindingList, opts report.Options) (*report.Report, error) {
	if err := i18n.TranslationsPreInitFromFileBytes("en.json", serveri18n.English); err != nil {
		return nil, fmt.Errorf("failed to load translations: %w", err)
	}
	opts.T = i18n.T
	opts.Location = time.Local
	return report.Build(list, opts), nil
}

func formatHealthReport(r *report.Report) string {
	header := r.EvaluatedAt.Label + ": " + r.EvaluatedAt.Value
	if r.Age != 0 {
		minutes := int(r.Age.Minutes())
		unit := "minutes"
		if minutes == 1 {
			unit = "minute"
		}
		header += fmt.Sprintf(" (%d %s ago)", minutes, unit)
	}
	if r.Stale != "" {
		header += ". " + r.Stale
	}
	blocks := slices.Concat(r.Notes, []string{header})

	for _, section := range r.Sections {
		lines := []string{section.Title}
		detail := func(text string) {
			if text != "" {
				lines = append(lines, "      "+text)
			}
		}
		for _, finding := range section.Findings {
			switch section.Kind {
			case report.SectionUnknown, report.SectionMuted:
				tags := finding.Severity
				if section.Kind == report.SectionMuted && finding.Unknown {
					tags += ", " + r.Labels.Unknown
				}
				lines = append(lines, fmt.Sprintf("  %s (%s)", finding.Title, tags))
				detail(finding.Message)
				if finding.Remediation != "" {
					detail("→ " + finding.Remediation)
				}
			case report.SectionResolved:
				lines = append(lines, "  "+finding.Title)
			default:
				lines = append(lines, fmt.Sprintf("  [%s] %s", finding.Area, finding.Title))
				detail(finding.Message)
				if finding.Remediation != "" {
					detail("→ " + finding.Remediation)
				}
			}
		}
		blocks = append(blocks, strings.Join(lines, "\n"))
	}

	return strings.Join(append(blocks, r.Summary), "\n\n")
}
