// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build unused

package build

// Track all the `go install` tools we use when building.

// This allows the versions to live in go.mod and thus effectively get cached by CI instead of
// constantly being reinstalled. We use an (unused) build tag to ensure nothing actually gets
// included from these packages in the final artifacts.
// but using a build tag to prevent this file from ever being part of the final by-product.
import (
	_ "github.com/golang/mock/mockgen"
	_ "github.com/golangci/golangci-lint/cmd/golangci-lint"
	_ "github.com/mattermost/mattermost-utilities/mmgotool"
	_ "github.com/mattermost/morph/cmd/morph"
	_ "github.com/reflog/struct2interface"
	_ "github.com/vektra/mockery/v2"
	_ "gotest.tools/gotestsum"
)
