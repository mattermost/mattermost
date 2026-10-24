// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bufio"
	"bytes"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestValidateDatabaseURL(t *testing.T) {
	t.Parallel()
	ok := "postgres://mmuser:secret@db.example.com:5432/mattermost?sslmode=disable"
	require.NoError(t, validateDatabaseURL(ok))
	require.NoError(t, validateDatabaseURL("postgresql://mmuser@/mattermost?host=/var/run/postgresql"))

	for _, raw := range []string{
		"",
		"   ",
		"mysql://mmuser@localhost/mattermost",
		"http://db.example.com/mattermost",
		"postgres://mmuser:secret@db.example.com/mattermost\nMM_CONFIG=other",
		"postgres://mmuser:secret@db.example.com/mattermost#comment",
	} {
		require.Error(t, validateDatabaseURL(raw), raw)
	}
}

func TestValidateSiteURL(t *testing.T) {
	t.Parallel()
	require.NoError(t, validateSiteURL(""))
	require.NoError(t, validateSiteURL("https://mattermost.example.com"))
	require.NoError(t, validateSiteURL("https://mattermost.example.com/team"))
	require.NoError(t, validateSiteURL("http://localhost:8065"))

	for _, raw := range []string{
		"mattermost.example.com",
		"ftp://mattermost.example.com",
		"https://user:pass@mattermost.example.com",
		"https://mattermost.example.com?x=1",
		"https://mattermost.example.com#frag",
		"/relative",
	} {
		require.Error(t, validateSiteURL(raw), raw)
	}
}

func TestRejectDifferentEnvURL(t *testing.T) {
	t.Parallel()
	const next = "postgres://mmuser:new@db.example.com/mattermost"
	const previous = "postgres://mmuser:old@db.example.com/mattermost"

	require.NoError(t, rejectDifferentEnvURL(next, next, false))
	require.Error(t, rejectDifferentEnvURL(previous, next, false))
	require.NoError(t, rejectDifferentEnvURL(previous, next, true))
	require.NoError(t, rejectDifferentEnvURL("", next, false))
}

func TestSystemdQuoteRoundTrip(t *testing.T) {
	t.Parallel()
	raw := `postgres://mmuser:se cret"\@db/mattermost`
	require.Equal(t, raw, systemdUnquote(systemdQuote(raw)))
	vals := parseEnvFile(renderEnvFile(raw, raw))
	require.Equal(t, raw, vals["MM_CONFIG"])
	require.Equal(t, raw, vals["MM_SQLSETTINGS_DATASOURCE"])
}

func TestPrivilegedListenWarning(t *testing.T) {
	t.Parallel()
	require.Empty(t, privilegedListenWarning(":8065"))
	require.Contains(t, privilegedListenWarning(":443"), "443")
	require.Contains(t, privilegedListenWarning(":443"), "reverse proxy")
}

func TestPeerIsSelf(t *testing.T) {
	t.Parallel()
	peer := clusterPeer{Hostname: "Setup-Host"}
	require.True(t, peerIsSelf(peer, []string{"setup-host"}))
	require.False(t, peerIsSelf(peer, []string{"other.example.com"}))
}

func TestCompareSchema(t *testing.T) {
	t.Parallel()
	warning, err := compareSchema(0, false, 234)
	require.NoError(t, err)
	require.Empty(t, warning)

	warning, err = compareSchema(200, true, 234)
	require.NoError(t, err)
	require.NotEmpty(t, warning)

	_, err = compareSchema(300, true, 234)
	require.Error(t, err)

	warning, err = compareSchema(234, true, 234)
	require.NoError(t, err)
	require.Empty(t, warning)
}

func TestDialPeers(t *testing.T) {
	t.Parallel()
	var mu sync.Mutex
	var dialed []string
	peers := []clusterPeer{{Hostname: "a.example.com", GossipPort: 8074}, {Hostname: "b.example.com", GossipPort: 8075}}
	failed := dialPeers(peers, 8074, func(addr string) error {
		mu.Lock()
		dialed = append(dialed, addr)
		mu.Unlock()
		if strings.HasPrefix(addr, "b.example.com") {
			return errors.New("connection refused")
		}
		return nil
	})
	require.Len(t, failed, 1)
	require.Contains(t, failed[0], "b.example.com")
	require.Contains(t, failed[0], "8075")
	require.Contains(t, failed[0], "8074")
	require.ElementsMatch(t, []string{"a.example.com:8074", "b.example.com:8075"}, dialed)
}

func TestMMOverrides(t *testing.T) {
	t.Parallel()
	require.Empty(t, mmOverrides([]string{"PATH=/usr/bin", "HOME=/root"}))
	require.Equal(t, []string{"MM_CONFIG", "MM_SQLSETTINGS_DATASOURCE"}, mmOverrides([]string{
		"MM_SQLSETTINGS_DATASOURCE=postgres://db",
		"PATH=/bin",
		"MM_CONFIG=postgres://db",
		"MM_CONFIG=postgres://db",
	}))
}

func TestActiveConfigQueryIsReadOnly(t *testing.T) {
	t.Parallel()
	upper := strings.ToUpper(activeConfigQuery)
	require.Contains(t, upper, "SELECT")
	require.NotContains(t, upper, "INSERT")
	require.NotContains(t, upper, "UPDATE")
	require.NotContains(t, upper, "DELETE")
}

func TestNeedsPrivilegeProbe(t *testing.T) {
	t.Parallel()
	require.True(t, needsPrivilegeProbe(false))
	require.False(t, needsPrivilegeProbe(true))
}

func TestOSPrettyName(t *testing.T) {
	t.Parallel()
	ubuntu := "NAME=\"Ubuntu\"\nVERSION=\"26.04.1 LTS (Resolute Raccoon)\"\nID=ubuntu\nPRETTY_NAME=\"Ubuntu 26.04.1 LTS\"\n"
	require.Equal(t, "Ubuntu 26.04.1 LTS", osPrettyName(ubuntu, ""))
	rhel := "NAME=\"Red Hat Enterprise Linux\"\nVERSION_ID=\"9.4\"\n"
	require.Equal(t, "Red Hat Enterprise Linux 9.4", osPrettyName(rhel, ""))
	require.Equal(t, "Rocky Linux release 9.4 (Blue Onyx)", osPrettyName("", "Rocky Linux release 9.4 (Blue Onyx)\n"))
	require.Equal(t, "Linux", osPrettyName("", ""))
}

func TestSystemdVersion(t *testing.T) {
	t.Parallel()
	require.Equal(t, "259", systemdVersion("systemd 259 (259.5-0ubuntu3.4)\n+PAM +AUDIT\n"))
	require.Empty(t, systemdVersion(""))
}

func TestAppArmorStatus(t *testing.T) {
	t.Parallel()
	status, warning := apparmorStatus("N\n", "", false)
	require.Equal(t, "not enabled", status)
	require.Empty(t, warning)

	status, warning = apparmorStatus("Y\n", "/usr/bin/man (enforce)\n", true)
	require.Equal(t, "enabled, no Mattermost profile", status)
	require.Empty(t, warning)

	status, warning = apparmorStatus("Y\n", "mattermost (enforce)\n", true)
	require.Equal(t, "enforcing mattermost", status)
	require.NotEmpty(t, warning)

	status, warning = apparmorStatus("Y\n", "/opt/mattermost/bin/mattermost (complain)\n", true)
	require.Equal(t, "complain /opt/mattermost/bin/mattermost", status)
	require.Empty(t, warning)
}

func TestSELinuxStatus(t *testing.T) {
	t.Parallel()
	status, warning := selinuxStatus("", true, "")
	require.Equal(t, "disabled", status)
	require.Empty(t, warning)

	status, warning = selinuxStatus("1\n", false, "system_u:object_r:bin_t:s0")
	require.Equal(t, "enforcing, binary bin_t", status)
	require.Empty(t, warning)

	status, warning = selinuxStatus("1\n", false, "system_u:object_r:mattermost_t:s0")
	require.Equal(t, "enforcing, binary mattermost_t", status)
	require.Contains(t, warning, "mattermost_t")

	status, warning = selinuxStatus("1\n", false, "system_u:object_r:usr_t:s0")
	require.Equal(t, "enforcing, binary usr_t", status)
	require.Contains(t, warning, "semanage")
	require.NotContains(t, warning, "must be allowed")

	status, warning = selinuxStatus("0\n", false, "system_u:object_r:mattermost_t:s0")
	require.Equal(t, "permissive, binary mattermost_t", status)
	require.Empty(t, warning)
}

func TestFapolicydStatus(t *testing.T) {
	t.Parallel()
	status, warning := fapolicydStatus(false, false)
	require.Equal(t, "not installed", status)
	require.Empty(t, warning)

	status, warning = fapolicydStatus(true, false)
	require.Equal(t, "installed, not running", status)
	require.Empty(t, warning)

	status, warning = fapolicydStatus(true, true)
	require.Equal(t, "running", status)
	require.Contains(t, warning, "/var/lib/mattermost")
}

func TestClassifyPostgres(t *testing.T) {
	t.Parallel()
	stock := "PostgreSQL 16.4 on x86_64-pc-linux-gnu, compiled by gcc"
	require.Equal(t, "PostgreSQL", classifyPostgres(stock, postgresVendor{}))
	require.Equal(t, "Amazon Aurora", classifyPostgres(stock, postgresVendor{aurora: true, rds: true}))
	require.Equal(t, "Amazon RDS", classifyPostgres(stock, postgresVendor{rds: true}))
	require.Equal(t, "Google AlloyDB", classifyPostgres(stock, postgresVendor{alloydb: true, cloudsql: true}))
	require.Equal(t, "Google Cloud SQL", classifyPostgres(stock, postgresVendor{cloudsql: true}))
	require.Equal(t, "Azure Database for PostgreSQL", classifyPostgres(stock, postgresVendor{azure: true}))
	require.Equal(t, "Citus", classifyPostgres(stock, postgresVendor{citus: true}))
	require.Equal(t, "EDB Postgres Advanced Server", classifyPostgres("EnterpriseDB 16.4", postgresVendor{rds: true}))
	require.Equal(t, "16.4", formatPostgresVersion(160004))
	require.Equal(t, "16.10", formatPostgresVersion(160010))
	require.Equal(t, "9.6.24", formatPostgresVersion(90624))
}

func TestFormatInfoBox(t *testing.T) {
	t.Parallel()
	box := formatInfoBox("System information", [][2]string{
		{"Mattermost", "12.1.0"},
		{"OS", "Ubuntu 26.04.1 LTS"},
		{"AppArmor", "enabled, no Mattermost profile"},
	})
	lines := strings.Split(strings.TrimRight(box, "\n"), "\n")
	require.GreaterOrEqual(t, len(lines), 3)
	width := len(lines[0])
	for _, line := range lines {
		require.Equal(t, width, len(line), line)
	}
	require.Contains(t, box, "System information")
	require.Contains(t, box, "Ubuntu 26.04.1 LTS")
	require.LessOrEqual(t, width, 78)
}

func TestSetupBanner(t *testing.T) {
	t.Parallel()
	for _, line := range strings.Split(strings.TrimRight(setupBanner, "\n"), "\n") {
		require.LessOrEqual(t, len(line), 78, line)
	}
	var buf bytes.Buffer
	(setupEnv{out: &buf}).printBanner()
	text := buf.String()
	require.Contains(t, text, setupBanner)
	require.Contains(t, text, "System information")
	require.Contains(t, text, model.CurrentVersion)
	require.Contains(t, text, "AppArmor")
	require.Contains(t, text, "SELinux")
}

func TestShippedUnitMatchesFile(t *testing.T) {
	t.Parallel()
	_, source, _, ok := runtime.Caller(0)
	require.True(t, ok)
	data, err := os.ReadFile(filepath.Join(filepath.Dir(source), "..", "..", "..", "build", "mattermost.service"))
	require.NoError(t, err)
	require.Equal(t, shippedMattermostUnit, string(data))
}

func TestWriteEnvFileMode(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "mattermost.env")
	contents := renderEnvFile("postgres://mmuser:secret@db/mattermost", "postgres://mmuser:secret@db/mattermost")
	require.NoError(t, writeEnvFile(path, contents))
	info, err := os.Stat(path)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0600), info.Mode().Perm())

	require.NoError(t, writeEnvFile(path, contents))
	again, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, contents, string(again))
}

func TestEnsureRuntimeDirsRejectsUnwritable(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root can write a directory mode 0555")
	}
	uid, gid := currentIDs(t)
	dir := filepath.Join(t.TempDir(), "data")
	require.NoError(t, os.Mkdir(dir, 0555))
	err := ensureRuntimeDirs([]string{dir}, uid, gid)
	require.Error(t, err)
	require.Contains(t, err.Error(), "chown mattermost:mattermost")
}

func TestEnsureRuntimeDirsCreatesMissing(t *testing.T) {
	uid, gid := currentIDs(t)
	root := t.TempDir()
	err := ensureRuntimeDirs(runtimeDirs(root, nil), uid, gid)
	require.NoError(t, err)
	for _, dir := range []string{"data", "logs", "plugins", filepath.Join("client", "plugins")} {
		info, statErr := os.Stat(filepath.Join(root, dir))
		require.NoError(t, statErr)
		require.True(t, info.IsDir())
	}
}

func TestBindAndClose(t *testing.T) {
	require.NoError(t, bindAndClose("tcp", "127.0.0.1:0"))
	require.NoError(t, bindAndClose("udp", "127.0.0.1:0"))
}

func TestEffectiveMMConfig(t *testing.T) {
	root := t.TempDir()
	unit := filepath.Join(root, "mattermost.service")
	other := filepath.Join(root, "mattermost.environment")
	setupFile := filepath.Join(root, "mattermost.env")
	require.NoError(t, os.WriteFile(other, []byte("MM_CONFIG=postgres://old\n"), 0600))
	require.NoError(t, os.WriteFile(setupFile, []byte("MM_CONFIG=postgres://new\n"), 0600))
	require.NoError(t, os.WriteFile(unit, []byte("[Service]\nEnvironmentFile="+other+"\n"), 0644))

	src, err := effectiveMMConfig(unit, nil)
	require.NoError(t, err)
	require.Equal(t, other, src.source)
	require.Equal(t, "postgres://old", src.value)

	dropIn := filepath.Join(root, "10-mattermost-setup.conf")
	require.NoError(t, os.WriteFile(dropIn, []byte("[Service]\nEnvironmentFile="+setupFile+"\n"), 0644))
	src, err = effectiveMMConfig(unit, []string{dropIn})
	require.NoError(t, err)
	require.Equal(t, setupFile, src.source)
	require.Equal(t, "postgres://new", src.value)

	quoted := filepath.Join(root, "quoted.service")
	require.NoError(t, os.WriteFile(quoted, []byte("[Service]\nEnvironment=\"MM_CONFIG=postgres://quoted/db\"\n"), 0644))
	src, err = effectiveMMConfig(quoted, nil)
	require.NoError(t, err)
	require.Equal(t, "postgres://quoted/db", src.value)

	reset := filepath.Join(root, "reset.conf")
	require.NoError(t, os.WriteFile(reset, []byte("[Service]\nEnvironment=\n"), 0644))
	src, err = effectiveMMConfig(quoted, []string{reset})
	require.NoError(t, err)
	require.False(t, src.found)
}

type setupCalls struct {
	order   []string
	migrate string
	file    bool
	binds   []string
	peers   int
}

func currentIDs(t *testing.T) (int, int) {
	t.Helper()
	account, err := user.Current()
	require.NoError(t, err)
	uid, err := strconv.Atoi(account.Uid)
	require.NoError(t, err)
	gid, err := strconv.Atoi(account.Gid)
	require.NoError(t, err)
	return uid, gid
}

func newTestSetup(t *testing.T) (setupEnv, setupOptions, *bytes.Buffer, *setupCalls) {
	t.Helper()
	buf := &bytes.Buffer{}
	calls := &setupCalls{}
	root := t.TempDir()
	sys := t.TempDir()
	uid, gid := currentIDs(t)
	state := filepath.Join(root, "state")
	env := setupEnv{
		out:         buf,
		in:          bufio.NewReader(strings.NewReader("")),
		tty:         false,
		geteuid:     func() int { return 0 },
		installRoot: root,
		state: statePaths{
			data:          filepath.Join(state, "data"),
			logs:          filepath.Join(state, "logs"),
			plugins:       filepath.Join(state, "plugins"),
			clientPlugins: filepath.Join(state, "client", "plugins"),
		},
		paths: systemdPaths{
			etcUnit:   filepath.Join(sys, "etc/systemd/system/mattermost.service"),
			dropInDir: filepath.Join(sys, "etc/systemd/system/mattermost.service.d"),
		},
		serviceActive: func() bool { return false },
		lookupUser: func(name string) (int, int, error) {
			if name != mattermostUser {
				return 0, 0, errors.New("missing user")
			}
			return uid, gid, nil
		},
		createUser: func(string, int) error {
			return errors.New("createUser should not be called")
		},
		dial: func(string) error { return nil },
		inspect: func(string, bool) (dbInspection, error) {
			calls.order = append(calls.order, "inspect")
			return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: false, probedCreate: true}, nil
		},
		readActiveConfig: func(string) (*model.Config, bool, error) {
			calls.order = append(calls.order, "read")
			return nil, false, nil
		},
		listPeers: func(string, string, int64) ([]clusterPeer, error) {
			calls.peers++
			return nil, nil
		},
		seedDatabase: func(_, migrateFrom, _ string, _ bool) error {
			calls.order = append(calls.order, "seed")
			calls.migrate = migrateFrom
			return nil
		},
		initSchema: func(string) error {
			calls.order = append(calls.order, "schema")
			return nil
		},
		readFileConfig: readConfigFile,
		writeFileConfig: func(path, _, _ string, _, _ int, _ *model.Config) error {
			calls.file = true
			require.Equal(t, defaultFileConfig, path)
			return nil
		},
		daemonReload:    func() error { return nil },
		binaryMigration: func() (int, error) { return 234, nil },
		hostname:        func() (string, error) { return "setup-host", nil },
		goos:            "linux",
		bind: func(network, address string) error {
			calls.binds = append(calls.binds, network+" "+address)
			return nil
		},
		now: func() time.Time { return time.Unix(1_700_000_000, 0).UTC() },
	}
	opts := setupOptions{
		DatabaseURL:    "postgres://mmuser:secret@db.example.com:5432/mattermost?sslmode=disable",
		ConfigStore:    configStoreDatabase,
		ConfigStoreSet: true,
		SiteURL:        "https://mattermost.example.com",
		SiteURLSet:     true,
		EnvFile:        filepath.Join(t.TempDir(), "mattermost.env"),
	}
	return env, opts, buf, calls
}

func TestSetupDatabaseURLFile(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	path := filepath.Join(t.TempDir(), "database.url")
	require.NoError(t, os.WriteFile(path, []byte(opts.DatabaseURL+"\n"), 0600))
	opts.DatabaseURL = ""
	opts.DatabaseURLFile = path
	require.NoError(t, runSetup(opts, env))
	require.Contains(t, calls.order, "seed")

	env, opts, _, _ = newTestSetup(t)
	opts.DatabaseURLFile = path
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "only one")
}

func TestSetupRejectsEnvChangeBeforeSeed(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	require.NoError(t, os.WriteFile(opts.EnvFile, []byte("MM_CONFIG="+systemdQuote("postgres://other/db")+"\n"), 0600))
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "--force")
	require.NotContains(t, calls.order, "seed")
	require.NotContains(t, calls.order, "schema")
}

func TestSetupFileStoreKeepsImportedConfig(t *testing.T) {
	env, opts, _, _ := newTestSetup(t)
	opts.ConfigStore = configStoreFile
	src := filepath.Join(t.TempDir(), "old.json")
	original := &model.Config{}
	original.ServiceSettings.EnableDeveloper = model.NewPointer(true)
	require.NoError(t, os.WriteFile(src, model.ToJSON(original), 0600))
	opts.MigrateFrom = src
	var got *model.Config
	env.writeFileConfig = func(_, _, _ string, _, _ int, imported *model.Config) error {
		got = imported
		return nil
	}
	require.NoError(t, runSetup(opts, env))
	require.NotNil(t, got)
	require.NotNil(t, got.ServiceSettings.EnableDeveloper)
	require.True(t, *got.ServiceSettings.EnableDeveloper)
}

func TestWriteFileConfigAppliesImport(t *testing.T) {
	imported := &model.Config{}
	imported.SetDefaults()
	imported.TeamSettings.SiteName = model.NewPointer("Imported Site")
	root := t.TempDir()
	path := filepath.Join(root, "config.json")
	paths := statePaths{
		data:          filepath.Join(root, "data"),
		logs:          filepath.Join(root, "logs"),
		plugins:       filepath.Join(root, "plugins"),
		clientPlugins: filepath.Join(root, "client", "plugins"),
	}
	dsn := "postgres://mmuser:secret@db.example.com/mattermost?sslmode=disable"
	require.NoError(t, writeFileConfig(path, dsn, "https://mattermost.example.com", os.Getuid(), os.Getgid(), paths, imported))
	saved, err := readConfigFile(path)
	require.NoError(t, err)
	require.Equal(t, "Imported Site", *saved.TeamSettings.SiteName)
	require.Equal(t, dsn, *saved.SqlSettings.DataSource)
	require.Equal(t, filepath.Clean(paths.data), filepath.Clean(*saved.FileSettings.Directory))
	info, err := os.Stat(path)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0600), info.Mode().Perm())
}

func TestSetupNonInteractiveMissingURL(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.DatabaseURL = ""
	opts.NonInteractive = true
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Empty(t, calls.order)
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
}

func TestSetupRejectsAmbientMMOverrides(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	env.environ = []string{"MM_SERVICESETTINGS_SITEURL=https://wrong.example.com"}
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "MM_SERVICESETTINGS_SITEURL")
	require.Empty(t, calls.order)
}

func TestSetupRejectsForeignMMConfig(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	other := filepath.Join(t.TempDir(), "mattermost.environment")
	require.NoError(t, os.WriteFile(other, []byte("MM_CONFIG=postgres://other/mattermost\n"), 0600))
	require.NoError(t, os.MkdirAll(filepath.Dir(env.paths.etcUnit), 0755))
	require.NoError(t, os.WriteFile(env.paths.etcUnit, []byte("[Service]\nEnvironmentFile="+other+"\n"), 0644))

	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), other)
	require.Empty(t, calls.order)
}

func TestSetupNewInstallDoesNotImportShippedConfig(t *testing.T) {
	env, opts, out, calls := newTestSetup(t)
	require.NoError(t, os.MkdirAll(filepath.Join(env.installRoot, "config"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(env.installRoot, "config", "config.json"), []byte("{}\n"), 0600))

	require.NoError(t, runSetup(opts, env))
	require.Equal(t, []string{"inspect", "read", "seed", "schema"}, calls.order)
	require.Empty(t, calls.migrate)
	require.False(t, calls.file)

	data, err := os.ReadFile(opts.EnvFile)
	require.NoError(t, err)
	require.Contains(t, string(data), "MM_CONFIG="+systemdQuote(opts.DatabaseURL)+"\n")
	require.Contains(t, string(data), "MM_SQLSETTINGS_DATASOURCE="+systemdQuote(opts.DatabaseURL)+"\n")
	info, err := os.Stat(opts.EnvFile)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0600), info.Mode().Perm())

	unit, err := os.ReadFile(env.paths.etcUnit)
	require.NoError(t, err)
	require.Contains(t, string(unit), "EnvironmentFile="+opts.EnvFile)
	require.Contains(t, string(unit), "ExecStart="+filepath.Join(env.installRoot, "bin", "mattermost"))

	text := out.String()
	require.Contains(t, text, "Initializing the database schema. This can take several minutes.")
	require.Contains(t, text, "[+] "+newInstallationLine)
	require.Contains(t, text, "[+] Can create a table in the current schema.")
	require.Contains(t, text, "System information")
	require.Contains(t, text, model.CurrentVersion)
	require.Contains(t, text, "Variant")
	require.Contains(t, text, "Site URL: https://mattermost.example.com")
	require.Contains(t, text, "systemctl enable --now mattermost")
	require.Contains(t, text, "will not be read")
	require.Contains(t, text, "File storage: "+env.state.data)
	require.Contains(t, text, "Mattermost was not started.")
	infoData, err := os.Stat(env.state.data)
	require.NoError(t, err)
	require.True(t, infoData.IsDir())
}

func TestSetupFileStoreOmitsDataSourceOverride(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.ConfigStore = configStoreFile
	require.NoError(t, runSetup(opts, env))
	require.True(t, calls.file)
	require.NotContains(t, calls.order, "seed")
	require.Contains(t, calls.order, "schema")
	data, err := os.ReadFile(opts.EnvFile)
	require.NoError(t, err)
	require.Equal(t, "MM_CONFIG="+systemdQuote(defaultFileConfig)+"\n", string(data))
}

func TestSetupExistingJoinSkipsSeedAndSiteURL(t *testing.T) {
	env, opts, out, calls := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	env.inspect = func(string, bool) (dbInspection, error) {
		calls.order = append(calls.order, "inspect")
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		calls.order = append(calls.order, "read")
		return cfg, true, nil
	}
	env.serviceActive = func() bool { return true }
	require.NoError(t, os.MkdirAll(filepath.Dir(env.paths.etcUnit), 0755))
	require.NoError(t, os.WriteFile(env.paths.etcUnit, []byte("[Service]\nExecStart=/opt/mattermost/bin/mattermost\n"), 0644))

	require.NoError(t, runSetup(opts, env))
	require.Equal(t, []string{"inspect", "read"}, calls.order)
	require.Empty(t, calls.binds)
	text := out.String()
	require.Contains(t, text, "[+] "+existingInstallLine)
	require.NotContains(t, text, "Can create a table")
	require.Contains(t, text, "Ignoring --site-url")
	require.Contains(t, text, "Clustering is disabled")
	dropIn, err := os.ReadFile(filepath.Join(env.paths.dropInDir, setupDropInName))
	require.NoError(t, err)
	require.Contains(t, string(dropIn), "EnvironmentFile="+opts.EnvFile)
}

func TestSetupClusterDialFailureWarnsAndContinues(t *testing.T) {
	env, opts, out, calls := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	cfg.ClusterSettings.Enable = model.NewPointer(true)
	cfg.ClusterSettings.ClusterName = model.NewPointer("production")
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	env.listPeers = func(_, cluster string, _ int64) ([]clusterPeer, error) {
		require.Equal(t, "production", cluster)
		calls.peers++
		return []clusterPeer{{Hostname: "peer.example.com", GossipPort: 8074}}, nil
	}
	env.dial = func(string) error { return errors.New("connection refused") }

	require.NoError(t, runSetup(opts, env))
	require.Contains(t, out.String(), "peer.example.com")
	require.Contains(t, out.String(), "This host will join the cluster.")
	require.Equal(t, 1, calls.peers)
	_, statErr := os.Stat(opts.EnvFile)
	require.NoError(t, statErr)
	require.NotContains(t, calls.order, "seed")
}

func TestSetupSkipsDialToThisHost(t *testing.T) {
	env, opts, out, _ := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	cfg.ClusterSettings.Enable = model.NewPointer(true)
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	env.hostname = func() (string, error) { return "setup-host", nil }
	env.listPeers = func(string, string, int64) ([]clusterPeer, error) {
		return []clusterPeer{{Hostname: "setup-host", GossipPort: 8074}}, nil
	}
	dialed := 0
	env.dial = func(string) error {
		dialed++
		return errors.New("connection refused")
	}
	require.NoError(t, runSetup(opts, env))
	require.Equal(t, 0, dialed)
	require.Contains(t, out.String(), "30 minutes")
}

func TestSetupSchemaNewerThanBinary(t *testing.T) {
	env, opts, _, _ := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 999}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "newer")
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
}

func TestSetupLeavesDifferentStoredDataSource(t *testing.T) {
	env, opts, out, _ := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer("postgres://other:secret@elsewhere/mattermost")
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	require.NoError(t, runSetup(opts, env))
	require.Contains(t, out.String(), "left unchanged")
	_, statErr := os.Stat(opts.EnvFile)
	require.NoError(t, statErr)
}

func TestSetupForceReplacesEnvURL(t *testing.T) {
	env, opts, _, _ := newTestSetup(t)
	opts.Force = true
	previous := "postgres://mmuser:old@db.example.com/mattermost"
	require.NoError(t, os.WriteFile(opts.EnvFile, []byte("MM_CONFIG="+previous+"\n"), 0600))
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(previous)
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	require.NoError(t, runSetup(opts, env))
	data, err := os.ReadFile(opts.EnvFile)
	require.NoError(t, err)
	require.Contains(t, string(data), "MM_CONFIG="+systemdQuote(opts.DatabaseURL))
}

func TestSetupKeepsExistingFileConfig(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.ConfigStoreSet = false
	path := filepath.Join(env.installRoot, "config", "config.json")
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0755))
	cfg := &model.Config{}
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	require.NoError(t, os.WriteFile(path, model.ToJSON(cfg), 0600))
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 200}, nil
	}
	require.NoError(t, runSetup(opts, env))
	require.NotContains(t, calls.order, "seed")
	require.NotContains(t, calls.order, "schema")
	data, err := os.ReadFile(opts.EnvFile)
	require.NoError(t, err)
	require.Equal(t, "MM_CONFIG="+systemdQuote(path)+"\n", string(data))
}

func TestSetupRejectsSampleFileConfig(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.ConfigStoreSet = false
	path := filepath.Join(env.installRoot, "config", "config.json")
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0755))
	require.NoError(t, os.WriteFile(path, []byte("{}\n"), 0600))
	env.inspect = func(string, bool) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 200}, nil
	}
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "--migrate-from")
	require.NotContains(t, calls.order, "seed")
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
}

func TestSetupDryRunWritesNothing(t *testing.T) {
	env, opts, out, calls := newTestSetup(t)
	opts.DryRun = true
	require.NoError(t, runSetup(opts, env))
	require.Equal(t, []string{"inspect", "read"}, calls.order)
	_, err := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(err))
	require.Contains(t, out.String(), newInstallationLine)
	require.Contains(t, out.String(), "Dry run skipped the table check.")
	require.Contains(t, out.String(), "Listen address :8065 is free.")
	require.Contains(t, out.String(), "Dry run")
	require.NotContains(t, calls.order, "seed")
	require.NotEmpty(t, calls.binds)
}

func TestApplyNewInstallPaths(t *testing.T) {
	t.Parallel()
	paths := defaultStatePaths()
	cfg := &model.Config{}
	cfg.SetDefaults()
	applyNewInstallPaths(cfg, paths)
	require.Equal(t, paths.data, *cfg.FileSettings.Directory)
	require.Equal(t, paths.data, *cfg.FileSettings.ExportDirectory)
	require.Equal(t, paths.logs, *cfg.LogSettings.FileLocation)
	require.Equal(t, paths.plugins, *cfg.PluginSettings.Directory)
	require.Equal(t, paths.clientPlugins, *cfg.PluginSettings.ClientDirectory)

	custom := &model.Config{}
	custom.SetDefaults()
	custom.FileSettings.Directory = model.NewPointer("/srv/mattermost/data")
	custom.FileSettings.ExportDirectory = model.NewPointer("/srv/mattermost/export")
	applyNewInstallPaths(custom, paths)
	require.Equal(t, "/srv/mattermost/data", *custom.FileSettings.Directory)
	require.Equal(t, "/srv/mattermost/export", *custom.FileSettings.ExportDirectory)
	require.Equal(t, paths.logs, *custom.LogSettings.FileLocation)
}

func TestSetupCreatesMissingServiceUser(t *testing.T) {
	env, opts, out, _ := newTestSetup(t)
	looked := 0
	uid, gid := currentIDs(t)
	env.lookupUser = func(string) (int, int, error) {
		looked++
		if looked == 1 {
			return 0, 0, user.UnknownUserError(mattermostUser)
		}
		return uid, gid, nil
	}
	env.createUser = func(name string, uid int) error {
		require.Equal(t, mattermostUser, name)
		require.Equal(t, 500, uid)
		return nil
	}
	opts.UID = 500
	opts.UIDSet = true
	require.NoError(t, runSetup(opts, env))
	require.Contains(t, out.String(), "Created system user and group mattermost.")
}

func TestSetupNoCreateUser(t *testing.T) {
	env, opts, _, _ := newTestSetup(t)
	env.lookupUser = func(string) (int, int, error) {
		return 0, 0, user.UnknownUserError(mattermostUser)
	}
	opts.NoCreateUser = true
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "--no-create-user")
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
}

func TestSetupDeclinesUserCreation(t *testing.T) {
	env, opts, _, _ := newTestSetup(t)
	env.tty = true
	env.in = bufio.NewReader(strings.NewReader("n\n"))
	env.lookupUser = func(string) (int, int, error) {
		return 0, 0, user.UnknownUserError(mattermostUser)
	}
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "does not exist")
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
}

func TestSetupLeavesExistingUserUnchanged(t *testing.T) {
	env, opts, out, _ := newTestSetup(t)
	opts.UID = 500
	opts.UIDSet = true
	require.NoError(t, runSetup(opts, env))
	require.Contains(t, out.String(), "already exists")
	require.Contains(t, out.String(), "Leaving it unchanged.")
}

func TestSetupRequiresRootOnLinux(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	env.geteuid = func() int { return 1000 }
	require.Error(t, runSetup(opts, env))
	env.geteuid = func() int { return 0 }
	env.goos = "darwin"
	require.Error(t, runSetup(opts, env))
	require.Empty(t, calls.order)
}

func TestPostgresWarnings(t *testing.T) {
	t.Parallel()
	old := postgresWarnings(140000, "UTF8")
	require.NotEmpty(t, old)
	require.Contains(t, old[0], "14.0")
	require.NotContains(t, old[0], "140000")
	require.NotEmpty(t, postgresWarnings(160000, "SQL_ASCII"))
	require.Empty(t, postgresWarnings(160000, "UTF8"))

	loopback := strings.Join(siteURLWarnings("http://localhost:8065"), " ")
	require.Contains(t, loopback, "loopback")
	require.Contains(t, loopback, "http")
	httpOnly := strings.Join(siteURLWarnings("http://mattermost.example.com"), " ")
	require.NotContains(t, httpOnly, "loopback")
	require.Contains(t, httpOnly, "secure origin")
}
