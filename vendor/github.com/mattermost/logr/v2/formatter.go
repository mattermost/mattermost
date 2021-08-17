package logr

import (
	"bytes"
	"io"
	"runtime"
	"strconv"
)

// Formatter turns a LogRec into a formatted string.
type Formatter interface {
	// IsStacktraceNeeded returns true if this formatter requires a stacktrace to be
	// generated for each LogRecord. Enabling features such as `Caller` field require
	// a stacktrace.
	IsStacktraceNeeded() bool

	// Format converts a log record to bytes. If buf is not nil then it will be
	// be filled with the formatted results, otherwise a new buffer will be allocated.
	Format(rec *LogRec, level Level, buf *bytes.Buffer) (*bytes.Buffer, error)
}

const (
	// DefTimestampFormat is the default time stamp format used by Plain formatter and others.
	DefTimestampFormat = "2006-01-02 15:04:05.000 Z07:00"

	// TimestampMillisFormat is the format for logging milliseconds UTC
	TimestampMillisFormat = "Jan _2 15:04:05.000"
)

type Writer struct {
	io.Writer
}

func (w Writer) Writes(elems ...[]byte) (int, error) {
	var count int
	for _, e := range elems {
		if c, err := w.Write(e); err != nil {
			return count + c, err
		} else {
			count += c
		}
	}
	return count, nil
}

// DefaultFormatter is the default formatter, outputting only text with
// no colors and a space delimiter. Use `format.Plain` instead.
type DefaultFormatter struct {
}

// IsStacktraceNeeded always returns false for default formatter since the
// `Caller` field is not supported.
func (p *DefaultFormatter) IsStacktraceNeeded() bool {
	return false
}

// Format converts a log record to bytes.
func (p *DefaultFormatter) Format(rec *LogRec, level Level, buf *bytes.Buffer) (*bytes.Buffer, error) {
	if buf == nil {
		buf = &bytes.Buffer{}
	}
	timestampFmt := DefTimestampFormat

	buf.WriteString(rec.Time().Format(timestampFmt))
	buf.Write(Space)

	buf.WriteString(level.Name)
	buf.Write(Space)

	buf.WriteString(rec.Msg())
	buf.Write(Space)

	fields := rec.Fields()
	if len(fields) > 0 {
		if err := WriteFields(buf, fields, Space, NoColor); err != nil {
			return nil, err
		}
	}

	if level.Stacktrace {
		frames := rec.StackFrames()
		if len(frames) > 0 {
			buf.Write(Newline)
			if err := WriteStacktrace(buf, rec.StackFrames()); err != nil {
				return nil, err
			}
		}
	}
	buf.Write(Newline)

	return buf, nil
}

// WriteFields writes zero or more name value pairs to the io.Writer.
// The pairs output in key=value format with optional separator between fields.
func WriteFields(w io.Writer, fields []Field, separator []byte, color Color) error {
	ws := Writer{w}

	sep := []byte{}
	for _, field := range fields {
		if err := writeField(ws, field, sep, color); err != nil {
			return err
		}
		sep = separator
	}
	return nil
}

func writeField(ws Writer, field Field, sep []byte, color Color) error {
	if len(sep) != 0 {
		if _, err := ws.Write(sep); err != nil {
			return err
		}
	}
	if err := WriteWithColor(ws, field.Key, color); err != nil {
		return err
	}
	if _, err := ws.Write(Equals); err != nil {
		return err
	}
	return field.ValueString(ws, shouldQuote)
}

// shouldQuote returns true if val contains any characters that might be unsafe
// when injecting log output into an aggregator, viewer or report.
func shouldQuote(val string) bool {
	for _, c := range val {
		if !((c >= '0' && c <= '9') ||
			(c >= 'a' && c <= 'z') ||
			(c >= 'A' && c <= 'Z') ||
			c == '-' || c == '.' || c == '_' || c == '/' || c == '@' || c == '^' || c == '+') {
			return true
		}
	}
	return false
}

// WriteStacktrace formats and outputs a stack trace to an io.Writer.
func WriteStacktrace(w io.Writer, frames []runtime.Frame) error {
	ws := Writer{w}
	for _, frame := range frames {
		if frame.Function != "" {
			if _, err := ws.Writes(Space, Space, []byte(frame.Function), Newline); err != nil {
				return err
			}
		}
		if frame.File != "" {
			s := strconv.FormatInt(int64(frame.Line), 10)
			if _, err := ws.Writes([]byte{' ', ' ', ' ', ' ', ' ', ' '}, []byte(frame.File), Colon, []byte(s), Newline); err != nil {
				return err
			}
		}
	}
	return nil
}

// WriteWithColor outputs a string with the specified ANSI color.
func WriteWithColor(w io.Writer, s string, color Color) error {
	var err error

	writer := func(buf []byte) {
		if err != nil {
			return
		}
		_, err = w.Write(buf)
	}

	if color != NoColor {
		writer(AnsiColorPrefix)
		writer([]byte(strconv.FormatInt(int64(color), 10)))
		writer(AnsiColorSuffix)
	}

	if err == nil {
		_, err = io.WriteString(w, s)
	}

	if color != NoColor {
		writer(AnsiColorPrefix)
		writer([]byte(strconv.FormatInt(int64(NoColor), 10)))
		writer(AnsiColorSuffix)
	}
	return err
}
