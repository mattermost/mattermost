// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"os"
	"testing"

	"github.com/Azure/azure-storage-blob-go/azblob"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type AzureFileBackendTestSuite struct {
	suite.Suite

	settings FileBackendSettings
	backend  FileBackend
}

func TestAzureFileBackendTestSuite(t *testing.T) {
	// Skip if Azure credentials are not set
	accountName := os.Getenv("TEST_AZURE_STORAGE_ACCOUNT")
	if accountName == "" {
		t.Skip("TEST_AZURE_STORAGE_ACCOUNT not set")
	}

	accountKey := os.Getenv("TEST_AZURE_STORAGE_KEY") 
	if accountKey == "" {
		t.Skip("TEST_AZURE_STORAGE_KEY not set")
	}

	suite.Run(t, &AzureFileBackendTestSuite{
		settings: FileBackendSettings{
			DriverName:                      "azure",
			AzureAccessKey:                  accountName,
			AzureAccessSecret:               accountKey,
			AzureContainer:                  "mattermost-test",
			AzureStorageAccount:             accountName,
			AzureRequestTimeoutMilliseconds: 5000,
		},
	})
}

func (s *AzureFileBackendTestSuite) SetupTest() {
	backend, err := NewAzureFileBackend(s.settings)
	require.NoError(s.T(), err)
	s.backend = backend

	err = s.backend.TestConnection()
	if err != nil {
		azureBackend := s.backend.(*AzureFileBackend)
		ctx := context.Background()
		_, err = azureBackend.containerURL.Create(ctx, azblob.Metadata{}, azblob.PublicAccessNone)
		require.NoError(s.T(), err)
	}
}

func (s *AzureFileBackendTestSuite) TestConnection() {
	s.Nil(s.backend.TestConnection())
}

func (s *AzureFileBackendTestSuite) TestReadWriteFile() {
	b := []byte("test")
	path := "tests/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	s.Nil(err)

	readString := string(read)
	s.EqualValues(readString, "test")
}

func (s *AzureFileBackendTestSuite) TestReadWriteFileImage() {
	b := []byte("testimage")
	path := "tests/" + randomString() + ".png"

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	s.Nil(err)

	readString := string(read)
	s.EqualValues(readString, "testimage")
}

func (s *AzureFileBackendTestSuite) TestFileExists() {
	b := []byte("testimage")
	path := "tests/" + randomString() + ".png"

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

func (s *AzureFileBackendTestSuite) TestCopyFile() {
	b := []byte("test")
	path1 := "tests/" + randomString()
	path2 := "tests/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	err = s.backend.CopyFile(path1, path2)
	s.Nil(err)
	defer s.backend.RemoveFile(path2)

	data1, err := s.backend.ReadFile(path1)
	s.Nil(err)

	data2, err := s.backend.ReadFile(path2)
	s.Nil(err)

	s.Equal(b, data1)
	s.Equal(b, data2)
}

func (s *AzureFileBackendTestSuite) TestMoveFile() {
	b := []byte("test")
	path1 := "tests/" + randomString()
	path2 := "tests/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	s.Nil(s.backend.MoveFile(path1, path2))
	defer s.backend.RemoveFile(path2)

	_, err = s.backend.ReadFile(path1)
	s.Error(err)

	data, err := s.backend.ReadFile(path2)
	s.Nil(err)

	s.Equal(b, data)
}

func (s *AzureFileBackendTestSuite) TestRemoveFile() {
	b := []byte("test")
	path := "tests/" + randomString()

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

func (s *AzureFileBackendTestSuite) TestListDirectory() {
	b := []byte("test")
	path1 := "19700101/" + randomString()
	path2 := "19800101/" + randomString()

	paths, err := s.backend.ListDirectory("19700101")
	s.Nil(err)
	s.Len(paths, 0)

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), path2)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	paths, err = s.backend.ListDirectory("19700101")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path1, paths[0])

	paths, err = s.backend.ListDirectory("19800101/")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path2, paths[0])

	paths, err = s.backend.ListDirectory("")
	s.Nil(err)
	found1 := false
	found2 := false
	for _, path := range paths {
		if path == "19700101" {
			found1 = true
		} else if path == "19800101" {
			found2 = true
		}
	}
	s.True(found1)
	s.True(found2)

	s.backend.RemoveFile(path1)
	s.backend.RemoveFile(path2)
}

func (s *AzureFileBackendTestSuite) TestListDirectoryRecursively() {
	b := []byte("test")
	path1 := "19700101/" + randomString()
	path2 := "19800101/" + randomString()

	paths, err := s.backend.ListDirectoryRecursively("19700101")
	s.Nil(err)
	s.Len(paths, 0)

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), path2)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	paths, err = s.backend.ListDirectoryRecursively("19700101")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path1, paths[0])

	paths, err = s.backend.ListDirectoryRecursively("19800101/")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path2, paths[0])

	paths, err = s.backend.ListDirectoryRecursively("")
	s.Nil(err)
	found1 := false
	found2 := false
	for _, path := range paths {
		if path == path1 {
			found1 = true
		} else if path == path2 {
			found2 = true
		}
	}
	s.True(found1)
	s.True(found2)

	s.backend.RemoveFile(path1)
	s.backend.RemoveFile(path2)
}
