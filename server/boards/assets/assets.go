package assets

import (
	_ "embed"
)

// DefaultTemplatesArchive is an embedded archive file containing the default
// templates to be imported to team 0.
// This archive is generated with `make templates-archive`
//
//go:embed templates.boardarchive
var DefaultTemplatesArchive []byte
