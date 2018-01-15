// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

import (
	"testing"
)

// TestCheckSupport is here for debugging purposes and has no assertions. You can quickly test
// sandboxing support with various systems by compiling the test executable and running this test on
// your target systems. For example, with docker, executed from the root of the repo:
//
// docker run --rm -it -w /go/src/github.com/mattermost/mattermost-server
//     -v $(pwd):/go/src/github.com/mattermost/mattermost-server golang:1.9
//     go test -c ./plugin/rpcplugin
//
// docker run --rm -it --privileged -w /opt/mattermost
//     -v $(pwd):/opt/mattermost centos:6
//     ./rpcplugin.test --test.v --test.run TestCheckSupport
func TestCheckSupport(t *testing.T) {
	if err := CheckSupport(); err != nil {
		t.Log(err.Error())
	}
}
