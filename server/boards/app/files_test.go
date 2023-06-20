// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
)

const (
	testFileName = "temp-file-name"
	testBoardID  = "test-board-id"
)

var errDummy = errors.New("hello")

type TestError struct{}

func (err *TestError) Error() string { return "Mocked File backend error" }

func TestGetFileReader(t *testing.T) {
	testFilePath := filepath.Join("1", "test-board-id", "temp-file-name")

	th, _ := SetupTestHelper(t)
	mockedReadCloseSeek := &mocks.ReadCloseSeeker{}
	t.Run("should get file reader from filestore successfully", func(t *testing.T) {
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		readerFunc := func(path string) filestore.ReadCloseSeeker {
			return mockedReadCloseSeek
		}

		readerErrorFunc := func(path string) error {
			return nil
		}

		fileExistsFunc := func(path string) bool {
			return true
		}

		fileExistsErrorFunc := func(path string) error {
			return nil
		}

		mockedFileBackend.On("Reader", testFilePath).Return(readerFunc, readerErrorFunc)
		mockedFileBackend.On("FileExists", testFilePath).Return(fileExistsFunc, fileExistsErrorFunc)
		actual, _ := th.App.GetFileReader("1", testBoardID, testFileName)
		assert.Equal(t, mockedReadCloseSeek, actual)
	})

	t.Run("should get error from filestore when file exists return error", func(t *testing.T) {
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedError := &TestError{}
		readerFunc := func(path string) filestore.ReadCloseSeeker {
			return mockedReadCloseSeek
		}

		readerErrorFunc := func(path string) error {
			return nil
		}

		fileExistsFunc := func(path string) bool {
			return false
		}

		fileExistsErrorFunc := func(path string) error {
			return mockedError
		}

		mockedFileBackend.On("Reader", testFilePath).Return(readerFunc, readerErrorFunc)
		mockedFileBackend.On("FileExists", testFilePath).Return(fileExistsFunc, fileExistsErrorFunc)
		actual, err := th.App.GetFileReader("1", testBoardID, testFileName)
		assert.Error(t, err, mockedError)
		assert.Nil(t, actual)
	})

	t.Run("should return error, if get reader from file backend returns error", func(t *testing.T) {
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedError := &TestError{}
		readerFunc := func(path string) filestore.ReadCloseSeeker {
			return nil
		}

		readerErrorFunc := func(path string) error {
			return mockedError
		}

		fileExistsFunc := func(path string) bool {
			return false
		}

		fileExistsErrorFunc := func(path string) error {
			return nil
		}

		mockedFileBackend.On("Reader", testFilePath).Return(readerFunc, readerErrorFunc)
		mockedFileBackend.On("FileExists", testFilePath).Return(fileExistsFunc, fileExistsErrorFunc)
		actual, err := th.App.GetFileReader("1", testBoardID, testFileName)
		assert.Error(t, err, mockedError)
		assert.Nil(t, actual)
	})

	t.Run("should move file from old filepath to new filepath, if file doesnot exists in new filepath and workspace id is 0", func(t *testing.T) {
		filePath := filepath.Join("0", "test-board-id", "temp-file-name")
		workspaceid := "0"
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		readerFunc := func(path string) filestore.ReadCloseSeeker {
			return mockedReadCloseSeek
		}

		readerErrorFunc := func(path string) error {
			return nil
		}

		fileExistsFunc := func(path string) bool {
			// return true for old path
			return path == testFileName
		}

		fileExistsErrorFunc := func(path string) error {
			return nil
		}

		moveFileFunc := func(oldFileName, newFileName string) error {
			return nil
		}

		mockedFileBackend.On("FileExists", filePath).Return(fileExistsFunc, fileExistsErrorFunc)
		mockedFileBackend.On("FileExists", testFileName).Return(fileExistsFunc, fileExistsErrorFunc)
		mockedFileBackend.On("MoveFile", testFileName, filePath).Return(moveFileFunc)
		mockedFileBackend.On("Reader", filePath).Return(readerFunc, readerErrorFunc)

		actual, _ := th.App.GetFileReader(workspaceid, testBoardID, testFileName)
		assert.Equal(t, mockedReadCloseSeek, actual)
	})

	t.Run("should return file reader, if file doesnot exists in new filepath and old file path", func(t *testing.T) {
		filePath := filepath.Join("0", "test-board-id", "temp-file-name")
		fileName := testFileName
		workspaceid := "0"
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		readerFunc := func(path string) filestore.ReadCloseSeeker {
			return mockedReadCloseSeek
		}

		readerErrorFunc := func(path string) error {
			return nil
		}

		fileExistsFunc := func(path string) bool {
			// return true for old path
			return false
		}

		fileExistsErrorFunc := func(path string) error {
			return nil
		}

		moveFileFunc := func(oldFileName, newFileName string) error {
			return nil
		}

		mockedFileBackend.On("FileExists", filePath).Return(fileExistsFunc, fileExistsErrorFunc)
		mockedFileBackend.On("FileExists", testFileName).Return(fileExistsFunc, fileExistsErrorFunc)
		mockedFileBackend.On("MoveFile", fileName, filePath).Return(moveFileFunc)
		mockedFileBackend.On("Reader", filePath).Return(readerFunc, readerErrorFunc)

		actual, _ := th.App.GetFileReader(workspaceid, testBoardID, testFileName)
		assert.Equal(t, mockedReadCloseSeek, actual)
	})
}

func TestSaveFile(t *testing.T) {
	th, _ := SetupTestHelper(t)
	mockedReadCloseSeek := &mocks.ReadCloseSeeker{}
	t.Run("should save file to file store using file backend", func(t *testing.T) {
		fileName := "temp-file-name.txt"
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		th.Store.EXPECT().SaveFileInfo(gomock.Any()).Return(nil)

		writeFileFunc := func(reader io.Reader, path string) int64 {
			paths := strings.Split(path, string(os.PathSeparator))
			assert.Equal(t, "boards", paths[0])
			assert.Equal(t, time.Now().Format("20060102"), paths[1])
			fileName = paths[2]
			return int64(10)
		}

		writeFileErrorFunc := func(reader io.Reader, filePath string) error {
			return nil
		}

		mockedFileBackend.On("WriteFile", mockedReadCloseSeek, mock.Anything).Return(writeFileFunc, writeFileErrorFunc)
		actual, err := th.App.SaveFile(mockedReadCloseSeek, "1", testBoardID, fileName, false)
		assert.Equal(t, fileName, actual)
		assert.NoError(t, err)
	})

	t.Run("should save .jpeg file as jpg file to file store using file backend", func(t *testing.T) {
		fileName := "temp-file-name.jpeg"
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		th.Store.EXPECT().SaveFileInfo(gomock.Any()).Return(nil)

		writeFileFunc := func(reader io.Reader, path string) int64 {
			paths := strings.Split(path, string(os.PathSeparator))
			assert.Equal(t, "boards", paths[0])
			assert.Equal(t, time.Now().Format("20060102"), paths[1])
			assert.Equal(t, "jpg", strings.Split(paths[2], ".")[1])
			return int64(10)
		}

		writeFileErrorFunc := func(reader io.Reader, filePath string) error {
			return nil
		}

		mockedFileBackend.On("WriteFile", mockedReadCloseSeek, mock.Anything).Return(writeFileFunc, writeFileErrorFunc)
		actual, err := th.App.SaveFile(mockedReadCloseSeek, "1", "test-board-id", fileName, false)
		assert.NoError(t, err)
		assert.NotNil(t, actual)
	})

	t.Run("should return error when fileBackend.WriteFile returns error", func(t *testing.T) {
		fileName := "temp-file-name.jpeg"
		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedError := &TestError{}

		writeFileFunc := func(reader io.Reader, path string) int64 {
			paths := strings.Split(path, string(os.PathSeparator))
			assert.Equal(t, "boards", paths[0])
			assert.Equal(t, time.Now().Format("20060102"), paths[1])
			assert.Equal(t, "jpg", strings.Split(paths[2], ".")[1])
			return int64(10)
		}

		writeFileErrorFunc := func(reader io.Reader, filePath string) error {
			return mockedError
		}

		mockedFileBackend.On("WriteFile", mockedReadCloseSeek, mock.Anything).Return(writeFileFunc, writeFileErrorFunc)
		actual, err := th.App.SaveFile(mockedReadCloseSeek, "1", "test-board-id", fileName, false)
		assert.Equal(t, "", actual)
		assert.Equal(t, "unable to store the file in the files storage: Mocked File backend error", err.Error())
	})
}

func TestGetFileInfo(t *testing.T) {
	th, _ := SetupTestHelper(t)

	t.Run("should return file info", func(t *testing.T) {
		fileInfo := &mm_model.FileInfo{
			Id:       "file_info_id",
			Archived: false,
		}

		th.Store.EXPECT().GetFileInfo("filename").Return(fileInfo, nil).Times(2)

		fetchedFileInfo, err := th.App.GetFileInfo("Afilename")
		assert.NoError(t, err)
		assert.Equal(t, "file_info_id", fetchedFileInfo.Id)
		assert.False(t, fetchedFileInfo.Archived)

		fetchedFileInfo, err = th.App.GetFileInfo("Afilename.txt")
		assert.NoError(t, err)
		assert.Equal(t, "file_info_id", fetchedFileInfo.Id)
		assert.False(t, fetchedFileInfo.Archived)
	})

	t.Run("should return archived file info", func(t *testing.T) {
		fileInfo := &mm_model.FileInfo{
			Id:       "file_info_id",
			Archived: true,
		}

		th.Store.EXPECT().GetFileInfo("filename").Return(fileInfo, nil)

		fetchedFileInfo, err := th.App.GetFileInfo("Afilename")
		assert.NoError(t, err)
		assert.Equal(t, "file_info_id", fetchedFileInfo.Id)
		assert.True(t, fetchedFileInfo.Archived)
	})

	t.Run("should return archived file infoerror", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("filename").Return(nil, errDummy)

		fetchedFileInfo, err := th.App.GetFileInfo("Afilename")
		assert.Error(t, err)
		assert.Nil(t, fetchedFileInfo)
	})
}

func TestGetFile(t *testing.T) {
	th, _ := SetupTestHelper(t)

	t.Run("happy path, no errors", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(&mm_model.FileInfo{
			Id:   "fileInfoID",
			Path: "/path/to/file/fileName.txt",
		}, nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedReadCloseSeek := &mocks.ReadCloseSeeker{}
		readerFunc := func(path string) filestore.ReadCloseSeeker {
			return mockedReadCloseSeek
		}

		readerErrorFunc := func(path string) error {
			return nil
		}
		mockedFileBackend.On("Reader", "/path/to/file/fileName.txt").Return(readerFunc, readerErrorFunc)
		mockedFileBackend.On("FileExists", "/path/to/file/fileName.txt").Return(true, nil)

		fileInfo, seeker, err := th.App.GetFile("teamID", "boardID", "7fileInfoID.txt")
		assert.NoError(t, err)
		assert.NotNil(t, fileInfo)
		assert.NotNil(t, seeker)
	})

	t.Run("when GetFilePath() throws error", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(nil, errDummy)

		fileInfo, seeker, err := th.App.GetFile("teamID", "boardID", "7fileInfoID.txt")
		assert.Error(t, err)
		assert.Nil(t, fileInfo)
		assert.Nil(t, seeker)
	})

	t.Run("when FileExists returns false", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(&mm_model.FileInfo{
			Id:   "fileInfoID",
			Path: "/path/to/file/fileName.txt",
		}, nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedFileBackend.On("FileExists", "/path/to/file/fileName.txt").Return(false, nil)

		fileInfo, seeker, err := th.App.GetFile("teamID", "boardID", "7fileInfoID.txt")
		assert.Error(t, err)
		assert.Nil(t, fileInfo)
		assert.Nil(t, seeker)
	})
	t.Run("when FileReader throws error", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(&mm_model.FileInfo{
			Id:   "fileInfoID",
			Path: "/path/to/file/fileName.txt",
		}, nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedFileBackend.On("Reader", "/path/to/file/fileName.txt").Return(nil, errDummy)
		mockedFileBackend.On("FileExists", "/path/to/file/fileName.txt").Return(true, nil)

		fileInfo, seeker, err := th.App.GetFile("teamID", "boardID", "7fileInfoID.txt")
		assert.Error(t, err)
		assert.Nil(t, fileInfo)
		assert.Nil(t, seeker)
	})

}

func TestGetFilePath(t *testing.T) {
	th, _ := SetupTestHelper(t)

	t.Run("when FileInfo exists", func(t *testing.T) {
		path := "/path/to/file/fileName.txt"
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(&mm_model.FileInfo{
			Id:   "fileInfoID",
			Path: path,
		}, nil)

		fileInfo, filePath, err := th.App.GetFilePath("teamID", "boardID", "7fileInfoID.txt")
		assert.NoError(t, err)
		assert.NotNil(t, fileInfo)
		assert.Equal(t, path, filePath)
	})

	t.Run("when FileInfo doesn't exist", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(nil, nil)

		fileInfo, filePath, err := th.App.GetFilePath("teamID", "boardID", "7fileInfoID.txt")
		assert.NoError(t, err)
		assert.Nil(t, fileInfo)
		assert.Equal(t, "teamID/boardID/7fileInfoID.txt", filePath)
	})

	t.Run("when FileInfo exists but FileInfo.Path is not set", func(t *testing.T) {
		th.Store.EXPECT().GetFileInfo("fileInfoID").Return(&mm_model.FileInfo{
			Id:   "fileInfoID",
			Path: "",
		}, nil)

		fileInfo, filePath, err := th.App.GetFilePath("teamID", "boardID", "7fileInfoID.txt")
		assert.NoError(t, err)
		assert.NotNil(t, fileInfo)
		assert.Equal(t, "teamID/boardID/7fileInfoID.txt", filePath)
	})
}

func TestCopyCard(t *testing.T) {
	th, _ := SetupTestHelper(t)
	imageBlock := &model.Block{
		ID:         "imageBlock",
		ParentID:   "c3zqnh6fsu3f4mr6hzq9hizwske",
		CreatedBy:  "6k6ynxdp47dujjhhojw9nqhmyh",
		ModifiedBy: "6k6ynxdp47dujjhhojw9nqhmyh",
		Schema:     1,
		Type:       "image",
		Title:      "",
		Fields:     map[string]interface{}{"fileId": "7fileName.jpg"},
		CreateAt:   1680725585250,
		UpdateAt:   1680725585250,
		DeleteAt:   0,
		BoardID:    "boardID",
	}
	t.Run("Board doesn't exist", func(t *testing.T) {
		th.Store.EXPECT().GetBoard("boardID").Return(nil, errDummy)
		_, err := th.App.CopyCardFiles("boardID", []*model.Block{}, false)
		assert.Error(t, err)
	})

	t.Run("Board exists, image block, with FileInfo", func(t *testing.T) {
		path := "/path/to/file/fileName.txt"
		fileInfo := &mm_model.FileInfo{
			Id:   "imageBlock",
			Path: path,
		}
		th.Store.EXPECT().GetBoard("boardID").Return(&model.Board{
			ID:         "boardID",
			IsTemplate: false,
		}, nil)
		th.Store.EXPECT().GetFileInfo("fileName").Return(fileInfo, nil)
		th.Store.EXPECT().SaveFileInfo(fileInfo).Return(nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedFileBackend.On("CopyFile", mock.Anything, mock.Anything).Return(nil)

		updatedFileNames, err := th.App.CopyCardFiles("boardID", []*model.Block{imageBlock}, false)
		assert.NoError(t, err)
		assert.Equal(t, "7fileName.jpg", imageBlock.Fields["fileId"])
		assert.NotNil(t, updatedFileNames["7fileName.jpg"])
		assert.NotNil(t, updatedFileNames[imageBlock.Fields["fileId"].(string)])
	})

	t.Run("Board exists, attachment block, with FileInfo", func(t *testing.T) {
		attachmentBlock := &model.Block{
			ID:         "attachmentBlock",
			ParentID:   "c3zqnh6fsu3f4mr6hzq9hizwske",
			CreatedBy:  "6k6ynxdp47dujjhhojw9nqhmyh",
			ModifiedBy: "6k6ynxdp47dujjhhojw9nqhmyh",
			Schema:     1,
			Type:       "attachment",
			Title:      "",
			Fields:     map[string]interface{}{"fileId": "7fileName.jpg"},
			CreateAt:   1680725585250,
			UpdateAt:   1680725585250,
			DeleteAt:   0,
			BoardID:    "boardID",
		}

		path := "/path/to/file/fileName.txt"
		fileInfo := &mm_model.FileInfo{
			Id:   "attachmentBlock",
			Path: path,
		}
		th.Store.EXPECT().GetBoard("boardID").Return(&model.Board{
			ID:         "boardID",
			IsTemplate: false,
		}, nil)
		th.Store.EXPECT().GetFileInfo("fileName").Return(fileInfo, nil)
		th.Store.EXPECT().SaveFileInfo(fileInfo).Return(nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedFileBackend.On("CopyFile", mock.Anything, mock.Anything).Return(nil)

		updatedFileNames, err := th.App.CopyCardFiles("boardID", []*model.Block{attachmentBlock}, false)
		assert.NoError(t, err)
		assert.NotNil(t, updatedFileNames[imageBlock.Fields["fileId"].(string)])
	})

	t.Run("Board exists, image block, without FileInfo", func(t *testing.T) {
		// path := "/path/to/file/fileName.txt"
		// fileInfo := &mm_model.FileInfo{
		// 	Id:   "imageBlock",
		// 	Path: path,
		// }
		th.Store.EXPECT().GetBoard("boardID").Return(&model.Board{
			ID:         "boardID",
			IsTemplate: false,
		}, nil)
		th.Store.EXPECT().GetFileInfo(gomock.Any()).Return(nil, nil)
		th.Store.EXPECT().SaveFileInfo(gomock.Any()).Return(nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedFileBackend.On("CopyFile", mock.Anything, mock.Anything).Return(nil)

		updatedFileNames, err := th.App.CopyCardFiles("boardID", []*model.Block{imageBlock}, false)
		assert.NoError(t, err)
		assert.NotNil(t, imageBlock.Fields["fileId"].(string))
		assert.NotNil(t, updatedFileNames[imageBlock.Fields["fileId"].(string)])
	})
}

func TestCopyAndUpdateCardFiles(t *testing.T) {
	th, _ := SetupTestHelper(t)
	imageBlock := &model.Block{
		ID:         "imageBlock",
		ParentID:   "c3zqnh6fsu3f4mr6hzq9hizwske",
		CreatedBy:  "6k6ynxdp47dujjhhojw9nqhmyh",
		ModifiedBy: "6k6ynxdp47dujjhhojw9nqhmyh",
		Schema:     1,
		Type:       "image",
		Title:      "",
		Fields:     map[string]interface{}{"fileId": "7fileName.jpg"},
		CreateAt:   1680725585250,
		UpdateAt:   1680725585250,
		DeleteAt:   0,
		BoardID:    "boardID",
	}

	t.Run("Board exists, image block, with FileInfo", func(t *testing.T) {
		path := "/path/to/file/fileName.txt"
		fileInfo := &mm_model.FileInfo{
			Id:   "imageBlock",
			Path: path,
		}
		th.Store.EXPECT().GetBoard("boardID").Return(&model.Board{
			ID:         "boardID",
			IsTemplate: false,
		}, nil)
		th.Store.EXPECT().GetFileInfo("fileName").Return(fileInfo, nil)
		th.Store.EXPECT().SaveFileInfo(fileInfo).Return(nil)
		th.Store.EXPECT().PatchBlocks(gomock.Any(), "userID").Return(nil)

		mockedFileBackend := &mocks.FileBackend{}
		th.App.filesBackend = mockedFileBackend
		mockedFileBackend.On("CopyFile", mock.Anything, mock.Anything).Return(nil)

		err := th.App.CopyAndUpdateCardFiles("boardID", "userID", []*model.Block{imageBlock}, false)
		assert.NoError(t, err)

		assert.NotEqual(t, path, imageBlock.Fields["fileId"])
	})
}
