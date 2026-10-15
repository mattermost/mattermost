// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/pkg/errors"

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
	existingInstallLine  = "This is an existing installation."
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
	fmt.Fprintf(&b, "MM_CONFIG=%s\n", systemdQuote(mmConfig))
	if dataSource != "" {
		fmt.Fprintf(&b, "MM_SQLSETTINGS_DATASOURCE=%s\n", systemdQuote(dataSource))
	}
	return b.String()
}

// systemdQuote wraps a value so systemd EnvironmentFile keeps spaces and quotes.
func systemdQuote(value string) string {
	var b strings.Builder
	b.WriteByte('"')
	for i := 0; i < len(value); i++ {
		switch value[i] {
		case '\\', '"':
			b.WriteByte('\\')
		}
		b.WriteByte(value[i])
	}
	b.WriteByte('"')
	return b.String()
}

// rejectDifferentEnvURL stops a re-run from replacing MM_CONFIG unless --force
// is set. Setup does not rewrite the shared configuration row.
func rejectDifferentEnvURL(previous, next string, force bool) error {
	if previous != "" && previous != next && !force {
		return errors.New("database URL differs from the existing env file; pass --force to replace it")
	}
	return nil
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
		warnings = append(warnings, fmt.Sprintf("PostgreSQL version %s is older than 15. The server logs this and continues.", formatPostgresVersion(version)))
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
		warnings = append(warnings, "Site URL uses http. Browsers will not treat it as a secure origin.")
	}
	return warnings
}

func siteURLSubpathWarning(raw, installRoot string, uid, gid int) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Path == "" || parsed.Path == "/" {
		return ""
	}
	client := filepath.Join(installRoot, "client")
	if probeDirWritable(client, uid, gid) == nil {
		return ""
	}
	return fmt.Sprintf("Site URL path is %s. The mattermost user must be able to write %s so Mattermost can rewrite client/root.html.", parsed.Path, client)
}

func privilegedListenWarning(address string) string {
	_, portText, err := net.SplitHostPort(address)
	if err != nil {
		return ""
	}
	port, err := strconv.Atoi(portText)
	if err != nil || port <= 0 || port >= 1024 {
		return ""
	}
	return fmt.Sprintf("Listen address %s uses port %d. The mattermost service has no CAP_NET_BIND_SERVICE, so it cannot bind ports below 1024. Put a reverse proxy on this port and set ListenAddress to an unprivileged port.", address, port)
}

// dialPeers checks peers together. A refused connection is a warning, not a
// failed setup: a replaced node stays registered for 30 minutes.
func dialPeers(peers []clusterPeer, configuredPort int, dial func(string) error) []string {
	failed := make([]string, len(peers))
	var wg sync.WaitGroup
	for i, peer := range peers {
		wg.Add(1)
		go func(i int, peer clusterPeer) {
			defer wg.Done()
			addr := net.JoinHostPort(peer.Hostname, strconv.Itoa(peer.GossipPort))
			if err := dial(addr); err != nil {
				msg := fmt.Sprintf("%s did not accept a TCP connection on gossip port %d", peer.Hostname, peer.GossipPort)
				if peer.GossipPort != configuredPort {
					msg += fmt.Sprintf(" (ClusterSettings.GossipPort is %d)", configuredPort)
				}
				failed[i] = msg
			}
		}(i, peer)
	}
	wg.Wait()
	var out []string
	for _, msg := range failed {
		if msg != "" {
			out = append(out, msg)
		}
	}
	sort.Strings(out)
	return out
}

func peerIsSelf(peer clusterPeer, names []string) bool {
	host := strings.TrimSpace(peer.Hostname)
	if host == "" {
		return false
	}
	for _, name := range names {
		if name != "" && strings.EqualFold(host, name) {
			return true
		}
	}
	return false
}

func selfPeerNames(host, override string) []string {
	names := []string{strings.TrimSpace(host), strings.TrimSpace(override)}
	if short, _, ok := strings.Cut(host, "."); ok {
		names = append(names, short)
	}
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return names
	}
	for _, addr := range addrs {
		switch v := addr.(type) {
		case *net.IPNet:
			names = append(names, v.IP.String())
		case *net.IPAddr:
			names = append(names, v.IP.String())
		}
	}
	return names
}

func needsPrivilegeProbe(hasMigrations bool) bool {
	return !hasMigrations
}
