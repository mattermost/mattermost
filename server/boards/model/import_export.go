// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
)

var (
	ErrInvalidImageBlock = errors.New("invalid image block")
)

// Archive is an import / export archive.
// TODO: remove once default templates are converted to new archive format.
type Archive struct {
	Version int64   `json:"version"`
	Date    int64   `json:"date"`
	Blocks  []Block `json:"blocks"`
}

// ArchiveHeader is the content of the first file (`version.json`) within an archive.
type ArchiveHeader struct {
	Version int   `json:"version"`
	Date    int64 `json:"date"`
}

// ArchiveLine is any line in an archive.
type ArchiveLine struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// ExportArchiveOptions provides options when exporting one or more boards
// to an archive.
type ExportArchiveOptions struct {
	TeamID string

	// BoardIDs is the list of boards to include in the archive.
	// Empty slice means export all boards from workspace/team.
	BoardIDs []string
}

// ImportArchiveOptions provides options when importing an archive.
type ImportArchiveOptions struct {
	TeamID        string
	ModifiedBy    string
	BoardModifier BoardModifier
	BlockModifier BlockModifier
}

// ErrUnsupportedArchiveVersion is an error returned when trying to import an
// archive with a version that this server does not support.
type ErrUnsupportedArchiveVersion struct {
	got  int
	want int
}

// NewErrUnsupportedArchiveVersion creates a ErrUnsupportedArchiveVersion error.
func NewErrUnsupportedArchiveVersion(got int, want int) ErrUnsupportedArchiveVersion {
	return ErrUnsupportedArchiveVersion{
		got:  got,
		want: want,
	}
}

func (e ErrUnsupportedArchiveVersion) Error() string {
	return fmt.Sprintf("unsupported archive version; got %d, want %d", e.got, e.want)
}

// ErrUnsupportedArchiveLineType is an error returned when trying to import an
// archive containing an unsupported line type.
type ErrUnsupportedArchiveLineType struct {
	line int
	got  string
}

// NewErrUnsupportedArchiveLineType creates a ErrUnsupportedArchiveLineType error.
func NewErrUnsupportedArchiveLineType(line int, got string) ErrUnsupportedArchiveLineType {
	return ErrUnsupportedArchiveLineType{
		line: line,
		got:  got,
	}
}

func (e ErrUnsupportedArchiveLineType) Error() string {
	return fmt.Sprintf("unsupported archive line type; got %s, line %d", e.got, e.line)
}
