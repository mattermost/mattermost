// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"strings"
)

type systemFacts struct {
	rows     [][2]string
	warnings []string
}

type postgresVendor struct {
	aurora    bool
	alloydbFn bool
	rds       bool
	cloudsql  bool
	alloydb   bool
	azure     bool
	citus     bool
}

func parseOSRelease(data string) map[string]string {
	values := make(map[string]string)
	for _, line := range strings.Split(data, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[key] = strings.Trim(val, `"'`)
	}
	return values
}

func osPrettyName(release, redhatRelease string) string {
	values := parseOSRelease(release)
	if pretty := values["PRETTY_NAME"]; pretty != "" {
		return pretty
	}
	name := values["NAME"]
	version := values["VERSION"]
	if version == "" {
		version = values["VERSION_ID"]
	}
	if name != "" && version != "" {
		return name + " " + version
	}
	if name != "" {
		return name
	}
	if line := strings.TrimSpace(redhatRelease); line != "" {
		return line
	}
	return "Linux"
}

func systemdVersion(output string) string {
	line, _, _ := strings.Cut(output, "\n")
	fields := strings.Fields(line)
	if len(fields) >= 2 && strings.EqualFold(fields[0], "systemd") {
		return fields[1]
	}
	return ""
}

func apparmorStatus(enabled, profiles string, profilesRead bool) (string, string) {
	switch strings.TrimSpace(enabled) {
	case "Y", "y", "1":
	default:
		return "not enabled", ""
	}
	if !profilesRead {
		return "enabled", ""
	}
	var enforcing []string
	var complaining []string
	for _, line := range strings.Split(profiles, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || !strings.Contains(strings.ToLower(line), "mattermost") {
			continue
		}
		switch {
		case strings.Contains(line, "(enforce)"):
			enforcing = append(enforcing, apparmorProfileName(line))
		case strings.Contains(line, "(complain)"):
			complaining = append(complaining, apparmorProfileName(line))
		}
	}
	if len(enforcing) > 0 {
		return "enforcing " + strings.Join(enforcing, ", "), "AppArmor is enforcing a profile for Mattermost. That profile must allow the /var state directories."
	}
	if len(complaining) > 0 {
		return "complain " + strings.Join(complaining, ", "), ""
	}
	return "enabled, no Mattermost profile", ""
}

func apparmorProfileName(line string) string {
	name := strings.TrimSpace(strings.TrimSuffix(strings.TrimSuffix(line, "(enforce)"), "(complain)"))
	if name == "" {
		return line
	}
	return name
}

func selinuxStatus(enforceFile string, missing bool, label string) (string, string) {
	if missing {
		return "disabled", ""
	}
	mode := "permissive"
	if strings.TrimSpace(enforceFile) == "1" {
		mode = "enforcing"
	}
	typ := selinuxType(label)
	if typ == "" {
		return mode, ""
	}
	status := mode + ", binary " + typ
	if mode != "enforcing" {
		return status, ""
	}
	switch typ {
	case "bin_t", "unconfined_t", "unconfined_exec_t", "unlabeled_t":
		return status, ""
	case "usr_t", "default_t":
		return status, fmt.Sprintf("SELinux is enforcing and the binary is labeled %s, not bin_t. Label it before starting: semanage fcontext -a -t bin_t \"/opt/mattermost/bin(/.*)?\" && restorecon -RF /opt/mattermost/bin", typ)
	default:
		if confinedSELinuxType(typ) {
			return status, fmt.Sprintf("SELinux is enforcing and the binary is labeled %s. That domain must be allowed to write /var/lib/mattermost and /var/log/mattermost.", typ)
		}
	}
	return status, ""
}

func selinuxType(label string) string {
	label = strings.TrimRight(strings.TrimSpace(label), "\x00")
	parts := strings.Split(label, ":")
	if len(parts) < 3 {
		return ""
	}
	return parts[2]
}

func confinedSELinuxType(typ string) bool {
	switch typ {
	case "", "bin_t", "unconfined_t", "unconfined_exec_t", "unlabeled_t":
		return false
	default:
		return true
	}
}

func fapolicydStatus(installed, running bool) (string, string) {
	if running {
		return "running", "fapolicyd is running. It must allow /opt/mattermost/bin/mattermost to execute files under /var/lib/mattermost."
	}
	if installed {
		return "installed, not running", ""
	}
	return "not installed", ""
}

func formatPostgresVersion(num int) string {
	if num <= 0 {
		return ""
	}
	major := num / 10000
	if major >= 10 {
		return fmt.Sprintf("%d.%d", major, num%10000)
	}
	return fmt.Sprintf("%d.%d.%d", major, (num/100)%100, num%100)
}

func classifyPostgres(versionString string, vendor postgresVendor) string {
	lower := strings.ToLower(versionString)
	switch {
	case strings.Contains(lower, "enterprisedb"):
		return "EDB Postgres Advanced Server"
	case strings.Contains(lower, "cockroach"):
		return "CockroachDB"
	case strings.Contains(lower, "yugabyte"):
		return "YugabyteDB"
	case vendor.aurora || strings.Contains(lower, "aurora"):
		return "Amazon Aurora"
	case vendor.alloydb || vendor.alloydbFn:
		return "Google AlloyDB"
	case vendor.cloudsql:
		return "Google Cloud SQL"
	case vendor.azure:
		return "Azure Database for PostgreSQL"
	case vendor.rds:
		return "Amazon RDS"
	case vendor.citus:
		return "Citus"
	default:
		return "PostgreSQL"
	}
}

func formatInfoBox(title string, rows [][2]string) string {
	labelWidth := 0
	for _, row := range rows {
		if len(row[0]) > labelWidth {
			labelWidth = len(row[0])
		}
	}
	lines := make([]string, 0, len(rows))
	width := len(title) + 5
	for _, row := range rows {
		line := row[0] + strings.Repeat(" ", labelWidth-len(row[0])) + "  " + row[1]
		lines = append(lines, line)
		if n := len(line) + 4; n > width {
			width = n
		}
	}
	var b strings.Builder
	topFill := width - len(title) - 5
	if topFill < 1 {
		topFill = 1
		width = len(title) + 6
	}
	fmt.Fprintf(&b, "+- %s %s+\n", title, strings.Repeat("-", topFill))
	for _, line := range lines {
		pad := width - len(line) - 4
		if pad < 0 {
			pad = 0
		}
		fmt.Fprintf(&b, "| %s%s |\n", line, strings.Repeat(" ", pad))
	}
	fmt.Fprintf(&b, "+%s+\n", strings.Repeat("-", width-2))
	return b.String()
}
