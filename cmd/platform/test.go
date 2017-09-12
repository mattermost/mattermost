// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"

	"os/signal"
	"syscall"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/wsapi"
	"github.com/spf13/cobra"
)

var testCmd = &cobra.Command{
	Use:    "test",
	Short:  "Testing Commands",
	Hidden: true,
}

var runWebClientTestsCmd = &cobra.Command{
	Use:   "web_client_tests",
	Short: "Run the web client tests",
	RunE:  webClientTestsCmdF,
}

var runServerForWebClientTestsCmd = &cobra.Command{
	Use:   "web_client_tests_server",
	Short: "Run the server configured for running the web client tests against it",
	RunE:  serverForWebClientTestsCmdF,
}

func init() {
	testCmd.AddCommand(
		runWebClientTestsCmd,
		runServerForWebClientTestsCmd,
	)
}

func webClientTestsCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	utils.InitTranslations(utils.Cfg.LocalizationSettings)
	a.Srv.Router = api.NewRouter()
	wsapi.InitRouter()
	api4.InitApi(a.Srv.Router, false)
	api.InitApi(a.Srv.Router)
	wsapi.InitApi()
	setupClientTests()
	a.StartServer()
	runWebClientTests()
	a.StopServer()

	return nil
}

func serverForWebClientTestsCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	utils.InitTranslations(utils.Cfg.LocalizationSettings)
	a.Srv.Router = api.NewRouter()
	wsapi.InitRouter()
	api4.InitApi(a.Srv.Router, false)
	api.InitApi(a.Srv.Router)
	wsapi.InitApi()
	setupClientTests()
	a.StartServer()

	c := make(chan os.Signal)
	signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-c

	a.StopServer()

	return nil
}

func setupClientTests() {
	*utils.Cfg.TeamSettings.EnableOpenServer = true
	*utils.Cfg.ServiceSettings.EnableCommands = false
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false
	utils.SetDefaultRolesBasedOnConfig()
}

func executeTestCommand(cmd *exec.Cmd) {
	cmdOutPipe, err := cmd.StdoutPipe()
	if err != nil {
		CommandPrintErrorln("Failed to run tests")
		os.Exit(1)
		return
	}

	cmdErrOutPipe, err := cmd.StderrPipe()
	if err != nil {
		CommandPrintErrorln("Failed to run tests")
		os.Exit(1)
		return
	}

	cmdOutReader := bufio.NewScanner(cmdOutPipe)
	cmdErrOutReader := bufio.NewScanner(cmdErrOutPipe)
	go func() {
		for cmdOutReader.Scan() {
			fmt.Println(cmdOutReader.Text())
		}
	}()

	go func() {
		for cmdErrOutReader.Scan() {
			fmt.Println(cmdErrOutReader.Text())
		}
	}()

	if err := cmd.Run(); err != nil {
		CommandPrintErrorln("Client Tests failed")
		os.Exit(1)
		return
	}
}

func runWebClientTests() {
	os.Chdir("webapp")
	cmd := exec.Command("npm", "test")
	executeTestCommand(cmd)
}
