// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/logr/v2"
	logrcfg "github.com/mattermost/logr/v2/config"
	"github.com/mattermost/logr/v2/formatters"
	"github.com/mattermost/logr/v2/targets"
)

// CheckTargets checks each target's type, options, format, queue size and level names.
// It does not create the targets or open their outputs.
func (lc LoggerConfiguration) CheckTargets() error {
	for name, target := range lc {
		if strings.EqualFold(target.Type, "none") {
			continue
		}
		if target.MaxQueueSize < 0 {
			return fmt.Errorf("invalid target %s: maxqueuesize must be non-negative", name)
		}
		if err := checkTargetOptions(target.Type, target.Options); err != nil {
			return fmt.Errorf("invalid target %s: %w", name, err)
		}
		if err := checkTargetFormat(target.Format, target.FormatOptions); err != nil {
			return fmt.Errorf("invalid format for target %s: %w", name, err)
		}
		for _, lvl := range target.Levels {
			if err := logr.CheckOptionText("level name", lvl.Name); err != nil {
				return fmt.Errorf("invalid level for target %s: %w", name, err)
			}
		}
	}
	return nil
}

func checkTargetOptions(targetType string, options json.RawMessage) error {
	switch strings.ToLower(targetType) {
	case "console":
		var opts logrcfg.ConsoleOptions
		if len(options) != 0 {
			if err := json.Unmarshal(options, &opts); err != nil {
				return err
			}
		}
		switch opts.Out {
		case "", "stdout", "stderr":
			return nil
		default:
			return fmt.Errorf("invalid console target option %q", opts.Out)
		}
	case "file":
		var opts targets.FileOptions
		if err := unmarshalTargetOptions(options, &opts); err != nil {
			return err
		}
		return opts.CheckValid()
	case "tcp":
		var opts targets.TcpOptions
		if err := unmarshalTargetOptions(options, &opts); err != nil {
			return err
		}
		return opts.CheckValid()
	case "syslog":
		var opts targets.SyslogOptions
		if err := unmarshalTargetOptions(options, &opts); err != nil {
			return err
		}
		if err := opts.CheckValid(); err != nil {
			return err
		}
		if opts.TLS {
			return certValueError(opts.Cert)
		}
		return nil
	default:
		return fmt.Errorf("target type %q is unrecognized", targetType)
	}
}

func unmarshalTargetOptions(options json.RawMessage, opts any) error {
	if len(options) == 0 {
		return errors.New("missing target options")
	}
	return json.Unmarshal(options, opts)
}

// certValueError reports a standard-base64 value that does not contain a PEM certificate.
// An empty value, or any value that is not standard base64, is accepted here and is not read.
func certValueError(cert string) error {
	der, err := base64.StdEncoding.DecodeString(cert)
	if cert == "" || err != nil {
		return nil
	}
	if !x509.NewCertPool().AppendCertsFromPEM(der) {
		return errors.New("cannot parse cert")
	}
	return nil
}

func checkTargetFormat(format string, options json.RawMessage) error {
	var formatter interface{ CheckValid() error }
	switch strings.ToLower(format) {
	case "json":
		formatter = &formatters.JSON{}
	case "plain":
		formatter = &formatters.Plain{}
	case "gelf":
		formatter = &formatters.Gelf{}
	default:
		return fmt.Errorf("format %q is unrecognized", format)
	}

	if len(options) == 0 {
		return nil
	}
	if err := json.Unmarshal(options, formatter); err != nil {
		return err
	}
	return formatter.CheckValid()
}
