// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeZip(t *testing.T, entries map[string][]byte) *bytes.Reader {
	t.Helper()
	buf := &bytes.Buffer{}
	w := zip.NewWriter(buf)
	for name, content := range entries {
		f, err := w.Create(name)
		require.NoError(t, err)
		_, err = f.Write(content)
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	return bytes.NewReader(buf.Bytes())
}

// makeTarGz builds a gzip-compressed tar from write.
func makeTarGz(t *testing.T, write func(t *testing.T, tw *tar.Writer)) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	write(t, tw)
	require.NoError(t, tw.Close())
	require.NoError(t, gz.Close())
	return buf.Bytes()
}

// makeTar builds an uncompressed tar from write.
func makeTar(t *testing.T, write func(t *testing.T, tw *tar.Writer)) []byte {
	t.Helper()
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	write(t, tw)
	require.NoError(t, tw.Close())
	return buf.Bytes()
}

// memberPath returns a slash-separated path of components names, using leaf last.
func memberPath(components int, leaf string) string {
	parts := make([]string, components)
	for i := range parts {
		parts[i] = "a"
	}
	parts[components-1] = leaf
	return strings.Join(parts, "/")
}

// writeTarMembers writes n zero-length members. dir selects directory members.
func writeTarMembers(t *testing.T, tw *tar.Writer, n int, dir bool) {
	t.Helper()
	for i := range n {
		hdr := &tar.Header{
			Name:     fmt.Sprintf("m%05d", i),
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}
		if dir {
			hdr.Name += "/"
			hdr.Mode = 0o755
			hdr.Typeflag = tar.TypeDir
		}
		require.NoError(t, tw.WriteHeader(hdr))
	}
}

func TestArchiveExtractorEntryLimit(t *testing.T) {
	entries := make(map[string][]byte, maxArchiveEntries+100)
	for i := range maxArchiveEntries + 100 {
		entries[fmt.Sprintf("file%04d.txt", i)] = []byte("x")
	}
	r := makeZip(t, entries)

	ae := &archiveExtractor{}
	result, err := ae.Extract(context.Background(), "test.zip", r, 0, newExtractionBudget(maxArchiveExtractedText*10, defaultMaxArchiveDepth))
	require.NoError(t, err)

	// Count distinct "file" tokens in the output path list.
	count := strings.Count(result, "file")
	assert.LessOrEqual(t, count, maxArchiveEntries, "should stop walking after maxArchiveEntries files")
}

func TestArchiveExtractorBudgetLimit(t *testing.T) {
	// First entry fills the aggregate budget; second must not appear in output.
	largeContent := bytes.Repeat([]byte("a"), int(maxArchiveExtractedText)+1024)
	r := makeZip(t, map[string][]byte{
		"large.txt":  largeContent,
		"second.txt": []byte("shouldnotappear"),
	})

	ae := &archiveExtractor{SubExtractor: &plainExtractor{}}
	result, err := ae.Extract(context.Background(), "test.zip", r, 0, newExtractionBudget(maxArchiveExtractedText, defaultMaxArchiveDepth))
	require.NoError(t, err)

	assert.NotContains(t, result, "shouldnotappear", "second entry should be skipped once budget is exhausted")
	assert.LessOrEqual(t, len(result), int(maxArchiveExtractedText)+256, "total output should not exceed budget by more than a path-length overhead")
}

func TestArchiveExtractorDepthLimit(t *testing.T) {
	const marker = "deepcontent"

	// Build from the inside out: a plain text file wrapped in defaultMaxArchiveDepth+2
	// levels of ZIP so the content sits well beyond the extraction depth limit.
	r := makeZip(t, map[string][]byte{"inner.txt": []byte(marker)})
	for range defaultMaxArchiveDepth + 2 {
		data, err := io.ReadAll(r)
		require.NoError(t, err)
		r = makeZip(t, map[string][]byte{"nested.zip": data})
	}

	// Self-referential extractor: every nested ZIP entry is handed back to the
	// same archiveExtractor, giving us arbitrary-depth recursion bounded only by
	// the budget's maxDepth.
	ae := &archiveExtractor{}
	ae.SubExtractor = ae

	budget := newExtractionBudget(maxArchiveExtractedText, defaultMaxArchiveDepth)
	result, err := ae.Extract(context.Background(), "outer.zip", r, 0, budget)
	require.NoError(t, err)
	assert.NotContains(t, result, marker, "content beyond max depth should not appear in output")
}

func TestArchiveExtractorSkips7zip(t *testing.T) {
	ae := &archiveExtractor{}

	t.Run("7zip file with .7z extension returns empty string", func(t *testing.T) {
		// Valid 7zip header (minimal)
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract(context.Background(), "test.7z", bytes.NewReader(sevenZipData), 0, testBudget())
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip content with wrong extension is still blocked", func(t *testing.T) {
		// 7zip content disguised with .zip extension - should still be blocked via stream detection
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract(context.Background(), "malicious.zip", bytes.NewReader(sevenZipData), 0, testBudget())
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip at offset with .7z extension is blocked via filename", func(t *testing.T) {
		junkPrefix := []byte{0x00, 0x00, 0x00, 0x00}
		sevenZipSig := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		dataWithOffset := append(junkPrefix, sevenZipSig...)
		result, err := ae.Extract(context.Background(), "test.7z", bytes.NewReader(dataWithOffset), 0, testBudget())
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip at offset with wrong extension fails safely", func(t *testing.T) {
		// Edge case: 7zip content at offset with non-.7z extension.
		// Our check won't catch it (ByName=false, ByStream=false), but archives.FileSystem
		// also won't identify it as 7zip, so it fails to extract rather than triggering OOM.
		junkPrefix := []byte{0x00, 0x00, 0x00, 0x00}
		sevenZipSig := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		dataWithOffset := append(junkPrefix, sevenZipSig...)
		_, err := ae.Extract(context.Background(), "malicious.zip", bytes.NewReader(dataWithOffset), 0, testBudget())
		assert.Error(t, err) // fails to extract as any valid archive format
	})
}

// TestArchiveExtractorReadAllocation checks that allocation while reading stays
// within a fixed ceiling for a long member path, many file members, many
// directory members, a sub-extractor, another archive suffix, member path and
// name boundaries, a cancelled context, and a single compressed file.
func TestArchiveExtractorReadAllocation(t *testing.T) {
	const (
		allocCeiling = 8 << 20
		memberCount  = 40000
		pathDepth    = 4096
		readTimeout  = 5 * time.Second
		afterEntries = "after-entries.txt"
	)

	// pathDepth slash-separated components.
	deepName := strings.Repeat("a/", pathDepth-1) + "a"
	deep := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     deepName,
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}))
	})
	manyFiles := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		writeTarMembers(t, tw, memberCount, false)
	})
	manyDirs := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		writeTarMembers(t, tw, memberCount, true)
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     afterEntries,
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}))
	})
	manyTar := makeTar(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		writeTarMembers(t, tw, memberCount, false)
	})
	var singleGz bytes.Buffer
	sgz := gzip.NewWriter(&singleGz)
	_, err := sgz.Write(make([]byte, 64<<20))
	require.NoError(t, err)
	require.NoError(t, sgz.Close())
	pathAtLimit := memberPath(maxArchivePathDepth, "kept.txt")
	pathPastLimit := memberPath(maxArchivePathDepth+1, "dropped.txt")
	nameAtLimit := strings.Repeat("n", maxArchiveNameLength)
	namePastLimit := strings.Repeat("m", maxArchiveNameLength+1)
	pathAtLimitArchive := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     pathAtLimit,
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}))
	})
	pathPastLimitArchive := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     pathPastLimit,
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}))
	})
	nameAtLimitArchive := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     nameAtLimit,
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}))
	})
	namePastLimitArchive := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     namePastLimit,
			Mode:     0o600,
			Typeflag: tar.TypeReg,
		}))
	})

	testCases := []struct {
		name         string
		archiveName  string
		data         []byte
		sub          Extractor
		cancel       bool
		wantNilErr   bool
		wantErr      error
		wantContains string
		wantAbsent   string
	}{
		{
			name:        "long member path",
			archiveName: "deep.tar.gz",
			data:        deep,
			wantNilErr:  true,
		},
		{
			name:        "long member path with sub-extractor",
			archiveName: "deep.tar.gz",
			data:        deep,
			sub:         &plainExtractor{},
			wantNilErr:  true,
		},
		{
			name:        "many file members",
			archiveName: "files.tar.gz",
			data:        manyFiles,
			wantNilErr:  true,
		},
		{
			name:        "many directory members",
			archiveName: "dirs.tar.gz",
			data:        manyDirs,
			wantNilErr:  true,
			wantAbsent:  afterEntries,
		},
		{
			name:        "cancelled context",
			archiveName: "deep.tar.gz",
			data:        deep,
			cancel:      true,
			wantErr:     context.Canceled,
		},
		{
			name:        "many file members with sub-extractor",
			archiveName: "files.tar.gz",
			data:        manyFiles,
			sub:         &plainExtractor{},
			wantNilErr:  true,
		},
		{
			name:        "many directory members with sub-extractor",
			archiveName: "dirs.tar.gz",
			data:        manyDirs,
			sub:         &plainExtractor{},
			wantNilErr:  true,
			wantAbsent:  afterEntries,
		},
		{
			name:         "member path at component limit",
			archiveName:  "path-at.tar.gz",
			data:         pathAtLimitArchive,
			wantNilErr:   true,
			wantContains: pathAtLimit,
		},
		{
			name:        "member path past component limit",
			archiveName: "path-past.tar.gz",
			data:        pathPastLimitArchive,
			wantNilErr:  true,
			wantAbsent:  pathPastLimit,
		},
		{
			name:         "member name at length limit",
			archiveName:  "name-at.tar.gz",
			data:         nameAtLimitArchive,
			wantNilErr:   true,
			wantContains: nameAtLimit,
		},
		{
			name:        "member name past length limit",
			archiveName: "name-past.tar.gz",
			data:        namePastLimitArchive,
			wantNilErr:  true,
			wantAbsent:  namePastLimit,
		},
		{
			name:        "many file members in tar",
			archiveName: "files.tar",
			data:        manyTar,
			wantNilErr:  true,
		},
		{
			name:        "cancelled context on many file members",
			archiveName: "files.tar.gz",
			data:        manyFiles,
			cancel:      true,
			wantErr:     context.Canceled,
		},
		{
			name:        "single compressed file with sub-extractor",
			archiveName: "zeros.txt.gz",
			data:        singleGz.Bytes(),
			sub:         &plainExtractor{},
			wantNilErr:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			r := bytes.NewReader(tc.data)

			var ctx context.Context
			if tc.cancel {
				var cancel context.CancelFunc
				ctx, cancel = context.WithCancel(context.Background())
				cancel()
			} else {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(context.Background(), readTimeout)
				t.Cleanup(cancel)
			}

			ae := &archiveExtractor{SubExtractor: tc.sub}

			// Sample TotalAlloc immediately around Extract.
			var before, after runtime.MemStats
			runtime.GC()
			runtime.ReadMemStats(&before)
			result, err := ae.Extract(ctx, tc.archiveName, r, 0, testBudget())
			runtime.ReadMemStats(&after)

			delta := after.TotalAlloc - before.TotalAlloc
			t.Logf("total alloc delta = %d err = %v", delta, err)
			require.Less(t, delta, uint64(allocCeiling), "allocation while reading stays within a fixed ceiling")
			if tc.wantNilErr {
				require.NoError(t, err)
			}
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
			}
			if tc.wantContains != "" {
				assert.Contains(t, result, tc.wantContains, "member name is returned")
			}
			if tc.wantAbsent != "" {
				assert.NotContains(t, result, tc.wantAbsent, "member name is omitted")
			}
		})
	}
}

// TestArchiveExtractorSmallArchive checks that a small archive still returns its entry name.
func TestArchiveExtractorSmallArchive(t *testing.T) {
	notes := []byte("hello notes")
	notesArchive := makeTarGz(t, func(t *testing.T, tw *tar.Writer) {
		t.Helper()
		require.NoError(t, tw.WriteHeader(&tar.Header{
			Name:     "notes.txt",
			Mode:     0o600,
			Size:     int64(len(notes)),
			Typeflag: tar.TypeReg,
		}))
		_, err := tw.Write(notes)
		require.NoError(t, err)
	})

	testCases := []struct {
		name        string
		archiveName string
		r           io.ReadSeeker
		entryName   string
	}{
		{
			name:        "tar.gz",
			archiveName: "notes.tar.gz",
			r:           bytes.NewReader(notesArchive),
			entryName:   "notes.txt",
		},
		{
			name:        "zip",
			archiveName: "readme.zip",
			r:           makeZip(t, map[string][]byte{"readme.txt": []byte("hello readme")}),
			entryName:   "readme.txt",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ae := &archiveExtractor{}
			result, err := ae.Extract(context.Background(), tc.archiveName, tc.r, 0, testBudget())
			require.NoError(t, err)
			assert.Contains(t, result, tc.entryName, "a small archive still returns its entry name")
		})
	}
}

// TestArchiveExtractorSingleCompressedFile checks that a compressed file that is
// not an archive, such as readme.md.gz, returns its name and contents.
func TestArchiveExtractorSingleCompressedFile(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	_, err := gz.Write([]byte("hello readme"))
	require.NoError(t, err)
	require.NoError(t, gz.Close())

	t.Run("without sub-extractor", func(t *testing.T) {
		ae := &archiveExtractor{}
		result, err := ae.Extract(context.Background(), "readme.md.gz", bytes.NewReader(buf.Bytes()), 0, testBudget())
		require.NoError(t, err)
		assert.Contains(t, result, "readme.md")
		assert.NotContains(t, result, "hello readme")
	})

	t.Run("with sub-extractor", func(t *testing.T) {
		ae := &archiveExtractor{SubExtractor: &plainExtractor{}}
		result, err := ae.Extract(context.Background(), "readme.md.gz", bytes.NewReader(buf.Bytes()), 0, testBudget())
		require.NoError(t, err)
		assert.Contains(t, result, "readme.md")
		assert.Contains(t, result, "hello readme")
	})

	t.Run("contents are limited by the budget", func(t *testing.T) {
		var large bytes.Buffer
		lgz := gzip.NewWriter(&large)
		_, err := lgz.Write(bytes.Repeat([]byte("a"), int(maxArchiveExtractedText)*4))
		require.NoError(t, err)
		require.NoError(t, lgz.Close())

		ae := &archiveExtractor{SubExtractor: &plainExtractor{}}
		result, err := ae.Extract(context.Background(), "large.txt.gz", bytes.NewReader(large.Bytes()), 0, testBudget())
		require.NoError(t, err)
		assert.LessOrEqual(t, len(result), int(maxArchiveExtractedText)+256, "total output should not exceed budget by more than a path-length overhead")
	})
}
