package command

import (
	"flag"
	"fmt"
	"sort"

	"github.com/hashicorp/errwrap"
	sockaddr "github.com/hashicorp/go-sockaddr"
	"github.com/mitchellh/cli"
)

type RFCListCommand struct {
	Ui cli.Ui

	// flags is a list of options belonging to this command
	flags *flag.FlagSet
}

// Description is the long-form command help.
func (c *RFCListCommand) Description() string {
	return `Lists all known RFCs.`
}

// Help returns the full help output expected by `sockaddr -h cmd`
func (c *RFCListCommand) Help() string {
	return MakeHelp(c)
}

// InitOpts is responsible for setup of this command's configuration via the
// command line.  InitOpts() does not parse the arguments (see parseOpts()).
func (c *RFCListCommand) InitOpts() {
	c.flags = flag.NewFlagSet("list", flag.ContinueOnError)
	c.flags.Usage = func() { c.Ui.Output(c.Help()) }
}

type rfcNums []uint

func (s rfcNums) Len() int           { return len(s) }
func (s rfcNums) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s rfcNums) Less(i, j int) bool { return s[i] < s[j] }

// Run executes this command.
func (c *RFCListCommand) Run(args []string) int {
	if len(args) != 0 {
		c.Ui.Error(c.Help())
		return 1
	}

	c.InitOpts()
	_, err := c.parseOpts(args)
	if err != nil {
		if errwrap.Contains(err, "flag: help requested") {
			return 0
		}
		return 1
	}

	var rfcs rfcNums
	sockaddr.VisitAllRFCs(func(rfcNum uint, sas sockaddr.SockAddrs) {
		rfcs = append(rfcs, rfcNum)
	})

	sort.Sort(rfcs)

	for _, rfcNum := range rfcs {
		c.Ui.Output(fmt.Sprintf("%d", rfcNum))
	}

	return 0
}

// Synopsis returns a terse description used when listing sub-commands.
func (c *RFCListCommand) Synopsis() string {
	return `Lists all known RFCs`
}

// Usage is the one-line usage description
func (c *RFCListCommand) Usage() string {
	return `sockaddr rfc list`
}

// VisitAllFlags forwards the visitor function to the FlagSet
func (c *RFCListCommand) VisitAllFlags(fn func(*flag.Flag)) {
	c.flags.VisitAll(fn)
}

func (c *RFCListCommand) parseOpts(args []string) ([]string, error) {
	if err := c.flags.Parse(args); err != nil {
		return nil, err
	}

	return c.flags.Args(), nil
}
