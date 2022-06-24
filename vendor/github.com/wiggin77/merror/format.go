package merror

import (
	"fmt"
	"strings"
)

// FormatterFunc is a function that converts a merror
// to a string.
type FormatterFunc func(merr *MError) string

// GlobalFormatter is the global merror formatter.
// Set this to a custom formatter if desired.
var GlobalFormatter = defaultFormatter

// defaultFormatter
func defaultFormatter(merr *MError) string {
	count := 0
	overflow := 0

	var format func(sb *strings.Builder, merr *MError, indent string)
	format = func(sb *strings.Builder, merr *MError, indent string) {
		count += merr.Len()
		overflow += merr.Overflow()

		fmt.Fprintf(sb, "%sMError:\n", indent)
		for _, err := range merr.Errors() {
			if e, ok := err.(*MError); ok {
				format(sb, e, indent+"  ")
			} else {
				fmt.Fprintf(sb, "%s%s\n", indent, err.Error())
			}
		}
	}

	sb := &strings.Builder{}
	format(sb, merr, "")
	fmt.Fprintf(sb, "%d errors total.\n", count)
	if merr.overflow > 0 {
		fmt.Fprintf(sb, "%d errors truncated.\n", overflow)
	}
	return sb.String()
}
