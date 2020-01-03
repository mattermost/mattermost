// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"go/token"
	"os"
	"path/filepath"
)

func renderWithFilePosition(fset *token.FileSet, pos token.Pos, msg string) string {
	var cwd string
	if d, err := os.Getwd(); err == nil {
		cwd = d
	}

	fpos := fset.Position(pos)

	filename, err := filepath.Rel(cwd, fpos.Filename)
	if err != nil {
		// If deriving a relative path fails for some reason,
		// we prefer to still print the absolute path to the file.
		filename = fpos.Filename
	}

	return fmt.Sprintf("%s:%d:%d: %s", filename, fpos.Line, fpos.Column, msg)
}
