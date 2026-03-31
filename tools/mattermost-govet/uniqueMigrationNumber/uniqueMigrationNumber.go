// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package uniqueMigrationNumber

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/tools/go/analysis"
)

var sqlPath string

var migrationNumberRegex = regexp.MustCompile(`^\d+`)

var Analyzer = &analysis.Analyzer{
	Name: "uniqueMigrationNumber",
	Doc:  "checks that each migration number is used by exactly one migration file",
	Run:  run,
}

func init() {
	Analyzer.Flags.StringVar(&sqlPath, "path", "", "Relative path to a directory of .sql migration files to scan")
}

func run(pass *analysis.Pass) (interface{}, error) {
	if sqlPath == "" {
		return nil, nil
	}
	if err := checkMigrationDir(pass, sqlPath); err != nil {
		return nil, err
	}
	return nil, nil
}

func getMigrationNumberFromFilename(filename string) int {
	m := migrationNumberRegex.FindString(filename)
	if m == "" {
		return -1
	}
	n, _ := strconv.Atoi(m)
	return n
}

func checkMigrationDir(pass *analysis.Pass, root string) error {
	// Collect migration number -> list of .up.sql filenames
	seen := make(map[int][]string)

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".up.sql") {
			return nil
		}
		if n := getMigrationNumberFromFilename(d.Name()); n >= 0 {
			seen[n] = append(seen[n], path)
		}
		return nil
	})
	if err != nil {
		return err
	}

	// Collect duplicate numbers and sort for deterministic output
	var dupes []int
	for n, files := range seen {
		if len(files) > 1 {
			dupes = append(dupes, n)
		}
	}
	sort.Ints(dupes)

	for _, n := range dupes {
		files := seen[n]
		sort.Strings(files)
		// Use the first file for the diagnostic position
		content, err := os.ReadFile(files[0])
		if err != nil {
			return err
		}
		tf := pass.Fset.AddFile(files[0], -1, len(content))
		tf.SetLinesForContent(content)

		names := make([]string, len(files))
		for i, f := range files {
			names[i] = filepath.Base(f)
		}
		pass.Reportf(tf.Pos(0), "duplicate migration number %06d: %s", n, strings.Join(names, ", "))
	}

	return nil
}
