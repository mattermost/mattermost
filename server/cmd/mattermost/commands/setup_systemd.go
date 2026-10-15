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
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if value[0] == '"' || value[0] == '\'' {
		return systemdUnquoteWord(value)
	}
	if i := strings.IndexByte(value, '#'); i >= 0 {
		return strings.TrimSpace(value[:i])
	}
	return value
}

func systemdUnquoteWord(value string) string {
	var b strings.Builder
	var quote byte
	for i := 0; i < len(value); i++ {
		c := value[i]
		if quote != 0 {
			if c == '\\' && quote == '"' && i+1 < len(value) {
				b.WriteByte(value[i+1])
				i++
				continue
			}
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
		if c == '#' {
			break
		}
		b.WriteByte(c)
	}
	return b.String()
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

func splitEnvAssignments(value string) []string {
	var parts []string
	var b strings.Builder
	var quote byte
	flush := func() {
		if b.Len() == 0 {
			return
		}
		parts = append(parts, b.String())
		b.Reset()
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if quote != 0 {
			if c == '\\' && quote == '"' && i+1 < len(value) {
				b.WriteByte(value[i+1])
				i++
				continue
			}
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
	return parts
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
			if value == "" {
				out = append(out, unitAssign{kind: "reset-file"})
				continue
			}
			for _, envPath := range splitEnvFilePaths(value) {
				out = append(out, unitAssign{kind: "file", path: envPath})
			}
		case "Environment":
			if value == "" {
				out = append(out, unitAssign{kind: "reset-env"})
				continue
			}
			for _, assignment := range splitEnvAssignments(value) {
				envKey, envValue, ok := strings.Cut(assignment, "=")
				if !ok || strings.TrimSpace(envKey) == "" {
					continue
				}
				out = append(out, unitAssign{kind: "env", key: strings.TrimSpace(envKey), value: envValue})
			}
		}
	}
	return out, nil
}

func effectiveMMConfig(mainUnit string, dropIns []string) (mmConfigSource, error) {
	var current mmConfigSource
	var currentKind string
	var fromFile mmConfigSource
	var fromEnv mmConfigSource
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
			switch assign.kind {
			case "reset-file":
				fromFile = mmConfigSource{}
				if currentKind == "file" {
					current = fromEnv
					currentKind = ""
					if fromEnv.found {
						currentKind = "env"
					}
				}
			case "reset-env":
				fromEnv = mmConfigSource{}
				if currentKind == "env" {
					current = fromFile
					currentKind = ""
					if fromFile.found {
						currentKind = "file"
					}
				}
			case "file":
				data, err := os.ReadFile(assign.path)
				if err != nil {
					if os.IsNotExist(err) {
						continue
					}
					return mmConfigSource{}, err
				}
				if value, ok := parseEnvFile(string(data))["MM_CONFIG"]; ok {
					fromFile = mmConfigSource{value: value, source: assign.path, found: true}
					current = fromFile
					currentKind = "file"
				}
			default:
				if assign.key == "MM_CONFIG" {
					fromEnv = mmConfigSource{value: assign.value, source: path, found: true}
					current = fromEnv
					currentKind = "env"
				}
			}
		}
	}
	return current, nil
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

func unitForInstall(envFile, installRoot string) string {
	content := strings.ReplaceAll(shippedMattermostUnit, defaultEnvFile, envFile)
	root := filepath.Clean(installRoot)
	if root == "" || root == "." || root == "/opt/mattermost" {
		return content
	}
	return strings.ReplaceAll(content, "/opt/mattermost", root)
}

func installSystemd(paths systemdPaths, envFile, installRoot string, reload func() error) error {
	main := paths.mainUnit()
	if main == "" {
		if err := os.MkdirAll(filepath.Dir(paths.etcUnit), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(paths.etcUnit, []byte(unitForInstall(envFile, installRoot)), 0644); err != nil {
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
		return reload()
	}
	return nil
}

func confirmSystemdEnv(paths systemdPaths, envFile string) error {
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

func unitValue(path, want string) (string, bool) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", false
	}
	section := ""
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
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
		if !ok || !strings.EqualFold(strings.TrimSpace(key), want) {
			continue
		}
		return systemdUnquote(strings.TrimSpace(value)), true
	}
	return "", false
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
