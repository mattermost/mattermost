package pluginmage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"text/template"
	"time"
)

const (
	underline = "\x1b[4m"
	reset     = "\x1b[0m"

	// Colors for different log levels
	colorDebug = "\x1b[36m" // Cyan
	colorInfo  = "\x1b[32m" // Green
	colorWarn  = "\x1b[33m" // Yellow
	colorError = "\x1b[31m" // Red

	// Log line template
	logTmpl = `{{.Time}} {{if .NSTarget}}{{.NSTarget}} {{end}}{{if .UseColors}}{{.Underline}}{{.LevelColor}}{{end}}{{.Level}}{{if .UseColors}}{{.Reset}}{{.Reset}}{{end}} {{.Message}}{{if .Attrs}} {{.Attrs}}{{end}}`
)

type logLine struct {
	Time       string
	NSTarget   string
	Level      string
	Message    string
	Attrs      []string
	UseColors  bool
	Underline  string
	Reset      string
	LevelColor string
}

var tmpl = template.Must(template.New("log").Parse(logTmpl))

type customHandler struct {
	out       io.Writer
	startTime time.Time
	useColors bool
}

func (h *customHandler) Enabled(_ context.Context, _ slog.Level) bool {
	return true
}

func (h *customHandler) Handle(_ context.Context, r slog.Record) error {
	// Get relative time since handler creation with fixed width (7 columns)
	timeStr := fmt.Sprintf("%7.2fs", r.Time.Sub(h.startTime).Seconds())

	// Extract namespace and target if present
	var namespace, target string
	attrs := make([]string, 0, r.NumAttrs())
	r.Attrs(func(a slog.Attr) bool {
		switch a.Key {
		case "namespace":
			namespace = a.Value.String()
		case "target":
			target = a.Value.String()
		default:
			if h.useColors {
				// Format the key-value without brackets: underlined key = value + reset
				attrs = append(attrs, fmt.Sprintf("%s%s%s=%v", underline, a.Key, reset, a.Value))
			} else {
				// Format the key-value without brackets: key = value
				attrs = append(attrs, fmt.Sprintf("%s=%v", a.Key, a.Value))
			}
		}
		return true
	})

	// Format namespace and target if present
	nsTarget := ""
	if namespace != "" && target != "" {
		nsTarget = fmt.Sprintf("(%s:%s)", namespace, target)
	} else if target != "" {
		nsTarget = fmt.Sprintf("(%s)", target)
	}

	// Get color for log level
	var levelColor string
	if h.useColors {
		switch r.Level {
		case slog.LevelDebug:
			levelColor = colorDebug
		case slog.LevelInfo:
			levelColor = colorInfo
		case slog.LevelWarn:
			levelColor = colorWarn
		case slog.LevelError:
			levelColor = colorError
		}
	}

	// Prepare log line data
	line := logLine{
		Time:       timeStr,
		NSTarget:   nsTarget,
		Level:      r.Level.String(),
		Message:    r.Message,
		Attrs:      attrs,
		UseColors:  h.useColors,
		Underline:  underline,
		Reset:      reset,
		LevelColor: levelColor,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, line); err != nil {
		return err
	}
	buf.WriteByte('\n') // Add explicit newline after template execution

	_, err := h.out.Write(buf.Bytes())
	return err
}

func (h *customHandler) WithAttrs(_ []slog.Attr) slog.Handler {
	return h
}

func (h *customHandler) WithGroup(_ string) slog.Handler {
	return h
}

// NewCustomHandler creates a new handler with our custom format
func NewCustomHandler(out io.Writer) slog.Handler {
	// Check if we're writing to a terminal
	useColors := false
	if f, ok := out.(*os.File); ok {
		fileInfo, _ := f.Stat()
		useColors = (fileInfo.Mode() & os.ModeCharDevice) != 0
	}

	return &customHandler{
		out:       out,
		startTime: time.Now(),
		useColors: useColors,
	}
}

// logWriter implements io.Writer to redirect output to logger. This is used to redirect the output
// from commands to the logger so we can add namespace and target to the logs for easier debugging.
type logWriter struct {
	namespace string
	target    string
	level     slog.Level
}

// NewLogWriter creates a new logWriter with the given namespace, target and level
func NewLogWriter(namespace, target string, level slog.Level) io.Writer {
	return &logWriter{
		namespace: namespace,
		target:    target,
		level:     level,
	}
}

func (l *logWriter) Write(p []byte) (n int, err error) {
	lines := bytes.Split(bytes.TrimSpace(p), []byte("\n"))
	for _, line := range lines {
		if len(line) == 0 {
			continue
		}

		Logger.Log(context.Background(), l.level, string(line),
			"namespace", l.namespace,
			"target", l.target)
	}

	return len(p), nil
}
