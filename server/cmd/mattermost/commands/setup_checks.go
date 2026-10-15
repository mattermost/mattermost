// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"net"
	"net/url"
	"slices"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/config"
)

// minimumRequiredPostgresVersion matches sqlstore.minimumRequiredPostgresVersion.
// The server logs and continues below this version; setup does the same.
const minimumRequiredPostgresVersion = 150000

const (
	defaultEnvFile       = "/etc/mattermost/mattermost.env"
	defaultFileConfig    = "/etc/mattermost/config.json"
	mattermostUser       = "mattermost"
	mattermostHome       = "/var/lib/mattermost"
	stateDataDir         = "/var/lib/mattermost/data"
	stateLogDir          = "/var/log/mattermost"
	statePluginDir       = "/var/lib/mattermost/plugins"
	stateClientPluginDir = "/var/lib/mattermost/client/plugins"
	defaultGossipPort    = 8074
	configStoreDatabase  = "database"
	configStoreFile      = "file"
	newInstallationLine  = "This is a new installation."
	existingInstallLine  = "This is an existing installation. This host will join the cluster."
)

type clusterPeer struct {
	Hostname   string
	GossipPort int
	Port       int
}

func validateDatabaseURL(raw string) error {
	if strings.TrimSpace(raw) == "" {
		return errors.New("database URL is required")
	}
	if strings.ContainsAny(raw, "\r\n#") {
		return errors.New("database URL cannot contain a newline or '#', which systemd EnvironmentFile treats as a comment")
	}
	if !config.IsDatabaseDSN(raw) {
		return errors.New("database URL must use the postgres:// or postgresql:// scheme")
	}
	if _, err := url.Parse(raw); err != nil {
		return errors.New("database URL is not a valid URL")
	}
	return nil
}

func validateSiteURL(raw string) error {
	if raw == "" {
		return nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || !parsed.IsAbs() || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("SiteURL must be an absolute http:// or https:// URL with a host and no user info, query, or fragment")
	}
	return nil
}

func validateConfigStore(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", configStoreDatabase:
		return configStoreDatabase, nil
	case configStoreFile:
		return configStoreFile, nil
	default:
		return "", errors.New("--config-store must be database or file")
	}
}

func mmOverrides(environ []string) []string {
	var keys []string
	for _, entry := range environ {
		key, _, ok := strings.Cut(entry, "=")
		if ok && strings.HasPrefix(key, "MM_") {
			keys = append(keys, key)
		}
	}
	slices.Sort(keys)
	return slices.Compact(keys)
}

func renderEnvFile(mmConfig, dataSource string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "MM_CONFIG=%s\n", mmConfig)
	if dataSource != "" {
		fmt.Fprintf(&b, "MM_SQLSETTINGS_DATASOURCE=%s\n", dataSource)
	}
	return b.String()
}

// decideDataSourceUpdate reports whether the stored DataSource should be
// rewritten to next. A different env-file URL requires force. A stored URL
// that is neither the previous env value nor the public default is left alone.
func decideDataSourceUpdate(stored string, hasStored bool, previous, next string, force bool) (bool, error) {
	if previous != "" && previous != next && !force {
		return false, errors.New("database URL differs from the existing env file; pass --force to replace it")
	}
	if !hasStored || stored == next {
		return false, nil
	}
	if stored == previous || stored == model.SqlSettingsDefaultDataSource {
		return true, nil
	}
	return false, errors.New("stored DataSource points at a different database than this URL; change it in the configuration store before continuing")
}

func compareSchema(dbVersion int, hasMigrations bool, binaryVersion int) (string, error) {
	if !hasMigrations {
		return "", nil
	}
	if dbVersion > binaryVersion {
		return "", errors.Errorf("database schema version %d is newer than this binary (migration %d)", dbVersion, binaryVersion)
	}
	if dbVersion < binaryVersion {
		return fmt.Sprintf("Database schema version %d is older than this binary (migration %d). Setup will not migrate an existing installation; the server applies migrations on first start.", dbVersion, binaryVersion), nil
	}
	return "", nil
}

func postgresWarnings(version int, encoding string) []string {
	var warnings []string
	if version > 0 && version < minimumRequiredPostgresVersion {
		warnings = append(warnings, fmt.Sprintf("PostgreSQL version %d is older than 15. The server logs this and continues.", version))
	}
	if encoding != "" && !strings.EqualFold(encoding, "UTF8") {
		warnings = append(warnings, fmt.Sprintf("Database encoding is %s, not UTF8.", encoding))
	}
	return warnings
}

func siteURLWarnings(raw string) []string {
	if raw == "" {
		return nil
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil
	}
	var warnings []string
	switch strings.ToLower(parsed.Hostname()) {
	case "localhost", "127.0.0.1", "::1":
		warnings = append(warnings, "Site URL is a loopback address. Other machines and TLS-terminating proxies will not match it.")
	}
	if parsed.Scheme == "http" {
		warnings = append(warnings, "Site URL uses http. Other machines and TLS-terminating proxies will not match it.")
	}
	return warnings
}

func dialPeers(peers []clusterPeer, configuredPort int, dial func(string) error) error {
	var failed []string
	for _, peer := range peers {
		addr := net.JoinHostPort(peer.Hostname, fmt.Sprintf("%d", peer.GossipPort))
		if err := dial(addr); err != nil {
			msg := fmt.Sprintf("%s on gossip port %d", peer.Hostname, peer.GossipPort)
			if peer.GossipPort != configuredPort {
				msg += fmt.Sprintf(" (ClusterSettings.GossipPort is %d)", configuredPort)
			}
			failed = append(failed, msg)
		}
	}
	if len(failed) > 0 {
		return errors.Errorf("cluster peer did not accept a TCP connection: %s", strings.Join(failed, "; "))
	}
	return nil
}

func needsPrivilegeProbe(hasMigrations bool) bool {
	return !hasMigrations
}
