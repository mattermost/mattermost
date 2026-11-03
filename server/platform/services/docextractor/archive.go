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
	"path"
	"path/filepath"
	"slices"
	"strings"

	"github.com/mholt/archives"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// maxArchiveEntries caps how many files are walked per archive level to guard
// against CPU exhaustion from archives containing huge numbers of tiny files.
const maxArchiveEntries = 1000

// maxArchivePathDepth is the maximum number of slash-separated components
// accepted for one archive member path.
const maxArchivePathDepth = 100

// maxArchiveNameLength is the maximum byte length accepted for one archive
// member name.
const maxArchiveNameLength = 4096

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

// archiveMember is one non-directory member held until names can be applied in order.
type archiveMember struct {
	name     string
	data     []byte
	hitLimit bool
}

func (ae *archiveExtractor) Extract(ctx context.Context, name string, r io.ReadSeeker, maxFileSize int64, budget *ExtractionBudget) (string, error) {
	// Depth check: refuse to descend if the budget says we're too deep.
	// This prevents stack overflow from pathologically nested archives.
	if !budget.Descend() {
		return "", nil
	}
	defer budget.Ascend()

	if err := ctx.Err(); err != nil {
		return "", err
	}

	// MM-65701: Skip 7zip files due to OOM vulnerability in bodgit/sevenzip library
	match, _ := (archives.SevenZip{}).Match(ctx, name, r)
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
	defer f.Close()

	_, err = io.Copy(f, r)
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}
	if _, err = f.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}

	format, _, err := archives.Identify(ctx, name, f)
	if err != nil {
		return "", fmt.Errorf("error creating file system: %w", err)
	}
	extractor, ok := format.(archives.Extractor)
	if !ok {
		return "", fmt.Errorf("error creating file system: unsupported format")
	}
	if _, err = f.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("error creating file system: %w", err)
	}

	var text strings.Builder
	var entries int
	// Sub-extractor output is applied in name order, matching a directory walk,
	// so a shared budget sees members in that order. Bodies are read here because
	// sequential formats only allow reading a member inside this callback.
	var pending []archiveMember
	var buffered int64

	err = extractor.Extract(ctx, f, func(ctx context.Context, file archives.FileInfo) error {
		if entries >= maxArchiveEntries || budget.Exhausted() {
			return fs.SkipAll
		}
		entries++

		memberName := file.NameInArchive
		if !archiveMemberWithinLimits(memberName) {
			return nil
		}
		if file.IsDir() {
			return nil
		}
		memberName = path.Clean(memberName)
		if memberName == "." {
			return nil
		}

		if ae.SubExtractor == nil {
			ae.writeMember(ctx, &text, memberName, nil, false, maxFileSize, budget)
			return nil
		}

		room := budget.Remaining() - buffered
		if room <= 0 {
			return fs.SkipAll
		}
		data, hitLimit, readErr := readArchiveMember(file, room, maxFileSize)
		if readErr != nil {
			return readErr
		}
		pending = append(pending, archiveMember{name: memberName, data: data, hitLimit: hitLimit})
		buffered += int64(len(data))
		// A read that reaches the size limit consumes the shared budget, so later
		// members are not read. The same applies once buffered bodies fill it.
		if hitLimit || buffered >= budget.Remaining() {
			return fs.SkipAll
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	slices.SortFunc(pending, func(a, b archiveMember) int {
		return strings.Compare(a.name, b.name)
	})
	for _, member := range pending {
		if budget.Exhausted() {
			break
		}
		ae.writeMember(ctx, &text, member.name, member.data, member.hitLimit, maxFileSize, budget)
	}

	return text.String(), nil
}

// archiveMemberWithinLimits reports whether name is within the per-member path limits.
func archiveMemberWithinLimits(name string) bool {
	if len(name) > maxArchiveNameLength {
		return false
	}
	if n := len(name); n > 0 && name[n-1] == '/' {
		name = name[:n-1]
	}
	if name == "" || name == "." {
		return true
	}
	return strings.Count(name, "/")+1 <= maxArchivePathDepth
}

func readArchiveMember(file archives.FileInfo, room, maxFileSize int64) ([]byte, bool, error) {
	opened, err := file.Open()
	if err != nil {
		return nil, false, err
	}
	defer opened.Close()

	limit := room
	if maxFileSize > 0 && maxFileSize < limit {
		limit = maxFileSize
	}
	reader := utils.NewLimitedReaderWithError(opened, limit)

	data, err := io.ReadAll(reader)
	if errors.Is(err, utils.ErrSizeLimitExceeded) {
		return data, true, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("error reading archive entry: %w", err)
	}
	return data, false, nil
}

func (ae *archiveExtractor) writeMember(ctx context.Context, text *strings.Builder, memberPath string, data []byte, hitLimit bool, maxFileSize int64, budget *ExtractionBudget) {
	pathEntry := memberPath + " "
	text.WriteString(pathEntry)
	budget.Deduct(int64(len(pathEntry)))

	if ae.SubExtractor == nil || budget.Exhausted() {
		return
	}
	if hitLimit {
		budget.Exhaust()
		return
	}

	filename := filepath.Base(memberPath)
	filename = strings.ReplaceAll(filename, "-", " ")
	filename = strings.ReplaceAll(filename, ".", " ")
	filename = strings.ReplaceAll(filename, ",", " ")

	subtext, extractErr := ae.SubExtractor.Extract(ctx, filename, bytes.NewReader(data), maxFileSize, budget)
	if extractErr == nil && budget.Remaining() > 0 {
		subtextEntry := subtext + " "
		if int64(len(subtextEntry)) > budget.Remaining() {
			subtextEntry = subtextEntry[:budget.Remaining()]
			text.WriteString(subtextEntry)
			budget.Exhaust()
		} else {
			text.WriteString(subtextEntry)
			budget.Deduct(int64(len(subtextEntry)))
		}
	}
}
