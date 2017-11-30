// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/model"
)

const (
	TEST_FILE_PATH = "/testfile"
)

type LocalFileBackend struct {
	directory string
}

func (b *LocalFileBackend) TestConnection() *model.AppError {
	f := []byte("testingwrite")
	if err := writeFileLocally(f, filepath.Join(b.directory, TEST_FILE_PATH)); err != nil {
		return model.NewAppError("TestFileConnection", "Don't have permissions to write to local path specified or other error.", nil, err.Error(), http.StatusInternalServerError)
	}
	os.Remove(filepath.Join(b.directory, TEST_FILE_PATH))
	l4g.Info("Able to write files to local storage.")
	return nil
}

func (b *LocalFileBackend) ReadFile(path string) ([]byte, *model.AppError) {
	if f, err := ioutil.ReadFile(filepath.Join(b.directory, path)); err != nil {
		return nil, model.NewAppError("ReadFile", "api.file.read_file.reading_local.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else {
		return f, nil
	}
}

func (b *LocalFileBackend) CopyFile(oldPath, newPath string) *model.AppError {
	if err := CopyFile(filepath.Join(b.directory, oldPath), filepath.Join(b.directory, newPath)); err != nil {
		return model.NewAppError("copyFile", "api.file.move_file.rename.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *LocalFileBackend) MoveFile(oldPath, newPath string) *model.AppError {
	if err := os.MkdirAll(filepath.Dir(filepath.Join(b.directory, newPath)), 0774); err != nil {
		return model.NewAppError("moveFile", "api.file.move_file.rename.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := os.Rename(filepath.Join(b.directory, oldPath), filepath.Join(b.directory, newPath)); err != nil {
		return model.NewAppError("moveFile", "api.file.move_file.rename.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (b *LocalFileBackend) WriteFile(f []byte, path string) *model.AppError {
	return writeFileLocally(f, filepath.Join(b.directory, path))
}

func writeFileLocally(f []byte, path string) *model.AppError {
	if err := os.MkdirAll(filepath.Dir(path), 0774); err != nil {
		directory, _ := filepath.Abs(filepath.Dir(path))
		return model.NewAppError("WriteFile", "api.file.write_file_locally.create_dir.app_error", nil, "directory="+directory+", err="+err.Error(), http.StatusInternalServerError)
	}

	if err := ioutil.WriteFile(path, f, 0644); err != nil {
		return model.NewAppError("WriteFile", "api.file.write_file_locally.writing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (b *LocalFileBackend) RemoveFile(path string) *model.AppError {
	if err := os.Remove(filepath.Join(b.directory, path)); err != nil {
		return model.NewAppError("RemoveFile", "utils.file.remove_file.local.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (b *LocalFileBackend) ListDirectory(path string) (*[]string, *model.AppError) {
	var paths []string
	if fileInfos, err := ioutil.ReadDir(filepath.Join(b.directory, path)); err != nil {
		return nil, model.NewAppError("ListDirectory", "utils.file.list_directory.local.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else {
		for _, fileInfo := range fileInfos {
			if fileInfo.IsDir() {
				paths = append(paths, filepath.Join(path, fileInfo.Name()))
			}
		}
	}
	return &paths, nil
}

func (b *LocalFileBackend) RemoveDirectory(path string) *model.AppError {
	if err := os.RemoveAll(filepath.Join(b.directory, path)); err != nil {
		return model.NewAppError("RemoveDirectory", "utils.file.remove_directory.local.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
