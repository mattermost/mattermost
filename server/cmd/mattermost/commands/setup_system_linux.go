// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package commands

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"strings"
	"time"

	"golang.org/x/sys/unix"

	"github.com/mattermost/mattermost/server/public/model"
)

func collectSystemInfo() systemFacts {
	release, _ := os.ReadFile("/etc/os-release")
	redhat, _ := os.ReadFile("/etc/redhat-release")
	host, _ := os.Hostname()
	apparmor, apparmorWarning := readAppArmor()
	selinux, selinuxWarning := readSELinux()
	fapolicyd, fapolicydWarning := readFapolicyd()

	version := model.CurrentVersion
	if build := strings.TrimSpace(model.BuildNumber); build != "" && build != "dev" {
		version += " (" + build + ")"
	}
	rows := [][2]string{
		{"Mattermost", version},
		{"OS", osPrettyName(string(release), string(redhat))},
	}
	if kernel := kernelVersion(); kernel != "" {
		rows = append(rows, [2]string{"Kernel", kernel})
	}
	if host != "" {
		rows = append(rows, [2]string{"Hostname", host})
	}
	if systemd := systemdVersion(readSystemdVersion()); systemd != "" {
		rows = append(rows, [2]string{"systemd", systemd})
	}
	rows = append(rows,
		[2]string{"AppArmor", apparmor},
		[2]string{"SELinux", selinux},
		[2]string{"fapolicyd", fapolicyd},
	)
	var warnings []string
	for _, warning := range []string{apparmorWarning, selinuxWarning, fapolicydWarning} {
		if warning != "" {
			warnings = append(warnings, warning)
		}
	}
	return systemFacts{rows: rows, warnings: warnings}
}

func kernelVersion() string {
	var uname unix.Utsname
	if err := unix.Uname(&uname); err != nil {
		return ""
	}
	release := utsField(uname.Release[:])
	machine := utsField(uname.Machine[:])
	if release == "" {
		return machine
	}
	if machine == "" {
		return release
	}
	return release + " " + machine
}

func utsField(raw []byte) string {
	if n := bytes.IndexByte(raw, 0); n >= 0 {
		raw = raw[:n]
	}
	return string(raw)
}

func readAppArmor() (string, string) {
	enabled, err := os.ReadFile("/sys/module/apparmor/parameters/enabled")
	if err != nil {
		return apparmorStatus("", "", false)
	}
	profiles, err := os.ReadFile("/sys/kernel/security/apparmor/profiles")
	if err != nil {
		return apparmorStatus(string(enabled), "", false)
	}
	return apparmorStatus(string(enabled), string(profiles), true)
}

func readSELinux() (string, string) {
	data, err := os.ReadFile("/sys/fs/selinux/enforce")
	if err != nil {
		return selinuxStatus("", true, "")
	}
	return selinuxStatus(string(data), false, selinuxLabel(currentExecutable()))
}

func selinuxLabel(path string) string {
	if path == "" {
		return ""
	}
	buf := make([]byte, 256)
	n, err := unix.Getxattr(path, "security.selinux", buf)
	if err != nil || n <= 0 {
		return ""
	}
	return string(buf[:n])
}

func currentExecutable() string {
	path, err := os.Executable()
	if err != nil {
		return ""
	}
	return path
}

func readFapolicyd() (string, string) {
	installed := false
	for _, path := range []string{"/usr/sbin/fapolicyd", "/usr/bin/fapolicyd", "/etc/fapolicyd/fapolicyd.conf"} {
		if _, err := os.Stat(path); err == nil {
			installed = true
			break
		}
	}
	running := systemctlActive("fapolicyd")
	if running {
		installed = true
	}
	return fapolicydStatus(installed, running)
}

func systemctlActive(unit string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, "systemctl", "is-active", "--quiet", unit).Run() == nil
}

func readSystemdVersion() string {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "systemctl", "--version").Output()
	if err != nil {
		return ""
	}
	return string(out)
}
