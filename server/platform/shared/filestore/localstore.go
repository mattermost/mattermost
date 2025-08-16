// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/utils"
)

const (
	TestFilePath      = "testfile"
	MaxRecursionDepth = 50
)

type LocalFileBackend struct {
	directory string
}

// copyFile will copy a file from src path to dst path.
// Overwrites any existing files at dst.
// Permissions are copied from file at src to the new file at dst.
func copyFile(base, src, dst string) (err error) {
	root, err := os.OpenRoot(base)
	if err != nil {
		return errors.Wrapf(err, "unable to open root directory %q", base)
	}
	defer root.Close()

	in, err := root.Open(src)
	if err != nil {
		return
	}
	defer in.Close()

	if err = mkdirAll(root, filepath.Dir(dst), os.ModePerm); err != nil {
		return
	}

	out, err := root.Create(dst)
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

	stat, err := root.Stat(src)
	if err != nil {
		return
	}
	err = out.Chmod(stat.Mode())
	if err != nil {
		return
	}

	return
}

func mkdirAll(root *os.Root, path string, perm os.FileMode) error {
	return os.MkdirAll(utils.SafeJoin(root.Name(), path), perm)
}

func rename(root *os.Root, oldPath, newPath string) error {
	return os.Rename(
		utils.SafeJoin(root.Name(), oldPath),
		utils.SafeJoin(root.Name(), newPath),
	)
}

func removeAll(root *os.Root, path string) error {
	return os.RemoveAll(utils.SafeJoin(root.Name(), path))
}

func (b *LocalFileBackend) DriverName() string {
	return driverLocal
}

func (b *LocalFileBackend) TestConnection() error {
	f := bytes.NewReader([]byte("testingwrite"))
	if _, err := b.WriteFile(f, TestFilePath); err != nil {
		return errors.Wrap(err, "unable to write to the local filesystem storage")
	}
	os.Remove(filepath.Join(b.directory, TestFilePath))
	mlog.Debug("Able to write files to local storage.")
	return nil
}

func (b *LocalFileBackend) Reader(path string) (ReadCloseSeeker, error) {
	f, err := os.OpenInRoot(b.directory, path)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open file %s", path)
	}
	return f, nil
}

func (b *LocalFileBackend) ReadFile(path string) ([]byte, error) {
	file, err := os.OpenInRoot(b.directory, path)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open file %s", path)
	}
	defer file.Close()

	// TODO: Consider replacing with Root.ReadFile with go1.25.
	f, err := io.ReadAll(file)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to read file %s", path)
	}
	return f, nil
}

func (b *LocalFileBackend) FileExists(path string) (bool, error) {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return false, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	_, err = root.Stat(path)

	if os.IsNotExist(err) {
		return false, nil
	}

	if err != nil {
		return false, errors.Wrapf(err, "unable to know if file %s exists", path)
	}
	return true, nil
}

func (b *LocalFileBackend) FileSize(path string) (int64, error) {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	info, err := root.Stat(path)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to get file size for %s", path)
	}
	return info.Size(), nil
}

func (b *LocalFileBackend) FileModTime(path string) (time.Time, error) {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	info, err := root.Stat(path)
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to get modification time for file %s", path)
	}
	return info.ModTime(), nil
}

func (b *LocalFileBackend) CopyFile(oldPath, newPath string) error {
	if err := copyFile(b.directory, oldPath, newPath); err != nil {
		return errors.Wrapf(err, "unable to copy file from %s to %s", oldPath, newPath)
	}
	return nil
}

func (b *LocalFileBackend) MoveFile(oldPath, newPath string) error {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	if err := mkdirAll(root, filepath.Dir(newPath), 0750); err != nil {
		return errors.Wrapf(err, "unable to create the new destination directory %s", filepath.Dir(newPath))
	}

	if err := rename(root, oldPath, newPath); err != nil {
		return errors.Wrapf(err, "unable to move the file to %s to the destination directory", newPath)
	}

	return nil
}

func (b *LocalFileBackend) WriteFile(fr io.Reader, path string) (int64, error) {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	err = mkdirAll(root, filepath.Dir(path), 0750)
	if err != nil {
		directory, _ := filepath.Abs(filepath.Dir(path))
		return 0, errors.Wrapf(err, "unable to create the directory %s for the file %s", directory, path)
	}

	fw, err := root.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
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
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	_, err = root.Stat(path)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to find the file %s to append the data", path)
	}

	fw, err := root.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0600)
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
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	if err := root.Remove(path); err != nil {
		return errors.Wrapf(err, "unable to remove the file %s", path)
	}
	return nil
}

// fixPathForRoot is a helper function to work around percularities with os.Root:
func fixPathForRoot(path string) (string, error) {
	// // os.Root.FS().ReadDir doesn't handle trailing slashes correctly, so trim first.
	// path = strings.TrimSuffix(path, string(filepath.Separator))

	// similarly, os.Root.FS().ReadDir trips over `./` despite being validly relative to root.
	// So first anchor it to a real root, then get the relative path from there.
	path, err := filepath.Rel("/", filepath.Join("/", path))
	if err != nil {
		return "", errors.Wrap(err, "failed to fix path for root")
	}

	return path, nil
}

// basePath: path to get to the file but won't be added to the end result
// path: basePath+path current directory we are looking at
// maxDepth: parameter to prevent infinite recursion, once this is reached we won't look any further
func appendRecursively(root *os.Root, path string, maxDepth int) ([]string, error) {
	path, err := fixPathForRoot(path)
	if err != nil {
		return nil, err
	}

	results := []string{}
	dirEntries, err := fs.ReadDir(root.FS(), path)
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
				mlog.Warn("Max depth reached, skipping any further directories", mlog.Int("depth", maxDepth), mlog.String("path", entryPath))
				results = append(results, entryPath)
				continue // we'll ignore it if max depth is reached.
			}
			nestedResults, err := appendRecursively(root, entryPath, maxDepth-1)
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
	results := []string{}
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	path, err = fixPathForRoot(path)
	if err != nil {
		return nil, err
	}

	dirEntries, err := fs.ReadDir(root.FS(), path)
	if err != nil {
		if os.IsNotExist(err) {
			// ideally os.ErrNotExist should've been returned but to keep the
			// consistency, leaving it as is before.
			return results, nil
		}
		// same here, ideally we shouldn't return the empty slice
		return results, errors.Wrapf(err, "unable to list the directory %s", path)
	}
	for _, dirEntry := range dirEntries {
		results = append(results, filepath.Join(path, dirEntry.Name()))
	}

	return results, nil
}

func (b *LocalFileBackend) ListDirectoryRecursively(path string) ([]string, error) {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	return appendRecursively(root, path, MaxRecursionDepth)
}

func (b *LocalFileBackend) RemoveDirectory(path string) error {
	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}
	defer root.Close()

	if err := removeAll(root, path); err != nil {
		return errors.Wrapf(err, "unable to remove the directory %s", path)
	}
	return nil
}

// ZipReader will create a zip of path. If path is a single file, it will zip the single file.
// If deflate is true, the contents will be compressed. It will stream the zip to io.ReadCloser.
func (b *LocalFileBackend) ZipReader(path string, deflate bool) (io.ReadCloser, error) {
	deflateMethod := zip.Store
	if deflate {
		deflateMethod = zip.Deflate
	}

	root, err := os.OpenRoot(b.directory)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open root directory %q", b.directory)
	}

	// We don't defer root.Close() here because we want to keep the root open until
	// the pipe is closed.

	baseInfo, err := root.Stat(path)
	if err != nil {
		root.Close()
		return nil, errors.Wrapf(err, "unable to stat path %s", path)
	}

	pr, pw := io.Pipe()

	go func() {
		defer pw.Close()
		defer root.Close()

		zipWriter := zip.NewWriter(pw)
		defer zipWriter.Close()

		err = fs.WalkDir(root.FS(), path, func(filePath string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			info, err := d.Info()
			if err != nil {
				return errors.Wrapf(err, "unable to call Info() for %s", filePath)
			}

			// Handle single file case
			baseDir := path
			if !baseInfo.IsDir() {
				baseDir = filepath.Dir(baseDir)
			}

			// Get the relative path from the base directory
			relPath, err := filepath.Rel(baseDir, filePath)
			if err != nil {
				return errors.Wrapf(err, "unable to get relative path for %s", filePath)
			}

			// Skip the root directory itself
			if relPath == "." {
				return nil
			}

			// Create zip header
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return errors.Wrapf(err, "unable to create zip header for %s", relPath)
			}

			// Ensure consistent forward slashes in paths
			header.Name = filepath.ToSlash(relPath)

			// Skip directories - we don't need to create entries for them
			if info.IsDir() {
				return nil
			}

			// Create file entry
			header.Method = deflateMethod
			header.SetMode(0644) // rw-r--r-- permissions
			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				return errors.Wrapf(err, "unable to create zip entry for %s", relPath)
			}

			file, err := root.Open(filePath)
			if err != nil {
				return errors.Wrapf(err, "unable to open file %s", filePath)
			}
			defer file.Close()

			if _, err := io.Copy(writer, file); err != nil {
				return errors.Wrapf(err, "unable to copy file content for %s", relPath)
			}

			return nil
		})
		if err != nil {
			pw.CloseWithError(errors.Wrap(err, "error walking directory"))
		}
	}()

	return pr, nil
}
