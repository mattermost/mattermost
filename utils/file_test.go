// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost-server/model"
)

type FileTestSuite struct {
	suite.Suite

	testDriver string

	// Config to be reset after tests.
	driverName              string
	amazonS3AccessKeyId     string
	amazonS3SecretAccessKey string
	amazonS3Bucket          string
	amazonS3Endpoint        string
	amazonS3SSL             bool
}

func TestFileLocalTestSuite(t *testing.T) {
	testsuite := FileTestSuite{
		testDriver: model.IMAGE_DRIVER_LOCAL,
	}
	suite.Run(t, &testsuite)
}

func TestFileMinioTestSuite(t *testing.T) {
	testsuite := FileTestSuite{
		testDriver: model.IMAGE_DRIVER_S3,
	}
	suite.Run(t, &testsuite)
}

func (s *FileTestSuite) SetupTest() {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)

	// Save state to restore after the test has run.
	s.driverName = *Cfg.FileSettings.DriverName
	s.amazonS3AccessKeyId = Cfg.FileSettings.AmazonS3AccessKeyId
	s.amazonS3SecretAccessKey = Cfg.FileSettings.AmazonS3SecretAccessKey
	s.amazonS3Bucket = Cfg.FileSettings.AmazonS3Bucket
	s.amazonS3Endpoint = Cfg.FileSettings.AmazonS3Endpoint
	s.amazonS3SSL = *Cfg.FileSettings.AmazonS3SSL

	// Set up the state for the tests.
	if s.testDriver == model.IMAGE_DRIVER_LOCAL {
		*Cfg.FileSettings.DriverName = model.IMAGE_DRIVER_LOCAL
	} else if s.testDriver == model.IMAGE_DRIVER_S3 {
		*Cfg.FileSettings.DriverName = model.IMAGE_DRIVER_S3
		Cfg.FileSettings.AmazonS3AccessKeyId = "minioaccesskey"
		Cfg.FileSettings.AmazonS3SecretAccessKey = "miniosecretkey"
		Cfg.FileSettings.AmazonS3Bucket = "mattermost-test"
		Cfg.FileSettings.AmazonS3Endpoint = "dockerhost:9001"
		*Cfg.FileSettings.AmazonS3SSL = false
	} else {
		s.T().Fatal("Invalid image driver set for test suite.")
	}
}

func (s *FileTestSuite) TearDownTest() {
	// Restore the test state.
	*Cfg.FileSettings.DriverName = s.driverName
	Cfg.FileSettings.AmazonS3AccessKeyId = s.amazonS3AccessKeyId
	Cfg.FileSettings.AmazonS3SecretAccessKey = s.amazonS3SecretAccessKey
	Cfg.FileSettings.AmazonS3Bucket = s.amazonS3Bucket
	Cfg.FileSettings.AmazonS3Endpoint = s.amazonS3Endpoint
	*Cfg.FileSettings.AmazonS3SSL = s.amazonS3SSL
}

func (s *FileTestSuite) TestReadWriteFile() {
	b := []byte("test")
	path := "tests/" + model.NewId()

	s.Nil(WriteFile(b, path))
	defer RemoveFile(path)

	read, err := ReadFile(path)
	s.Nil(err)

	readString := string(read)
	s.EqualValues(readString, "test")
}

func (s *FileTestSuite) TestMoveFile() {
	b := []byte("test")
	path1 := "tests/" + model.NewId()
	path2 := "tests/" + model.NewId()

	s.Nil(WriteFile(b, path1))
	defer RemoveFile(path1)

	s.Nil(MoveFile(path1, path2))
	defer RemoveFile(path2)

	_, err := ReadFile(path1)
	s.Error(err)

	_, err = ReadFile(path2)
	s.Nil(err)
}

func (s *FileTestSuite) TestRemoveFile() {
	b := []byte("test")
	path := "tests/" + model.NewId()

	s.Nil(WriteFile(b, path))
	s.Nil(RemoveFile(path))

	_, err := ReadFile(path)
	s.Error(err)

	s.Nil(WriteFile(b, "tests2/foo"))
	s.Nil(WriteFile(b, "tests2/bar"))
	s.Nil(WriteFile(b, "tests2/asdf"))
	s.Nil(RemoveDirectory("tests2"))
}

func (s *FileTestSuite) TestListDirectory() {
	b := []byte("test")
	path1 := "19700101/" + model.NewId()
	path2 := "19800101/" + model.NewId()

	s.Nil(WriteFile(b, path1))
	defer RemoveFile(path1)
	s.Nil(WriteFile(b, path2))
	defer RemoveFile(path2)

	paths, err := ListDirectory("")
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

func (s *FileTestSuite) TestRemoveDirectory() {
	b := []byte("test")

	s.Nil(WriteFile(b, "tests2/foo"))
	s.Nil(WriteFile(b, "tests2/bar"))
	s.Nil(WriteFile(b, "tests2/aaa"))

	s.Nil(RemoveDirectory("tests2"))

	_, err := ReadFile("tests2/foo")
	s.Error(err)
	_, err = ReadFile("tests2/bar")
	s.Error(err)
	_, err = ReadFile("tests2/asdf")
	s.Error(err)
}
