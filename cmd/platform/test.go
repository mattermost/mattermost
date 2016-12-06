// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"

	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/utils"
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

func init() {
	testCmd.AddCommand(
		runWebClientTestsCmd,
	)
}

func webClientTestsCmdF(cmd *cobra.Command, args []string) error {
	initDBCommandContextCobra(cmd)
	utils.InitTranslations(utils.Cfg.LocalizationSettings)
	api.InitRouter()
	api.InitApi()
	setupClientTests()
	api.StartServer()
	runWebClientTests()
	api.StopServer()

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
		return
	}

	cmdOutReader := bufio.NewScanner(cmdOutPipe)
	go func() {
		for cmdOutReader.Scan() {
			fmt.Println(cmdOutReader.Text())
		}
	}()

	if err := cmd.Run(); err != nil {
		CommandPrintErrorln("Client Tests failed")
		return
	}
}

func runWebClientTests() {
	os.Chdir("webapp")
	cmd := exec.Command("npm", "test")
	executeTestCommand(cmd)
}
