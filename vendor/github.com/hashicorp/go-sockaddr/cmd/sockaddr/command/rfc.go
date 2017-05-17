package command

import (
	"flag"
	"fmt"
	"strconv"

	"github.com/hashicorp/errwrap"
	sockaddr "github.com/hashicorp/go-sockaddr"
	"github.com/mitchellh/cli"
)

type RFCCommand struct {
	Ui cli.Ui

	// flags is a list of options belonging to this command
	flags *flag.FlagSet

	// silentMode prevents any output and only returns exit code 1 when the
	// IP address is NOT a member of the known RFC.  Unknown RFCs return a
	// status code of 2.
	silentMode bool
}

// Description is the long-form command help.
func (c *RFCCommand) Description() string {
	return `Tests a given IP address to see if it is part of a known RFC.  If the IP address belongs to a known RFC, return exit code 0 and print the status.  If the IP does not belong to an RFC, return 1.  If the RFC is not known, return 2.`
}

// Help returns the full help output expected by `sockaddr -h cmd`
func (c *RFCCommand) Help() string {
	return MakeHelp(c)
}

// InitOpts is responsible for setup of this command's configuration via the
// command line.  InitOpts() does not parse the arguments (see parseOpts()).
func (c *RFCCommand) InitOpts() {
	c.flags = flag.NewFlagSet("rfc", flag.ContinueOnError)
	c.flags.Usage = func() { c.Ui.Output(c.Help()) }
	c.flags.BoolVar(&c.silentMode, "s", false, "Silent, only return different exit codes")
}

// Run executes this command.
func (c *RFCCommand) Run(args []string) int {
	if len(args) == 0 {
		c.Ui.Error(c.Help())
		return 1
	}

	c.InitOpts()
	unprocessedArgs, err := c.parseOpts(args)
	if err != nil {
		if errwrap.Contains(err, "flag: help requested") {
			return 0
		}
		return 1
	}

	switch numArgs := len(unprocessedArgs); {
	case numArgs != 2 && numArgs != 0:
		c.Ui.Error(`ERROR: Need an RFC Number and an IP address to test.`)
		c.Ui.Error(c.Help())
		fallthrough
	case numArgs == 0:
		return 1
	}

	// Parse the RFC Number
	rfcNum, err := strconv.ParseUint(unprocessedArgs[0], 10, 32)
	if err != nil {
		c.Ui.Error(fmt.Sprintf("ERROR: Invalid RFC Number %+q: %v", unprocessedArgs[0], err))
		return 2
	}

	// Parse the IP address
	ipAddr, err := sockaddr.NewIPAddr(unprocessedArgs[1])
	if err != nil {
		c.Ui.Error(fmt.Sprintf("ERROR: Invalid IP address %+q: %v", unprocessedArgs[1], err))
		return 3
	}

	switch inRFC := sockaddr.IsRFC(uint(rfcNum), ipAddr); {
	case inRFC && !c.silentMode:
		c.Ui.Output(fmt.Sprintf("%s is part of RFC %d", ipAddr, rfcNum))
		fallthrough
	case inRFC:
		return 0
	case !inRFC && !c.silentMode:
		c.Ui.Output(fmt.Sprintf("%s is not part of RFC %d", ipAddr, rfcNum))
		fallthrough
	case !inRFC:
		return 1
	default:
		panic("bad")
	}
}

// Synopsis returns a terse description used when listing sub-commands.
func (c *RFCCommand) Synopsis() string {
	return `Test to see if an IP is part of a known RFC`
}

// Usage is the one-line usage description
func (c *RFCCommand) Usage() string {
	return `sockaddr rfc [RFC Number] [IP Address]`
}

// VisitAllFlags forwards the visitor function to the FlagSet
func (c *RFCCommand) VisitAllFlags(fn func(*flag.Flag)) {
	c.flags.VisitAll(fn)
}

// parseOpts is responsible for parsing the options set in InitOpts().  Returns
// a list of non-parsed flags.
func (c *RFCCommand) parseOpts(args []string) ([]string, error) {
	if err := c.flags.Parse(args); err != nil {
		return nil, err
	}

	return c.flags.Args(), nil
}
