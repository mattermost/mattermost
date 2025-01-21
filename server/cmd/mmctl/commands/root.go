// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func Run(args []string) error {
	viper.SetEnvPrefix("mmctl")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.SetDefault("local-socket-path", model.LocalModeSocketPath)
	viper.AutomaticEnv()

	RootCmd.PersistentFlags().String("config", filepath.Join(xdgConfigHomeVar, configParent, configFileName), "path to the configuration file")
	_ = viper.BindPFlag("config", RootCmd.PersistentFlags().Lookup("config"))
	RootCmd.PersistentFlags().String("config-path", xdgConfigHomeVar, "path to the configuration directory.")
	_ = viper.BindPFlag("config-path", RootCmd.PersistentFlags().Lookup("config-path"))
	_ = RootCmd.PersistentFlags().MarkHidden("config-path")
	RootCmd.PersistentFlags().Bool("suppress-warnings", false, "disables printing warning messages")
	_ = viper.BindPFlag("suppress-warnings", RootCmd.PersistentFlags().Lookup("suppress-warnings"))
	RootCmd.PersistentFlags().String("format", "plain", "the format of the command output [plain, json]")
	_ = viper.BindPFlag("format", RootCmd.PersistentFlags().Lookup("format"))
	_ = RootCmd.PersistentFlags().MarkHidden("format")
	RootCmd.PersistentFlags().Bool("json", false, "the output format will be in json format")
	_ = viper.BindPFlag("json", RootCmd.PersistentFlags().Lookup("json"))
	RootCmd.PersistentFlags().Bool("strict", false, "will only run commands if the mmctl version matches the server one")
	_ = viper.BindPFlag("strict", RootCmd.PersistentFlags().Lookup("strict"))
	RootCmd.PersistentFlags().Bool("insecure-sha1-intermediate", false, "allows to use insecure TLS protocols, such as SHA-1")
	_ = viper.BindPFlag("insecure-sha1-intermediate", RootCmd.PersistentFlags().Lookup("insecure-sha1-intermediate"))
	RootCmd.PersistentFlags().Bool("insecure-tls-version", false, "allows to use TLS versions 1.0 and 1.1")
	_ = viper.BindPFlag("insecure-tls-version", RootCmd.PersistentFlags().Lookup("insecure-tls-version"))
	RootCmd.PersistentFlags().Bool("local", false, "allows communicating with the server through a unix socket")
	_ = viper.BindPFlag("local", RootCmd.PersistentFlags().Lookup("local"))
	RootCmd.PersistentFlags().Bool("short-stat", false, "short stat will provide useful statistical data")
	_ = RootCmd.PersistentFlags().MarkHidden("short-stat")
	RootCmd.PersistentFlags().Bool("no-stat", false, "the statistical data won't be displayed")
	_ = RootCmd.PersistentFlags().MarkHidden("no-stat")
	RootCmd.PersistentFlags().Bool("disable-pager", false, "disables paged output")
	_ = viper.BindPFlag("disable-pager", RootCmd.PersistentFlags().Lookup("disable-pager"))
	RootCmd.PersistentFlags().Bool("quiet", false, "prevent mmctl to generate output for the commands")
	_ = viper.BindPFlag("quiet", RootCmd.PersistentFlags().Lookup("quiet"))

	RootCmd.SetArgs(args)

	defer func() {
		if x := recover(); x != nil {
			printPanic(x)

			_ = printer.Flush()
			os.Exit(1)
		}
	}()

	return RootCmd.Execute()
}

func printPanic(x any) {
	u, err := url.Parse("https://github.com/mattermost/mattermost/issues/new")
	if err != nil {
		panic(err)
	}

	q := u.Query()
	q.Add("title", "[mmctl] [bug] panic on v"+Version)
	q.Add("body", "<!--- Please provide the stack trace -->\n")
	u.RawQuery = q.Encode()

	printer.PrintError("Uh oh! Something unexpected happened :( Would you mind reporting it?")
	printer.PrintError(u.String() + "\n")
	printer.PrintError(fmt.Sprintf("%s", x))
	printer.PrintError(string(debug.Stack()))
}

var RootCmd = &cobra.Command{
	Use:               "mmctl",
	Short:             "Remote client for the Open Source, self-hosted Slack-alternative",
	Long:              `Mattermost offers workplace messaging across web, PC and phones with archiving, search and integration with your existing systems. Documentation available at https://docs.mattermost.com`,
	DisableAutoGenTag: true,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		for i, arg := range args {
			args[i] = strings.TrimSpace(arg)
		}
		format := viper.GetString("format")
		if viper.GetBool("disable-pager") {
			printer.OverrideEnablePager(false)
		}

		printer.SetCommand(cmd)
		isJSON := viper.GetBool("json")
		if isJSON || format == printer.FormatJSON {
			printer.SetFormat(printer.FormatJSON)
		} else {
			printer.SetFormat(printer.FormatPlain)
		}
		quiet := viper.GetBool("quiet")
		printer.SetQuiet(quiet)

		perPage, err := cmd.Flags().GetInt("per-page")
		if err == nil && perPage > MaxPageSize {
			printer.PrintError(fmt.Sprintf("Per page value is greater than the maximum allowed. Mattermost might only return %d items.", MaxPageSize))
		}
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		_ = printer.Flush()
	},
	SilenceUsage: true,
}
