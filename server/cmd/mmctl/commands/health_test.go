// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.uber.org/mock/gomock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/report"
)

func healthTestFindings(lastSeen time.Time) []*model.HealthFinding {
	return []*model.HealthFinding{
		{
			Fingerprint: "00000000000000000000000000000001",
			Code:        "PUSH_BAD_SCHEME",
			Severity:    "critical",
			State:       "firing",
			Area:        model.AreaNotifications,
			Title:       "Push notification server is not HTTPS",
			Message:     "The push server is http://push.example.com, so notifications are sent unencrypted.",
			Remediation: "Set Push Notification Server to an https:// URL.",
			LastSeenAt:  lastSeen.UnixMilli(),
		},
		{
			Fingerprint: "00000000000000000000000000000002",
			Code:        "SITE_URL_HTTP",
			Severity:    "warning",
			State:       "unknown",
			Area:        model.AreaCluster,
			Title:       "Site URL is not HTTPS",
			Message:     "Config section unavailable.",
			Remediation: "Serve via HTTPS and update SiteURL accordingly.",
			LastSeenAt:  lastSeen.UnixMilli(),
		},
		{
			Fingerprint: "00000000000000000000000000000003",
			Code:        "SITE_URL_EMPTY",
			Severity:    "critical",
			State:       "resolved",
			Area:        model.AreaCluster,
			Title:       "Site URL is empty",
			Remediation: "Set SiteURL to the public HTTPS URL of the server.",
			LastSeenAt:  lastSeen.UnixMilli(),
		},
	}
}

func healthTestList(lastSeen time.Time) *model.HealthFindingList {
	return &model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: healthTestFindings(lastSeen)}
}

func healthTestCommand(includeResolved, includeMuted bool) *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().Bool("include-resolved", includeResolved, "")
	cmd.Flags().Bool("include-muted", includeMuted, "")
	return cmd
}

func (s *MmctlUnitTestSuite) printedHealthFindings() string {
	s.Require().Len(printer.GetLines(), 1)
	output, ok := printer.GetLines()[0].(string)
	s.Require().True(ok)
	return output
}

func (s *MmctlUnitTestSuite) TestHealthCheckCmd() {
	lastSeen := time.Now().Add(-5 * time.Minute)

	s.Run("default view shows firing and unknown findings only", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(healthTestList(lastSeen), &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.Contains(output, "Push notification server is not HTTPS")
		s.Contains(output, "Site URL is not HTTPS")
		s.NotContains(output, "Site URL is empty")
		s.NotContains(output, "Resolved")
	})

	s.Run("--include-resolved adds resolved findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(healthTestList(lastSeen), &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(true, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.Contains(output, "Push notification server is not HTTPS")
		s.Contains(output, "Site URL is not HTTPS")
		s.Contains(output, "Resolved\n  Site URL is empty")
	})

	s.Run("--include-muted asks the server for muted findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{Muted: model.MutedIncluded}).
			Return(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, true), []string{})
		s.Require().NoError(err)
	})

	s.Run("--json prints the same rows as the table", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		list := healthTestList(lastSeen)
		findings := list.Findings

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(list, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, false), []string{})
		s.Require().NoError(err)

		s.Require().Len(printer.GetLines(), 1)
		s.Equal(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: []*model.HealthFinding{findings[0], findings[1]}}, printer.GetLines()[0])
	})

	s.Run("--json with --include-resolved prints every row", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		list := healthTestList(lastSeen)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(list, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(true, false), []string{})
		s.Require().NoError(err)

		s.Require().Len(printer.GetLines(), 1)
		s.Equal(list, printer.GetLines()[0])
	})

	s.Run("every finding muted still reports the evaluation", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: []*model.HealthFinding{}}, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.True(strings.HasPrefix(output, "Last evaluated: "), output)
		s.True(strings.HasSuffix(output, "\n\nNo open findings."), output)
	})

	s.Run("client error", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, false), []string{})
		s.Require().EqualError(err, "failed to get health findings: mock error")
		s.Empty(printer.GetLines())
	})
}

func healthTestJob(status string, createAt int64) *model.Job {
	return &model.Job{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: status, CreateAt: createAt}
}

func (s *MmctlUnitTestSuite) TestHealthRun() {
	saved := healthRunPollInterval
	healthRunPollInterval = time.Millisecond
	s.T().Cleanup(func() { healthRunPollInterval = saved })

	lastSeen := time.Now()

	s.Run("waits for the run to succeed, then prints the findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		pending := healthTestJob(model.JobStatusPending, 100)
		inProgress := *pending
		inProgress.Status = model.JobStatusInProgress
		succeeded := *pending
		succeeded.Status = model.JobStatusSuccess

		gomock.InOrder(
			s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(pending, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetJob(gomock.Any(), pending.Id).Return(&inProgress, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetJob(gomock.Any(), pending.Id).Return(&succeeded, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).Return(healthTestList(lastSeen), &model.Response{}, nil).Times(1),
		)

		err := healthRunCmdF(s.client, newTestCmd(s.T(), HealthRunCmd), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.True(strings.HasPrefix(output, "Last evaluated: "), output)
		s.Contains(output, "Push notification server is not HTTPS")
	})

	s.Run("keeps waiting while a lagging replica hasn't seen the new run", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		started := healthTestJob(model.JobStatusPending, 100)
		succeeded := *started
		succeeded.Status = model.JobStatusSuccess

		gomock.InOrder(
			s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(started, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetJob(gomock.Any(), started.Id).Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).Times(1),
			s.client.EXPECT().GetJob(gomock.Any(), started.Id).Return(&succeeded, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).Return(healthTestList(lastSeen), &model.Response{}, nil).Times(1),
		)

		err := healthRunCmdF(s.client, newTestCmd(s.T(), HealthRunCmd), []string{})
		s.Require().NoError(err)
	})

	s.Run("fails when the run's status can't be read", func() {
		printer.Clean()

		started := healthTestJob(model.JobStatusPending, 100)
		gomock.InOrder(
			s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(started, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetJob(gomock.Any(), started.Id).Return(nil, &model.Response{StatusCode: http.StatusInternalServerError}, errors.New("mock error")).Times(1),
		)

		err := healthRunCmdF(s.client, newTestCmd(s.T(), HealthRunCmd), []string{})
		s.Require().EqualError(err, "failed to get the health check run status: mock error")
	})

	s.Run("a run that already finished is not polled", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		gomock.InOrder(
			s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(healthTestJob(model.JobStatusSuccess, 100), &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).Return(healthTestList(lastSeen), &model.Response{}, nil).Times(1),
		)

		err := healthRunCmdF(s.client, newTestCmd(s.T(), HealthRunCmd), []string{})
		s.Require().NoError(err)
	})

	s.Run("a failed run reports the job's error and prints nothing", func() {
		printer.Clean()

		started := healthTestJob(model.JobStatusPending, 100)
		failed := *started
		failed.Status = model.JobStatusError
		failed.Data = model.StringMap{"error": "collect failed"}

		gomock.InOrder(
			s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(started, &model.Response{}, nil).Times(1),
			s.client.EXPECT().GetJob(gomock.Any(), started.Id).Return(&failed, &model.Response{}, nil).Times(1),
		)

		err := healthRunCmdF(s.client, newTestCmd(s.T(), HealthRunCmd), []string{})
		s.Require().EqualError(err, "health check run "+started.Id+" failed: collect failed")
		s.Empty(printer.GetLines())
	})

	s.Run("timeout", func() {
		printer.Clean()

		started := healthTestJob(model.JobStatusPending, 100)
		s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(started, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetJob(gomock.Any(), started.Id).Return(started, &model.Response{}, nil).AnyTimes()

		err := runHealthCheckAndWait(s.T().Context(), s.client, 50*time.Millisecond)
		s.Require().EqualError(err, "timed out after 50ms waiting for health check run "+started.Id+", which is still pending; run `mmctl health check` later to see its findings")
	})

	s.Run("Ctrl+C stops the wait without reporting a timeout", func() {
		printer.Clean()

		ctx, cancel := context.WithCancel(s.T().Context())
		started := healthTestJob(model.JobStatusPending, 100)
		s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(started, &model.Response{}, nil).Times(1)
		s.client.EXPECT().GetJob(gomock.Any(), started.Id).DoAndReturn(func(context.Context, string) (*model.Job, *model.Response, error) {
			cancel()
			return started, &model.Response{}, nil
		}).AnyTimes()

		err := runHealthCheckAndWait(ctx, s.client, time.Minute)
		s.Require().ErrorIs(err, context.Canceled)
	})

	s.Run("the run cannot be started", func() {
		printer.Clean()

		s.client.EXPECT().CreateJob(gomock.Any(), &model.Job{Type: model.JobTypeHealthCheck}).Return(nil, &model.Response{}, errors.New("mock error")).Times(1)

		err := healthRunCmdF(s.client, newTestCmd(s.T(), HealthRunCmd), []string{})
		s.Require().EqualError(err, "failed to start a health check run: mock error")
	})
}

func (s *MmctlUnitTestSuite) TestHealthPrintFindings() {
	lastSeen := time.Date(2026, time.September, 24, 14, 2, 0, 0, time.Local)
	evaluated := "Last evaluated: " + lastSeen.Format("2006-01-02 15:04 MST") + " (38 minutes ago)"
	opts := report.Options{GeneratedAt: lastSeen.Add(38 * time.Minute)}

	s.Run("plain output", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.Require().NoError(printHealthFindings(healthTestList(lastSeen), false, opts))

		s.Equal(evaluated+`

Critical
  [Notifications] Push notification server is not HTTPS
      The push server is http://push.example.com, so notifications are sent unencrypted.
      → Set Push Notification Server to an https:// URL.

Could not evaluate
  Site URL is not HTTPS (Warning)
      Config section unavailable.

1 critical, 1 could not be evaluated`, s.printedHealthFindings())
	})

	s.Run("plain output has no code, state or fingerprint", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := healthTestFindings(lastSeen)

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: findings}, true, opts))

		output := s.printedHealthFindings()
		for _, finding := range findings {
			s.NotContains(output, finding.Code)
			s.NotContains(output, finding.Fingerprint)
		}
		for _, state := range []string{"firing", "unknown"} {
			s.NotContains(output, state)
		}
	})

	s.Run("groups findings by severity, sorted by area then title", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := []*model.HealthFinding{
			{Severity: "warning", State: "firing", Area: model.AreaNotifications, Title: "B warning", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "critical", State: "firing", Area: model.AreaNotifications, Title: "Z critical", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "warning", State: "firing", Area: model.AreaNotifications, Title: "A warning", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "warning", State: "firing", Area: model.AreaCluster, Title: "C warning", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "info", State: "firing", Area: model.AreaCluster, Title: "Node info", Scope: "node-1", MutedAt: 1, LastSeenAt: lastSeen.UnixMilli()},
		}

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: findings}, false, opts))

		s.Equal(evaluated+`

Critical
  [Notifications] Z critical

Warning
  [High availability] C warning
  [Notifications] A warning
  [Notifications] B warning

Muted
  Node info on node-1 (Info)

1 critical, 3 warnings`, s.printedHealthFindings())
	})

	s.Run("a muted finding shows its remediation, or that its check could not run", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := []*model.HealthFinding{
			{Severity: "warning", State: "firing", Area: model.AreaCluster, Title: "Firing", Message: "Still a problem.", Remediation: "Fix it.", MutedAt: 1, LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "warning", State: "unknown", Area: model.AreaCluster, Title: "Unknown", Message: "Was a problem.", Remediation: "Fix it.", MutedAt: 1, LastSeenAt: lastSeen.UnixMilli()},
		}

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: findings}, false, opts))

		s.Equal(evaluated+`

Muted
  Firing (Warning)
      Still a problem.
      → Fix it.
  Unknown (Warning, Could not evaluate)
      Was a problem.

No open findings.`, s.printedHealthFindings())
	})

	s.Run("a muted resolved finding is listed as resolved", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := []*model.HealthFinding{
			{Severity: "warning", State: "resolved", Area: model.AreaCluster, Title: "Muted and resolved", MutedAt: 1, LastSeenAt: lastSeen.UnixMilli()},
		}

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: findings}, true, opts))

		s.Equal(evaluated+`

Resolved
  Muted and resolved

No open findings.`, s.printedHealthFindings())
	})

	s.Run("stored findings with nothing firing or unknown", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: healthTestFindings(lastSeen)[2:]}, false, opts))

		s.Equal(evaluated+"\n\nNo open findings.", s.printedHealthFindings())
	})

	s.Run("never evaluated", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, false, opts))

		s.Equal("Last evaluated: Not evaluated yet\n\nThe first health check runs within an hour of enabling the feature.", s.printedHealthFindings())
	})

	s.Run("evaluation time comes from the server, not the shown findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		list := &model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: healthTestFindings(lastSeen.Add(-time.Hour))}

		s.Require().NoError(printHealthFindings(list, false, opts))

		s.True(strings.HasPrefix(s.printedHealthFindings(), evaluated+"\n"))
	})

	s.Run("evaluation older than two hours appears stopped", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.Require().NoError(printHealthFindings(healthTestList(lastSeen), false, report.Options{GeneratedAt: lastSeen.Add(2*time.Hour + time.Minute)}))

		s.True(strings.HasPrefix(s.printedHealthFindings(), "Last evaluated: "+lastSeen.Format("2006-01-02 15:04 MST")+" (121 minutes ago). Evaluation appears to have stopped.\n"))
	})

	s.Run("evaluation two hours old is not reported as stopped", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.Require().NoError(printHealthFindings(healthTestList(lastSeen), false, report.Options{GeneratedAt: lastSeen.Add(2 * time.Hour)}))

		s.NotContains(s.printedHealthFindings(), "Evaluation appears to have stopped")
	})

	s.Run("json output when never evaluated has an empty list", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)

		s.Require().NoError(printHealthFindings(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, false, opts))

		s.Require().Len(printer.GetLines(), 1)
		s.Equal(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, printer.GetLines()[0])
	})
}

const healthTestPacketGeneratedAt = 1790330400000

func healthTestPacketFiles() map[string]string {
	return map[string]string{
		model.PacketMetadataFileName: "version: 1\ntype: support-packet\ngenerated_at: 1790330400000\nserver_version: 11.0.4\n",
		model.SupportPacketDiagnosticsFileName: `version: 2
license:
  users: 500
  sku_short_name: enterprise
  expires_at: 1821866400000
  features:
    metrics: true
    compliance: true
    data_retention: true
    message_export: true
server:
  os: linux
  hostname: mm.example.com
  open_file_descriptors: 120
  max_file_descriptors: 65536
  version: 11.0.4
database:
  type: postgres
  version: "15.8"
  master_connections_in_use: 1
  posts_dead_tuples: 0
  posts_estimated_rows: 1000
  posts_vacuum_in_progress: false
  posts_last_vacuum: 2026-09-25T09:00:00Z
elastic:
  status: disabled
file_store:
  file_status: OK
  file_driver: local
  total_mb: 102400
  available_mb: 51200
notifications:
  email:
    status: OK
`,
		model.SupportPacketStatsFileName:   "registered_users: 100\nactive_users: 100\nsingle_channel_guests: 0\nposts: 1000\n",
		model.SupportPacketJobsFileName:    "data_retention_jobs: []\n",
		model.SupportPacketConfigFileName:  healthTestPacketConfig(),
		model.SupportPacketPluginsFileName: `{"enabled": [], "disabled": []}`,
	}
}

// healthTestPacketConfig starts from defaults so new rules see a realistic config without editing this fixture.
func healthTestPacketConfig() string {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ServiceSettings.SiteURL = model.NewPointer("https://chat.example.com")
	cfg.GuestAccountsSettings.Enable = model.NewPointer(true)
	cfg.EmailSettings.SMTPServer = model.NewPointer("smtp.example.com")
	cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
	cfg.EmailSettings.PushNotificationServer = model.NewPointer("http://push.example.com")
	cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.IdLoadedNotification)
	cfg.SqlSettings.DataSource = model.NewPointer("postgres://****:****@db.example.com:5432/mattermost")
	cfg.RateLimitSettings.Enable = model.NewPointer(true)
	cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(true)
	cfg.MetricsSettings.Enable = model.NewPointer(true)

	b, err := json.Marshal(cfg)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func (s *MmctlUnitTestSuite) writeHealthTestPacket(files map[string]string) string {
	path := filepath.Join(s.T().TempDir(), "packet.zip")
	f, err := os.Create(path)
	s.Require().NoError(err)
	defer f.Close()

	zw := zip.NewWriter(f)
	for name, body := range files {
		w, createErr := zw.Create(name)
		s.Require().NoError(createErr)
		_, err = w.Write([]byte(body))
		s.Require().NoError(err)
	}
	s.Require().NoError(zw.Close())

	return path
}

func (s *MmctlUnitTestSuite) healthPacketTestCommand(path string, includeResolved, includeMuted bool) *cobra.Command {
	cmd := newTestCmd(s.T(), HealthCheckCmd)
	s.Require().NoError(cmd.Flags().Set("packet", path))
	s.Require().NoError(cmd.Flags().Set("include-resolved", strconv.FormatBool(includeResolved)))
	s.Require().NoError(cmd.Flags().Set("include-muted", strconv.FormatBool(includeMuted)))
	return cmd
}

func healthTestRelease(tag string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprintf(w, `{"id": 1, "tag_name": %q}`, tag)
	}
}

// serveLatestRelease points the --packet latest release fetch at handler until the test ends,
// and counts the requests that reach it.
func serveLatestRelease(t testing.TB, handler http.HandlerFunc) *atomic.Int32 {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		handler(w, r)
	}))
	originalURL := healthLatestVersionURL
	healthLatestVersionURL = server.URL
	t.Cleanup(func() {
		healthLatestVersionURL = originalURL
		server.Close()
	})
	return &requests
}

// healthTestBehindVersions returns a supported regular release and a latest release two minors
// past the newest line in the table, so VERSION_BEHIND fires whatever today's date.
func (s *MmctlUnitTestSuite) healthTestBehindVersions() (running, latest string) {
	table := model.ReleaseLifecycles()
	i := slices.IndexFunc(table, func(l model.ReleaseLifecycle) bool { return !l.ESR && time.Now().Before(l.EOLDate) })
	s.Require().NotEqual(-1, i, "model.ReleaseLifecycles has no supported regular release")
	major, minor, _ := model.SplitVersion(table[0].MajorMinor)
	return table[i].MajorMinor + ".0", fmt.Sprintf("%d.%d.0", major, minor+2)
}

func (s *MmctlUnitTestSuite) runHealthPacketJSON(packetPath string) []*model.HealthFinding {
	printer.Clean()
	printer.SetFormat(printer.FormatJSON)
	cmd := newTestCmd(s.T(), HealthCheckCmd)
	cmd.SetContext(context.Background())
	s.Require().NoError(cmd.Flags().Set("packet", packetPath))
	s.Require().NoError(healthCheckRunE(cmd, []string{}))
	s.Require().Len(printer.GetLines(), 1)
	list, ok := printer.GetLines()[0].(*model.HealthFindingList)
	s.Require().True(ok)
	return list.Findings
}

func healthTestFinding(findings []*model.HealthFinding, code string) *model.HealthFinding {
	if i := slices.IndexFunc(findings, func(f *model.HealthFinding) bool { return f.Code == code }); i >= 0 {
		return findings[i]
	}
	return nil
}

func (s *MmctlUnitTestSuite) TestHealthCheckPacket() {
	serveLatestRelease(s.T(), healthTestRelease("v12.4.0"))
	packetPath := s.writeHealthTestPacket(healthTestPacketFiles())
	evaluatedAt := time.UnixMilli(healthTestPacketGeneratedAt).Format("2006-01-02 15:04 MST")
	packetWithFilestoreDisk := func(totalMB, availableMB uint64) string {
		files := healthTestPacketFiles()
		files[model.SupportPacketDiagnosticsFileName] = strings.Replace(
			files[model.SupportPacketDiagnosticsFileName],
			"  total_mb: 102400\n  available_mb: 51200\n",
			"  total_mb: "+strconv.FormatUint(totalMB, 10)+"\n  available_mb: "+strconv.FormatUint(availableMB, 10)+"\n",
			1,
		)
		return s.writeHealthTestPacket(files)
	}

	s.Run("runs with no server configured", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		viper.Set("config", filepath.Join(s.T().TempDir(), "missing-config"))
		viper.Set("local-socket-path", filepath.Join(s.T().TempDir(), "missing.socket"))
		s.T().Cleanup(func() {
			viper.Set("config", "")
			viper.Set("local-socket-path", model.LocalModeSocketPath)
		})

		err := healthCheckRunE(healthTestCommand(false, false), []string{})
		s.Require().ErrorContains(err, "failed to create client")

		err = healthCheckRunE(s.healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)
		s.Contains(s.printedHealthFindings(), "PushNotificationServer does not use https://")
	})

	s.Run("plain output opens with the disclaimer and uses the packet's time", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)

		s.Equal(healthPacketDisclaimer+`

Data collected: `+evaluatedAt+`

Critical
  [Notifications] PushNotificationServer does not use https://
      PushNotificationServer http://push.example.com uses http://, so push notifications are sent in cleartext.
      → Prefix PushNotificationServer with https:// and verify reachability from the app node.
  [Updates] Mattermost version is past end-of-life
      Running Mattermost 11.0.4. Support for this release line ended on 2026-01-15. No security patches ship for this release line. Upgrade to the latest release.
      → Plan a staged upgrade to a supported Extended Support Release or the latest release. Supported versions are listed at https://docs.mattermost.com/product-overview/mattermost-server-releases.html.

Could not evaluate
  GOMAXPROCS exceeds the container CPU limit on mm.example.com (Warning)
      Server diagnostics unavailable.
  Host memory is running low on mm.example.com (Warning)
      Server diagnostics unavailable.
  Host load is high on mm.example.com (Info)
      Server diagnostics unavailable.

2 critical, 3 could not be evaluated`, s.printedHealthFindings())
	})

	s.Run("plain output localizes a full filestore disk finding", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(packetWithFilestoreDisk(102400, 4096), false, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.Contains(output, "\n  [Platform] File storage disk is nearly full on mm.example.com\n")
		s.Contains(output, "\n\n3 critical, ")
		s.Contains(output, "The volume containing FileSettings.Directory has 4.0 GiB (4.00%) available of 100.0 GiB. File uploads and other file operations can fail when the volume fills.")
		s.Contains(output, "Immediately expand the volume or remove unrelated data from its filesystem; do not manually delete files managed by Mattermost from FileSettings.Directory. Keep at least 10% or 10 GiB available, and never less than 1 GiB.")
	})

	s.Run("plain output localizes a low filestore disk finding", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(packetWithFilestoreDisk(102400, 9216), false, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.Contains(output, "Warning\n  [Platform] File storage disk space is low on mm.example.com")
		s.Contains(output, "The volume containing FileSettings.Directory has 9.0 GiB (9.00%) available of 100.0 GiB.")
		s.Contains(output, "Expand the volume or remove unrelated data from its filesystem; do not manually delete files managed by Mattermost from FileSettings.Directory. Keep at least 10% or 10 GiB available, and never less than 1 GiB.")
	})

	s.Run("an old packet is not reported as stopped evaluation", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)
		s.NotContains(s.printedHealthFindings(), "Evaluation appears to have stopped")
	})

	s.Run("--include-resolved finds nothing resolved in a single evaluation", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(packetPath, true, false), []string{})
		s.Require().NoError(err)
		output := s.printedHealthFindings()
		s.Contains(output, "PushNotificationServer does not use https://")
		s.NotContains(output, "\nResolved\n")
	})

	s.Run("--include-muted is rejected", func() {
		printer.Clean()

		err := healthCheckRunE(s.healthPacketTestCommand(packetPath, false, true), []string{})
		s.Require().ErrorContains(err, "--include-muted cannot be used with --packet")
		s.Empty(printer.GetLines())
	})

	s.Run("--json prints findings and sends the notes to stderr", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)

		s.Require().Len(printer.GetLines(), 1)
		list, ok := printer.GetLines()[0].(*model.HealthFindingList)
		s.Require().True(ok)
		s.Equal(int64(healthTestPacketGeneratedAt), list.EvaluatedAt)
		findings := list.Findings
		s.Require().Len(findings, 5)
		codes := make([]string, 0, len(findings))
		for _, finding := range findings {
			codes = append(codes, finding.Code)
		}
		s.ElementsMatch([]string{
			"VERSION_EOL",
			"PUSH_BAD_SCHEME",
			"NODE_HOST_MEMORY_LOW",
			"NODE_GOMAXPROCS_ABOVE_CPU_LIMIT",
			"NODE_HOST_LOAD_HIGH",
		}, codes)

		pushIndex := slices.IndexFunc(findings, func(finding *model.HealthFinding) bool { return finding.Code == "PUSH_BAD_SCHEME" })
		s.Require().NotEqual(-1, pushIndex)
		s.Equal("PushNotificationServer does not use https://", findings[pushIndex].Title)
		s.Equal(time.UnixMilli(healthTestPacketGeneratedAt).UnixMilli(), findings[pushIndex].FirstSeenAt)
		s.Equal([]string{healthPacketDisclaimer}, printer.GetErrorLines())
	})

	running, latest := s.healthTestBehindVersions()
	supportedFiles := healthTestPacketFiles()
	supportedFiles[model.PacketMetadataFileName] = strings.Replace(supportedFiles[model.PacketMetadataFileName], "server_version: 11.0.4", "server_version: "+running, 1)
	supportedPacket := s.writeHealthTestPacket(supportedFiles)

	s.Run("fetches the latest release the packet doesn't record", func() {
		requests := serveLatestRelease(s.T(), healthTestRelease("v"+latest))

		findings := s.runHealthPacketJSON(supportedPacket)

		s.Equal(int32(1), requests.Load())
		s.Equal([]string{healthPacketDisclaimer}, printer.GetErrorLines())
		behind := healthTestFinding(findings, "VERSION_BEHIND")
		s.Require().NotNil(behind)
		s.Equal("firing", behind.State)
		s.Equal("Running "+running+". Latest is "+latest+", two or more releases newer.", behind.Message)
	})

	requireVersionBehindUnknown := func(findings []*model.HealthFinding) {
		for _, code := range []string{"VERSION_BEHIND", "VERSION_BEHIND_ONE"} {
			finding := healthTestFinding(findings, code)
			s.Require().NotNil(finding, code)
			s.Equal("unknown", finding.State, code)
			s.Equal("Latest release unknown: it could not be fetched, or the packet does not record it.", finding.Message, code)
		}
	}

	s.Run("a failed fetch leaves version-behind findings unknown", func() {
		serveLatestRelease(s.T(), func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
		})

		findings := s.runHealthPacketJSON(supportedPacket)

		s.Equal([]string{healthPacketDisclaimer, "Could not fetch the latest release (unexpected status code 502): version-behind findings are unknown."}, printer.GetErrorLines())
		requireVersionBehindUnknown(findings)
	})

	s.Run("a timed out fetch leaves version-behind findings unknown", func() {
		serveLatestRelease(s.T(), func(_ http.ResponseWriter, r *http.Request) {
			select {
			case <-r.Context().Done():
			case <-time.After(5 * time.Second):
			}
		})
		originalTimeout := healthLatestVersionTimeout
		healthLatestVersionTimeout = 50 * time.Millisecond
		s.T().Cleanup(func() { healthLatestVersionTimeout = originalTimeout })

		findings := s.runHealthPacketJSON(supportedPacket)

		s.Require().Len(printer.GetErrorLines(), 2)
		s.True(strings.HasPrefix(printer.GetErrorLines()[1], "Could not fetch the latest release ("))
		s.Contains(printer.GetErrorLines()[1], "context deadline exceeded")
		requireVersionBehindUnknown(findings)
	})

	s.Run("an interrupted command stops the fetch", func() {
		requests := serveLatestRelease(s.T(), healthTestRelease("v"+latest))
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		cmd := s.healthPacketTestCommand(supportedPacket, false, false)
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		cmd.SetContext(ctx)

		s.Require().NoError(healthCheckPacketCmdF(cmd, []string{}))

		s.Zero(requests.Load())
		s.Require().Len(printer.GetErrorLines(), 2)
		s.Contains(printer.GetErrorLines()[1], "context canceled")
	})

	s.Run("a latest release the snapshot already records is not fetched", func() {
		requests := serveLatestRelease(s.T(), healthTestRelease("v99.0.0"))
		snapshot := &healthcheck.Snapshot{}
		snapshot.Version.Latest = "12.1.0"

		s.Empty(fillLatestVersion(context.Background(), snapshot))
		s.Equal("12.1.0", snapshot.Version.Latest)
		s.Zero(requests.Load())
	})

	s.Run("renders a Posts dead tuples finding after a stale vacuum", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		files := healthTestPacketFiles()
		files[model.SupportPacketDiagnosticsFileName] = strings.Replace(
			files[model.SupportPacketDiagnosticsFileName],
			"  posts_dead_tuples: 0\n",
			"  posts_dead_tuples: 200001\n",
			1,
		)
		files[model.SupportPacketDiagnosticsFileName] = strings.Replace(
			files[model.SupportPacketDiagnosticsFileName],
			"  posts_last_vacuum: 2026-09-25T09:00:00Z\n",
			"  posts_last_vacuum: 2026-09-10T10:00:00Z\n",
			1,
		)
		files[model.SupportPacketDiagnosticsFileName] = strings.Replace(
			files[model.SupportPacketDiagnosticsFileName],
			"  posts_estimated_rows: 1000\n",
			"  posts_estimated_rows: 500000\n",
			1,
		)

		cmd := newTestCmd(s.T(), HealthCheckCmd)
		cmd.SetContext(context.Background())
		s.Require().NoError(cmd.Flags().Set("packet", s.writeHealthTestPacket(files)))
		s.Require().NoError(healthCheckRunE(cmd, []string{}))
		s.Require().Len(printer.GetLines(), 1)
		list, ok := printer.GetLines()[0].(*model.HealthFindingList)
		s.Require().True(ok)

		index := slices.IndexFunc(list.Findings, func(f *model.HealthFinding) bool {
			return f.Code == "DB_POSTS_DEAD_TUPLES"
		})
		s.Require().NotEqual(-1, index)
		finding := list.Findings[index]
		s.Equal("Posts table has many dead tuples", finding.Title)
		s.Equal("The Posts table has 200001 estimated dead tuples (40.0% of an estimated 500000 rows), and its most recent vacuum was 15 days ago at 2026-09-10T10:00:00Z. Autovacuum does not appear to be keeping up with this table. Table and index bloat can degrade query performance and increase disk use.", finding.Message)
		s.Contains(finding.Remediation, "verify autovacuum is enabled")
	})

	s.Run("renders a Posts dead tuples finding after a recent vacuum", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		files := healthTestPacketFiles()
		files[model.SupportPacketDiagnosticsFileName] = strings.Replace(
			files[model.SupportPacketDiagnosticsFileName],
			"  posts_dead_tuples: 0\n",
			"  posts_dead_tuples: 200001\n",
			1,
		)
		files[model.SupportPacketDiagnosticsFileName] = strings.Replace(
			files[model.SupportPacketDiagnosticsFileName],
			"  posts_estimated_rows: 1000\n",
			"  posts_estimated_rows: 500000\n",
			1,
		)

		cmd := newTestCmd(s.T(), HealthCheckCmd)
		cmd.SetContext(context.Background())
		s.Require().NoError(cmd.Flags().Set("packet", s.writeHealthTestPacket(files)))
		s.Require().NoError(healthCheckRunE(cmd, []string{}))
		s.Require().Len(printer.GetLines(), 1)
		list, ok := printer.GetLines()[0].(*model.HealthFindingList)
		s.Require().True(ok)

		index := slices.IndexFunc(list.Findings, func(f *model.HealthFinding) bool {
			return f.Code == "DB_POSTS_DEAD_TUPLES"
		})
		s.Require().NotEqual(-1, index)
		finding := list.Findings[index]
		s.Equal("The Posts table has 200001 estimated dead tuples (40.0% of an estimated 500000 rows), even though it was last vacuumed at 2026-09-25T09:00:00Z. Vacuum is running but most likely cannot remove them because something is holding back cleanup, such as a long-running or idle-in-transaction session, an inactive replication slot, or an abandoned prepared transaction. Table and index bloat can degrade query performance and increase disk use.", finding.Message)
		s.Contains(finding.Remediation, "pg_replication_slots")
	})

	s.Run("audit logging is judged by the server that generated the packet, not this machine", func() {
		var cfg model.Config
		s.Require().NoError(json.Unmarshal([]byte(healthTestPacketConfig()), &cfg))
		cfg.ExperimentalAuditSettings.FileEnabled = model.NewPointer(false)
		noAuditTargets, err := json.Marshal(cfg)
		s.Require().NoError(err)

		reportsAuditLogOff := func(serverAuditActive bool) bool {
			files := healthTestPacketFiles()
			files[model.SupportPacketDiagnosticsFileName] += "config:\n  audit_logging_configured: " + strconv.FormatBool(serverAuditActive) + "\n"
			files[model.SupportPacketStatsFileName] = "registered_users: 6000\n"
			files[model.SupportPacketConfigFileName] = string(noAuditTargets)

			printer.Clean()
			printer.SetFormat(printer.FormatJSON)
			cmd := newTestCmd(s.T(), HealthCheckCmd)
			cmd.SetContext(context.Background())
			s.Require().NoError(cmd.Flags().Set("packet", s.writeHealthTestPacket(files)))
			s.Require().NoError(healthCheckRunE(cmd, []string{}))
			s.Require().Len(printer.GetLines(), 1)
			list, ok := printer.GetLines()[0].(*model.HealthFindingList)
			s.Require().True(ok)
			return slices.ContainsFunc(list.Findings, func(f *model.HealthFinding) bool { return f.Code == "AUDIT_LOG_OFF" })
		}

		s.True(reportsAuditLogOff(false))
		s.False(reportsAuditLogOff(true), "the server audits through targets its config doesn't show")

		s.T().Setenv("MM_EXPERIMENTALAUDITSETTINGS_ADDITIONAL", `{"audit": {"type": "file", "format": "json", "levels": [{"id": 100, "name": "audit-api"}], "options": {"filename": "audit.log"}}}`)
		s.True(reportsAuditLogOff(false), "audit targets on the evaluating machine say nothing about the server")
	})

	s.Run("packet warnings follow the disclaimer and contain no em dash", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		files := healthTestPacketFiles()
		delete(files, model.PacketMetadataFileName)
		files[model.SupportPacketDiagnosticsFileName] = "version: 99\n"

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(s.writeHealthTestPacket(files), true, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.True(strings.HasPrefix(output, healthPacketDisclaimer+"\n\n"))
		s.Contains(output, "newer server")
		s.Contains(output, "no metadata.yaml")
		s.Contains(output, "\nData collected: Unknown\n", "without metadata the collection time is unknown, not now")
		s.NotContains(output, "—")
	})

	s.Run("an unreadable packet is an error", func() {
		printer.Clean()

		err := healthCheckPacketCmdF(s.healthPacketTestCommand(filepath.Join(s.T().TempDir(), "missing.zip"), false, false), []string{})
		s.Require().ErrorContains(err, "failed to read Support Packet")
		s.Empty(printer.GetLines())
	})
}

func (s *MmctlUnitTestSuite) healthTestCommand(command *cobra.Command, flags ...string) *cobra.Command {
	cmd := newTestCmd(s.T(), command)
	cmd.SetContext(context.Background())
	for i := 0; i < len(flags); i += 2 {
		s.Require().NoError(cmd.Flags().Set(flags[i], flags[i+1]))
	}
	return cmd
}

func (s *MmctlUnitTestSuite) TestHealthExport() {
	serveLatestRelease(s.T(), healthTestRelease("v12.4.0"))
	lastSeen := time.Now().Add(-5 * time.Minute)
	exportList := func() *model.HealthFindingList {
		list := healthTestList(lastSeen)
		list.Findings = append(list.Findings, &model.HealthFinding{Severity: "warning", State: "firing", Area: model.AreaPlatform, Title: "Muted finding", MutedAt: 1, LastSeenAt: lastSeen.UnixMilli()})
		return list
	}
	expectFindings := func() {
		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{Muted: model.MutedIncluded}).
			Return(exportList(), &model.Response{}, nil).
			Times(1)
	}
	expectSite := func() {
		s.client.
			EXPECT().
			GetClientConfig(context.TODO(), "").
			Return(map[string]string{"SiteURL": "https://chat.example.com", "Version": "12.2.0"}, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetOldClientLicense(context.TODO(), "").
			Return(map[string]string{"IsLicensed": "true", "SkuShortName": "advanced", "IsGovSku": "true", "Company": "Acme Corp"}, &model.Response{}, nil).
			Times(1)
	}

	for _, tc := range []struct {
		format string
		want   []string
	}{
		{"html", []string{"<!DOCTYPE html>", "<title>mm_site_health_Acme_Corp_", "<dt>Site URL</dt>", "<dt>Licensed to</dt>"}},
		{"md", []string{"# Health report\n", "- **Site URL:** https://chat.example.com\n", "- **License:** Enterprise Advanced Gov\n", "- **Licensed to:** Acme Corp\n"}},
	} {
		s.Run("online "+tc.format+" export includes resolved and muted findings", func() {
			printer.Clean()
			printer.SetFormat(printer.FormatPlain)
			expectFindings()
			expectSite()

			err := healthExportCmdF(s.client, s.healthTestCommand(HealthExportCmd), []string{tc.format})
			s.Require().NoError(err)

			output := s.printedHealthFindings()
			for _, want := range append(tc.want, "https://chat.example.com", "12.2.0", "Enterprise Advanced Gov", "Acme Corp",
				"Push notification server is not HTTPS", "Site URL is not HTTPS", "Site URL is empty", "Muted finding") {
				s.Contains(output, want)
			}
		})
	}

	s.Run("online export to a file", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		path := filepath.Join(s.T().TempDir(), "report.md")
		expectFindings()
		expectSite()

		err := healthExportCmdF(s.client, s.healthTestCommand(HealthExportCmd, "output", path), []string{"md"})
		s.Require().NoError(err)

		s.Equal([]any{"Wrote the health report to " + path}, printer.GetLines())
		b, err := os.ReadFile(path)
		s.Require().NoError(err)
		s.Contains(string(b), "- **Licensed to:** Acme Corp\n")
		s.Contains(string(b), "Push notification server is not HTTPS")
	})

	s.Run("online export leaves out site facts mmctl can't read", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		expectFindings()
		s.client.
			EXPECT().
			GetClientConfig(context.TODO(), "").
			Return(nil, &model.Response{}, errors.New("forbidden")).
			Times(1)
		s.client.
			EXPECT().
			GetOldClientLicense(context.TODO(), "").
			Return(map[string]string{"IsLicensed": "false"}, &model.Response{}, nil).
			Times(1)

		err := healthExportCmdF(s.client, s.healthTestCommand(HealthExportCmd), []string{"md"})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.Contains(output, "Push notification server is not HTTPS")
		for _, label := range []string{"Site URL", "Server version", "License", "Licensed to"} {
			s.NotContains(output, "**"+label+":**")
		}
	})

	s.Run("unwritable output file is an error", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		path := filepath.Join(s.T().TempDir(), "missing", "report.html")
		expectFindings()
		expectSite()

		err := healthExportCmdF(s.client, s.healthTestCommand(HealthExportCmd, "output", path), []string{"html"})
		s.Require().ErrorContains(err, "failed to write the health report")
		s.Empty(printer.GetLines())
	})

	packetFiles := healthTestPacketFiles()
	var cfg model.Config
	s.Require().NoError(json.Unmarshal([]byte(packetFiles[model.SupportPacketConfigFileName]), &cfg))
	cfg.LogSettings.FileLevel = model.NewPointer("DEBUG")
	cfgJSON, err := json.Marshal(cfg)
	s.Require().NoError(err)
	packetFiles[model.SupportPacketConfigFileName] = string(cfgJSON)
	packetFiles[model.SupportPacketDiagnosticsFileName] = strings.Replace(packetFiles[model.SupportPacketDiagnosticsFileName], "license:\n", "license:\n  company: Acme Corp\n  is_gov_sku: true\n", 1)
	packetPath := s.writeHealthTestPacket(packetFiles)
	internalTitle := "File logging at debug or trace level"

	s.Run("health check of the packet includes internal findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		s.Require().NoError(healthCheckRunE(s.healthTestCommand(HealthCheckCmd, "packet", packetPath), []string{}))
		s.Contains(s.printedHealthFindings(), internalTitle)
	})

	for _, tc := range []struct {
		format string
		want   []string
	}{
		{"html", []string{"<!DOCTYPE html>", "<title>mm_site_health_Acme_Corp_", "<dt>Site URL</dt>"}},
		{"md", []string{
			"# Health report\n", "> " + healthPacketDisclaimer + "\n",
			"- **Data collected:** " + time.UnixMilli(healthTestPacketGeneratedAt).Format("2006-01-02 15:04 MST") + "\n",
			"- **Site URL:** https://chat.example.com\n", "- **Server version:** 11.0.4\n", "- **License:** Enterprise Gov\n", "- **Licensed to:** Acme Corp\n",
		}},
	} {
		s.Run("packet "+tc.format+" export leaves out internal findings", func() {
			printer.Clean()
			printer.SetFormat(printer.FormatPlain)

			s.Require().NoError(healthExportRunE(s.healthTestCommand(HealthExportCmd, "packet", packetPath), []string{tc.format}))

			output := s.printedHealthFindings()
			for _, want := range append(tc.want, "https://chat.example.com", "11.0.4", "Enterprise Gov", "Acme Corp",
				"Evaluated locally from a Support Packet", "PushNotificationServer does not use https://") {
				s.Contains(output, want)
			}
			s.NotContains(output, internalTitle)
			s.NotContains(output, "Muted")
		})
	}

	s.Run("packet export with no collection time says it is unknown", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		files := healthTestPacketFiles()
		delete(files, model.PacketMetadataFileName)

		s.Require().NoError(healthExportRunE(s.healthTestCommand(HealthExportCmd, "packet", s.writeHealthTestPacket(files)), []string{"md"}))
		s.Contains(s.printedHealthFindings(), "- **Data collected:** Unknown\n")
	})
}

func (s *MmctlUnitTestSuite) TestHealthExportRejectedInput() {
	s.Run("--json", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)

		err := healthExportRunE(s.healthTestCommand(HealthExportCmd), []string{"html"})
		s.Require().EqualError(err, "--json cannot be used with health export")
		s.Empty(printer.GetLines())
	})

	for _, args := range [][]string{{}, {"pdf"}, {"html", "md"}} {
		s.Run(fmt.Sprintf("args %q", args), func() {
			s.Require().Error(HealthExportCmd.Args(HealthExportCmd, args))
		})
	}
}
