// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	TestFilePath = "/testfile"
)

type LocalFileBackend struct {
	directory string
}

// copyFile will copy a file from src path to dst path.
// Overwrites any existing files at dst.
// Permissions are copied from file at src to the new file at dst.
func copyFile(src, dst string) (err error) {
	in, err := os.Open(src)
	if err != nil {
		return
	}
	defer in.Close()

	if err = os.MkdirAll(filepath.Dir(dst), os.ModePerm); err != nil {
		return
	}
	out, err := os.Create(dst)
	if err != nil {
		return
	}
	defer func() {
		if e := out.Close(); e != nil {
			err = e
		}
	}()

	_, err = io.Copy(out, in)
	if err != nil {
		return
	}

	err = out.Sync()
	if err != nil {
		return
	}

	stat, err := os.Stat(src)
	if err != nil {
		return
	}
	err = os.Chmod(dst, stat.Mode())
	if err != nil {
		return
	}

	return
}

func (b *LocalFileBackend) TestConnection() error {
	f := bytes.NewReader([]byte("testingwrite"))
	if _, err := writeFileLocally(f, filepath.Join(b.directory, TestFilePath)); err != nil {
		return errors.Wrap(err, "unable to write to the local filesystem storage")
	}
	os.Remove(filepath.Join(b.directory, TestFilePath))
	mlog.Debug("Able to write files to local storage.")
	return nil
}

func (b *LocalFileBackend) Reader(path string) (ReadCloseSeeker, error) {
	f, err := os.Open(filepath.Join(b.directory, path))
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open file %s", path)
	}
	return f, nil
}

func (b *LocalFileBackend) ReadFile(path string) ([]byte, error) {
	f, err := os.ReadFile(filepath.Join(b.directory, path))
	if err != nil {
		return nil, errors.Wrapf(err, "unable to read file %s", path)
	}
	return f, nil
}

func (b *LocalFileBackend) FileExists(path string) (bool, error) {
	_, err := os.Stat(filepath.Join(b.directory, path))

	if os.IsNotExist(err) {
		return false, nil
	}

	if err != nil {
		return false, errors.Wrapf(err, "unable to know if file %s exists", path)
	}
	return true, nil
}

func (b *LocalFileBackend) FileSize(path string) (int64, error) {
	info, err := os.Stat(filepath.Join(b.directory, path))
	if err != nil {
		return 0, errors.Wrapf(err, "unable to get file size for %s", path)
	}
	return info.Size(), nil
}

func (b *LocalFileBackend) FileModTime(path string) (time.Time, error) {
	info, err := os.Stat(filepath.Join(b.directory, path))
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to get modification time for file %s", path)
	}
	return info.ModTime(), nil
}

func (b *LocalFileBackend) CopyFile(oldPath, newPath string) error {
	if err := copyFile(filepath.Join(b.directory, oldPath), filepath.Join(b.directory, newPath)); err != nil {
		return errors.Wrapf(err, "unable to copy file from %s to %s", oldPath, newPath)
	}
	return nil
}

func (b *LocalFileBackend) MoveFile(oldPath, newPath string) error {
	if err := os.MkdirAll(filepath.Dir(filepath.Join(b.directory, newPath)), 0750); err != nil {
		return errors.Wrapf(err, "unable to create the new destination directory %s", filepath.Dir(newPath))
	}

	if err := os.Rename(filepath.Join(b.directory, oldPath), filepath.Join(b.directory, newPath)); err != nil {
		return errors.Wrapf(err, "unable to move the file to %s to the destination directory", newPath)
	}

	return nil
}

func (b *LocalFileBackend) WriteFile(fr io.Reader, path string) (int64, error) {
	return writeFileLocally(fr, filepath.Join(b.directory, path))
}

func writeFileLocally(fr io.Reader, path string) (int64, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		directory, _ := filepath.Abs(filepath.Dir(path))
		return 0, errors.Wrapf(err, "unable to create the directory %s for the file %s", directory, path)
	}
	fw, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to open the file %s to write the data", path)
	}
	defer fw.Close()
	written, err := io.Copy(fw, fr)
	if err != nil {
		return written, errors.Wrapf(err, "unable write the data in the file %s", path)
	}
	return written, nil
}

func (b *LocalFileBackend) AppendFile(fr io.Reader, path string) (int64, error) {
	fp := filepath.Join(b.directory, path)
	if _, err := os.Stat(fp); err != nil {
		return 0, errors.Wrapf(err, "unable to find the file %s to append the data", path)
	}
	fw, err := os.OpenFile(fp, os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to open the file %s to append the data", path)
	}
	defer fw.Close()
	written, err := io.Copy(fw, fr)
	if err != nil {
		return written, errors.Wrapf(err, "unable append the data in the file %s", path)
	}
	return written, nil
}

func (b *LocalFileBackend) RemoveFile(path string) error {
	if err := os.Remove(filepath.Join(b.directory, path)); err != nil {
		return errors.Wrapf(err, "unable to remove the file %s", path)
	}
	return nil
}

// basePath: path to get to the file but won't be added to the end result
// path: basePath+path current directory we are looking at
// maxDepth: parameter to prevent infinite recursion, once this is reached we won't look any further
func appendRecursively(basePath, path string, maxDepth int) ([]string, error) {
	results := []string{}
	dirEntries, err := os.ReadDir(filepath.Join(basePath, path))
	if err != nil {
		if os.IsNotExist(err) {
			return results, nil
		}
		return results, errors.Wrapf(err, "unable to list the directory %s", path)
	}
	for _, dirEntry := range dirEntries {
		entryName := dirEntry.Name()
		entryPath := filepath.Join(path, entryName)
		if entryName == "." || entryName == ".." || entryPath == path {
			continue
		}
		if dirEntry.IsDir() {
			if maxDepth <= 0 {
				mlog.Warn("Max Depth reached", mlog.String("path", entryPath))
				results = append(results, entryPath)
				continue // we'll ignore it if max depth is reached.
			}
			nestedResults, err := appendRecursively(basePath, entryPath, maxDepth-1)
			if err != nil {
				return results, err
			}
			results = append(results, nestedResults...)
		} else {
			results = append(results, entryPath)
		}
	}
	return results, nil
}

func (b *LocalFileBackend) ListDirectory(path string) ([]string, error) {
	return appendRecursively(b.directory, path, 0)
}

func (b *LocalFileBackend) ListDirectoryRecursively(path string) ([]string, error) {
	return appendRecursively(b.directory, path, 10)
}

func (b *LocalFileBackend) RemoveDirectory(path string) error {
	if err := os.RemoveAll(filepath.Join(b.directory, path)); err != nil {
		return errors.Wrapf(err, "unable to remove the directory %s", path)
	}
	return nil
}
