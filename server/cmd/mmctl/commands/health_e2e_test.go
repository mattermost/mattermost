// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"cmp"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strconv"
	"sync/atomic"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/healthchecktest"
)

// mmctl health check --packet on a server's Support Packet prints the findings mmctl health check
// prints for that server, with mmctl's own latest-release fetch, rendering and resolved filtering.
func (s *MmctlE2ETestSuite) TestHealthCheckPacketMatchesLiveFindings() {
	// The server and mmctl look up the latest release here instead of on GitHub.
	var latestRequests atomic.Int32
	latestRelease := healthTestRelease("v99.0.0")
	latest := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		latestRequests.Add(1)
		latestRelease(w, r)
	}))
	s.T().Cleanup(latest.Close)
	originalURL := healthLatestVersionURL
	healthLatestVersionURL = latest.URL
	s.T().Cleanup(func() { healthLatestVersionURL = originalURL })

	s.th = api4.SetupWithServerOptions(s.T(), []app.Option{app.LatestVersionURL(latest.URL)})
	s.th.InitBasic(s.T())
	license := model.NewTestLicenseSKU(model.LicenseShortSkuProfessional)
	// The packet's metadata needs valid IDs, and the permissions collector the migration, or the
	// packet carries a warning.txt.
	license.Id = model.NewId()
	license.Customer.Id = model.NewId()
	s.th.App.Srv().SetLicense(license)
	systemStore := s.th.App.Srv().Store().System()
	s.Require().NoError(systemStore.Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"}))
	s.T().Cleanup(func() {
		_, err := systemStore.PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
		s.Require().NoError(err)
	})
	s.th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = true
		// The health check and the packet each probe SMTP and could disagree.
		cfg.EmailSettings.SendEmailNotifications = model.NewPointer(false)
		cfg.EmailSettings.RequireEmailVerification = model.NewPointer(false)
		cfg.EmailSettings.EnableSignInWithEmail = model.NewPointer(false)
		cfg.EmailSettings.EnableSignInWithUsername = model.NewPointer(false)
		cfg.ServiceSettings.EnableEmailInvitations = model.NewPointer(false)
	})

	s.Require().NoError(s.th.App.RunHealthCheck(s.th.Context))
	s.Require().Equal(int32(1), latestRequests.Load(), "the health check didn't fetch the latest release")

	packetPath := filepath.Join(s.T().TempDir(), "mm_support_packet.zip")
	cmd := newTestCmd(s.T(), SystemSupportPacketCmd)
	s.Require().NoError(cmd.Flags().Set("output-file", packetPath))
	s.Require().NoError(systemSupportPacketCmdF(s.th.SystemAdminClient, cmd, nil))
	findings := func(run func(cmd *cobra.Command) error, includeResolved bool, packetPath string) []*model.HealthFinding {
		printer.Clean()
		printer.SetFormat(printer.FormatJSON)
		cmd := newTestCmd(s.T(), HealthCheckCmd)
		s.Require().NoError(cmd.Flags().Set("include-resolved", strconv.FormatBool(includeResolved)))
		if packetPath != "" {
			s.Require().NoError(cmd.Flags().Set("packet", packetPath))
		}
		s.Require().NoError(run(cmd))
		s.Require().Len(printer.GetLines(), 1)
		list, ok := printer.GetLines()[0].(*model.HealthFindingList)
		s.Require().True(ok)
		return list.Findings
	}

	for _, includeResolved := range []bool{false, true} {
		s.Run("include-resolved="+strconv.FormatBool(includeResolved), func() {
			live := findings(func(cmd *cobra.Command) error { return healthCheckCmdF(s.th.SystemAdminClient, cmd, nil) }, includeResolved, "")
			offline := findings(func(cmd *cobra.Command) error { return healthCheckPacketCmdF(cmd, nil) }, includeResolved, packetPath)
			s.Equal([]string{healthPacketDisclaimer}, printer.GetErrorLines(), "the packet was incomplete, or mmctl couldn't fetch the latest release")
			// The findings API serves product findings only; a packet is evaluated for support engineers too.
			offline = slices.DeleteFunc(offline, func(f *model.HealthFinding) bool { return f.Surface != string(healthcheck.SurfaceProduct) })

			s.Require().NotEmpty(live)
			s.Equal(comparableHealthFindings(live), comparableHealthFindings(offline))
		})
	}
}

// comparableHealthFindings drops what depends on when and how often a finding was evaluated, and
// the values each collection samples for itself, and sorts by fingerprint.
func comparableHealthFindings(findings []*model.HealthFinding) []model.HealthFinding {
	result := make([]model.HealthFinding, 0, len(findings))
	for _, finding := range findings {
		f := *finding
		f.FirstSeenAt, f.LastSeenAt, f.StateSince = 0, 0, 0
		if len(f.Details) == 0 {
			f.Details = nil
		}
		if slices.Contains(healthchecktest.SampledCodes, f.Code) {
			f.Details, f.Message = nil, ""
		}
		result = append(result, f)
	}
	slices.SortFunc(result, func(a, b model.HealthFinding) int { return cmp.Compare(a.Fingerprint, b.Fingerprint) })
	return result
}
