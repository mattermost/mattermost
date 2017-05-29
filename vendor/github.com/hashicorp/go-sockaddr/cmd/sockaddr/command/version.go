package command

import (
	"fmt"

	"github.com/mitchellh/cli"
)

// VersionCommand is a Command implementation prints the version.
type VersionCommand struct {
	HumanVersion string
	Ui           cli.Ui
}

func (c *VersionCommand) Help() string {
	return ""
}

func (c *VersionCommand) Run(_ []string) int {
	c.Ui.Output(fmt.Sprintf("sockaddr %s", c.HumanVersion))

	return 0
}

func (c *VersionCommand) Synopsis() string {
	return "Prints the sockaddr version"
}
