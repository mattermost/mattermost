package main

import (
	"os"

	"github.com/hashicorp/go-sockaddr/cmd/sockaddr/command"
	"github.com/mitchellh/cli"
)

// Commands is the mapping of all the available CLI commands.
var Commands map[string]cli.CommandFactory

func init() {
	ui := &cli.BasicUi{Writer: os.Stdout}

	Commands = map[string]cli.CommandFactory{
		"dump": func() (cli.Command, error) {
			return &command.DumpCommand{
				Ui: ui,
			}, nil
		},
		"eval": func() (cli.Command, error) {
			return &command.EvalCommand{
				Ui: ui,
			}, nil
		},
		"rfc": func() (cli.Command, error) {
			return &command.RFCCommand{
				Ui: ui,
			}, nil
		},
		"rfc list": func() (cli.Command, error) {
			return &command.RFCListCommand{
				Ui: ui,
			}, nil
		},
		"tech-support": func() (cli.Command, error) {
			return &command.TechSupportCommand{
				Ui: ui,
			}, nil
		},
		"version": func() (cli.Command, error) {
			return &command.VersionCommand{
				HumanVersion: GetHumanVersion(),
				Ui:           ui,
			}, nil
		},
	}
}
