// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testutils

import (
	"bytes"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/channels/utils"

	"github.com/mattermost/mattermost-server/server/v8/channels/utils/fileutils"
)

func ReadTestFile(name string) ([]byte, error) {
	path, _ := fileutils.FindDir("tests")
	file, err := os.Open(filepath.Join(path, name))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := &bytes.Buffer{}
	if _, err := io.Copy(data, file); err != nil {
		return nil, err
	}
	return data.Bytes(), nil
}

// GetInterface returns the best match of an interface that might be listening on a given port.
// This is helpful when a test is being run in a CI environment under docker.
func GetInterface(port int) string {
	dial := func(iface string, port int) bool {
		c, err := net.DialTimeout("tcp", iface+":"+strconv.Itoa(port), time.Second)
		if err != nil {
			return false
		}
		c.Close()
		return true
	}
	// First, we check dockerhost
	iface := "dockerhost"
	if ok := dial(iface, port); ok {
		return iface
	}
	// If not, we check localhost
	iface = "localhost"
	if ok := dial(iface, port); ok {
		return iface
	}
	// If nothing works, we just attempt to use a hack and get the interface IP.
	// https://stackoverflow.com/a/37212665/4962526.
	cmdStr := ""
	switch runtime.GOOS {
	// Using ip address for Linux, ifconfig for Darwin.
	case "linux":
		cmdStr = `ip address | grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v 127.0.0.1 | awk '{ print $2 }' | cut -f2 -d: | cut -f1 -d/ | head -n1`
	case "darwin":
		cmdStr = `ifconfig | grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v 127.0.0.1 | awk '{ print $2 }' | cut -f2 -d: | head -n1`
	default:
		return ""
	}
	cmd := exec.Command("bash", "-c", cmdStr)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return ""
	}
	return string(out)
}

func ResetLicenseValidator() {
	utils.LicenseValidator = &utils.LicenseValidatorImpl{}
}
