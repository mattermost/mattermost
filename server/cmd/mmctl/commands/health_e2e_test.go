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

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// mmctl health check --packet on a server's Support Packet prints the findings mmctl health check
// prints for that server, with mmctl's own latest-release fetch, rendering and resolved filtering.
func (s *MmctlE2ETestSuite) TestHealthCheckPacketMatchesLiveFindings() {
	s.SetupTestHelper().InitBasic(s.T())
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

	// The health check reads the latest release from a cache that isn't keyed by URL, so filling
	// it from a stub keeps the run off GitHub. An earlier test may have filled it already; mmctl
	// is served whatever the server holds.
	stub := httptest.NewServer(healthTestRelease("v99.0.0"))
	s.T().Cleanup(stub.Close)
	latest, appErr := s.th.App.GetLatestVersion(s.th.Context, stub.URL)
	latestRelease := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusBadGateway) }
	if appErr == nil {
		latestRelease = healthTestRelease(latest.TagName)
	}
	fetch := httptest.NewServer(http.HandlerFunc(latestRelease))
	s.T().Cleanup(fetch.Close)
	originalURL := healthLatestVersionURL
	healthLatestVersionURL = fetch.URL
	s.T().Cleanup(func() { healthLatestVersionURL = originalURL })

	s.Require().NoError(s.th.App.RunHealthCheck(s.th.Context))

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
			s.Equal([]string{healthPacketDisclaimer}, printer.GetErrorLines())
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
	comparable := make([]model.HealthFinding, 0, len(findings))
	for _, finding := range findings {
		f := *finding
		f.FirstSeenAt, f.LastSeenAt, f.StateSince = 0, 0, 0
		if len(f.Details) == 0 {
			f.Details = nil
		}
		switch f.Code {
		case "NODE_FD_EXHAUSTION", "FILESTORE_DISK_LOW", "FILESTORE_DISK_FULL", "DB_POOL_SATURATED",
			"NODE_HOST_MEMORY_LOW", "NODE_CONTAINER_MEMORY_PRESSURE", "NODE_HOST_LOAD_HIGH", "NODE_CPU_THROTTLED":
			f.Details, f.Message = nil, ""
		}
		comparable = append(comparable, f)
	}
	slices.SortFunc(comparable, func(a, b model.HealthFinding) int { return cmp.Compare(a.Fingerprint, b.Fingerprint) })
	return comparable
}
