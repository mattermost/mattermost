// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"cmp"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// hostOSPaths holds the files used to identify the host OS.
// These are package-level variables so they can be overridden in tests.
var hostOSPaths = struct {
	osRelease        []string
	containerMarkers []string
}{
	// os-release(5): /etc/os-release takes precedence, /usr/lib/os-release is the fallback.
	osRelease:        []string{"/etc/os-release", "/usr/lib/os-release"},
	containerMarkers: []string{"/.dockerenv", "/run/.containerenv"},
}

// osReleaseUnescaper undoes the shell escapes os-release(5) allows in double-quoted values.
var osReleaseUnescaper = strings.NewReplacer(`\\`, `\`, `\"`, `"`, `\$`, `$`, "\\`", "`")

// cgroupContainerSegments and cgroupContainerPrefixes match the cgroup path segments that container
// runtimes create, e.g. /docker/<id>, /lxc/<name>, kubepods.slice or docker-<id>.scope.
var (
	cgroupContainerSegments = []string{"docker", "lxc"}
	cgroupContainerPrefixes = []string{"kubepods", "docker-", "libpod-", "crio-", "cri-containerd-", "lxc.payload"}
)

func getOSRelease() (*model.SupportPacketOSRelease, error) {
	for _, path := range hostOSPaths.osRelease {
		data, err := os.ReadFile(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		return parseOSRelease(string(data)), nil
	}
	return nil, fmt.Errorf("no os-release file at %s", strings.Join(hostOSPaths.osRelease, " or "))
}

// parseOSRelease parses the KEY=value lines of an os-release(5) file.
func parseOSRelease(contents string) *model.SupportPacketOSRelease {
	values := make(map[string]string)
	for line := range strings.SplitSeq(contents, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[key] = unquoteOSReleaseValue(value)
	}

	return &model.SupportPacketOSRelease{
		// os-release(5) defines "linux" as the default ID.
		ID:         cmp.Or(values["ID"], "linux"),
		VersionID:  values["VERSION_ID"],
		PlatformID: values["PLATFORM_ID"],
		PrettyName: values["PRETTY_NAME"],
	}
}

func unquoteOSReleaseValue(value string) string {
	if len(value) < 2 || value[0] != value[len(value)-1] {
		return value
	}
	switch value[0] {
	case '"':
		return osReleaseUnescaper.Replace(value[1 : len(value)-1])
	case '\'':
		return value[1 : len(value)-1]
	}
	return value
}

func getRunningInContainer(installationType string) (*bool, error) {
	// The official Docker image sets MM_INSTALL_TYPE=docker.
	if installationType == "docker" {
		return new(true), nil
	}
	// Kubernetes sets this in every pod. containerd creates no marker file, and its pods usually have a
	// private cgroup namespace, so their cgroup path is "/".
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return new(true), nil
	}
	var markerErr error
	for _, path := range hostOSPaths.containerMarkers {
		_, err := os.Stat(path)
		if err == nil {
			return new(true), nil
		}
		if !errors.Is(err, os.ErrNotExist) && markerErr == nil {
			markerErr = err
		}
	}
	cgroup, err := readFile(resourcePaths.procSelfCgroup)
	if err != nil {
		return nil, err
	}
	if cgroupIndicatesContainer(cgroup) {
		return new(true), nil
	}
	if markerErr != nil {
		return nil, markerErr
	}
	return new(false), nil
}

// cgroupIndicatesContainer reports whether any cgroup v1 or v2 path in /proc/self/cgroup was
// created by a container runtime. In a private cgroup namespace the path is "/", so this misses
// containers that only the marker files or MM_INSTALL_TYPE reveal.
func cgroupIndicatesContainer(contents string) bool {
	for line := range strings.SplitSeq(contents, "\n") {
		parts := strings.SplitN(line, ":", 3)
		if len(parts) != 3 {
			continue
		}
		for segment := range strings.SplitSeq(strings.ToLower(parts[2]), "/") {
			if slices.Contains(cgroupContainerSegments, segment) ||
				slices.ContainsFunc(cgroupContainerPrefixes, func(prefix string) bool { return strings.HasPrefix(segment, prefix) }) {
				return true
			}
		}
	}
	return false
}
