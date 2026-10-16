// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/zip"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
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
		s.True(strings.HasPrefix(output, "Last evaluated "), output)
		s.True(strings.HasSuffix(output, "\n\nNo findings."), output)
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

func (s *MmctlUnitTestSuite) TestHealthPrintFindings() {
	lastSeen := time.Date(2026, time.September, 24, 14, 2, 0, 0, time.Local)
	now := lastSeen.Add(38 * time.Minute)

	s.Run("plain output", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(healthTestList(lastSeen), false, now)

		s.Equal(`Last evaluated 2026-09-24 14:02 (38 minutes ago)

Notifications
  CRITICAL  Push notification server is not HTTPS
            The push server is http://push.example.com, so notifications are sent unencrypted.
            → Set Push Notification Server to an https:// URL.

Could not evaluate
  WARNING   Site URL is not HTTPS
            Config section unavailable.

1 critical, 1 could not be evaluated`, s.printedHealthFindings())
	})

	s.Run("plain output has no code, state or fingerprint", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := healthTestFindings(lastSeen)

		printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: findings}, true, now)

		output := s.printedHealthFindings()
		for _, finding := range findings {
			s.NotContains(output, finding.Code)
			s.NotContains(output, finding.Fingerprint)
		}
		for _, state := range []string{"firing", "unknown", "resolved"} {
			s.NotContains(output, state)
		}
	})

	s.Run("groups firing findings by area, sorted by severity then title", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := []*model.HealthFinding{
			{Severity: "warning", State: "firing", Area: model.AreaNotifications, Title: "B warning", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "critical", State: "firing", Area: model.AreaNotifications, Title: "Z critical", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "warning", State: "firing", Area: model.AreaNotifications, Title: "A warning", LastSeenAt: lastSeen.UnixMilli()},
			{Severity: "info", State: "firing", Area: model.AreaCluster, Title: "Node info", Scope: "node-1", MutedAt: 1, LastSeenAt: lastSeen.UnixMilli()},
		}

		printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: findings}, false, now)

		s.Equal(`Last evaluated 2026-09-24 14:02 (38 minutes ago)

Cluster
  INFO      Node info on node-1 [muted]

Notifications
  CRITICAL  Z critical
  WARNING   A warning
  WARNING   B warning

1 critical, 2 warnings, 1 info`, s.printedHealthFindings())
	})

	s.Run("stored findings with nothing firing or unknown", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(&model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: healthTestFindings(lastSeen)[2:]}, false, now)

		s.Equal("Last evaluated 2026-09-24 14:02 (38 minutes ago)\n\nNo findings.", s.printedHealthFindings())
	})

	s.Run("never evaluated", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, false, now)

		s.Equal("Not evaluated yet. The first check runs within an hour of enabling the feature.", s.printedHealthFindings())
	})

	s.Run("evaluation time comes from the server, not the shown findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		list := &model.HealthFindingList{EvaluatedAt: lastSeen.UnixMilli(), Findings: healthTestFindings(lastSeen.Add(-time.Hour))}

		printHealthFindings(list, false, now)

		s.Contains(s.printedHealthFindings(), "Last evaluated 2026-09-24 14:02 (38 minutes ago)\n")
	})

	s.Run("evaluation older than two hours appears stopped", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(healthTestList(lastSeen), false, lastSeen.Add(2*time.Hour+time.Minute))

		s.Contains(s.printedHealthFindings(), "Last evaluated 2026-09-24 14:02 (121 minutes ago). Evaluation appears to have stopped.\n")
	})

	s.Run("evaluation two hours old is not reported as stopped", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(healthTestList(lastSeen), false, lastSeen.Add(2*time.Hour))

		s.NotContains(s.printedHealthFindings(), "Evaluation appears to have stopped")
	})

	s.Run("json output when never evaluated has an empty list", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)

		printHealthFindings(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, false, now)

		s.Require().Len(printer.GetLines(), 1)
		s.Equal(&model.HealthFindingList{Findings: []*model.HealthFinding{}}, printer.GetLines()[0])
	})
}

const healthTestPacketGeneratedAt = 1790330400000

func healthTestPacketFiles() map[string]string {
	return map[string]string{
		model.PacketMetadataFileName:           "version: 1\ntype: support-packet\ngenerated_at: 1790330400000\nserver_version: 11.0.4\n",
		model.SupportPacketDiagnosticsFileName: "version: 2\nserver:\n  os: linux\n  hostname: mm.example.com\n  open_file_descriptors: 120\n  max_file_descriptors: 65536\n  version: 11.0.4\nfile_store:\n  file_status: OK\n",
		model.SupportPacketConfigFileName: `{
    "ServiceSettings": {"SiteURL": "https://chat.example.com", "ListenAddress": ":8065"},
    "LogSettings": {"EnableFile": true, "FileLevel": "INFO"},
    "FileSettings": {"DriverName": "local", "Directory": "./data/"},
    "EmailSettings": {"SendPushNotifications": true, "PushNotificationServer": "http://push.example.com"},
    "ClusterSettings": {"Enable": false},
    "MetricsSettings": {"Enable": true},
    "PluginSettings": {"Enable": true, "EnableHealthCheck": true}
}`,
		model.SupportPacketPluginsFileName: `{"enabled": [], "disabled": []}`,
	}
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

func healthPacketTestCommand(path string, includeResolved, includeMuted bool) *cobra.Command {
	cmd := healthTestCommand(includeResolved, includeMuted)
	cmd.Flags().String("packet", path, "")
	return cmd
}

func (s *MmctlUnitTestSuite) TestHealthCheckPacket() {
	packetPath := s.writeHealthTestPacket(healthTestPacketFiles())
	evaluatedAt := time.UnixMilli(healthTestPacketGeneratedAt).Format("2006-01-02 15:04")

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

		err = healthCheckRunE(healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)
		s.Contains(s.printedHealthFindings(), "PushNotificationServer does not use https://")
	})

	s.Run("plain output opens with the disclaimer and uses the packet's time", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)

		s.Equal(healthPacketDisclaimer+`

Last evaluated `+evaluatedAt+` (0 minutes ago)

Notifications
  CRITICAL  PushNotificationServer does not use https://
            PushNotificationServer http://push.example.com uses http://, so push notifications are sent in cleartext.
            → Prefix PushNotificationServer with https:// and verify reachability from the app node.

1 critical`, s.printedHealthFindings())
	})

	s.Run("an old packet is not reported as stopped evaluation", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)
		s.NotContains(s.printedHealthFindings(), "Evaluation appears to have stopped")
	})

	s.Run("--include-resolved finds nothing resolved in a single evaluation", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		err := healthCheckPacketCmdF(healthPacketTestCommand(packetPath, true, false), []string{})
		s.Require().NoError(err)
		output := s.printedHealthFindings()
		s.Contains(output, "PushNotificationServer does not use https://")
		s.NotContains(output, "\nResolved\n")
	})

	s.Run("--include-muted is rejected", func() {
		printer.Clean()

		err := healthCheckRunE(healthPacketTestCommand(packetPath, false, true), []string{})
		s.Require().ErrorContains(err, "--include-muted cannot be used with --packet")
		s.Empty(printer.GetLines())
	})

	s.Run("--json prints findings and sends the notes to stderr", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)

		err := healthCheckPacketCmdF(healthPacketTestCommand(packetPath, false, false), []string{})
		s.Require().NoError(err)

		s.Require().Len(printer.GetLines(), 1)
		list, ok := printer.GetLines()[0].(*model.HealthFindingList)
		s.Require().True(ok)
		s.Equal(int64(healthTestPacketGeneratedAt), list.EvaluatedAt)
		findings := list.Findings
		s.Require().Len(findings, 1)
		s.Equal("PUSH_BAD_SCHEME", findings[0].Code)
		s.Equal("PushNotificationServer does not use https://", findings[0].Title)
		s.Equal(time.UnixMilli(healthTestPacketGeneratedAt).UnixMilli(), findings[0].FirstSeenAt)
		s.Equal([]string{healthPacketDisclaimer}, printer.GetErrorLines())
	})

	s.Run("packet warnings follow the disclaimer and contain no em dash", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		files := healthTestPacketFiles()
		delete(files, model.PacketMetadataFileName)
		files[model.SupportPacketDiagnosticsFileName] = "version: 99\n"

		err := healthCheckPacketCmdF(healthPacketTestCommand(s.writeHealthTestPacket(files), true, false), []string{})
		s.Require().NoError(err)

		output := s.printedHealthFindings()
		s.True(strings.HasPrefix(output, healthPacketDisclaimer+"\n\n"))
		s.Contains(output, "newer server")
		s.Contains(output, "no metadata.yaml")
		s.NotContains(output, "—")
	})

	s.Run("an unreadable packet is an error", func() {
		printer.Clean()

		err := healthCheckPacketCmdF(healthPacketTestCommand(filepath.Join(s.T().TempDir(), "missing.zip"), false, false), []string{})
		s.Require().ErrorContains(err, "failed to read Support Packet")
		s.Empty(printer.GetLines())
	})
}
