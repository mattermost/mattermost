// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math/rand"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"github.com/xtgo/uuid"

	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

func randomString() string {
	return uuid.NewRandom().String()
}

type FileBackendTestSuite struct {
	suite.Suite

	settings FileBackendSettings
	backend  FileBackend
}

func TestLocalFileBackendTestSuite(t *testing.T) {
	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initializing but that's fine for testing. Ideally this won't happen.
	logger := mlog.CreateConsoleTestLogger(true, mlog.LvlError)
	defer logger.Shutdown()

	mlog.InitGlobalLogger(logger)

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	suite.Run(t, &FileBackendTestSuite{
		settings: FileBackendSettings{
			DriverName: driverLocal,
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
	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	suite.Run(t, &FileBackendTestSuite{
		settings: FileBackendSettings{
			DriverName:                         driverS3,
			AmazonS3AccessKeyId:                "minioaccesskey",
			AmazonS3SecretAccessKey:            "miniosecretkey",
			AmazonS3Bucket:                     "mattermost-test",
			AmazonS3Region:                     "",
			AmazonS3Endpoint:                   s3Endpoint,
			AmazonS3PathPrefix:                 "",
			AmazonS3SSL:                        false,
			AmazonS3SSE:                        encrypt,
			AmazonS3RequestTimeoutMilliseconds: 5000,
		},
	})
}

func (s *FileBackendTestSuite) SetupTest() {
	backend, err := NewFileBackend(s.settings)
	require.NoError(s.T(), err)
	s.backend = backend

	// This is needed to create the bucket if it doesn't exist.
	err = s.backend.TestConnection()
	if _, ok := err.(*S3FileBackendNoBucketError); ok {
		s3Backend := s.backend.(*S3FileBackend)
		s.NoError(s3Backend.MakeBucket())
	} else {
		s.NoError(err)
	}
}

func (s *FileBackendTestSuite) TestConnection() {
	s.Nil(s.backend.TestConnection())
}

func (s *FileBackendTestSuite) TestReadWriteFile() {
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

func (s *FileBackendTestSuite) TestReadWriteFileContext() {
	type ContextWriter interface {
		WriteFileContext(context.Context, io.Reader, string) (int64, error)
	}

	data := "test"

	s.T().Run("no deadline", func(t *testing.T) {
		var (
			written int64
			err     error
		)

		path := "tests/" + randomString()

		ctx := context.Background()
		if cw, ok := s.backend.(ContextWriter); ok {
			written, err = cw.WriteFileContext(ctx, strings.NewReader(data), path)
		} else {
			written, err = s.backend.WriteFile(strings.NewReader(data), path)
		}
		s.NoError(err)
		s.EqualValues(len(data), written, "expected given number of bytes to have been written")
		defer s.backend.RemoveFile(path)

		read, err := s.backend.ReadFile(path)
		s.NoError(err)

		readString := string(read)
		s.Equal(readString, data)
	})

	s.T().Run("long deadline", func(t *testing.T) {
		var (
			written int64
			err     error
		)

		path := "tests/" + randomString()

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if cw, ok := s.backend.(ContextWriter); ok {
			written, err = cw.WriteFileContext(ctx, strings.NewReader(data), path)
		} else {
			written, err = s.backend.WriteFile(strings.NewReader(data), path)
		}
		s.NoError(err)
		s.EqualValues(len(data), written, "expected given number of bytes to have been written")
		defer s.backend.RemoveFile(path)

		read, err := s.backend.ReadFile(path)
		s.NoError(err)

		readString := string(read)
		s.Equal(readString, data)
	})

	s.T().Run("missed deadline", func(t *testing.T) {
		var (
			written int64
			err     error
		)

		path := "tests/" + randomString()

		r, w := io.Pipe()
		go func() {
			// close the writer after a short time
			time.Sleep(500 * time.Millisecond)
			w.Close()
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()
		if cw, ok := s.backend.(ContextWriter); ok {
			written, err = cw.WriteFileContext(ctx, r, path)
		} else {
			// this test works only with a context writer
			return
		}
		s.Error(err)
		s.Zero(written)
	})
}

func (s *FileBackendTestSuite) TestReadWriteFileImage() {
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

func (s *FileBackendTestSuite) TestFileExists() {
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

func (s *FileBackendTestSuite) TestCopyFile() {
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

func (s *FileBackendTestSuite) TestCopyFileToDirectoryThatDoesntExist() {
	b := []byte("test")
	path1 := "tests/" + randomString()
	path2 := "tests/newdirectory/" + randomString()

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

func (s *FileBackendTestSuite) TestRemoveFile() {
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

func (s *FileBackendTestSuite) TestListDirectory() {
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
	s.Equal(path1, (paths)[0])

	paths, err = s.backend.ListDirectory("19800101/")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path2, (paths)[0])

	if s.settings.DriverName == driverLocal {
		paths, err = s.backend.ListDirectory("19800102")
		s.Nil(err)
		s.Len(paths, 0)
	}

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

func (s *FileBackendTestSuite) TestListDirectoryRecursively() {
	b := []byte("test")
	path1 := "19700101/" + randomString()
	path2 := "19800101/" + randomString()
	longPath := "19800102/this/is/a/way/too/long/path/for/this/function/to/handle" + randomString()

	paths, err := s.backend.ListDirectoryRecursively("19700101")
	s.Nil(err)
	s.Len(paths, 0)

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), path2)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), longPath)
	s.Nil(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	paths, err = s.backend.ListDirectoryRecursively("19700101")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path1, (paths)[0])

	paths, err = s.backend.ListDirectoryRecursively("19800101/")
	s.Nil(err)
	s.Len(paths, 1)
	s.Equal(path2, (paths)[0])

	if s.settings.DriverName == driverLocal {
		paths, err = s.backend.ListDirectory("19800102")
		s.Nil(err)
		s.Len(paths, 1)
	}

	paths, err = s.backend.ListDirectoryRecursively("")
	s.Nil(err)
	found1 := false
	found2 := false
	found3 := false
	for _, path := range paths {
		if path == path1 {
			found1 = true
		} else if path == path2 {
			found2 = true
		} else if path == longPath {
			found3 = true
		}
	}
	s.True(found1)
	s.True(found2)
	if s.settings.DriverName == driverLocal {
		s.False(found3)
	}

	s.backend.RemoveFile(path1)
	s.backend.RemoveFile(path2)
	s.backend.RemoveFile(longPath)
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

func (s *FileBackendTestSuite) TestAppendFile() {
	s.Run("should fail if target file is missing", func() {
		path := "tests/" + randomString()
		b := make([]byte, 1024)
		written, err := s.backend.AppendFile(bytes.NewReader(b), path)
		s.Error(err)
		s.Zero(written)
	})

	s.Run("should correctly append the data", func() {
		// First part needs to be at least 5MB for the S3 implementation to work.
		size := 5 * 1024 * 1024
		b := make([]byte, size)
		for i := range b {
			b[i] = 'A'
		}
		path := "tests/" + randomString()

		written, err := s.backend.WriteFile(bytes.NewReader(b), path)
		s.Nil(err)
		s.EqualValues(len(b), written)
		defer s.backend.RemoveFile(path)

		b2 := make([]byte, 1024)
		for i := range b2 {
			b2[i] = 'B'
		}

		written, err = s.backend.AppendFile(bytes.NewReader(b2), path)
		s.Nil(err)
		s.EqualValues(int64(len(b2)), written)

		read, err := s.backend.ReadFile(path)
		s.Nil(err)
		s.EqualValues(len(b)+len(b2), len(read))
		s.True(bytes.Equal(append(b, b2...), read))

		b3 := make([]byte, 1024)
		for i := range b3 {
			b3[i] = 'C'
		}

		written, err = s.backend.AppendFile(bytes.NewReader(b3), path)
		s.Nil(err)
		s.EqualValues(int64(len(b3)), written)

		read, err = s.backend.ReadFile(path)
		s.Nil(err)
		s.EqualValues(len(b)+len(b2)+len(b3), len(read))
		s.True(bytes.Equal(append(append(b, b2...), b3...), read))
	})
}

func (s *FileBackendTestSuite) TestFileSize() {
	s.Run("nonexistent file", func() {
		size, err := s.backend.FileSize("tests/nonexistentfile")
		s.NotNil(err)
		s.Zero(size)
	})

	s.Run("valid file", func() {
		data := make([]byte, rand.Intn(1024*1024)+1)
		path := "tests/" + randomString()

		written, err := s.backend.WriteFile(bytes.NewReader(data), path)
		s.Nil(err)
		s.EqualValues(len(data), written)
		defer s.backend.RemoveFile(path)

		size, err := s.backend.FileSize(path)
		s.Nil(err)
		s.Equal(int64(len(data)), size)
	})
}

func (s *FileBackendTestSuite) TestFileModTime() {
	s.Run("nonexistent file", func() {
		modTime, err := s.backend.FileModTime("tests/nonexistentfile")
		s.NotNil(err)
		s.Empty(modTime)
	})

	s.Run("valid file", func() {
		path := "tests/" + randomString()
		data := []byte("some data")

		written, err := s.backend.WriteFile(bytes.NewReader(data), path)
		s.Nil(err)
		s.EqualValues(len(data), written)
		defer s.backend.RemoveFile(path)

		modTime, err := s.backend.FileModTime(path)
		s.Nil(err)
		s.NotEmpty(modTime)

		// We wait 1 second so that the times will differ enough to be testable.
		time.Sleep(1 * time.Second)

		path2 := "tests/" + randomString()
		written, err = s.backend.WriteFile(bytes.NewReader(data), path2)
		s.Nil(err)
		s.EqualValues(len(data), written)
		defer s.backend.RemoveFile(path2)

		modTime2, err := s.backend.FileModTime(path2)
		s.Nil(err)
		s.NotEmpty(modTime2)
		s.True(modTime2.After(modTime))
	})
}

func BenchmarkS3WriteFile(b *testing.B) {
	settings := FileBackendSettings{
		DriverName:                         driverS3,
		AmazonS3AccessKeyId:                "minioaccesskey",
		AmazonS3SecretAccessKey:            "miniosecretkey",
		AmazonS3Bucket:                     "mattermost-test",
		AmazonS3Region:                     "",
		AmazonS3Endpoint:                   "localhost:9000",
		AmazonS3PathPrefix:                 "",
		AmazonS3SSL:                        false,
		AmazonS3SSE:                        false,
		AmazonS3RequestTimeoutMilliseconds: 20000,
	}

	backend, err := NewFileBackend(settings)
	require.NoError(b, err)

	// This is needed to create the bucket if it doesn't exist.
	require.NoError(b, backend.TestConnection())

	path := "tests/" + randomString()
	size := 1 * 1024 * 1024
	data := make([]byte, size)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		written, err := backend.WriteFile(bytes.NewReader(data), path)
		defer backend.RemoveFile(path)
		require.NoError(b, err)
		require.Len(b, data, int(written))
	}

	b.StopTimer()
}
