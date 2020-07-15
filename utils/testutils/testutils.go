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

	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
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
	} else {
		return data.Bytes(), nil
	}
}

// GetInterface returns the best match of an interface that might be listening on a given port.
// This is helpful when a test is being run in a CI environment under docker.
func GetInterface(port int) string {
	dial := func(iface string, port int) bool {
		c, err := net.Dial("tcp", iface+":"+strconv.Itoa(port))
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
	if runtime.GOOS != "windows" {
		cmd := exec.Command("bash", "-c", `ifconfig | grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v 127.0.0.1 | awk '{ print $2 }' | cut -f2 -d: | head -n1`)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return ""
		}
		return string(out)
	}
	return ""
}
