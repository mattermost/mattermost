// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package filesstore

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type FileBackendTestSuite struct {
	suite.Suite

	settings model.FileSettings
	backend  FileBackend
}

func TestLocalFileBackendTestSuite(t *testing.T) {
	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing. Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	suite.Run(t, &FileBackendTestSuite{
		settings: model.FileSettings{
			DriverName: model.NewString(model.IMAGE_DRIVER_LOCAL),
			Directory:  dir,
		},
	})
}

func TestS3FileBackendTestSuite(t *testing.T) {
	runBackendTest(t, false)
}

func TestS3FileBackendTestSuiteWithEncryption(t *testing.T) {
	runBackendTest(t, true)
}

func runBackendTest(t *testing.T, encrypt bool) {
	s3Host := os.Getenv("CI_HOST")
	if s3Host == "" {
		s3Host = "dockerhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9001"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	suite.Run(t, &FileBackendTestSuite{
		settings: model.FileSettings{
			DriverName:              model.NewString(model.IMAGE_DRIVER_S3),
			AmazonS3AccessKeyId:     model.MINIO_ACCESS_KEY,
			AmazonS3SecretAccessKey: model.MINIO_SECRET_KEY,
			AmazonS3Bucket:          model.MINIO_BUCKET,
			AmazonS3Endpoint:        s3Endpoint,
			AmazonS3SSL:             model.NewBool(false),
			AmazonS3SSE:             model.NewBool(encrypt),
		},
	})
}

func (s *FileBackendTestSuite) SetupTest() {
	utils.TranslationsPreInit()

	backend, err := NewFileBackend(&s.settings, true)
	require.Nil(s.T(), err)
	s.backend = backend
}

func (s *FileBackendTestSuite) TestConnection() {
	s.Nil(s.backend.TestConnection())
}

func (s *FileBackendTestSuite) TestReadWriteFile() {
	b := []byte("test")
	path := "tests/" + model.NewId()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	s.Nil(err)

	readString := string(read)
	s.EqualValues(readString, "test")
}

func (s *FileBackendTestSuite) TestReadWriteFileImage() {
	b := []byte("testimage")
	path := "tests/" + model.NewId() + ".png"

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	s.Nil(err)

	readString := string(read)
	s.EqualValues(readString, "testimage")
}

func (s *FileBackendTestSuite) TestFileExists() {
	b := []byte("testimage")
	path := "tests/" + model.NewId() + ".png"

	_, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.Nil(err)
	defer s.backend.RemoveFile(path)

	res, err := s.backend.FileExists(path)
	s.Nil(err)
	s.True(res)

	res, err = s.backend.FileExists("tests/idontexist.png")
	s.Nil(err)
	s.False(res)
}

func (s *FileBackendTestSuite) TestCopyFile() {
	b := []byte("test")
	path1 := "tests/" + model.NewId()
	path2 := "tests/" + model.NewId()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	err = s.backend.CopyFile(path1, path2)
	s.Nil(err)
	defer s.backend.RemoveFile(path2)

	_, err = s.backend.ReadFile(path1)
	s.Nil(err)

	_, err = s.backend.ReadFile(path2)
	s.Nil(err)
}

func (s *FileBackendTestSuite) TestCopyFileToDirectoryThatDoesntExist() {
	b := []byte("test")
	path1 := "tests/" + model.NewId()
	path2 := "tests/newdirectory/" + model.NewId()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	err = s.backend.CopyFile(path1, path2)
	s.Nil(err)
	defer s.backend.RemoveFile(path2)

	_, err = s.backend.ReadFile(path1)
	s.Nil(err)

	_, err = s.backend.ReadFile(path2)
	s.Nil(err)
}

func (s *FileBackendTestSuite) TestMoveFile() {
	b := []byte("test")
	path1 := "tests/" + model.NewId()
	path2 := "tests/" + model.NewId()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	s.Nil(s.backend.MoveFile(path1, path2))
	defer s.backend.RemoveFile(path2)

	_, err = s.backend.ReadFile(path1)
	s.Error(err)

	_, err = s.backend.ReadFile(path2)
	s.Nil(err)
}

func (s *FileBackendTestSuite) TestRemoveFile() {
	b := []byte("test")
	path := "tests/" + model.NewId()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	s.Nil(s.backend.RemoveFile(path))

	_, err = s.backend.ReadFile(path)
	s.Error(err)

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/foo")
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/bar")
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/asdf")
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	s.Nil(s.backend.RemoveDirectory("tests2"))
}

func (s *FileBackendTestSuite) TestListDirectory() {
	b := []byte("test")
	path1 := "19700101/" + model.NewId()
	path2 := "19800101/" + model.NewId()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	written, err = s.backend.WriteFile(bytes.NewReader(b), path2)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path2)

	paths, err := s.backend.ListDirectory("")
	s.Nil(err)

	found1 := false
	found2 := false
	for _, path := range *paths {
		if path == "19700101" {
			found1 = true
		} else if path == "19800101" {
			found2 = true
		}
	}
	s.True(found1)
	s.True(found2)
}

func (s *FileBackendTestSuite) TestRemoveDirectory() {
	b := []byte("test")

	written, err := s.backend.WriteFile(bytes.NewReader(b), "tests2/foo")
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/bar")
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/aaa")
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	s.Nil(s.backend.RemoveDirectory("tests2"))

	_, err = s.backend.ReadFile("tests2/foo")
	s.Error(err)
	_, err = s.backend.ReadFile("tests2/bar")
	s.Error(err)
	_, err = s.backend.ReadFile("tests2/asdf")
	s.Error(err)
}
