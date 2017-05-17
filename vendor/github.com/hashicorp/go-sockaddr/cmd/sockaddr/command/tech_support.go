package command

import (
	"flag"
	"fmt"
	"net"
	"os/exec"
	"runtime"

	"github.com/hashicorp/errwrap"
	sockaddr "github.com/hashicorp/go-sockaddr"
	"github.com/mitchellh/cli"
)

type TechSupportCommand struct {
	Ui cli.Ui

	// outputMode controls the type of output encoding.
	outputMode string

	// flags is a list of options belonging to this command
	flags *flag.FlagSet
}

// Description is the long-form command help.
func (c *TechSupportCommand) Description() string {
	return `Print out network diagnostic information that can be used by support.

` + "The `sockaddr` library relies on OS-specific commands and output which can potentially be " +
		"brittle.  The `tech-support` subcommand emits all of the platform-specific " +
		"network details required to debug why a given `sockaddr` API call is behaving " +
		"differently than expected.  The `-output` flag controls the output format. " +
		"The default output mode is Markdown (`md`) however a raw mode (`raw`) is " +
		"available to obtain the original output."
}

// Help returns the full help output expected by `sockaddr -h cmd`
func (c *TechSupportCommand) Help() string {
	return MakeHelp(c)
}

// InitOpts is responsible for setup of this command's configuration via the
// command line.  InitOpts() does not parse the arguments (see parseOpts()).
func (c *TechSupportCommand) InitOpts() {
	c.flags = flag.NewFlagSet("tech-support", flag.ContinueOnError)
	c.flags.Usage = func() { c.Ui.Output(c.Help()) }
	c.flags.StringVar(&c.outputMode, "output", "md", `Encode the output using one of Markdown ("md") or Raw ("raw")`)
}

// Run executes this command.
func (c *TechSupportCommand) Run(args []string) int {
	c.InitOpts()
	rest, err := c.parseOpts(args)
	if err != nil {
		if errwrap.Contains(err, "flag: help requested") {
			return 0
		}
		return 1
	}
	if len(rest) != 0 {
		c.Ui.Error(c.Help())
		return 1
	}

	ri, err := sockaddr.NewRouteInfo()
	if err != nil {
		c.Ui.Error(fmt.Sprintf("error loading route information: %v", err))
		return 1
	}

	const initNumCmds = 4
	type cmdResult struct {
		cmd []string
		out string
	}
	output := make(map[string]cmdResult, initNumCmds)
	ri.VisitCommands(func(name string, cmd []string) {
		out, err := exec.Command(cmd[0], cmd[1:]...).Output()
		if err != nil {
			out = []byte(fmt.Sprintf("ERROR: command %q failed: %v", name, err))
		}

		output[name] = cmdResult{
			cmd: cmd,
			out: string(out),
		}
	})

	out := c.rowWriterOutputFactory()

	for cmdName, result := range output {
		switch c.outputMode {
		case "md":
			c.Ui.Output(fmt.Sprintf("## cmd: `%s`", cmdName))
			c.Ui.Output("")
			c.Ui.Output(fmt.Sprintf("Command: `%#v`", result.cmd))
			c.Ui.Output("```")
			c.Ui.Output(result.out)
			c.Ui.Output("```")
			c.Ui.Output("")
		case "raw":
			c.Ui.Output(fmt.Sprintf("cmd: %q: %#v", cmdName, result.cmd))
			c.Ui.Output("")
			c.Ui.Output(result.out)
			c.Ui.Output("")
		default:
			c.Ui.Error(fmt.Sprintf("Unsupported output type: %q", c.outputMode))
			return 1
		}

		out("s", "GOOS", runtime.GOOS)
		out("s", "GOARCH", runtime.GOARCH)
		out("s", "Compiler", runtime.Compiler)
		out("s", "Version", runtime.Version())
		ifs, err := net.Interfaces()
		if err != nil {
			out("v", "net.Interfaces", err)
		} else {
			for i, intf := range ifs {
				out("s", fmt.Sprintf("net.Interfaces[%d].Name", i), intf.Name)
				out("s", fmt.Sprintf("net.Interfaces[%d].Flags", i), intf.Flags)
				out("+v", fmt.Sprintf("net.Interfaces[%d].Raw", i), intf)
				addrs, err := intf.Addrs()
				if err != nil {
					out("v", fmt.Sprintf("net.Interfaces[%d].Addrs", i), err)
				} else {
					for j, addr := range addrs {
						out("s", fmt.Sprintf("net.Interfaces[%d].Addrs[%d]", i, j), addr)
					}
				}
			}
		}
	}

	return 0
}

// Synopsis returns a terse description used when listing sub-commands.
func (c *TechSupportCommand) Synopsis() string {
	return `Dumps diagnostic information about a platform's network`
}

// Usage is the one-line usage description
func (c *TechSupportCommand) Usage() string {
	return `sockaddr tech-support [options]`
}

// VisitAllFlags forwards the visitor function to the FlagSet
func (c *TechSupportCommand) VisitAllFlags(fn func(*flag.Flag)) {
	c.flags.VisitAll(fn)
}

// parseOpts is responsible for parsing the options set in InitOpts().  Returns
// a list of non-parsed flags.
func (c *TechSupportCommand) parseOpts(args []string) ([]string, error) {
	if err := c.flags.Parse(args); err != nil {
		return nil, err
	}

	switch c.outputMode {
	case "md", "markdown":
		c.outputMode = "md"
	case "raw":
	default:
		return nil, fmt.Errorf(`Invalid output mode %q, supported output types are "md" (default) and "raw"`, c.outputMode)
	}
	return c.flags.Args(), nil
}

func (c *TechSupportCommand) rowWriterOutputFactory() func(valueVerb, key string, val interface{}) {
	type _Fmt string
	type _Verb string
	var lineNoFmt string
	var keyVerb _Verb
	var fmtMap map[_Verb]_Fmt
	switch c.outputMode {
	case "md":
		lineNoFmt = "%02d."
		keyVerb = "s"
		fmtMap = map[_Verb]_Fmt{
			"s":  "`%s`",
			"-s": "%s",
			"v":  "`%v`",
			"+v": "`%#v`",
		}
	case "raw":
		lineNoFmt = "%02d:"
		keyVerb = "-s"
		fmtMap = map[_Verb]_Fmt{
			"s":  "%q",
			"-s": "%s",
			"v":  "%v",
			"+v": "%#v",
		}
	default:
		panic(fmt.Sprintf("Unsupported output type: %q", c.outputMode))
	}

	var count int
	return func(valueVerb, key string, val interface{}) {
		count++

		keyFmt, ok := fmtMap[keyVerb]
		if !ok {
			panic(fmt.Sprintf("Invalid key verb: %q", keyVerb))
		}

		valFmt, ok := fmtMap[_Verb(valueVerb)]
		if !ok {
			panic(fmt.Sprintf("Invalid value verb: %q", valueVerb))
		}

		outputModeFmt := fmt.Sprintf("%s %s:\t%s", lineNoFmt, keyFmt, valFmt)
		c.Ui.Output(fmt.Sprintf(outputModeFmt, count, key, val))
	}
}
