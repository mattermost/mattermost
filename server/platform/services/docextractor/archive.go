// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/mholt/archives"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// maxArchiveEntries caps how many files are walked per archive level to guard
// against CPU exhaustion from archives containing huge numbers of tiny files.
const maxArchiveEntries = 1000

type archiveExtractor struct {
	SubExtractor Extractor
}

func (ae *archiveExtractor) Name() string {
	return "archiveExtractor"
}

func (ae *archiveExtractor) Match(filename string) bool {
	_, _, err := archives.Identify(context.Background(), filename, nil)
	return err == nil
}

// getExtAlsoTarGz returns the extension of the given file name, special casing .tar.gz.
func getExtAlsoTarGz(name string) string {
	if strings.HasSuffix(name, ".tar.gz") {
		return ".tar.gz"
	}

	return filepath.Ext(name)
}

func (ae *archiveExtractor) Extract(name string, r io.ReadSeeker, maxFileSize int64, budget *ExtractionBudget) (string, error) {
	// Depth check: refuse to descend if the budget says we're too deep.
	// This prevents stack overflow from pathologically nested archives.
	if !budget.Descend() {
		return "", nil
	}
	defer budget.Ascend()

	// MM-65701: Skip 7zip files due to OOM vulnerability in bodgit/sevenzip library
	match, _ := (archives.SevenZip{}).Match(context.Background(), name, r)
	_, _ = r.Seek(0, io.SeekStart) // Reset reader position after Match reads from stream
	if match.ByName || match.ByStream {
		return "", nil
	}

	ext := getExtAlsoTarGz(name)

	// Create a temporary file, using `*` control the random component while preserving the extension.
	f, err := os.CreateTemp("", "archiver-*"+ext)
	if err != nil {
		return "", fmt.Errorf("error creating temporary file: %v", err)
	}
	defer os.Remove(f.Name())

	_, err = io.Copy(f, r)
	f.Close()
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}

	var text strings.Builder
	fsys, err := archives.FileSystem(context.Background(), f.Name(), nil)
	if err != nil {
		return "", fmt.Errorf("error creating file system: %w", err)
	}

	var entries int

	err = fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		if entries >= maxArchiveEntries || budget.Exhausted() {
			return fs.SkipAll
		}
		entries++

		pathEntry := path + " "
		text.WriteString(pathEntry)
		budget.Deduct(int64(len(pathEntry)))

		if ae.SubExtractor != nil && !budget.Exhausted() {
			filename := filepath.Base(path)
			filename = strings.ReplaceAll(filename, "-", " ")
			filename = strings.ReplaceAll(filename, ".", " ")
			filename = strings.ReplaceAll(filename, ",", " ")

			file, err := fsys.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()

			// Cap each entry at min(budget.Remaining(), maxFileSize) so the
			// aggregate across all entries and nesting levels shares one pool.
			limit := budget.Remaining()
			if maxFileSize > 0 && maxFileSize < limit {
				limit = maxFileSize
			}
			reader := utils.NewLimitedReaderWithError(file, limit)

			data, err := io.ReadAll(reader)
			if errors.Is(err, utils.ErrSizeLimitExceeded) {
				// Budget (or per-entry cap) hit; use whatever was read and
				// exhaust the budget so the walk stops at the next iteration.
				budget.Exhaust()
			} else if err != nil {
				return fmt.Errorf("error reading archive entry %s: %w", path, err)
			}

			subtext, extractErr := ae.SubExtractor.Extract(filename, bytes.NewReader(data), maxFileSize, budget)
			if extractErr == nil {
				subtextEntry := subtext + " "
				text.WriteString(subtextEntry)
				budget.Deduct(int64(len(subtextEntry)))
			}
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	return text.String(), nil
}
