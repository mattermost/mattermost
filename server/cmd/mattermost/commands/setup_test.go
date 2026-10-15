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

func TestDecideDataSourceUpdate(t *testing.T) {
	t.Parallel()
	const next = "postgres://mmuser:new@db.example.com/mattermost"
	const previous = "postgres://mmuser:old@db.example.com/mattermost"

	update, err := decideDataSourceUpdate(next, true, next, next, false)
	require.NoError(t, err)
	require.False(t, update)

	_, err = decideDataSourceUpdate(previous, true, previous, next, false)
	require.Error(t, err)

	update, err = decideDataSourceUpdate(previous, true, previous, next, true)
	require.NoError(t, err)
	require.True(t, update)

	update, err = decideDataSourceUpdate(model.SqlSettingsDefaultDataSource, true, "", next, false)
	require.NoError(t, err)
	require.True(t, update)

	_, err = decideDataSourceUpdate("postgres://other:secret@elsewhere/mattermost", true, "", next, true)
	require.Error(t, err)

	update, err = decideDataSourceUpdate("", false, "", next, false)
	require.NoError(t, err)
	require.False(t, update)
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
	var dialed []string
	peers := []clusterPeer{{Hostname: "a.example.com", GossipPort: 8074}, {Hostname: "b.example.com", GossipPort: 8075}}
	err := dialPeers(peers, 8074, func(addr string) error {
		dialed = append(dialed, addr)
		if strings.HasPrefix(addr, "b.example.com") {
			return errors.New("connection refused")
		}
		return nil
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "b.example.com")
	require.Contains(t, err.Error(), "8075")
	require.Contains(t, err.Error(), "8074")
	require.Equal(t, []string{"a.example.com:8074", "b.example.com:8075"}, dialed)
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
}

type setupCalls struct {
	order   []string
	migrate string
	updated bool
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
		inspect: func(string) (dbInspection, error) {
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
		updateStoredDataSource: func(string) error {
			calls.updated = true
			return nil
		},
		readFileConfig: readConfigFile,
		writeFileConfig: func(path, _, _ string, _, _ int) error {
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
	require.Contains(t, string(data), "MM_CONFIG="+opts.DatabaseURL+"\n")
	require.Contains(t, string(data), "MM_SQLSETTINGS_DATASOURCE="+opts.DatabaseURL+"\n")
	info, err := os.Stat(opts.EnvFile)
	require.NoError(t, err)
	require.Equal(t, os.FileMode(0600), info.Mode().Perm())

	unit, err := os.ReadFile(env.paths.etcUnit)
	require.NoError(t, err)
	require.Contains(t, string(unit), "EnvironmentFile="+opts.EnvFile)

	text := out.String()
	require.Contains(t, text, newInstallationLine)
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
	require.Equal(t, "MM_CONFIG="+defaultFileConfig+"\n", string(data))
}

func TestSetupExistingJoinSkipsSeedAndSiteURL(t *testing.T) {
	env, opts, out, calls := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	env.inspect = func(string) (dbInspection, error) {
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
	require.False(t, calls.updated)
	require.Empty(t, calls.binds)
	text := out.String()
	require.Contains(t, text, existingInstallLine)
	require.Contains(t, text, "Ignoring --site-url")
	require.Contains(t, text, "Clustering is disabled")
	dropIn, err := os.ReadFile(filepath.Join(env.paths.dropInDir, setupDropInName))
	require.NoError(t, err)
	require.Contains(t, string(dropIn), "EnvironmentFile="+opts.EnvFile)
}

func TestSetupClusterDialFailureStopsBeforeEnvFile(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	cfg.ClusterSettings.Enable = model.NewPointer(true)
	cfg.ClusterSettings.ClusterName = model.NewPointer("production")
	env.inspect = func(string) (dbInspection, error) {
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

	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "peer.example.com")
	require.Equal(t, 1, calls.peers)
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
	require.NotContains(t, calls.order, "seed")
}

func TestSetupSchemaNewerThanBinary(t *testing.T) {
	env, opts, _, _ := newTestSetup(t)
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(opts.DatabaseURL)
	env.inspect = func(string) (dbInspection, error) {
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

func TestSetupForceRefusesDifferentStoredDatabase(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.Force = true
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer("postgres://other:secret@elsewhere/mattermost")
	env.inspect = func(string) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	err := runSetup(opts, env)
	require.Error(t, err)
	require.Contains(t, err.Error(), "different database")
	require.False(t, calls.updated)
	_, statErr := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(statErr))
}

func TestSetupForceUpdatesMatchingDataSource(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.Force = true
	previous := "postgres://mmuser:old@db.example.com/mattermost"
	require.NoError(t, os.WriteFile(opts.EnvFile, []byte("MM_CONFIG="+previous+"\n"), 0600))
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.SqlSettings.DataSource = model.NewPointer(previous)
	env.inspect = func(string) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 234}, nil
	}
	env.readActiveConfig = func(string) (*model.Config, bool, error) {
		return cfg, true, nil
	}
	require.NoError(t, runSetup(opts, env))
	require.True(t, calls.updated)
	data, err := os.ReadFile(opts.EnvFile)
	require.NoError(t, err)
	require.Contains(t, string(data), "MM_CONFIG="+opts.DatabaseURL)
}

func TestSetupKeepsExistingFileConfig(t *testing.T) {
	env, opts, _, calls := newTestSetup(t)
	opts.ConfigStoreSet = false
	path := filepath.Join(env.installRoot, "config", "config.json")
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0755))
	require.NoError(t, os.WriteFile(path, []byte("{}\n"), 0600))
	env.inspect = func(string) (dbInspection, error) {
		return dbInspection{version: 160000, encoding: "UTF8", hasMigrations: true, schemaVersion: 200}, nil
	}
	require.NoError(t, runSetup(opts, env))
	require.NotContains(t, calls.order, "seed")
	require.NotContains(t, calls.order, "schema")
	data, err := os.ReadFile(opts.EnvFile)
	require.NoError(t, err)
	require.Equal(t, "MM_CONFIG="+path+"\n", string(data))
}

func TestSetupDryRunWritesNothing(t *testing.T) {
	env, opts, out, calls := newTestSetup(t)
	opts.DryRun = true
	require.NoError(t, runSetup(opts, env))
	require.Equal(t, []string{"inspect", "read"}, calls.order)
	_, err := os.Stat(opts.EnvFile)
	require.True(t, os.IsNotExist(err))
	require.Contains(t, out.String(), newInstallationLine)
	require.Contains(t, out.String(), "Dry run")
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
	require.NotEmpty(t, postgresWarnings(140000, "UTF8"))
	require.NotEmpty(t, postgresWarnings(160000, "SQL_ASCII"))
	require.Empty(t, postgresWarnings(160000, "UTF8"))
	require.NotEmpty(t, siteURLWarnings("http://localhost:8065"))
}
