// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"context"
	"io"
)

// Extractors define the interface needed to extract file content
type Extractor interface {
	Match(filename string) bool
	Extract(ctx context.Context, filename string, file io.ReadSeeker, maxFileSize int64) (string, error)
	Name() string
}
