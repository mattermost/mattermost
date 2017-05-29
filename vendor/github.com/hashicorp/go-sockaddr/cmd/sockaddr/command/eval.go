package command

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/hashicorp/errwrap"
	"github.com/hashicorp/go-sockaddr/template"
	"github.com/mitchellh/cli"
)

type EvalCommand struct {
	Ui cli.Ui

	// debugOutput emits framed output vs raw output.
	debugOutput bool

	// flags is a list of options belonging to this command
	flags *flag.FlagSet

	// rawInput disables wrapping the string in the text/template {{ }}
	// handlebars.
	rawInput bool

	// suppressNewline changes whether or not there's a newline between each
	// arg passed to the eval subcommand.
	suppressNewline bool
}

// Description is the long-form command help.
func (c *EvalCommand) Description() string {
	return `Parse the sockaddr template and evaluates the output.

` + "The `sockaddr` library has the potential to be very complex, which is why the " +
		"`sockaddr` command supports an `eval` subcommand in order to test configurations " +
		"from the command line.  The `eval` subcommand automatically wraps its input with " +
		"the `{{` and `}}` template delimiters unless the `-r` command is specified, in " +
		"which case `eval` parses the raw input.  If the `template` argument passed to " +
		"`eval` is a dash (`-`), then `sockaddr eval` will read from stdin and " +
		"automatically sets the `-r` flag."

}

// Help returns the full help output expected by `sockaddr -h cmd`
func (c *EvalCommand) Help() string {
	return MakeHelp(c)
}

// InitOpts is responsible for setup of this command's configuration via the
// command line.  InitOpts() does not parse the arguments (see parseOpts()).
func (c *EvalCommand) InitOpts() {
	c.flags = flag.NewFlagSet("eval", flag.ContinueOnError)
	c.flags.Usage = func() { c.Ui.Output(c.Help()) }
	c.flags.BoolVar(&c.debugOutput, "d", false, "Debug output")
	c.flags.BoolVar(&c.suppressNewline, "n", false, "Suppress newlines between args")
	c.flags.BoolVar(&c.rawInput, "r", false, "Suppress wrapping the input with {{ }} delimiters")
}

// Run executes this command.
func (c *EvalCommand) Run(args []string) int {
	if len(args) == 0 {
		c.Ui.Error(c.Help())
		return 1
	}

	c.InitOpts()
	tmpls, err := c.parseOpts(args)
	if err != nil {
		if errwrap.Contains(err, "flag: help requested") {
			return 0
		}
		return 1
	}
	inputs, outputs := make([]string, len(tmpls)), make([]string, len(tmpls))
	var rawInput, readStdin bool
	for i, in := range tmpls {
		if readStdin {
			break
		}

		rawInput = c.rawInput
		if in == "-" {
			rawInput = true
			var f io.Reader = os.Stdin
			var buf bytes.Buffer
			if _, err := io.Copy(&buf, f); err != nil {
				c.Ui.Error(fmt.Sprintf("[ERROR]: Error reading from stdin: %v", err))
				return 1
			}
			in = buf.String()
			if len(in) == 0 {
				return 0
			}
			readStdin = true
		}
		inputs[i] = in

		if !rawInput {
			in = `{{` + in + `}}`
			inputs[i] = in
		}

		out, err := template.Parse(in)
		if err != nil {
			c.Ui.Error(fmt.Sprintf("ERROR[%d] in: %q\n[%d] msg: %v\n", i, in, i, err))
			return 1
		}
		outputs[i] = out
	}

	if c.debugOutput {
		for i, out := range outputs {
			c.Ui.Output(fmt.Sprintf("[%d] in: %q\n[%d] out: %q\n", i, inputs[i], i, out))
			if i != len(outputs)-1 {
				if c.debugOutput {
					c.Ui.Output(fmt.Sprintf("---\n"))
				}
			}
		}
	} else {
		sep := "\n"
		if c.suppressNewline {
			sep = ""
		}
		c.Ui.Output(strings.Join(outputs, sep))
	}

	return 0
}

// Synopsis returns a terse description used when listing sub-commands.
func (c *EvalCommand) Synopsis() string {
	return `Evaluates a sockaddr template`
}

// Usage is the one-line usage description
func (c *EvalCommand) Usage() string {
	return `sockaddr eval [options] [template ...]`
}

// VisitAllFlags forwards the visitor function to the FlagSet
func (c *EvalCommand) VisitAllFlags(fn func(*flag.Flag)) {
	c.flags.VisitAll(fn)
}

// parseOpts is responsible for parsing the options set in InitOpts().  Returns
// a list of non-parsed flags.
func (c *EvalCommand) parseOpts(args []string) ([]string, error) {
	if err := c.flags.Parse(args); err != nil {
		return nil, err
	}

	return c.flags.Args(), nil
}
