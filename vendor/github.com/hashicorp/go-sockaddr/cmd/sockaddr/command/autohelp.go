package command

import (
	"flag"
	"fmt"
	"sort"
	"strings"

	wordwrap "github.com/mitchellh/go-wordwrap"
	"github.com/ryanuber/columnize"
)

// AutoHelp specifies the necessary methods required to have their help
// completely generated for them.
type AutoHelp interface {
	Usage() string
	Description() string
	InitOpts()
	VisitAllFlags(func(f *flag.Flag))
}

// MakeHelp generates a help string based on the capabilities of the Command
func MakeHelp(c AutoHelp) string {
	usageText := c.Usage()

	// If the length of Usage() is zero, then assume this is a hidden
	// command.
	if len(usageText) == 0 {
		return ""
	}

	descriptionText := wordwrap.WrapString(c.Description(), 60)
	descrLines := strings.Split(descriptionText, "\n")
	prefixedLines := make([]string, len(descrLines))
	for i := range descrLines {
		prefixedLines[i] = "  " + descrLines[i]
	}
	descriptionText = strings.Join(prefixedLines, "\n")

	c.InitOpts()
	flags := []*flag.Flag{}
	c.VisitAllFlags(func(f *flag.Flag) {
		flags = append(flags, f)
	})
	optionsText := OptionsHelpOutput(flags)

	var helpOutput string
	switch {
	case len(optionsText) == 0 && len(descriptionText) == 0:
		helpOutput = usageText
	case len(optionsText) == 0:
		helpOutput = fmt.Sprintf(`Usage: %s

%s`,
			usageText, descriptionText)
	case len(descriptionText) == 0 && len(optionsText) > 0:
		helpOutput = fmt.Sprintf(`Usage: %s

Options:

%s`,
			usageText, optionsText)
	default:
		helpOutput = fmt.Sprintf(`Usage: %s

%s

Options:

%s`,
			usageText, descriptionText, optionsText)
	}

	return strings.TrimSpace(helpOutput)
}

// ByOptName implements sort.Interface for flag.Flag based on the Name field.
type ByName []*flag.Flag

func (a ByName) Len() int      { return len(a) }
func (a ByName) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a ByName) Less(i, j int) bool {
	// Bubble up single-char args to the top of the list
	switch {
	case len(a[i].Name) == 1 && len(a[j].Name) != 1:
		return true
	case len(a[i].Name) != 1 && len(a[j].Name) == 1:
		return false
	default:
		// Case-insensitive sort.  Use case as a tie breaker, however.
		a1 := strings.ToLower(a[i].Name)
		a2 := strings.ToLower(a[j].Name)
		if a1 == a2 {
			return a[i].Name < a[j].Name
		} else {
			return a1 < a2
		}
	}
}

// OptionsHelpOutput returns a string of formatted options
func OptionsHelpOutput(flags []*flag.Flag) string {
	sort.Sort(ByName(flags))

	var output []string
	for _, f := range flags {
		if len(f.Usage) == 0 {
			continue
		}

		output = append(output, fmt.Sprintf("-%s | %s", f.Name, f.Usage))
	}

	optionsOutput := columnize.Format(output, &columnize.Config{
		Delim:  "|",
		Glue:   "  ",
		Prefix: "  ",
		Empty:  "",
	})
	return optionsOutput
}
