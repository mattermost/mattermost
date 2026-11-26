// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8"
)

func osReleaseSample(name string) string {
	return filepath.Join(server.GetPackagePath(), "channels", "app", "platform", "testdata", "os_release", name)
}

func setHostOSPaths(t *testing.T, osRelease, containerMarkers []string) {
	t.Helper()
	original := hostOSPaths
	t.Cleanup(func() { hostOSPaths = original })
	hostOSPaths.osRelease = osRelease
	hostOSPaths.containerMarkers = containerMarkers
}

func TestParseOSRelease(t *testing.T) {
	t.Run("distribution samples", func(t *testing.T) {
		for _, tc := range []struct {
			file     string
			expected model.SupportPacketOSRelease
		}{
			{"rhel8", model.SupportPacketOSRelease{ID: "rhel", VersionID: "8.10", PlatformID: "platform:el8", PrettyName: "Red Hat Enterprise Linux 8.10 (Ootpa)"}},
			{"rocky8", model.SupportPacketOSRelease{ID: "rocky", VersionID: "8.10", PlatformID: "platform:el8", PrettyName: "Rocky Linux 8.10 (Green Obsidian)"}},
			{"ubuntu2404", model.SupportPacketOSRelease{ID: "ubuntu", VersionID: "24.04", PrettyName: "Ubuntu 24.04.3 LTS"}},
			{"debian13", model.SupportPacketOSRelease{ID: "debian", VersionID: "13", PrettyName: "Debian GNU/Linux 13 (trixie)"}},
		} {
			t.Run(tc.file, func(t *testing.T) {
				data, err := os.ReadFile(osReleaseSample(tc.file))
				require.NoError(t, err)
				assert.Equal(t, &tc.expected, parseOSRelease(string(data)))
			})
		}
	})

	t.Run("quoting, comments and blank lines", func(t *testing.T) {
		contents := strings.Join([]string{
			"# comment with ID=commented",
			"",
			"   ",
			"  ID=arch  ",
			"not a key value line",
			`VERSION_ID='2024\$01'`,
			`PLATFORM_ID="platform:\"quoted\" \$HOME \\ \` + "`x`" + `"`,
			`PRETTY_NAME="Arch Linux"`,
		}, "\n")

		assert.Equal(t, &model.SupportPacketOSRelease{
			ID:         "arch",
			VersionID:  `2024\$01`,
			PlatformID: "platform:\"quoted\" $HOME \\ `x`",
			PrettyName: "Arch Linux",
		}, parseOSRelease(contents))
	})

	t.Run("mismatched or lone quotes are kept", func(t *testing.T) {
		assert.Equal(t, `"rhel'`, parseOSRelease(`ID="rhel'`).ID)
		assert.Equal(t, `"`, parseOSRelease(`ID="`).ID)
	})

	t.Run("missing keys", func(t *testing.T) {
		assert.Equal(t, &model.SupportPacketOSRelease{ID: "linux"}, parseOSRelease("NAME=\"Some Linux\"\n"))
		assert.Equal(t, &model.SupportPacketOSRelease{ID: "linux"}, parseOSRelease(""))
		assert.Equal(t, "linux", parseOSRelease(`ID=""`).ID)
	})
}

func TestGetOSRelease(t *testing.T) {
	dir := t.TempDir()
	etc := filepath.Join(dir, "etc-os-release")

	t.Run("prefers the first file", func(t *testing.T) {
		setHostOSPaths(t, []string{
			writeTempCgroupFile(t, dir, "first", "ID=rocky\n"),
			writeTempCgroupFile(t, dir, "second", "ID=debian\n"),
		}, nil)

		osRelease, err := getOSRelease()
		require.NoError(t, err)
		assert.Equal(t, "rocky", osRelease.ID)
	})

	t.Run("falls back when the first file is missing", func(t *testing.T) {
		setHostOSPaths(t, []string{etc, writeTempCgroupFile(t, dir, "usr-lib-os-release", "ID=debian\n")}, nil)

		osRelease, err := getOSRelease()
		require.NoError(t, err)
		assert.Equal(t, "debian", osRelease.ID)
	})

	t.Run("fails when no file exists", func(t *testing.T) {
		setHostOSPaths(t, []string{etc, filepath.Join(dir, "missing")}, nil)

		osRelease, err := getOSRelease()
		require.ErrorContains(t, err, "no os-release file at "+etc+" or ")
		assert.Nil(t, osRelease)
	})

	t.Run("fails without falling back when the first file is unreadable", func(t *testing.T) {
		// A directory exists but can't be read as a file.
		setHostOSPaths(t, []string{dir, writeTempCgroupFile(t, dir, "usr-lib-os-release", "ID=debian\n")}, nil)

		osRelease, err := getOSRelease()
		require.Error(t, err)
		assert.Nil(t, osRelease)
	})
}

func TestGetKernelRelease(t *testing.T) {
	expected, err := os.ReadFile("/proc/sys/kernel/osrelease")
	require.NoError(t, err)

	kernelRelease, err := getKernelRelease()
	require.NoError(t, err)
	require.NotNil(t, kernelRelease)
	assert.Equal(t, strings.TrimSpace(string(expected)), *kernelRelease)
}

func TestGetRunningInContainer(t *testing.T) {
	originalPaths := resourcePaths
	t.Cleanup(func() { resourcePaths = originalPaths })
	dir := t.TempDir()
	missingMarker := filepath.Join(dir, "missing-dockerenv")
	hostCgroup := "0::/system.slice/mattermost.service\n"

	runningInContainer := func(t *testing.T, installationType, cgroup string, markers ...string) bool {
		t.Helper()
		setHostOSPaths(t, nil, append([]string{missingMarker}, markers...))
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup", cgroup)

		result, err := getRunningInContainer(installationType)
		require.NoError(t, err)
		require.NotNil(t, result)
		return *result
	}

	for name, cgroup := range map[string]string{
		"host process":             hostCgroup,
		"cgroup v1 host process":   "1:name=systemd:/user.slice/user-1000.slice/session-2.scope\n2:cpu:/user.slice\n",
		"private cgroup namespace": "0::/\n",
	} {
		t.Run(name, func(t *testing.T) {
			assert.False(t, runningInContainer(t, "unknown", cgroup))
		})
	}

	t.Run("official Docker image", func(t *testing.T) {
		assert.True(t, runningInContainer(t, "docker", hostCgroup))
	})

	t.Run("official Docker image without a readable cgroup file", func(t *testing.T) {
		setHostOSPaths(t, nil, []string{missingMarker})
		resourcePaths.procSelfCgroup = filepath.Join(dir, "missing-cgroup")

		result, err := getRunningInContainer("docker")
		require.NoError(t, err)
		assert.Equal(t, new(true), result)
	})

	t.Run("container marker file", func(t *testing.T) {
		assert.True(t, runningInContainer(t, "unknown", hostCgroup, writeTempCgroupFile(t, dir, ".containerenv", "")))
	})

	for name, cgroup := range map[string]string{
		"cgroup v1 Docker":             "12:memory:/docker/0123456789abcdef\n11:cpu:/docker/0123456789abcdef\n",
		"cgroup v2 Docker systemd":     "0::/system.slice/docker-0123456789abcdef.scope\n",
		"cgroup v2 Kubernetes":         "0::/kubepods.slice/kubepods-burstable.slice/cri-containerd-0123.scope\n",
		"cgroup v2 Podman":             "0::/machine.slice/libpod-0123456789abcdef.scope/container\n",
		"cgroup v1 containerd":         "4:memory:/default/containerd-0123456789abcdef\n",
		"cgroup v2 CRI-O":              "0::/machine.slice/crio-0123456789abcdef.scope\n",
		"cgroup v1 LXC, mixed entries": "1:name=systemd:/\n2:cpuset:/lxc/mattermost\n",
	} {
		t.Run(name, func(t *testing.T) {
			assert.True(t, runningInContainer(t, "unknown", cgroup))
		})
	}

	t.Run("uninspectable marker without a positive cgroup result", func(t *testing.T) {
		notADir := writeTempCgroupFile(t, dir, "not-a-dir", "")
		setHostOSPaths(t, nil, []string{filepath.Join(notADir, ".dockerenv")})
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup", hostCgroup)

		result, err := getRunningInContainer("unknown")
		require.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("uninspectable marker with a positive cgroup result", func(t *testing.T) {
		notADir := writeTempCgroupFile(t, dir, "not-a-dir", "")
		setHostOSPaths(t, nil, []string{filepath.Join(notADir, ".dockerenv")})
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup", "0::/system.slice/docker-0123.scope\n")

		result, err := getRunningInContainer("unknown")
		require.NoError(t, err)
		assert.Equal(t, new(true), result)
	})

	t.Run("unreadable cgroup file", func(t *testing.T) {
		setHostOSPaths(t, nil, []string{missingMarker})
		resourcePaths.procSelfCgroup = filepath.Join(dir, "missing-cgroup")

		result, err := getRunningInContainer("unknown")
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestGetSupportPacketDiagnosticsOSRelease(t *testing.T) {
	th := Setup(t)
	th.Service.UpdateConfig(func(cfg *model.Config) {
		cfg.FileSettings.Directory = model.NewPointer(t.TempDir())
	})

	t.Run("reads the default os-release paths", func(t *testing.T) {
		nodeDiagnostics, err := th.Service.GetSupportPacketDiagnostics(th.Context)
		require.NoError(t, err)
		require.NotNil(t, nodeDiagnostics.Diagnostics.Server.OSRelease)
		assert.NotEmpty(t, nodeDiagnostics.Diagnostics.Server.OSRelease.ID)
	})

	t.Run("collects os-release, kernel release and container detection", func(t *testing.T) {
		setHostOSPaths(t, []string{osReleaseSample("rhel8")}, hostOSPaths.containerMarkers)

		nodeDiagnostics, err := th.Service.GetSupportPacketDiagnostics(th.Context)
		require.NoError(t, err)
		assert.NoError(t, nodeDiagnostics.Errors[model.SectionServerHost])

		serverDiagnostics := nodeDiagnostics.Diagnostics.Server
		assert.Equal(t, &model.SupportPacketOSRelease{
			ID:         "rhel",
			VersionID:  "8.10",
			PlatformID: "platform:el8",
			PrettyName: "Red Hat Enterprise Linux 8.10 (Ootpa)",
		}, serverDiagnostics.OSRelease)
		require.NotNil(t, serverDiagnostics.KernelRelease)
		assert.NotEmpty(t, *serverDiagnostics.KernelRelease)
		assert.NotNil(t, serverDiagnostics.RunningInContainer)
	})

	t.Run("container detection uses the installation type", func(t *testing.T) {
		originalPaths := resourcePaths
		t.Cleanup(func() { resourcePaths = originalPaths })
		originalInstallType := th.Service.installTypeOverride
		t.Cleanup(func() { th.Service.installTypeOverride = originalInstallType })
		dir := t.TempDir()
		setHostOSPaths(t, hostOSPaths.osRelease, []string{filepath.Join(dir, "missing-dockerenv")})
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup", "0::/system.slice/mattermost.service\n")

		for installType, expected := range map[string]bool{"docker": true, "tar": false} {
			th.Service.installTypeOverride = installType
			nodeDiagnostics, err := th.Service.GetSupportPacketDiagnostics(th.Context)
			require.NoError(t, err)
			assert.Equal(t, &expected, nodeDiagnostics.Diagnostics.Server.RunningInContainer, "installation type %q", installType)
		}
	})

	t.Run("failed container detection fails the server host section", func(t *testing.T) {
		originalPaths := resourcePaths
		t.Cleanup(func() { resourcePaths = originalPaths })
		originalInstallType := th.Service.installTypeOverride
		t.Cleanup(func() { th.Service.installTypeOverride = originalInstallType })
		th.Service.installTypeOverride = "tar"
		dir := t.TempDir()
		setHostOSPaths(t, hostOSPaths.osRelease, []string{filepath.Join(dir, "missing-dockerenv")})
		resourcePaths.procSelfCgroup = filepath.Join(dir, "missing-cgroup")

		nodeDiagnostics, err := th.Service.GetSupportPacketDiagnostics(th.Context)
		require.ErrorContains(t, err, "error while detecting container")
		require.ErrorContains(t, nodeDiagnostics.Errors[model.SectionServerHost], "error while detecting container")
		assert.Nil(t, nodeDiagnostics.Diagnostics.Server.RunningInContainer)

		fileData, err := supportPacketDiagnosticsFile(nodeDiagnostics.Diagnostics, nil)
		require.NoError(t, err)
		assert.NotContains(t, string(fileData.Body), "\n  running_in_container:")
	})

	t.Run("missing os-release fails the server host section only", func(t *testing.T) {
		setHostOSPaths(t, []string{filepath.Join(t.TempDir(), "missing")}, hostOSPaths.containerMarkers)

		nodeDiagnostics, err := th.Service.GetSupportPacketDiagnostics(th.Context)
		require.ErrorContains(t, err, "error while reading os-release")
		require.ErrorContains(t, nodeDiagnostics.Errors[model.SectionServerHost], "error while reading os-release")
		for section, sectionErr := range nodeDiagnostics.Errors {
			if section != model.SectionServerHost {
				assert.NoError(t, sectionErr, "section %q", section)
			}
		}

		serverDiagnostics := nodeDiagnostics.Diagnostics.Server
		assert.Nil(t, serverDiagnostics.OSRelease)
		assert.NotNil(t, serverDiagnostics.KernelRelease)
		assert.NotNil(t, serverDiagnostics.RunningInContainer)

		fileData, err := supportPacketDiagnosticsFile(nodeDiagnostics.Diagnostics, nil)
		require.NoError(t, err)
		assert.NotContains(t, string(fileData.Body), "os_release")
		assert.Contains(t, string(fileData.Body), "kernel_release: "+*serverDiagnostics.KernelRelease)
	})
}
