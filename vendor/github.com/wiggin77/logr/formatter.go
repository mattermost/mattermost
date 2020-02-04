package logr

import (
	"fmt"
	"io"
	"runtime"
	"sort"
	"strings"
)

// Formatter turns a LogRec into a formatted string.
type Formatter interface {
	// Format converts a log record to bytes.
	Format(rec *LogRec, stacktrace bool) ([]byte, error)
}

const (
	// DefTimestampFormat is the default time stamp format used by
	// Plain formatter and others.
	DefTimestampFormat = "2006-01-02 15:04:05.000 Z07:00"
)

// DefaultFormatter is the default formatter, outputting only text with
// no colors and a space delimiter. Use `format.Plain` instead.
type DefaultFormatter struct {
}

// Format converts a log record to bytes.
func (p *DefaultFormatter) Format(rec *LogRec, stacktrace bool) ([]byte, error) {
	sb := &strings.Builder{}
	delim := " "
	timestampFmt := DefTimestampFormat

	fmt.Fprintf(sb, "%s%s", rec.Time().Format(timestampFmt), delim)
	fmt.Fprintf(sb, "%v%s", rec.Level(), delim)
	fmt.Fprint(sb, rec.Msg(), delim)

	ctx := rec.Fields()
	if len(ctx) > 0 {
		WriteFields(sb, ctx, " ")
	}

	if stacktrace {
		frames := rec.StackFrames()
		if len(frames) > 0 {
			sb.WriteString("\n")
			WriteStacktrace(sb, rec.StackFrames())
		}
	}
	sb.WriteString("\n")

	return []byte(sb.String()), nil
}

// WriteFields writes zero or more name value pairs to the io.Writer.
// The pairs are sorted by key name and output in key=value format
// with optional separator between fields.
func WriteFields(w io.Writer, flds Fields, separator string) {
	keys := make([]string, 0, len(flds))
	for k := range flds {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	sep := ""
	for _, key := range keys {
		writeField(w, key, flds[key], sep)
		sep = separator
	}
}

func writeField(w io.Writer, key string, val interface{}, sep string) {
	var template string
	switch v := val.(type) {
	case error:
		val := v.Error()
		if shouldQuote(val) {
			template = "%s%s=%q"
		} else {
			template = "%s%s=%s"
		}
	case string:
		if shouldQuote(v) {
			template = "%s%s=%q"
		} else {
			template = "%s%s=%s"
		}
	default:
		template = "%s%s=%v"
	}
	fmt.Fprintf(w, template, sep, key, val)
}

// shouldQuote returns true if val contains any characters that might be unsafe
// when injecting log output into an aggregator, viewer or report.
func shouldQuote(val string) bool {
	for _, c := range val {
		if !((c >= '0' && c <= '9') ||
			(c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z')) {
			return true
		}
	}
	return false
}

// WriteStacktrace formats and outputs a stack trace to an io.Writer.
func WriteStacktrace(w io.Writer, frames []runtime.Frame) {
	for _, frame := range frames {
		if frame.Function != "" {
			fmt.Fprintf(w, "  %s\n", frame.Function)
		}
		if frame.File != "" {
			fmt.Fprintf(w, "      %s:%d\n", frame.File, frame.Line)
		}
	}
}
