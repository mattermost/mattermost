// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testutils

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost-server/utils/fileutils"
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

// WasCalled reports whether a given callback channel was called
// within the specified time duration or not.
func WasCalled(c chan bool, duration time.Duration) bool {
	wasCalled := false
	select {
	case <-c:
		wasCalled = true
	case <-time.After(duration):
	}
	return wasCalled
}
