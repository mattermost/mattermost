package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/mattermost/logr/v2"
	"github.com/mattermost/logr/v2/formatters"
	"github.com/mattermost/logr/v2/targets"
)

type TargetCfg struct {
	Type          string          `json:"type"` // one of "console", "file", "tcp", "syslog", "none".
	Options       json.RawMessage `json:"options,omitempty"`
	Format        string          `json:"format"` // one of "json", "plain", "gelf"
	FormatOptions json.RawMessage `json:"format_options,omitempty"`
	Levels        []logr.Level    `json:"levels"`
	MaxQueueSize  int             `json:"maxqueuesize,omitempty"`
}

type ConsoleOptions struct {
	Out string `json:"out"` // one of "stdout", "stderr"
}

type TargetFactory func(targetType string, options json.RawMessage) (logr.Target, error)
type FormatterFactory func(format string, options json.RawMessage) (logr.Formatter, error)

type Factories struct {
	TargetFactory    TargetFactory    // can be nil
	FormatterFactory FormatterFactory // can be nil
}

var removeAll = func(ti logr.TargetInfo) bool { return true }

// ConfigureTargets replaces the current list of log targets with a new one based on a map
// of name->TargetCfg. The map of TargetCfg's would typically be serialized from a JSON
// source or can be programmatically created.
//
// An optional set of factories can be provided which will be called to create any target
// types or formatters not built-in.
//
// To append log targets to an existing config, use `(*Logr).AddTarget` or
// `(*Logr).AddTargetFromConfig` instead.
func ConfigureTargets(lgr *logr.Logr, config map[string]TargetCfg, factories *Factories) error {
	if err := lgr.RemoveTargets(context.Background(), removeAll); err != nil {
		return fmt.Errorf("error removing existing log targets: %w", err)
	}

	if factories == nil {
		factories = &Factories{nil, nil}
	}

	for name, tcfg := range config {
		target, err := newTarget(tcfg.Type, tcfg.Options, factories.TargetFactory)
		if err != nil {
			return fmt.Errorf("error creating log target %s: %w", name, err)
		}

		if target == nil {
			continue
		}

		formatter, err := newFormatter(tcfg.Format, tcfg.FormatOptions, factories.FormatterFactory)
		if err != nil {
			return fmt.Errorf("error creating formatter for log target %s: %w", name, err)
		}

		filter := newFilter(tcfg.Levels)
		qSize := tcfg.MaxQueueSize
		if qSize == 0 {
			qSize = logr.DefaultMaxQueueSize
		}

		if err = lgr.AddTarget(target, name, filter, formatter, qSize); err != nil {
			return fmt.Errorf("error adding log target %s: %w", name, err)
		}
	}
	return nil
}

func newFilter(levels []logr.Level) logr.Filter {
	filter := &logr.CustomFilter{}
	for _, lvl := range levels {
		filter.Add(lvl)
	}
	return filter
}

func newTarget(targetType string, options json.RawMessage, factory TargetFactory) (logr.Target, error) {
	switch strings.ToLower(targetType) {
	case "console":
		c := ConsoleOptions{}
		if len(options) != 0 {
			if err := json.Unmarshal(options, &c); err != nil {
				return nil, fmt.Errorf("error decoding console target options: %w", err)
			}
		}
		var w io.Writer
		switch c.Out {
		case "stderr":
			w = os.Stderr
		case "stdout", "":
			w = os.Stdout
		default:
			return nil, fmt.Errorf("invalid console target option '%s'", c.Out)
		}
		return targets.NewWriterTarget(w), nil
	case "file":
		fo := targets.FileOptions{}
		if len(options) == 0 {
			return nil, errors.New("missing file target options")
		}
		if err := json.Unmarshal(options, &fo); err != nil {
			return nil, fmt.Errorf("error decoding file target options: %w", err)
		}
		if err := fo.CheckValid(); err != nil {
			return nil, fmt.Errorf("invalid file target options: %w", err)
		}
		return targets.NewFileTarget(fo), nil
	case "tcp":
		to := targets.TcpOptions{}
		if len(options) == 0 {
			return nil, errors.New("missing TCP target options")
		}
		if err := json.Unmarshal(options, &to); err != nil {
			return nil, fmt.Errorf("error decoding TCP target options: %w", err)
		}
		if err := to.CheckValid(); err != nil {
			return nil, fmt.Errorf("invalid TCP target options: %w", err)
		}
		return targets.NewTcpTarget(&to), nil
	case "syslog":
		so := targets.SyslogOptions{}
		if len(options) == 0 {
			return nil, errors.New("missing SysLog target options")
		}
		if err := json.Unmarshal(options, &so); err != nil {
			return nil, fmt.Errorf("error decoding Syslog target options: %w", err)
		}
		if err := so.CheckValid(); err != nil {
			return nil, fmt.Errorf("invalid SysLog target options: %w", err)
		}
		return targets.NewSyslogTarget(&so)
	case "none":
		return nil, nil
	default:
		if factory != nil {
			t, err := factory(targetType, options)
			if err != nil || t == nil {
				return nil, fmt.Errorf("error from target factory: %w", err)
			}
			return t, nil
		}
	}
	return nil, fmt.Errorf("target type '%s' is unrecogized", targetType)
}

func newFormatter(format string, options json.RawMessage, factory FormatterFactory) (logr.Formatter, error) {
	switch strings.ToLower(format) {
	case "json":
		j := formatters.JSON{}
		if len(options) != 0 {
			if err := json.Unmarshal(options, &j); err != nil {
				return nil, fmt.Errorf("error decoding JSON formatter options: %w", err)
			}
			if err := j.CheckValid(); err != nil {
				return nil, fmt.Errorf("invalid JSON formatter options: %w", err)
			}
		}
		return &j, nil
	case "plain":
		p := formatters.Plain{}
		if len(options) != 0 {
			if err := json.Unmarshal(options, &p); err != nil {
				return nil, fmt.Errorf("error decoding Plain formatter options: %w", err)
			}
			if err := p.CheckValid(); err != nil {
				return nil, fmt.Errorf("invalid plain formatter options: %w", err)
			}
		}
		return &p, nil
	case "gelf":
		g := formatters.Gelf{}
		if len(options) != 0 {
			if err := json.Unmarshal(options, &g); err != nil {
				return nil, fmt.Errorf("error decoding Gelf formatter options: %w", err)
			}
			if err := g.CheckValid(); err != nil {
				return nil, fmt.Errorf("invalid GELF formatter options: %w", err)
			}
		}
		return &g, nil

	default:
		if factory != nil {
			f, err := factory(format, options)
			if err != nil || f == nil {
				return nil, fmt.Errorf("error from formatter factory: %w", err)
			}
			return f, nil
		}
	}
	return nil, fmt.Errorf("format '%s' is unrecogized", format)
}
