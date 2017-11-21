// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost-server/model"
)

type FileBackendTestSuite struct {
	suite.Suite

	settings model.FileSettings
	backend  FileBackend
}

func TestLocalFileBackendTestSuite(t *testing.T) {
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
			AmazonS3AccessKeyId:     "minioaccesskey",
			AmazonS3SecretAccessKey: "miniosecretkey",
			AmazonS3Bucket:          "mattermost-test",
			AmazonS3Endpoint:        s3Endpoint,
			AmazonS3SSL:             model.NewBool(false),
		},
	})
}

func (s *FileBackendTestSuite) SetupTest() {
	TranslationsPreInit()

	backend, err := NewFileBackend(&s.settings)
	require.Nil(s.T(), err)
	s.backend = backend
}

func (s *FileBackendTestSuite) TestConnection() {
	require.Nil(s.T(), s.backend.TestConnection())
}

func (s *FileBackendTestSuite) TestReadWriteFile() {
	b := []byte("test")
	path := "tests/" + model.NewId()

	require.Nil(s.T(), s.backend.WriteFile(b, path))
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	require.Nil(s.T(), err)

	readString := string(read)
	require.EqualValues(s.T(), readString, "test")
}

func (s *FileBackendTestSuite) TestMoveFile() {
	b := []byte("test")
	path1 := "tests/" + model.NewId()
	path2 := "tests/" + model.NewId()

	require.Nil(s.T(), s.backend.WriteFile(b, path1))
	defer s.backend.RemoveFile(path1)

	require.Nil(s.T(), s.backend.MoveFile(path1, path2))
	defer s.backend.RemoveFile(path2)

	_, err := s.backend.ReadFile(path1)
	require.Error(s.T(), err)

	_, err = s.backend.ReadFile(path2)
	require.Nil(s.T(), err)
}

func (s *FileBackendTestSuite) TestRemoveFile() {
	b := []byte("test")
	path := "tests/" + model.NewId()

	require.Nil(s.T(), s.backend.WriteFile(b, path))
	require.Nil(s.T(), s.backend.RemoveFile(path))

	_, err := s.backend.ReadFile(path)
	require.Error(s.T(), err)

	require.Nil(s.T(), s.backend.WriteFile(b, "tests2/foo"))
	require.Nil(s.T(), s.backend.WriteFile(b, "tests2/bar"))
	require.Nil(s.T(), s.backend.WriteFile(b, "tests2/asdf"))
	require.Nil(s.T(), s.backend.RemoveDirectory("tests2"))
}

func (s *FileBackendTestSuite) TestListDirectory() {
	b := []byte("test")
	path1 := "19700101/" + model.NewId()
	path2 := "19800101/" + model.NewId()

	require.Nil(s.T(), s.backend.WriteFile(b, path1))
	defer s.backend.RemoveFile(path1)
	require.Nil(s.T(), s.backend.WriteFile(b, path2))
	defer s.backend.RemoveFile(path2)

	paths, err := s.backend.ListDirectory("")
	require.Nil(s.T(), err)

	found1 := false
	found2 := false
	for _, path := range *paths {
		if path == "19700101" {
			found1 = true
		} else if path == "19800101" {
			found2 = true
		}
	}
	require.True(s.T(), found1)
	require.True(s.T(), found2)
}

func (s *FileBackendTestSuite) TestRemoveDirectory() {
	b := []byte("test")

	require.Nil(s.T(), s.backend.WriteFile(b, "tests2/foo"))
	require.Nil(s.T(), s.backend.WriteFile(b, "tests2/bar"))
	require.Nil(s.T(), s.backend.WriteFile(b, "tests2/aaa"))

	require.Nil(s.T(), s.backend.RemoveDirectory("tests2"))

	_, err := s.backend.ReadFile("tests2/foo")
	require.Error(s.T(), err)
	_, err = s.backend.ReadFile("tests2/bar")
	require.Error(s.T(), err)
	_, err = s.backend.ReadFile("tests2/asdf")
	require.Error(s.T(), err)
}
