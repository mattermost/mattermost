// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/config"
)

const setupBanner = "" +
	" __  __       _   _                                _\n" +
	"|  \\/  | __ _| |_| |_ ___ _ __ _ __ ___   ___  ___| |_\n" +
	"| |\\/| |/ _` | __| __/ _ \\ '__| '_ ` _ \\ / _ \\/ __| __|\n" +
	"| |  | | (_| | |_| ||  __/ |  | | | | | | (_) \\__ \\ |_\n" +
	"|_|  |_|\\__,_|\\__|\\__\\___|_|  |_| |_| |_|\\___/|___/\\__|\n"

var SetupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Bootstrap a systemd install",
	Long: `Write /etc/mattermost/mattermost.env and point the service at PostgreSQL.

The command requires root on Linux. It never starts Mattermost and never enables the
service. Database configuration is the default. Pass --config-store file to write
/etc/mattermost/config.json instead.

On a new database it stores the configuration, initializes the schema, and saves the
Site URL. File storage, plugins, and logs are placed under /var. On an existing
database it keeps that installation's paths and only writes this host's env file
and systemd drop-in. When the mattermost user is missing, setup creates it.`,
	Example: `  sudo mattermost setup --database-url 'postgres://mmuser@db.example.com:5432/mattermost?sslmode=disable' --site-url https://mattermost.example.com

  sudo mattermost setup`,
	Args: cobra.NoArgs,
	// A child PersistentPreRun replaces the parent, which would otherwise warn about root.
	PersistentPreRun: func(_ *cobra.Command, _ []string) {},
	RunE:             setupCmdF,
}

func init() {
	SetupCmd.Flags().String("database-url", "", "PostgreSQL URL (postgres:// or postgresql://). Required when stdin is not a terminal.")
	SetupCmd.Flags().String("config-store", configStoreDatabase, "Where a new installation stores configuration: database or file.")
	SetupCmd.Flags().String("site-url", "", "Site URL for a new installation. Empty is valid.")
	SetupCmd.Flags().String("migrate-from", "", "Import this configuration file when the database has no active configuration row.")
	SetupCmd.Flags().String("env-file", defaultEnvFile, "systemd EnvironmentFile to write.")
	SetupCmd.Flags().Bool("non-interactive", false, "Fail instead of prompting. Creates the mattermost user when it is missing.")
	SetupCmd.Flags().Bool("no-create-user", false, "Stop when the mattermost user does not exist.")
	SetupCmd.Flags().Int("uid", 0, "uid for the mattermost user when setup creates it. An existing user is left unchanged.")
	SetupCmd.Flags().Bool("force", false, "Replace an env file that already points at a different database URL.")
	SetupCmd.Flags().Bool("dry-run", false, "Print the installation type and connectivity results, then stop before writing.")
	RootCmd.AddCommand(SetupCmd)
}

type setupOptions struct {
	DatabaseURL    string
	ConfigStore    string
	ConfigStoreSet bool
	SiteURL        string
	SiteURLSet     bool
	MigrateFrom    string
	EnvFile        string
	NonInteractive bool
	NoCreateUser   bool
	UID            int
	UIDSet         bool
	Force          bool
	DryRun         bool
}

type setupEnv struct {
	out                    io.Writer
	in                     *bufio.Reader
	stdin                  *os.File
	tty                    bool
	geteuid                func() int
	environ                []string
	installRoot            string
	paths                  systemdPaths
	serviceActive          func() bool
	lookupUser             func(string) (int, int, error)
	createUser             func(string, int) error
	state                  statePaths
	dial                   func(string) error
	inspect                func(string) (dbInspection, error)
	readActiveConfig       func(string) (*model.Config, bool, error)
	listPeers              func(string, string, int64) ([]clusterPeer, error)
	seedDatabase           func(string, string, string, bool) error
	initSchema             func(string) error
	updateStoredDataSource func(string) error
	readFileConfig         func(string) (*model.Config, error)
	writeFileConfig        func(string, string, string, int, int) error
	daemonReload           func() error
	binaryMigration        func() (int, error)
	hostname               func() (string, error)
	goos                   string
	bind                   func(string, string) error
	now                    func() time.Time
}

func productionSetupEnv() setupEnv {
	paths := defaultStatePaths()
	return setupEnv{
		out:              os.Stdout,
		in:               bufio.NewReader(os.Stdin),
		stdin:            os.Stdin,
		tty:              term.IsTerminal(int(os.Stdin.Fd())),
		geteuid:          os.Geteuid,
		environ:          os.Environ(),
		installRoot:      detectInstallRoot(),
		paths:            defaultSystemdPaths(),
		serviceActive:    mattermostServiceActive,
		lookupUser:       lookupServiceUser,
		createUser:       createServiceUser,
		state:            paths,
		dial:             dialTCP,
		inspect:          inspectDatabase,
		readActiveConfig: readActiveConfig,
		listPeers:        listClusterPeers,
		seedDatabase: func(dsn, migrateFrom, siteURL string, newInstallPaths bool) error {
			return seedDatabase(dsn, migrateFrom, siteURL, newInstallPaths, paths)
		},
		initSchema:             initSchema,
		updateStoredDataSource: updateStoredDataSource,
		readFileConfig:         readConfigFile,
		writeFileConfig: func(path, dsn, siteURL string, uid, gid int) error {
			return writeFileConfig(path, dsn, siteURL, uid, gid, paths)
		},
		daemonReload:    systemctlDaemonReload,
		binaryMigration: binaryLatestMigration,
		hostname:        os.Hostname,
		goos:            runtime.GOOS,
		bind:            bindAndClose,
		now:             time.Now,
	}
}

func setupCmdF(cmd *cobra.Command, _ []string) error {
	if cfg, _ := cmd.Flags().GetString("config"); cfg != "" {
		return errors.New("mattermost setup does not use --config; pass --database-url")
	}
	databaseURL, _ := cmd.Flags().GetString("database-url")
	configStore, _ := cmd.Flags().GetString("config-store")
	siteURL, _ := cmd.Flags().GetString("site-url")
	migrateFrom, _ := cmd.Flags().GetString("migrate-from")
	envFile, _ := cmd.Flags().GetString("env-file")
	nonInteractive, _ := cmd.Flags().GetBool("non-interactive")
	noCreateUser, _ := cmd.Flags().GetBool("no-create-user")
	uid, _ := cmd.Flags().GetInt("uid")
	force, _ := cmd.Flags().GetBool("force")
	dryRun, _ := cmd.Flags().GetBool("dry-run")

	return runSetup(setupOptions{
		DatabaseURL:    databaseURL,
		ConfigStore:    configStore,
		ConfigStoreSet: cmd.Flags().Changed("config-store"),
		SiteURL:        siteURL,
		SiteURLSet:     cmd.Flags().Changed("site-url"),
		MigrateFrom:    migrateFrom,
		EnvFile:        envFile,
		NonInteractive: nonInteractive,
		NoCreateUser:   noCreateUser,
		UID:            uid,
		UIDSet:         cmd.Flags().Changed("uid"),
		Force:          force,
		DryRun:         dryRun,
	}, productionSetupEnv())
}

func runSetup(opts setupOptions, env setupEnv) error {
	if env.goos != "linux" {
		return errors.New("mattermost setup is supported only on linux")
	}
	if env.geteuid() != 0 {
		return errors.New("mattermost setup must be run as root")
	}
	if keys := mmOverrides(env.environ); len(keys) > 0 {
		return errors.Errorf("unset %s and run setup again. Those values are applied on load and then stripped on save, so a Site URL or database URL written under them would not stick", strings.Join(keys, ", "))
	}
	if opts.EnvFile == "" {
		opts.EnvFile = defaultEnvFile
	}
	if opts.UIDSet && opts.UID <= 0 {
		return errors.New("--uid must be a positive user id")
	}
	if err := mmConfigConflict(env.paths, opts.EnvFile); err != nil {
		return err
	}

	env.printBanner()

	dsn, err := env.obtainDatabaseURL(opts)
	if err != nil {
		return err
	}
	if err := validateDatabaseURL(dsn); err != nil {
		return err
	}

	info, err := env.inspect(dsn)
	if err != nil {
		return err
	}
	for _, warning := range postgresWarnings(info.version, info.encoding) {
		env.warnf("%s", warning)
	}
	if info.hasMigrations {
		env.note("%s", existingInstallLine)
	} else {
		env.note("%s", newInstallationLine)
	}
	env.note("Database connectivity succeeded.")
	env.printDatabaseInfo(info)
	if needsPrivilegeProbe(info.hasMigrations) {
		env.note("Can create a table in the current schema.")
		if info.probeDropWarning != "" {
			env.warnf("%s", info.probeDropWarning)
		}
	}

	active, hasActive, err := env.readActiveConfig(dsn)
	if err != nil {
		return err
	}
	if info.hasMigrations && hasActive && opts.MigrateFrom != "" {
		return errors.New("an active configuration already exists; --migrate-from would overwrite it")
	}

	var imported *model.Config
	if opts.MigrateFrom != "" && !hasActive {
		imported, err = env.readFileConfig(opts.MigrateFrom)
		if err != nil {
			return err
		}
	}

	useDatabase, keepFile, err := env.chooseConfigStore(opts, info, hasActive)
	if err != nil {
		return err
	}

	checkCfg := configForChecks(info, hasActive, active, imported)
	if checkCfg == nil && keepFile != "" {
		checkCfg, err = env.readFileConfig(keepFile)
		if err != nil {
			return err
		}
	}

	if err := env.checkCluster(dsn, info, checkCfg); err != nil {
		return err
	}
	if opts.DryRun {
		env.note("Dry run stopped before writing files. Mattermost was not started.")
		return nil
	}

	uid, gid, err := env.ensureServiceUser(opts)
	if err != nil {
		return err
	}
	dirSpec := dirsFromConfig(checkCfg)
	if !info.hasMigrations {
		dirSpec = newInstallDirs(checkCfg, env.state)
	}
	if err := ensureRuntimeDirs(runtimeDirs(env.installRoot, dirSpec), uid, gid); err != nil {
		return err
	}
	env.note("The mattermost user can write the runtime directories.")
	if !info.hasMigrations {
		env.printStatePaths(dirSpec)
	}

	binaryVersion, err := env.binaryMigration()
	if err != nil {
		return err
	}
	schemaWarning, err := compareSchema(info.schemaVersion, info.hasMigrations, binaryVersion)
	if err != nil {
		return err
	}
	if schemaWarning != "" {
		env.warnf("%s", schemaWarning)
	} else if info.hasMigrations {
		env.note("Database schema is not newer than this binary.")
	}

	if err := env.checkListenPorts(info, checkCfg); err != nil {
		return err
	}

	siteURL := ""
	if !info.hasMigrations {
		siteURL, err = env.obtainSiteURL(opts)
		if err != nil {
			return err
		}
		for _, warning := range siteURLWarnings(siteURL) {
			env.warnf("%s", warning)
		}
	} else if opts.SiteURLSet && strings.TrimSpace(opts.SiteURL) != "" {
		env.note("This installation already has a Site URL. Ignoring --site-url.")
	}

	if !info.hasMigrations {
		if useDatabase {
			if err := env.seedDatabase(dsn, opts.MigrateFrom, siteURL, true); err != nil {
				return err
			}
			env.note("Configuration was stored in the database.")
		} else {
			if err := env.writeFileConfig(defaultFileConfig, dsn, siteURL, uid, gid); err != nil {
				return err
			}
			env.note("Configuration was written to %s.", defaultFileConfig)
		}
		if err := env.initSchema(dsn); err != nil {
			return err
		}
		env.note("Database schema was initialized.")
	} else if !hasActive && opts.MigrateFrom != "" {
		if err := env.seedDatabase(dsn, opts.MigrateFrom, "", false); err != nil {
			return err
		}
		env.note("Configuration was imported from %s. The stored DataSource is the setup URL.", opts.MigrateFrom)
	}

	mmConfig := dsn
	dataSource := dsn
	if !useDatabase {
		if !info.hasMigrations {
			mmConfig = defaultFileConfig
		} else {
			mmConfig = keepFile
		}
		dataSource = ""
	}

	previous, err := previousMMConfig(opts.EnvFile)
	if err != nil {
		return err
	}
	if useDatabase && hasActive {
		update, err := decideDataSourceUpdate(storedDataSource(active), true, previous, dsn, opts.Force)
		if err != nil {
			return err
		}
		if update {
			if err := env.updateStoredDataSource(dsn); err != nil {
				return err
			}
			env.note("Stored DataSource was updated to the setup URL.")
		}
	} else if _, err := decideDataSourceUpdate("", false, previous, mmConfig, opts.Force); err != nil {
		return err
	}

	shipped := filepath.Join(env.installRoot, "config", "config.json")
	if _, statErr := os.Stat(shipped); statErr == nil && filepath.Clean(shipped) != filepath.Clean(mmConfig) {
		env.warnf("%s is present and will not be read. The service uses MM_CONFIG from %s.", shipped, opts.EnvFile)
	}

	contents := renderEnvFile(mmConfig, dataSource)
	if err := writeEnvFile(opts.EnvFile, contents); err != nil {
		return err
	}
	env.note("Wrote %s (mode 0600).", opts.EnvFile)

	if err := installSystemd(env.paths, opts.EnvFile, env.daemonReload); err != nil {
		return err
	}
	env.note("systemd was reloaded. The service was not enabled or started.")
	env.note("Mattermost was not started.")
	if useDatabase {
		env.note("Run `systemctl enable --now mattermost`. It reads %s and does not use config.json.", opts.EnvFile)
	} else {
		env.note("Run `systemctl enable --now mattermost`. It reads %s and uses %s.", opts.EnvFile, mmConfig)
	}
	if !info.hasMigrations && siteURL != "" {
		env.note("Site URL: %s", siteURL)
	}
	if useDatabase {
		env.note("System Console shows DataSource as environment-controlled. To return to a file, migrate the database configuration back to a file and point MM_CONFIG at that file. Commenting MM_CONFIG out falls through to the shipped config.json.")
	}
	return nil
}

func (e setupEnv) printBanner() {
	fmt.Fprint(e.out, setupBanner)
	fmt.Fprintln(e.out)
	facts := collectSystemInfo()
	fmt.Fprint(e.out, formatInfoBox("System information", facts.rows))
	for _, warning := range facts.warnings {
		e.warnf("%s", warning)
	}
	fmt.Fprintln(e.out)
}

func (e setupEnv) printDatabaseInfo(info dbInspection) {
	if info.version == 0 && info.variant == "" {
		return
	}
	version := info.serverVersion
	if version == "" {
		version = formatPostgresVersion(info.version)
	}
	variant := info.variant
	if variant == "" {
		variant = "PostgreSQL"
	}
	rows := [][2]string{
		{"Version", version},
		{"Variant", variant},
	}
	if info.encoding != "" {
		rows = append(rows, [2]string{"Encoding", info.encoding})
	}
	fmt.Fprint(e.out, formatInfoBox("Database", rows))
}

func (e setupEnv) note(format string, args ...any) {
	fmt.Fprintf(e.out, "[+] "+format+"\n", args...)
}

func (e setupEnv) warnf(format string, args ...any) {
	fmt.Fprintf(e.out, "[!] "+format+"\n", args...)
}

func (e setupEnv) ask(prompt string) {
	fmt.Fprint(e.out, "[?] "+prompt)
}

func (e setupEnv) obtainDatabaseURL(opts setupOptions) (string, error) {
	dsn := strings.TrimSpace(opts.DatabaseURL)
	if dsn != "" {
		return dsn, nil
	}
	if !e.tty || opts.NonInteractive {
		return "", errors.New("database URL is required when stdin is not a terminal; pass --database-url")
	}
	e.ask("PostgreSQL URL (for example postgres://mmuser@db.example.com:5432/mattermost?sslmode=disable): ")
	if e.tty && e.stdin == os.Stdin {
		secret, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Fprintln(e.out)
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(secret)), nil
	}
	line, err := e.in.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func (e setupEnv) chooseConfigStore(opts setupOptions, info dbInspection, hasActive bool) (useDatabase bool, keepFile string, err error) {
	if !info.hasMigrations {
		store := opts.ConfigStore
		if !opts.ConfigStoreSet {
			store = configStoreDatabase
			if e.tty && !opts.NonInteractive {
				e.ask("Store configuration in the database or in a file? [database/file] (database): ")
				line, readErr := e.in.ReadString('\n')
				if readErr != nil && !errors.Is(readErr, io.EOF) {
					return false, "", readErr
				}
				if strings.TrimSpace(line) != "" {
					store = strings.TrimSpace(line)
				}
			}
		}
		chosen, err := validateConfigStore(store)
		if err != nil {
			return false, "", err
		}
		return chosen == configStoreDatabase, "", nil
	}

	if hasActive {
		if opts.ConfigStoreSet && opts.ConfigStore == configStoreFile {
			e.note("This installation already stores configuration in the database. Ignoring --config-store file.")
		}
		return true, "", nil
	}
	if opts.MigrateFrom != "" {
		return true, "", nil
	}
	if opts.ConfigStoreSet && strings.EqualFold(opts.ConfigStore, configStoreDatabase) {
		return false, "", errors.New("schema exists but there is no configuration in the database. Pass --migrate-from to import a file, or omit --config-store to keep the current file")
	}

	values, ok, err := readEnvValues(opts.EnvFile)
	if err != nil {
		return false, "", err
	}
	if ok {
		if previous := values["MM_CONFIG"]; previous != "" && !config.IsDatabaseDSN(previous) {
			if _, statErr := os.Stat(previous); statErr == nil {
				return false, previous, nil
			}
		}
	}
	if path, found := existingConfigFile(e.installRoot); found {
		return false, path, nil
	}
	return false, "", errors.Errorf("this is an existing installation and configuration is still a file, but no config.json was found under %s. Pass --migrate-from to import one", e.installRoot)
}

func configForChecks(info dbInspection, hasActive bool, active, imported *model.Config) *model.Config {
	if !info.hasMigrations {
		return imported
	}
	if hasActive {
		return active
	}
	return imported
}

func (e setupEnv) checkCluster(dsn string, info dbInspection, cfg *model.Config) error {
	if !info.hasMigrations {
		e.note("Skipping gossip port checks; there is no cluster yet.")
		return nil
	}
	if !clusterEnabled(cfg) {
		e.note("Clustering is disabled. Skipping gossip port checks.")
		return nil
	}
	port := gossipPort(cfg)
	since := e.now().UnixMilli() - model.CDSOfflineAfterMillis
	peers, err := e.listPeers(dsn, clusterName(cfg), since)
	if err != nil {
		return err
	}
	if len(peers) == 0 {
		e.note("Clustering is enabled on gossip port %d, but no peer is registered.", port)
		return nil
	}
	if err := dialPeers(peers, port, e.dial); err != nil {
		return err
	}
	e.note("Every registered peer accepted a TCP connection on its gossip port.")
	e.warnf("Outbound checks do not prove peers can open this host. Allow inbound TCP and UDP on the gossip port from every peer.")

	host, err := e.hostname()
	if err != nil {
		return err
	}
	if cfg != nil && cfg.ClusterSettings.OverrideHostname != nil && *cfg.ClusterSettings.OverrideHostname != "" {
		host = *cfg.ClusterSettings.OverrideHostname
	}
	for _, peer := range peers {
		if strings.EqualFold(peer.Hostname, host) {
			e.warnf("%s is already a live cluster peer. A replaced node can stay registered for 30 minutes.", host)
			break
		}
	}
	return nil
}

func (e setupEnv) checkListenPorts(info dbInspection, cfg *model.Config) error {
	if e.serviceActive() {
		e.note("mattermost.service is active. Skipping local port checks.")
		return nil
	}
	listen := listenAddress(cfg)
	if err := e.bind("tcp", listen); err != nil {
		return errors.Errorf("listen address %s is already in use: %s", listen, err.Error())
	}
	e.note("Listen address %s is free.", listen)
	if info.hasMigrations && clusterEnabled(cfg) {
		gossip := fmt.Sprintf(":%d", gossipPort(cfg))
		if err := e.bind("tcp", gossip); err != nil {
			return errors.Errorf("gossip port %s/tcp is already in use: %s", gossip, err.Error())
		}
		if err := e.bind("udp", gossip); err != nil {
			return errors.Errorf("gossip port %s/udp is already in use: %s", gossip, err.Error())
		}
		e.note("Gossip port %s is free on TCP and UDP.", gossip)
	}
	return nil
}

func (e setupEnv) obtainSiteURL(opts setupOptions) (string, error) {
	if opts.SiteURLSet || opts.NonInteractive || !e.tty {
		siteURL := strings.TrimSpace(opts.SiteURL)
		if err := validateSiteURL(siteURL); err != nil {
			return "", err
		}
		return siteURL, nil
	}
	for {
		e.ask("Site URL (for example https://mattermost.example.com), or leave empty to skip: ")
		line, err := e.in.ReadString('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return "", err
		}
		siteURL := strings.TrimSpace(line)
		if err := validateSiteURL(siteURL); err != nil {
			e.warnf("%s", err.Error())
			continue
		}
		return siteURL, nil
	}
}

func previousMMConfig(path string) (string, error) {
	values, ok, err := readEnvValues(path)
	if err != nil || !ok {
		return "", err
	}
	return values["MM_CONFIG"], nil
}

func dirsFromConfig(cfg *model.Config) *modelConfigDirs {
	if cfg == nil {
		return nil
	}
	dirs := &modelConfigDirs{}
	if cfg.FileSettings.Directory != nil {
		dirs.data = *cfg.FileSettings.Directory
	}
	if cfg.LogSettings.FileLocation != nil {
		dirs.logs = *cfg.LogSettings.FileLocation
	}
	if cfg.PluginSettings.Directory != nil {
		dirs.plugins = *cfg.PluginSettings.Directory
	}
	if cfg.PluginSettings.ClientDirectory != nil {
		dirs.clientPlugins = *cfg.PluginSettings.ClientDirectory
	}
	if cfg.FileSettings.ExportDirectory != nil {
		dirs.export = *cfg.FileSettings.ExportDirectory
	}
	return dirs
}

func listenAddress(cfg *model.Config) string {
	if cfg != nil && cfg.ServiceSettings.ListenAddress != nil && *cfg.ServiceSettings.ListenAddress != "" {
		return *cfg.ServiceSettings.ListenAddress
	}
	return model.ServiceSettingsDefaultListenAndAddress
}

func gossipPort(cfg *model.Config) int {
	if cfg != nil && cfg.ClusterSettings.GossipPort != nil && *cfg.ClusterSettings.GossipPort != 0 {
		return *cfg.ClusterSettings.GossipPort
	}
	return defaultGossipPort
}

func clusterEnabled(cfg *model.Config) bool {
	return cfg != nil && cfg.ClusterSettings.Enable != nil && *cfg.ClusterSettings.Enable
}

func clusterName(cfg *model.Config) string {
	if cfg != nil && cfg.ClusterSettings.ClusterName != nil {
		return *cfg.ClusterSettings.ClusterName
	}
	return ""
}

func storedDataSource(cfg *model.Config) string {
	if cfg == nil || cfg.SqlSettings.DataSource == nil {
		return ""
	}
	return *cfg.SqlSettings.DataSource
}

func (e setupEnv) printStatePaths(spec *modelConfigDirs) {
	if spec == nil {
		return
	}
	e.note("File storage: %s", resolveUnderRoot(e.installRoot, spec.data))
	e.note("Logs: %s", resolveUnderRoot(e.installRoot, spec.logs))
	e.note("Plugins: %s", resolveUnderRoot(e.installRoot, spec.plugins))
	e.note("Client plugins: %s", resolveUnderRoot(e.installRoot, spec.clientPlugins))
}

func (e setupEnv) ensureServiceUser(opts setupOptions) (int, int, error) {
	uid, gid, err := e.lookupUser(mattermostUser)
	if err == nil {
		if opts.UIDSet && uid != opts.UID {
			e.warnf("User %s already exists with uid %d. Leaving it unchanged.", mattermostUser, uid)
		}
		return uid, gid, nil
	}
	if _, missing := err.(user.UnknownUserError); !missing {
		return 0, 0, err
	}
	if opts.NoCreateUser {
		return 0, 0, errors.Errorf("user %s does not exist. Re-run without --no-create-user to create it", mattermostUser)
	}
	if e.tty && !opts.NonInteractive {
		e.ask("Create the system user and group 'mattermost'? [Y/n]: ")
		line, readErr := e.in.ReadString('\n')
		if readErr != nil && !errors.Is(readErr, io.EOF) {
			return 0, 0, readErr
		}
		if !affirmDefaultYes(line) {
			return 0, 0, errors.Errorf("user %s does not exist", mattermostUser)
		}
	}
	if e.createUser == nil {
		return 0, 0, errors.New("cannot create the mattermost user")
	}
	if err := e.createUser(mattermostUser, opts.UID); err != nil {
		return 0, 0, err
	}
	e.note("Created system user and group %s.", mattermostUser)
	return e.lookupUser(mattermostUser)
}

func affirmDefaultYes(line string) bool {
	switch strings.ToLower(strings.TrimSpace(line)) {
	case "", "y", "yes":
		return true
	default:
		return false
	}
}

func lookupServiceUser(name string) (int, int, error) {
	account, err := user.Lookup(name)
	if err != nil {
		return 0, 0, err
	}
	uid, err := strconv.Atoi(account.Uid)
	if err != nil {
		return 0, 0, err
	}
	gid, err := strconv.Atoi(account.Gid)
	if err != nil {
		return 0, 0, err
	}
	return uid, gid, nil
}

func createServiceUser(name string, uid int) error {
	args := []string{
		"--system",
		"--user-group",
		"--home-dir", mattermostHome,
		"--shell", nologinShell(),
	}
	if uid > 0 {
		args = append(args, "--uid", strconv.Itoa(uid))
	}
	args = append(args, name)
	out, err := exec.Command(useraddBinary(), args...).CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return errors.Errorf("useradd %s: %s", name, msg)
	}
	return nil
}

func useraddBinary() string {
	for _, path := range []string{"/usr/sbin/useradd", "/sbin/useradd"} {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return "useradd"
}

func nologinShell() string {
	for _, path := range []string{"/usr/sbin/nologin", "/sbin/nologin"} {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return "/usr/sbin/nologin"
}

func mattermostServiceActive() bool {
	return exec.Command("systemctl", "is-active", "--quiet", "mattermost").Run() == nil
}

func systemctlDaemonReload() error {
	out, err := exec.Command("systemctl", "daemon-reload").CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return errors.Errorf("systemctl daemon-reload: %s", msg)
	}
	return nil
}

func dialTCP(addr string) error {
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return err
	}
	return conn.Close()
}
