// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func assertDirectoryContents(t *testing.T, dir string, expectedFiles []string) {
	var files []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		require.NoError(t, err)
		file := strings.TrimPrefix(path, dir)
		file = strings.TrimPrefix(file, "/")
		files = append(files, file)
		return nil
	})
	require.NoError(t, err)

	sort.Strings(files)
	sort.Strings(expectedFiles)
	assert.Equal(t, expectedFiles, files)
}

func TestExtractTarGz(t *testing.T) {
	makeArchive := func(t *testing.T, files []*tar.Header) bytes.Buffer {
		// Build an in-memory archive with the specified files, writing the path as each
		// file's contents when applicable.
		var archive bytes.Buffer
		archiveGzWriter := gzip.NewWriter(&archive)
		archiveWriter := tar.NewWriter(archiveGzWriter)
		for _, file := range files {
			if file.Typeflag == tar.TypeReg {
				contents := []byte(file.Name)
				file.Size = int64(len(contents))
				err := archiveWriter.WriteHeader(file)
				require.NoError(t, err)

				var written int
				written, err = archiveWriter.Write(contents)
				require.NoError(t, err)
				require.EqualValues(t, len(contents), written)
			} else {
				err := archiveWriter.WriteHeader(file)
				require.NoError(t, err)
			}
		}
		err := archiveWriter.Close()
		require.NoError(t, err)
		err = archiveGzWriter.Close()
		require.NoError(t, err)

		return archive
	}

	logger, _ := mlog.NewLogger()
	ctx := request.EmptyContext(logger)

	t.Run("empty dst", func(t *testing.T) {
		archive := makeArchive(t, nil)
		err := extractTarGz(ctx, &archive, "")
		require.Error(t, err)
	})

	t.Run("huge tar", func(t *testing.T) {
		files := make([]*tar.Header, 0, 10000)
		for i := 0; i < 10000; i++ {
			files = append(files, &tar.Header{
				Name:     fmt.Sprintf("%d.txt", i),
				Typeflag: tar.TypeReg,
			})
		}

		dst, err := os.MkdirTemp("", "TestExtractTarGz")
		require.NoError(t, err)
		defer os.RemoveAll(dst)

		archive := makeArchive(t, files)
		err = extractTarGz(ctx, &archive, dst)
		require.NoError(t, err)
	})

	testCases := []struct {
		Files         []*tar.Header
		ExpectedError bool
		ExpectedFiles []string
	}{
		{
			[]*tar.Header{{Name: "../test/path", Typeflag: tar.TypeDir}},
			true,
			nil,
		},
		{
			[]*tar.Header{{Name: "../../test/path", Typeflag: tar.TypeDir}},
			true,
			nil,
		},
		{
			[]*tar.Header{{Name: "../../test/../path", Typeflag: tar.TypeDir}},
			true,
			nil,
		},
		{
			[]*tar.Header{{Name: "test/../../path", Typeflag: tar.TypeDir}},
			true,
			nil,
		},
		{
			[]*tar.Header{{Name: "test/path/../..", Typeflag: tar.TypeDir}},
			false,
			[]string{""},
		},
		{
			[]*tar.Header{{Name: "test", Typeflag: tar.TypeDir}},
			false,
			[]string{"", "test"},
		},
		{
			[]*tar.Header{
				{Name: "test", Typeflag: tar.TypeDir},
				{Name: "test/path", Typeflag: tar.TypeDir},
			},
			false,
			[]string{"", "test", "test/path"},
		},
		{
			[]*tar.Header{
				{Name: "test", Typeflag: tar.TypeDir},
				{Name: "test/path/", Typeflag: tar.TypeDir},
			},
			false,
			[]string{"", "test", "test/path"},
		},
		{
			[]*tar.Header{
				{Name: "test", Typeflag: tar.TypeDir},
				{Name: "test/path", Typeflag: tar.TypeDir},
				{Name: "test/path/file.ext", Typeflag: tar.TypeReg},
			},
			false,
			[]string{"", "test", "test/path", "test/path/file.ext"},
		},
		{
			[]*tar.Header{
				{Name: "/../../file.ext", Typeflag: tar.TypeReg},
			},
			true,
			nil,
		},
		{
			[]*tar.Header{
				{Name: "/../../link", Typeflag: tar.TypeLink},
			},
			false,
			[]string{""},
		},
		{
			[]*tar.Header{
				{Name: "..file", Typeflag: tar.TypeReg},
			},
			false,
			[]string{"", "..file"},
		},
	}

	for i, testCase := range testCases {
		t.Run(fmt.Sprintf("test-%d", i), func(t *testing.T) {
			dst, err := os.MkdirTemp("", "TestExtractTarGz")
			require.NoError(t, err)
			defer os.RemoveAll(dst)

			archive := makeArchive(t, testCase.Files)
			err = extractTarGz(ctx, &archive, dst)
			if testCase.ExpectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assertDirectoryContents(t, dst, testCase.ExpectedFiles)
			}
		})
	}
}
