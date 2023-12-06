// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fileutils

import (
	"os"
	"path/filepath"
)

func CommonBaseSearchPaths() []string {
	paths := []string{
		".",
		"..",
		"../..",
		"../../..",
		"../../../..",
	}

	// this enables the server to be used in tests from a different repository
	if mmPath := os.Getenv("MM_SERVER_PATH"); mmPath != "" {
		paths = append(paths, mmPath)
	}

	return paths
}

func findPath(path string, baseSearchPaths []string, workingDirFirst bool, filter func(os.FileInfo) bool) string {
	if filepath.IsAbs(path) {
		if _, err := os.Stat(path); err == nil {
			return path
		}

		return ""
	}

	searchPaths := []string{}
	if workingDirFirst {
		searchPaths = append(searchPaths, baseSearchPaths...)
	}

	// Attempt to search relative to the location of the running binary either before
	// or after searching relative to the working directory, depending on `workingDirFirst`.
	var binaryDir string
	if exe, err := os.Executable(); err == nil {
		if exe, err = filepath.EvalSymlinks(exe); err == nil {
			if exe, err = filepath.Abs(exe); err == nil {
				binaryDir = filepath.Dir(exe)
			}
		}
	}
	if binaryDir != "" {
		for _, baseSearchPath := range baseSearchPaths {
			searchPaths = append(
				searchPaths,
				filepath.Join(binaryDir, baseSearchPath),
			)
		}
	}

	if !workingDirFirst {
		searchPaths = append(searchPaths, baseSearchPaths...)
	}

	for _, parent := range searchPaths {
		found, err := filepath.Abs(filepath.Join(parent, path))
		if err != nil {
			continue
		} else if fileInfo, err := os.Stat(found); err == nil {
			if filter != nil {
				if filter(fileInfo) {
					return found
				}
			} else {
				return found
			}
		}
	}

	return ""
}

func FindPath(path string, baseSearchPaths []string, filter func(os.FileInfo) bool) string {
	return findPath(path, baseSearchPaths, true, filter)
}

// FindFile looks for the given file in nearby ancestors relative to the current working
// directory as well as the directory of the executable.
func FindFile(path string) string {
	return FindPath(path, CommonBaseSearchPaths(), func(fileInfo os.FileInfo) bool {
		return !fileInfo.IsDir()
	})
}

// fileutils.FindDir looks for the given directory in nearby ancestors relative to the current working
// directory as well as the directory of the executable, falling back to `./` if not found.
func FindDir(dir string) (string, bool) {
	found := FindPath(dir, CommonBaseSearchPaths(), func(fileInfo os.FileInfo) bool {
		return fileInfo.IsDir()
	})
	if found == "" {
		return "./", false
	}

	return found, true
}

// FindDirRelBinary looks for the given directory in nearby ancestors relative to the
// directory of the executable, then relative to the working directory, falling back to `./` if not found.
func FindDirRelBinary(dir string) (string, bool) {
	found := findPath(dir, CommonBaseSearchPaths(), false, func(fileInfo os.FileInfo) bool {
		return fileInfo.IsDir()
	})
	if found == "" {
		return "./", false
	}
	return found, true
}
