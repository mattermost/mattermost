// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build maincoverage
// +build maincoverage

package main

import (
	"testing"
)

// TestRunMain can be used to track code coverage in integration tests.
// To run this:
// go test -coverpkg="<>" -ldflags '<>' -tags maincoverage -c ./cmd/mattermost/
// ./mattermost.test -test.run="^TestRunMain$" -test.coverprofile=coverage.out
// And then run your integration tests.
func TestRunMain(t *testing.T) {
	main()
}
