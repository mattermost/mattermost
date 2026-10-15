// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/pkg/errors"
)

const setupDropInName = "10-mattermost-setup.conf"

// shippedMattermostUnit is the unit copied into the tarball. Keep it identical
// to server/build/mattermost.service.
const shippedMattermostUnit = `[Unit]
Description=Mattermost
After=network.target

[Service]
Type=notify
EnvironmentFile=/etc/mattermost/mattermost.env
ExecStart=/opt/mattermost/bin/mattermost
TimeoutStartSec=3600
KillMode=mixed
Restart=always
RestartSec=10
WorkingDirectory=/opt/mattermost
User=mattermost
Group=mattermost
LimitNOFILE=49152

[Install]
WantedBy=multi-user.target
`

type systemdPaths struct {
	etcUnit   string
	libUnits  []string
	dropInDir string
}

func defaultSystemdPaths() systemdPaths {
	return systemdPaths{
		etcUnit: "/etc/systemd/system/mattermost.service",
		libUnits: []string{
			"/usr/lib/systemd/system/mattermost.service",
			"/lib/systemd/system/mattermost.service",
		},
		dropInDir: "/etc/systemd/system/mattermost.service.d",
	}
}

type mmConfigSource struct {
	value  string
	source string
	found  bool
}

type unitAssign struct {
	kind  string
	path  string
	key   string
	value string
}

func (p systemdPaths) mainUnit() string {
	if st, err := os.Stat(p.etcUnit); err == nil && !st.IsDir() {
		return p.etcUnit
	}
	for _, lib := range p.libUnits {
		if st, err := os.Stat(lib); err == nil && !st.IsDir() {
			return lib
		}
	}
	return ""
}

func (p systemdPaths) dropIns() ([]string, error) {
	entries, err := os.ReadDir(p.dropInDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".conf") {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)
	out := make([]string, len(names))
	for i, name := range names {
		out[i] = filepath.Join(p.dropInDir, name)
	}
	return out, nil
}

func parseEnvFile(data string) map[string]string {
	vals := make(map[string]string)
	for _, line := range strings.Split(data, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		vals[strings.TrimSpace(key)] = systemdUnquote(strings.TrimSpace(value))
	}
	return vals
}

func systemdUnquote(value string) string {
	if len(value) >= 2 {
		if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
			return value[1 : len(value)-1]
		}
	}
	if i := strings.IndexByte(value, '#'); i >= 0 {
		return strings.TrimSpace(value[:i])
	}
	return value
}

func splitEnvFilePaths(value string) []string {
	var paths []string
	var b strings.Builder
	var quote byte
	flush := func() {
		if b.Len() == 0 {
			return
		}
		paths = append(paths, strings.TrimPrefix(b.String(), "-"))
		b.Reset()
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if quote != 0 {
			if c == quote {
				quote = 0
				continue
			}
			b.WriteByte(c)
			continue
		}
		if c == '"' || c == '\'' {
			quote = c
			continue
		}
		if c == ' ' || c == '\t' {
			flush()
			continue
		}
		b.WriteByte(c)
	}
	flush()
	return paths
}

func parseUnitAssignments(path string) ([]unitAssign, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out []unitAssign
	section := ""
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section = strings.Trim(line, "[]")
			continue
		}
		if !strings.EqualFold(section, "Service") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		switch key {
		case "EnvironmentFile":
			for _, envPath := range splitEnvFilePaths(value) {
				out = append(out, unitAssign{kind: "file", path: envPath})
			}
		case "Environment":
			envKey, envValue, ok := strings.Cut(value, "=")
			if !ok {
				continue
			}
			out = append(out, unitAssign{kind: "env", key: strings.TrimSpace(envKey), value: systemdUnquote(strings.TrimSpace(envValue))})
		}
	}
	return out, nil
}

func effectiveMMConfig(mainUnit string, dropIns []string) (mmConfigSource, error) {
	var last mmConfigSource
	files := make([]string, 0, 1+len(dropIns))
	if mainUnit != "" {
		files = append(files, mainUnit)
	}
	files = append(files, dropIns...)
	for _, path := range files {
		assigns, err := parseUnitAssignments(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return mmConfigSource{}, err
		}
		for _, assign := range assigns {
			if assign.kind == "file" {
				data, err := os.ReadFile(assign.path)
				if err != nil {
					if os.IsNotExist(err) {
						continue
					}
					return mmConfigSource{}, err
				}
				if value, ok := parseEnvFile(string(data))["MM_CONFIG"]; ok {
					last = mmConfigSource{value: value, source: assign.path, found: true}
				}
				continue
			}
			if assign.key == "MM_CONFIG" {
				last = mmConfigSource{value: assign.value, source: path, found: true}
			}
		}
	}
	return last, nil
}

func mmConfigConflict(paths systemdPaths, envFile string) error {
	main := paths.mainUnit()
	if main == "" {
		return nil
	}
	dropIns, err := paths.dropIns()
	if err != nil {
		return err
	}
	src, err := effectiveMMConfig(main, dropIns)
	if err != nil {
		return err
	}
	if !src.found || filepath.Clean(src.source) == filepath.Clean(envFile) {
		return nil
	}
	return errors.Errorf("MM_CONFIG is already loaded from %s. Setup will not add %s over that file", src.source, envFile)
}

func installSystemd(paths systemdPaths, envFile string, reload func() error) error {
	main := paths.mainUnit()
	if main == "" {
		if err := os.MkdirAll(filepath.Dir(paths.etcUnit), 0755); err != nil {
			return err
		}
		content := strings.ReplaceAll(shippedMattermostUnit, defaultEnvFile, envFile)
		if err := os.WriteFile(paths.etcUnit, []byte(content), 0644); err != nil {
			return err
		}
	} else {
		dropIns, err := paths.dropIns()
		if err != nil {
			return err
		}
		src, err := effectiveMMConfig(main, dropIns)
		if err != nil {
			return err
		}
		if !src.found || filepath.Clean(src.source) != filepath.Clean(envFile) {
			if err := writeDropIn(paths.dropInDir, envFile); err != nil {
				return err
			}
		}
	}
	if reload != nil {
		if err := reload(); err != nil {
			return err
		}
	}
	dropIns, err := paths.dropIns()
	if err != nil {
		return err
	}
	src, err := effectiveMMConfig(paths.mainUnit(), dropIns)
	if err != nil {
		return err
	}
	if !src.found || filepath.Clean(src.source) != filepath.Clean(envFile) {
		return errors.Errorf("systemd unit does not load MM_CONFIG from %s", envFile)
	}
	return nil
}

func writeDropIn(dir, envFile string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	body := "[Service]\nEnvironmentFile=" + envFile + "\n"
	path := filepath.Join(dir, setupDropInName)
	existing, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if string(existing) == body {
		return nil
	}
	return os.WriteFile(path, []byte(body), 0644)
}
