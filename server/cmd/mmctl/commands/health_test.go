// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"time"

	"github.com/spf13/cobra"

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
			Return(healthTestFindings(lastSeen), &model.Response{}, nil).
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
			Return(healthTestFindings(lastSeen), &model.Response{}, nil).
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
			Return([]*model.HealthFinding{}, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, true), []string{})
		s.Require().NoError(err)
	})

	s.Run("--json prints the same rows as the table", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		findings := healthTestFindings(lastSeen)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(findings, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(false, false), []string{})
		s.Require().NoError(err)

		s.Require().Len(printer.GetLines(), 1)
		s.Equal([]*model.HealthFinding{findings[0], findings[1]}, printer.GetLines()[0])
	})

	s.Run("--json with --include-resolved prints every row", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		findings := healthTestFindings(lastSeen)

		s.client.
			EXPECT().
			GetHealthFindings(context.TODO(), model.HealthFindingFilter{}).
			Return(findings, &model.Response{}, nil).
			Times(1)

		err := healthCheckCmdF(s.client, healthTestCommand(true, false), []string{})
		s.Require().NoError(err)

		s.Require().Len(printer.GetLines(), 1)
		s.Equal(findings, printer.GetLines()[0])
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

		printHealthFindings(healthTestFindings(lastSeen), false, now)

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

		printHealthFindings(findings, true, now)

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

		printHealthFindings(findings, false, now)

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

		printHealthFindings(healthTestFindings(lastSeen)[2:], false, now)

		s.Equal("Last evaluated 2026-09-24 14:02 (38 minutes ago)\n\nNo findings.", s.printedHealthFindings())
	})

	s.Run("no stored findings", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings([]*model.HealthFinding{}, false, now)

		s.Equal("Not evaluated yet. The first check runs within an hour of enabling the feature.", s.printedHealthFindings())
	})

	s.Run("evaluation time comes from the newest finding, including hidden resolved ones", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		findings := healthTestFindings(lastSeen.Add(-time.Hour))
		findings[2].LastSeenAt = lastSeen.UnixMilli()

		printHealthFindings(findings, false, now)

		output := s.printedHealthFindings()
		s.Contains(output, "Last evaluated 2026-09-24 14:02 (38 minutes ago)\n")
		s.NotContains(output, "Site URL is empty")
	})

	s.Run("evaluation older than two hours appears stopped", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(healthTestFindings(lastSeen), false, lastSeen.Add(2*time.Hour+time.Minute))

		s.Contains(s.printedHealthFindings(), "Last evaluated 2026-09-24 14:02 (121 minutes ago). Evaluation appears to have stopped.\n")
	})

	s.Run("evaluation two hours old is not reported as stopped", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)

		printHealthFindings(healthTestFindings(lastSeen), false, lastSeen.Add(2*time.Hour))

		s.NotContains(s.printedHealthFindings(), "Evaluation appears to have stopped")
	})

	s.Run("json output with no stored findings is an empty list", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)

		printHealthFindings([]*model.HealthFinding{}, false, now)

		s.Require().Len(printer.GetLines(), 1)
		s.Equal([]*model.HealthFinding{}, printer.GetLines()[0])
	})
}
