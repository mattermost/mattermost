// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Server for Focalboard
package main

import (
	"C"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/server"
	"github.com/mattermost/mattermost-server/v6/boards/services/config"
	"github.com/mattermost/mattermost-server/v6/boards/services/permissions/localpermissions"
)
import (
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

// Active server used with shared code (dll)
var pServer *server.Server

const (
	timeBetweenPidMonitoringChecks = 2 * time.Second
)

func isProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	err = process.Signal(syscall.Signal(0))

	return err == nil
}

// monitorPid is used to keep the server lifetime in sync with another (client app) process
func monitorPid(pid int, logger *mlog.Logger) {
	logger.Info("Monitoring PID", mlog.Int("pid", pid))

	go func() {
		for {
			if !isProcessRunning(pid) {
				logger.Info("Monitored process not found, exiting.")
				os.Exit(1)
			}

			time.Sleep(timeBetweenPidMonitoringChecks)
		}
	}()
}

func main() {
	// Command line args
	pMonitorPid := flag.Int("monitorpid", -1, "a process ID")
	pPort := flag.Int("port", 0, "the port number")
	pSingleUser := flag.Bool("single-user", false, "single user mode")
	pDBType := flag.String("dbtype", "", "Database type")
	pDBConfig := flag.String("dbconfig", "", "Database config")
	pConfigFilePath := flag.String(
		"config",
		"",
		"Location of the JSON config file",
	)
	flag.Parse()

	config, err := config.ReadConfigFile(*pConfigFilePath)
	if err != nil {
		log.Fatal("Unable to read the config file: ", err)
		return
	}

	logger, _ := mlog.NewLogger()
	cfgJSON := config.LoggingCfgJSON
	if config.LoggingCfgFile == "" && cfgJSON == "" {
		// if no logging defined, use default config (console output)
		cfgJSON = defaultLoggingConfig()
	}
	err = logger.Configure(config.LoggingCfgFile, cfgJSON, nil)
	if err != nil {
		log.Fatal("Error in config file for logger: ", err)
		return
	}
	defer func() { _ = logger.Shutdown() }()

	if logger.HasTargets() {
		restore := logger.RedirectStdLog(mlog.LvlInfo, mlog.String("src", "stdlog"))
		defer restore()
	}

	model.LogServerInfo(logger)

	singleUser := false
	if pSingleUser != nil {
		singleUser = *pSingleUser
	}

	singleUserToken := ""
	if singleUser {
		singleUserToken = os.Getenv("FOCALBOARD_SINGLE_USER_TOKEN")
		if len(singleUserToken) < 1 {
			logger.Fatal("The FOCALBOARD_SINGLE_USER_TOKEN environment variable must be set for single user mode ")
			return
		}
		logger.Info("Single user mode")
	}

	if pMonitorPid != nil && *pMonitorPid > 0 {
		monitorPid(*pMonitorPid, logger)
	}

	// Override config from commandline

	if pDBType != nil && *pDBType != "" {
		config.DBType = *pDBType
		logger.Info("DBType from commandline", mlog.String("DBType", *pDBType))
	}

	if pDBConfig != nil && *pDBConfig != "" {
		config.DBConfigString = *pDBConfig
		// Don't echo, as the confix string may contain passwords
		logger.Info("DBConfigString overridden from commandline")
	}

	if pPort != nil && *pPort > 0 && *pPort != config.Port {
		// Override port
		logger.Info("Port from commandline", mlog.Int("port", *pPort))
		config.Port = *pPort
	}

	db, err := server.NewStore(config, singleUser, logger)
	if err != nil {
		logger.Fatal("server.NewStore ERROR", mlog.Err(err))
	}

	permissionsService := localpermissions.New(db, logger)

	params := server.Params{
		Cfg:                config,
		SingleUserToken:    singleUserToken,
		DBStore:            db,
		Logger:             logger,
		PermissionsService: permissionsService,
	}

	server, err := server.New(params)
	if err != nil {
		logger.Fatal("server.New ERROR", mlog.Err(err))
	}

	if err := server.Start(); err != nil {
		logger.Fatal("server.Start ERROR", mlog.Err(err))
	}

	// Setting up signal capturing
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	// Waiting for SIGINT (pkill -2)
	<-stop

	_ = server.Shutdown()
}

// StartServer starts the server
//
//export StartServer
func StartServer(webPath *C.char, filesPath *C.char, port int, singleUserToken, dbConfigString, configFilePath *C.char) {
	startServer(
		C.GoString(webPath),
		C.GoString(filesPath),
		port,
		C.GoString(singleUserToken),
		C.GoString(dbConfigString),
		C.GoString(configFilePath),
	)
}

// StopServer stops the server
//
//export StopServer
func StopServer() {
	stopServer()
}

func startServer(webPath string, filesPath string, port int, singleUserToken, dbConfigString, configFilePath string) {
	if pServer != nil {
		stopServer()
		pServer = nil
	}

	// config.json file
	config, err := config.ReadConfigFile(configFilePath)
	if err != nil {
		log.Fatal("Unable to read the config file: ", err)
		return
	}

	logger, _ := mlog.NewLogger()
	err = logger.Configure(config.LoggingCfgFile, config.LoggingCfgJSON, nil)
	if err != nil {
		log.Fatal("Error in config file for logger: ", err)
		return
	}

	model.LogServerInfo(logger)

	if filesPath != "" {
		config.FilesPath = filesPath
	}

	if webPath != "" {
		config.WebPath = webPath
	}

	if port > 0 {
		config.Port = port
	}

	if dbConfigString != "" {
		config.DBConfigString = dbConfigString
	}

	singleUser := singleUserToken != ""
	db, err := server.NewStore(config, singleUser, logger)
	if err != nil {
		logger.Fatal("server.NewStore ERROR", mlog.Err(err))
	}

	permissionsService := localpermissions.New(db, logger)

	params := server.Params{
		Cfg:                config,
		SingleUserToken:    singleUserToken,
		DBStore:            db,
		Logger:             logger,
		PermissionsService: permissionsService,
	}

	pServer, err = server.New(params)
	if err != nil {
		logger.Fatal("server.New ERROR", mlog.Err(err))
	}

	if err := pServer.Start(); err != nil {
		logger.Fatal("server.Start ERROR", mlog.Err(err))
	}
}

func stopServer() {
	if pServer == nil {
		return
	}

	logger := pServer.Logger()

	err := pServer.Shutdown()
	if err != nil {
		logger.Error("server.Shutdown ERROR", mlog.Err(err))
	}

	if l, ok := logger.(*mlog.Logger); ok {
		_ = l.Shutdown()
	}
	pServer = nil
}

func defaultLoggingConfig() string {
	return `
	{
		"def": {
			"type": "console",
			"options": {
				"out": "stdout"
			},
			"format": "plain",
			"format_options": {
				"delim": " ",
				"min_level_len": 5,
				"min_msg_len": 40,
				"enable_color": true,
				"enable_caller": true
			},
			"levels": [
				{"id": 5, "name": "debug"},
				{"id": 4, "name": "info", "color": 36},
				{"id": 3, "name": "warn"},
				{"id": 2, "name": "error", "color": 31},
				{"id": 1, "name": "fatal", "stacktrace": true},
				{"id": 0, "name": "panic", "stacktrace": true}
			]
		}
	}`
}
