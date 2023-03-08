// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/api4"
	"github.com/mattermost/mattermost-server/v6/server/channels/app"
	"github.com/mattermost/mattermost-server/v6/server/channels/wsapi"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/i18n"
)

var TestCmd = &cobra.Command{
	Use:    "test",
	Short:  "Testing Commands",
	Hidden: true,
}

var RunWebClientTestsCmd = &cobra.Command{
	Use:   "web_client_tests",
	Short: "Run the web client tests",
	RunE:  webClientTestsCmdF,
}

var RunServerForWebClientTestsCmd = &cobra.Command{
	Use:   "web_client_tests_server",
	Short: "Run the server configured for running the web client tests against it",
	RunE:  serverForWebClientTestsCmdF,
}

func init() {
	TestCmd.AddCommand(
		RunWebClientTestsCmd,
		RunServerForWebClientTestsCmd,
	)
	RootCmd.AddCommand(TestCmd)
}

func webClientTestsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command, app.StartMetrics)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	i18n.InitTranslations(*a.Config().LocalizationSettings.DefaultServerLocale, *a.Config().LocalizationSettings.DefaultClientLocale)
	serverErr := a.Srv().Start()
	if serverErr != nil {
		return serverErr
	}

	_, err = api4.Init(a.Srv())
	if err != nil {
		return err
	}
	wsapi.Init(a.Srv())
	a.UpdateConfig(setupClientTests)
	runWebClientTests()

	return nil
}

func serverForWebClientTestsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command, app.StartMetrics)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	i18n.InitTranslations(*a.Config().LocalizationSettings.DefaultServerLocale, *a.Config().LocalizationSettings.DefaultClientLocale)
	serverErr := a.Srv().Start()
	if serverErr != nil {
		return serverErr
	}

	_, err = api4.Init(a.Srv())
	if err != nil {
		return err
	}
	wsapi.Init(a.Srv())
	a.UpdateConfig(setupClientTests)

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-c

	return nil
}

func setupClientTests(cfg *model.Config) {
	*cfg.TeamSettings.EnableOpenServer = true
	*cfg.ServiceSettings.EnableCommands = false
	*cfg.ServiceSettings.EnableCustomEmoji = true
	*cfg.ServiceSettings.EnableIncomingWebhooks = false
	*cfg.ServiceSettings.EnableOutgoingWebhooks = false
}

func executeTestCommand(command *exec.Cmd) {
	cmdOutPipe, err := command.StdoutPipe()
	if err != nil {
		CommandPrintErrorln("Failed to run tests")
		os.Exit(1)
		return
	}

	cmdErrOutPipe, err := command.StderrPipe()
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

	if err := command.Run(); err != nil {
		CommandPrintErrorln("Client Tests failed")
		os.Exit(1)
		return
	}
}

func runWebClientTests() {
	if webappDir := os.Getenv("WEBAPP_DIR"); webappDir != "" {
		os.Chdir(webappDir)
	} else {
		os.Chdir("../mattermost-webapp")
	}

	cmd := exec.Command("npm", "test")
	executeTestCommand(cmd)
}
