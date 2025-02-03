// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"github.com/xtgo/uuid"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	logger := mlog.CreateConsoleTestLogger(t)

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
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	s.NoError(err)

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
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path)

	read, err := s.backend.ReadFile(path)
	s.NoError(err)

	readString := string(read)
	s.EqualValues(readString, "testimage")
}

func (s *FileBackendTestSuite) TestFileExists() {
	b := []byte("testimage")
	path := "tests/" + randomString() + ".png"

	_, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.NoError(err)
	defer s.backend.RemoveFile(path)

	res, err := s.backend.FileExists(path)
	s.NoError(err)
	s.True(res)

	res, err = s.backend.FileExists("tests/idontexist.png")
	s.NoError(err)
	s.False(res)
}

func (s *FileBackendTestSuite) TestCopyFile() {
	b := []byte("test")
	path1 := "tests/" + randomString()
	path2 := "tests/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	err = s.backend.CopyFile(path1, path2)
	s.NoError(err)
	defer s.backend.RemoveFile(path2)

	data1, err := s.backend.ReadFile(path1)
	s.NoError(err)

	data2, err := s.backend.ReadFile(path2)
	s.NoError(err)

	s.Equal(b, data1)
	s.Equal(b, data2)
}

func (s *FileBackendTestSuite) TestCopyFileToDirectoryThatDoesntExist() {
	b := []byte("test")
	path1 := "tests/" + randomString()
	path2 := "tests/newdirectory/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	err = s.backend.CopyFile(path1, path2)
	s.NoError(err)
	defer s.backend.RemoveFile(path2)

	_, err = s.backend.ReadFile(path1)
	s.NoError(err)

	_, err = s.backend.ReadFile(path2)
	s.NoError(err)
}

func (s *FileBackendTestSuite) TestMoveFile() {
	b := []byte("test")
	path1 := "tests/" + randomString()
	path2 := "tests/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	defer s.backend.RemoveFile(path1)

	s.Nil(s.backend.MoveFile(path1, path2))
	defer s.backend.RemoveFile(path2)

	_, err = s.backend.ReadFile(path1)
	s.Error(err)

	data, err := s.backend.ReadFile(path2)
	s.NoError(err)

	s.Equal(b, data)
}

func (s *FileBackendTestSuite) TestRemoveFile() {
	b := []byte("test")
	path := "tests/" + randomString()

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")
	s.Nil(s.backend.RemoveFile(path))

	_, err = s.backend.ReadFile(path)
	s.Error(err)

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/foo")
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/bar")
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/asdf")
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	s.Nil(s.backend.RemoveDirectory("tests2"))
}

func (s *FileBackendTestSuite) TestListDirectory() {
	b := []byte("test")
	path1 := "19700101/" + randomString()
	path2 := "19800101/" + randomString()

	paths, err := s.backend.ListDirectory("19700101")
	s.NoError(err)
	s.Len(paths, 0)

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), path2)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	paths, err = s.backend.ListDirectory("19700101")
	s.NoError(err)
	s.Len(paths, 1)
	s.Equal(path1, (paths)[0])

	paths, err = s.backend.ListDirectory("19800101/")
	s.NoError(err)
	s.Len(paths, 1)
	s.Equal(path2, (paths)[0])

	if s.settings.DriverName == driverLocal {
		paths, err = s.backend.ListDirectory("19800102")
		s.NoError(err)
		s.Len(paths, 0)
	}

	paths, err = s.backend.ListDirectory("")
	s.NoError(err)
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
	longPath := "19800102" + strings.Repeat("/toomuch", MaxRecursionDepth+1) + randomString()

	paths, err := s.backend.ListDirectoryRecursively("19700101")
	s.NoError(err)
	s.Len(paths, 0)

	written, err := s.backend.WriteFile(bytes.NewReader(b), path1)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), path2)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), longPath)
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	paths, err = s.backend.ListDirectoryRecursively("19700101")
	s.NoError(err)
	s.Len(paths, 1)
	s.Equal(path1, (paths)[0])

	paths, err = s.backend.ListDirectoryRecursively("19800101/")
	s.NoError(err)
	s.Len(paths, 1)
	s.Equal(path2, (paths)[0])

	if s.settings.DriverName == driverLocal {
		paths, err = s.backend.ListDirectory("19800102")
		s.NoError(err)
		s.Len(paths, 1)
	}

	paths, err = s.backend.ListDirectoryRecursively("")
	s.NoError(err)
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
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/bar")
	s.NoError(err)
	s.EqualValues(len(b), written, "expected given number of bytes to have been written")

	written, err = s.backend.WriteFile(bytes.NewReader(b), "tests2/aaa")
	s.NoError(err)
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
		b := bytes.Repeat([]byte{'A'}, size)
		path := "tests/" + randomString()

		written, err := s.backend.WriteFile(bytes.NewReader(b), path)
		s.NoError(err)
		s.EqualValues(len(b), written)
		defer s.backend.RemoveFile(path)

		b2 := make([]byte, 1024)
		for i := range b2 {
			b2[i] = 'B'
		}

		written, err = s.backend.AppendFile(bytes.NewReader(b2), path)
		s.NoError(err)
		s.EqualValues(int64(len(b2)), written)

		read, err := s.backend.ReadFile(path)
		s.NoError(err)
		s.EqualValues(len(b)+len(b2), len(read))
		s.True(bytes.Equal(append(b, b2...), read))

		b3 := make([]byte, 1024)
		for i := range b3 {
			b3[i] = 'C'
		}

		written, err = s.backend.AppendFile(bytes.NewReader(b3), path)
		s.NoError(err)
		s.EqualValues(int64(len(b3)), written)

		read, err = s.backend.ReadFile(path)
		s.NoError(err)
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
		s.NoError(err)
		s.EqualValues(len(data), written)
		defer s.backend.RemoveFile(path)

		size, err := s.backend.FileSize(path)
		s.NoError(err)
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
		s.NoError(err)
		s.EqualValues(len(data), written)
		defer s.backend.RemoveFile(path)

		modTime, err := s.backend.FileModTime(path)
		s.NoError(err)
		s.NotEmpty(modTime)

		// We wait 1 second so that the times will differ enough to be testable.
		time.Sleep(1 * time.Second)

		path2 := "tests/" + randomString()
		written, err = s.backend.WriteFile(bytes.NewReader(data), path2)
		s.NoError(err)
		s.EqualValues(len(data), written)
		defer s.backend.RemoveFile(path2)

		modTime2, err := s.backend.FileModTime(path2)
		s.NoError(err)
		s.NotEmpty(modTime2)
		s.True(modTime2.After(modTime))
	})
}

func BenchmarkS3WriteFile(b *testing.B) {
	fileSizes := []int{
		1024 * 100,          // 100KB
		1024 * 1024,         // 1MB
		1024 * 1024 * 10,    // 10MB
		1024 * 1024 * 100,   // 100MB
		1024 * 1024 * 1000,  // 1GB
		1024 * 1024 * 10000, // 10GB
	}

	partSizes := []int64{
		1024 * 1024 * 5,   // 5MB
		1024 * 1024 * 10,  // 10MB
		1024 * 1024 * 25,  // 25MB
		1024 * 1024 * 100, // 100MB
		1024 * 1024 * 200, // 200MB
	}

	defaultSettings := FileBackendSettings{
		DriverName:                         driverS3,
		AmazonS3AccessKeyId:                "minioaccesskey",
		AmazonS3SecretAccessKey:            "miniosecretkey",
		AmazonS3Bucket:                     "mattermost-test",
		AmazonS3Region:                     "",
		AmazonS3Endpoint:                   "localhost:9000",
		AmazonS3PathPrefix:                 "",
		AmazonS3SSL:                        false,
		AmazonS3SSE:                        false,
		AmazonS3RequestTimeoutMilliseconds: 300 * 1000,
	}

	// The following overrides make it easier to test these against different backends
	// (e.g. S3 instead of minio).
	if val := os.Getenv("MM_FILESETTINGS_AMAZONS3BUCKET"); val != "" {
		defaultSettings.AmazonS3Bucket = val
	}
	if val := os.Getenv("MM_FILESETTINGS_AMAZONS3REGION"); val != "" {
		defaultSettings.AmazonS3Region = val
	}
	if val := os.Getenv("MM_FILESETTINGS_AMAZONS3ACCESSKEYID"); val != "" {
		defaultSettings.AmazonS3AccessKeyId = val
	}
	if val := os.Getenv("MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY"); val != "" {
		defaultSettings.AmazonS3SecretAccessKey = val
	}
	if val := os.Getenv("MM_FILESETTINGS_AMAZONS3ENDPOINT"); val != "" {
		defaultSettings.AmazonS3Endpoint = val
	}
	if val := os.Getenv("MM_FILESETTINGS_AMAZONS3TRACE"); val == "true" {
		defaultSettings.AmazonS3Trace = true
	}

	backendMap := make(map[int64]FileBackend, len(partSizes))
	for _, partSize := range partSizes {
		settings := defaultSettings
		settings.AmazonS3UploadPartSizeBytes = partSize

		backend, err := NewFileBackend(settings)
		require.NoError(b, err)

		// This is needed to create the bucket if it doesn't exist.
		err = backend.TestConnection()
		if _, ok := err.(*S3FileBackendNoBucketError); ok {
			require.NoError(b, backend.(*S3FileBackend).MakeBucket())
		} else {
			require.NoError(b, err)
		}

		backendMap[partSize] = backend
	}

	bufferSize := 1024 * 1024 // 4MB
	buffer := make([]byte, bufferSize)

	for _, size := range fileSizes {
		for _, partSize := range partSizes {
			backend := backendMap[partSize]
			b.Run(fmt.Sprintf("FileSize-%dMB_PartSize-%dMB", int(math.Round(float64(size)/1024/1024)), int(math.Round(float64(partSize)/1024/1024))), func(b *testing.B) {
				b.ReportAllocs()
				for i := 0; i < b.N; i++ {
					rd, wr := io.Pipe()
					go func() {
						defer wr.Close()
						for i := 0; i < size; i += bufferSize {
							b := buffer
							if size < bufferSize {
								b = b[:size]
							}
							wr.Write(b)
						}
					}()
					path := "tests/" + randomString()
					b.StartTimer()
					written, err := backend.WriteFile(rd, path)
					b.StopTimer()
					require.NoError(b, err)
					require.Equal(b, size, int(written))
					err = backend.RemoveFile(path)
					require.NoError(b, err)
				}
			})
		}
	}
}

func TestNewExportFileBackendSettingsFromConfig(t *testing.T) {
	t.Run("local filestore", func(t *testing.T) {
		skipVerify := false
		enableComplianceFeature := false

		expected := FileBackendSettings{
			DriverName:                         driverLocal,
			Directory:                          "directory",
			AmazonS3AccessKeyId:                "",
			AmazonS3SecretAccessKey:            "",
			AmazonS3Bucket:                     "",
			AmazonS3PathPrefix:                 "",
			AmazonS3Region:                     "",
			AmazonS3Endpoint:                   "",
			AmazonS3SSL:                        false,
			AmazonS3SignV2:                     false,
			AmazonS3SSE:                        false,
			AmazonS3Trace:                      false,
			SkipVerify:                         false,
			AmazonS3RequestTimeoutMilliseconds: 0,
			AmazonS3PresignExpiresSeconds:      0,
		}

		actual := NewExportFileBackendSettingsFromConfig(&model.FileSettings{
			ExportDriverName: model.NewPointer(driverLocal),
			ExportDirectory:  model.NewPointer("directory"),
		}, enableComplianceFeature, skipVerify)

		require.Equal(t, expected, actual)
	})

	t.Run("s3 filestore, disable compliance", func(t *testing.T) {
		skipVerify := true
		enableComplianceFeature := false

		expected := FileBackendSettings{
			DriverName:                         driverS3,
			Directory:                          "",
			AmazonS3AccessKeyId:                "minioaccesskey",
			AmazonS3SecretAccessKey:            "miniosecretkey",
			AmazonS3Bucket:                     "mattermost-test",
			AmazonS3PathPrefix:                 "prefix",
			AmazonS3Region:                     "region",
			AmazonS3Endpoint:                   "s3.example.com",
			AmazonS3SSL:                        true,
			AmazonS3SignV2:                     true,
			AmazonS3SSE:                        false,
			AmazonS3Trace:                      true,
			SkipVerify:                         true,
			AmazonS3RequestTimeoutMilliseconds: 1000,
			AmazonS3PresignExpiresSeconds:      60000,
			AmazonS3UploadPartSizeBytes:        model.FileSettingsDefaultS3ExportUploadPartSizeBytes,
		}

		actual := NewExportFileBackendSettingsFromConfig(&model.FileSettings{
			ExportDriverName:                         model.NewPointer(driverS3),
			ExportAmazonS3AccessKeyId:                model.NewPointer("minioaccesskey"),
			ExportAmazonS3SecretAccessKey:            model.NewPointer("miniosecretkey"),
			ExportAmazonS3Bucket:                     model.NewPointer("mattermost-test"),
			ExportAmazonS3Region:                     model.NewPointer("region"),
			ExportAmazonS3Endpoint:                   model.NewPointer("s3.example.com"),
			ExportAmazonS3PathPrefix:                 model.NewPointer("prefix"),
			ExportAmazonS3SSL:                        model.NewPointer(true),
			ExportAmazonS3SignV2:                     model.NewPointer(true),
			ExportAmazonS3SSE:                        model.NewPointer(true),
			ExportAmazonS3Trace:                      model.NewPointer(true),
			ExportAmazonS3RequestTimeoutMilliseconds: model.NewPointer(int64(1000)),
			ExportAmazonS3PresignExpiresSeconds:      model.NewPointer(int64(60000)),
			ExportAmazonS3UploadPartSizeBytes:        model.NewPointer(int64(model.FileSettingsDefaultS3ExportUploadPartSizeBytes)),
			ExportAmazonS3StorageClass:               model.NewPointer(""),
		}, enableComplianceFeature, skipVerify)

		require.Equal(t, expected, actual)
	})

	t.Run("s3 filestore, enable compliance", func(t *testing.T) {
		skipVerify := true
		enableComplianceFeature := true

		expected := FileBackendSettings{
			DriverName:                         driverS3,
			Directory:                          "",
			AmazonS3AccessKeyId:                "minioaccesskey",
			AmazonS3SecretAccessKey:            "miniosecretkey",
			AmazonS3Bucket:                     "mattermost-test",
			AmazonS3PathPrefix:                 "prefix",
			AmazonS3Region:                     "region",
			AmazonS3Endpoint:                   "s3.example.com",
			AmazonS3SSL:                        true,
			AmazonS3SignV2:                     true,
			AmazonS3SSE:                        true,
			AmazonS3Trace:                      true,
			SkipVerify:                         true,
			AmazonS3RequestTimeoutMilliseconds: 1000,
			AmazonS3PresignExpiresSeconds:      60000,
			AmazonS3UploadPartSizeBytes:        model.FileSettingsDefaultS3ExportUploadPartSizeBytes,
			AmazonS3StorageClass:               "",
		}

		actual := NewExportFileBackendSettingsFromConfig(&model.FileSettings{
			ExportDriverName:                         model.NewPointer(driverS3),
			ExportAmazonS3AccessKeyId:                model.NewPointer("minioaccesskey"),
			ExportAmazonS3SecretAccessKey:            model.NewPointer("miniosecretkey"),
			ExportAmazonS3Bucket:                     model.NewPointer("mattermost-test"),
			ExportAmazonS3Region:                     model.NewPointer("region"),
			ExportAmazonS3Endpoint:                   model.NewPointer("s3.example.com"),
			ExportAmazonS3PathPrefix:                 model.NewPointer("prefix"),
			ExportAmazonS3SSL:                        model.NewPointer(true),
			ExportAmazonS3SignV2:                     model.NewPointer(true),
			ExportAmazonS3SSE:                        model.NewPointer(true),
			ExportAmazonS3Trace:                      model.NewPointer(true),
			ExportAmazonS3RequestTimeoutMilliseconds: model.NewPointer(int64(1000)),
			ExportAmazonS3PresignExpiresSeconds:      model.NewPointer(int64(60000)),
			ExportAmazonS3UploadPartSizeBytes:        model.NewPointer(int64(model.FileSettingsDefaultS3ExportUploadPartSizeBytes)),
			ExportAmazonS3StorageClass:               model.NewPointer(""),
		}, enableComplianceFeature, skipVerify)

		require.Equal(t, expected, actual)
	})
}

func (s *FileBackendTestSuite) TestZipReaderSingleFile() {
	// Test zipping a single file (but not its neighbours)
	b := []byte("testdata")
	path := "tests/" + randomString() + ".txt"

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.NoError(err)
	s.EqualValues(len(b), written)
	defer s.backend.RemoveFile(path)

	// neighbour, not included
	b2 := []byte("testdata2")
	path2 := "tests/" + randomString() + ".txt"

	written, err = s.backend.WriteFile(bytes.NewReader(b2), path2)
	s.NoError(err)
	s.EqualValues(len(b2), written)
	defer s.backend.RemoveFile(path2)

	// Test without compression
	reader, err := s.backend.ZipReader(path, false)
	s.NoError(err)
	defer reader.Close()

	// Read the zip file
	zipBytes, err := io.ReadAll(reader)
	s.NoError(err)

	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	s.NoError(err)
	s.Len(zipReader.File, 1)

	// Verify file contents
	zf := zipReader.File[0]
	s.Equal(filepath.Base(path), zf.Name)
	s.Equal(zip.Store, zf.Method)

	rc, err := zf.Open()
	s.NoError(err)
	defer rc.Close()

	content, err := io.ReadAll(rc)
	s.NoError(err)
	s.Equal(b, content)
}

func (s *FileBackendTestSuite) TestZipReaderSingleFileCompressed() {
	// Test zipping a single file (but not its neighbours) with compression
	b := []byte("testdata")
	path := "tests/" + randomString() + ".txt"

	written, err := s.backend.WriteFile(bytes.NewReader(b), path)
	s.NoError(err)
	s.EqualValues(len(b), written)
	defer s.backend.RemoveFile(path)

	// neighbour, not included
	b2 := []byte("testdata2")
	path2 := "tests/" + randomString() + ".txt"

	written, err = s.backend.WriteFile(bytes.NewReader(b2), path2)
	s.NoError(err)
	s.EqualValues(len(b2), written)
	defer s.backend.RemoveFile(path2)

	reader, err := s.backend.ZipReader(path, true)
	s.NoError(err)
	defer reader.Close()

	zipBytes, err := io.ReadAll(reader)
	s.NoError(err)

	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	s.NoError(err)
	s.Len(zipReader.File, 1)

	zf := zipReader.File[0]
	s.Equal(filepath.Base(path), zf.Name)
	s.Equal(zip.Deflate, zf.Method)

	rc, err := zf.Open()
	s.NoError(err)
	defer rc.Close()

	content, err := io.ReadAll(rc)
	s.NoError(err)
	s.Equal(b, content)
}

func (s *FileBackendTestSuite) TestZipReaderDirectory() {
	// Create test directory structure
	dirPath := "tests/zip_test_" + randomString()
	files := map[string][]byte{
		"file1.txt":          []byte("file1 content"),
		"file2.png":          []byte("file2 content"),
		"subdir/file3.txt":   []byte("file3 content"),
		"subdir2/file4.json": []byte("file4 content"),
	}

	for path, content := range files {
		fullPath := filepath.Join(dirPath, path)
		written, err := s.backend.WriteFile(bytes.NewReader(content), fullPath)
		s.NoError(err)
		s.EqualValues(len(content), written)
		defer s.backend.RemoveFile(fullPath)
	}

	// Test without compression
	reader, err := s.backend.ZipReader(dirPath, false)
	s.NoError(err)
	defer reader.Close()

	// Read and verify zip contents
	zipBytes, err := io.ReadAll(reader)
	s.NoError(err)

	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	s.NoError(err)

	// Verify each file
	foundFiles := make(map[string]bool)
	for _, zf := range zipReader.File {
		s.Contains(files, zf.Name)
		expectedContent := files[zf.Name]
		delete(files, zf.Name)

		rc, err := zf.Open()
		s.NoError(err)

		content, err := io.ReadAll(rc)
		s.NoError(err)
		rc.Close()

		s.Equal(expectedContent, content)
		foundFiles[zf.Name] = true
	}

	// Verify we found all files
	s.Len(foundFiles, 4)
	s.Empty(files)
}

func (s *FileBackendTestSuite) TestZipReaderDirectoryCompressed() {
	// Create test directory structure
	dirPath := "tests/zip_test_" + randomString()
	files := map[string][]byte{
		"file1.txt":          []byte("file1 content"),
		"file2.png":          []byte("file2 content"),
		"subdir/file3.txt":   []byte("file3 content"),
		"subdir2/file4.json": []byte("file4 content"),
	}

	for path, content := range files {
		fullPath := filepath.Join(dirPath, path)
		written, err := s.backend.WriteFile(bytes.NewReader(content), fullPath)
		s.NoError(err)
		s.EqualValues(len(content), written)
		defer s.backend.RemoveFile(fullPath)
	}

	// Test with compression
	reader, err := s.backend.ZipReader(dirPath, true)
	s.NoError(err)
	defer reader.Close()

	// Read and verify zip contents
	zipBytes, err := io.ReadAll(reader)
	s.NoError(err)

	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	s.NoError(err)

	// Verify each file
	foundFiles := make(map[string]bool)
	for _, zf := range zipReader.File {
		s.Contains(files, zf.Name)
		s.Equal(zip.Deflate, zf.Method)
		expectedContent := files[zf.Name]
		delete(files, zf.Name)

		rc, err := zf.Open()
		s.NoError(err)

		content, err := io.ReadAll(rc)
		s.NoError(err)
		rc.Close()

		s.Equal(expectedContent, content)
		foundFiles[zf.Name] = true
	}

	// Verify we found all files
	s.Len(foundFiles, 4)
	s.Empty(files)
}

func (s *FileBackendTestSuite) TestZipReaderErrors() {
	// Test non-existent path
	reader, err := s.backend.ZipReader("path/to/nonexistent.txt", false)
	if s.settings.DriverName == driverLocal {
		// Only local will return the error immediately.
		s.Error(err)
		s.Nil(reader)
	} else {
		s.NoError(err)
		defer reader.Close()
		var content []byte
		content, err = io.ReadAll(reader)
		s.NoError(err)
		s.assertEmptyZip(content)
	}

	// Test empty directory
	emptyDir := "tests/empty_" + randomString()
	err = os.MkdirAll(filepath.Join(s.settings.Directory, emptyDir), 0750)
	s.NoError(err)
	defer os.RemoveAll(filepath.Join(s.settings.Directory, emptyDir))

	reader, err = s.backend.ZipReader(emptyDir, false)
	s.NoError(err)
	defer reader.Close()
	content, err := io.ReadAll(reader)
	s.NoError(err)
	s.assertEmptyZip(content)
}

func (s *FileBackendTestSuite) TestZipReaderErrorsCompressed() {
	// Test non-existent path with compression
	reader, err := s.backend.ZipReader("path/to/nonexistent.txt", true)
	if s.settings.DriverName == driverLocal {
		// Only local will return the error immediately.
		s.Error(err)
		s.Nil(reader)
	} else {
		s.NoError(err)
		defer reader.Close()
		var content []byte
		content, err = io.ReadAll(reader)
		s.NoError(err)
		s.assertEmptyZip(content)
	}

	// Test empty directory with compression
	emptyDir := "tests/empty_" + randomString()
	err = os.MkdirAll(filepath.Join(s.settings.Directory, emptyDir), 0750)
	s.NoError(err)
	defer os.RemoveAll(filepath.Join(s.settings.Directory, emptyDir))

	reader, err = s.backend.ZipReader(emptyDir, true)
	s.NoError(err)
	defer reader.Close()
	content, err := io.ReadAll(reader)
	s.NoError(err)
	s.assertEmptyZip(content)
}

func (s *FileBackendTestSuite) assertEmptyZip(content []byte) {
	s.NotNil(content)

	// Verify it's a valid but empty zip
	zipReader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	s.NoError(err)
	s.Len(zipReader.File, 0)
}
