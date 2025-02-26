// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	s3 "github.com/minio/minio-go/v7"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckMandatoryS3Fields(t *testing.T) {
	cfg := FileBackendSettings{}

	err := cfg.CheckMandatoryS3Fields()
	require.Error(t, err)
	require.Equal(t, err.Error(), "missing s3 bucket settings", "should've failed with missing s3 bucket")

	cfg.AmazonS3Bucket = "test-mm"
	err = cfg.CheckMandatoryS3Fields()
	require.NoError(t, err)

	cfg.AmazonS3Endpoint = ""
	err = cfg.CheckMandatoryS3Fields()
	require.NoError(t, err)

	require.Equal(t, "s3.amazonaws.com", cfg.AmazonS3Endpoint, "should've set the endpoint to the default")
}

func TestMakeBucket(t *testing.T) {
	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	// Generate a random bucket name
	b := make([]byte, 30)
	rand.Read(b)
	bucketName := base64.StdEncoding.EncodeToString(b)
	bucketName = strings.ToLower(bucketName)
	bucketName = strings.Replace(bucketName, "+", "", -1)
	bucketName = strings.Replace(bucketName, "/", "", -1)

	cfg := FileBackendSettings{
		DriverName:                         model.ImageDriverS3,
		AmazonS3AccessKeyId:                model.MinioAccessKey,
		AmazonS3SecretAccessKey:            model.MinioSecretKey,
		AmazonS3Bucket:                     bucketName,
		AmazonS3Endpoint:                   s3Endpoint,
		AmazonS3Region:                     "",
		AmazonS3PathPrefix:                 "",
		AmazonS3SSL:                        false,
		SkipVerify:                         false,
		AmazonS3RequestTimeoutMilliseconds: 5000,
	}

	fileBackend, err := NewS3FileBackend(cfg)
	require.NoError(t, err)

	err = fileBackend.MakeBucket()
	require.NoError(t, err)
}

func TestTimeout(t *testing.T) {
	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	// Generate a random bucket name
	b := make([]byte, 30)
	rand.Read(b)
	bucketName := base64.StdEncoding.EncodeToString(b)
	bucketName = strings.ToLower(bucketName)
	bucketName = strings.Replace(bucketName, "+", "", -1)
	bucketName = strings.Replace(bucketName, "/", "", -1)

	cfg := FileBackendSettings{
		DriverName:                         model.ImageDriverS3,
		AmazonS3AccessKeyId:                model.MinioAccessKey,
		AmazonS3SecretAccessKey:            model.MinioSecretKey,
		AmazonS3Bucket:                     bucketName,
		AmazonS3Endpoint:                   s3Endpoint,
		AmazonS3Region:                     "",
		AmazonS3PathPrefix:                 "",
		AmazonS3SSL:                        false,
		SkipVerify:                         false,
		AmazonS3RequestTimeoutMilliseconds: 0,
	}

	t.Run("MakeBucket", func(t *testing.T) {
		fileBackend, err := NewS3FileBackend(cfg)
		require.NoError(t, err)

		err = fileBackend.MakeBucket()
		require.True(t, errors.Is(err, context.DeadlineExceeded))
	})

	t.Run("WriteFile", func(t *testing.T) {
		cfg.AmazonS3RequestTimeoutMilliseconds = 1000

		fileBackend, err := NewS3FileBackend(cfg)
		require.NoError(t, err)

		err = fileBackend.MakeBucket()
		require.NoError(t, err)

		r, w := io.Pipe()
		go func() {
			defer w.Close()
			for i := 0; i < 10; i++ {
				_, writeErr := w.Write([]byte("data"))
				require.NoError(t, writeErr)
				time.Sleep(time.Millisecond * 200)
			}
		}()

		_, err = fileBackend.WriteFile(r, "tests/"+randomString()+".png")
		require.True(t, errors.Is(err, context.DeadlineExceeded))
	})
}

func TestInsecureMakeBucket(t *testing.T) {
	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	proxySelfSignedHTTPS := newTLSProxyServer(&url.URL{Scheme: "http", Host: s3Endpoint})
	defer proxySelfSignedHTTPS.Close()

	enableInsecure, secure := true, false

	testCases := []struct {
		description     string
		skipVerify      bool
		expectedAllowed bool
	}{
		{"allow self-signed HTTPS when insecure enabled", enableInsecure, true},
		{"reject self-signed HTTPS when secured", secure, false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			// Generate a random bucket name
			b := make([]byte, 30)
			rand.Read(b)
			bucketName := base64.StdEncoding.EncodeToString(b)
			bucketName = strings.ToLower(bucketName)
			bucketName = strings.Replace(bucketName, "+", "", -1)
			bucketName = strings.Replace(bucketName, "/", "", -1)

			cfg := FileBackendSettings{
				DriverName:                         model.ImageDriverS3,
				AmazonS3AccessKeyId:                model.MinioAccessKey,
				AmazonS3SecretAccessKey:            model.MinioSecretKey,
				AmazonS3Bucket:                     bucketName,
				AmazonS3Endpoint:                   proxySelfSignedHTTPS.URL[8:],
				AmazonS3Region:                     "",
				AmazonS3PathPrefix:                 "",
				AmazonS3SSL:                        true,
				SkipVerify:                         testCase.skipVerify,
				AmazonS3RequestTimeoutMilliseconds: 5000,
			}

			fileBackend, err := NewS3FileBackend(cfg)
			require.NoError(t, err)

			err = fileBackend.MakeBucket()
			if testCase.expectedAllowed {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
func newTLSProxyServer(backend *url.URL) *httptest.Server {
	return httptest.NewTLSServer(httputil.NewSingleHostReverseProxy(backend))
}

func TestS3WithCancel(t *testing.T) {
	// Some of these tests use time.Sleep to wait for the timeout to expire.
	// They are run in parallel to reduce wait times.

	t.Run("zero timeout", func(t *testing.T) {
		t.Parallel()
		r, ctx := newMockS3WithCancel(0, nil)

		time.Sleep(10 * time.Millisecond) // give the context time to cancel

		require.False(t, r.CancelTimeout())
		require.Error(t, ctx.Err())
	})

	t.Run("timeout", func(t *testing.T) {
		t.Parallel()
		r, ctx := newMockS3WithCancel(50*time.Millisecond, nil)

		time.Sleep(100 * time.Millisecond) // give the context time to cancel

		require.False(t, r.CancelTimeout())
		require.Error(t, ctx.Err())
	})

	t.Run("timeout cancel", func(t *testing.T) {
		t.Parallel()
		r, ctx := newMockS3WithCancel(50*time.Millisecond, nil)

		time.Sleep(10 * time.Millisecond) // give the context time to cancel

		require.True(t, r.CancelTimeout())
		require.NoError(t, ctx.Err())

		time.Sleep(100 * time.Millisecond) // wait for the original (canceled) timeout to expire

		require.False(t, r.CancelTimeout())
		require.NoError(t, ctx.Err())
		require.NoError(t, r.Close())
	})

	t.Run("timeout closed", func(t *testing.T) {
		t.Parallel()
		r, ctx := newMockS3WithCancel(50*time.Millisecond, nil)

		time.Sleep(10 * time.Millisecond) // give the context time to cancel

		require.True(t, r.CancelTimeout())
		require.NoError(t, ctx.Err())
		require.NoError(t, r.Close())

		time.Sleep(100 * time.Millisecond) // wait for the original (canceled) timeout to expire

		require.False(t, r.CancelTimeout())
		require.Error(t, ctx.Err())
		require.NoError(t, r.Close())
	})

	t.Run("close cancel close", func(t *testing.T) {
		t.Parallel()
		r, ctx := newMockS3WithCancel(50*time.Millisecond, nil)

		time.Sleep(10 * time.Millisecond) // give the context time to cancel

		require.True(t, r.CancelTimeout())
		require.NoError(t, r.Close())
		require.Error(t, ctx.Err())
		require.False(t, r.CancelTimeout())
		require.Error(t, ctx.Err())
		require.NoError(t, r.Close())
	})

	t.Run("close error", func(t *testing.T) {
		t.Parallel()
		r, ctx := newMockS3WithCancel(50*time.Millisecond, errors.New("test error"))

		time.Sleep(10 * time.Millisecond) // give the context time to cancel

		require.NoError(t, ctx.Err())
		require.Error(t, r.Close())
		require.False(t, r.CancelTimeout())
		require.Error(t, ctx.Err())
	})
}

func newMockS3WithCancel(timeout time.Duration, closeErr error) (*fauxCloser, context.Context) {
	ctx, cancel := context.WithCancel(context.Background())
	return &fauxCloser{
		s3WithCancel: &s3WithCancel{
			Object: &s3.Object{},
			timer:  time.AfterFunc(timeout, cancel),
			cancel: cancel,
		},
		closeErr: closeErr,
	}, ctx
}

type fauxCloser struct {
	*s3WithCancel
	closeErr error
}

func (fc fauxCloser) Close() error {
	fc.s3WithCancel.timer.Stop()
	fc.s3WithCancel.cancel()
	return fc.closeErr
}

func TestListDirectory(t *testing.T) {
	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	cfg := FileBackendSettings{
		DriverName:                         driverS3,
		AmazonS3AccessKeyId:                "minioaccesskey",
		AmazonS3SecretAccessKey:            "miniosecretkey",
		AmazonS3Bucket:                     "mattermost-test-1",
		AmazonS3Region:                     "",
		AmazonS3Endpoint:                   s3Endpoint,
		AmazonS3PathPrefix:                 "",
		AmazonS3SSL:                        false,
		AmazonS3SSE:                        false,
		AmazonS3RequestTimeoutMilliseconds: 5000,
	}

	fileBackend, err := NewS3FileBackend(cfg)
	require.NoError(t, err)

	found, err := fileBackend.client.BucketExists(context.Background(), cfg.AmazonS3Bucket)
	require.NoError(t, err)

	if !found {
		err = fileBackend.MakeBucket()
		require.NoError(t, err)
	}

	fileBackend.pathPrefix = "19700101/"
	require.NoError(t, err)
	b := []byte("test")

	path1 := "19700101/" + randomString() + ".txt"
	_, err = fileBackend.WriteFile(bytes.NewReader(b), path1)
	require.NoError(t, err, "Failed to write file1 to S3")

	_, err = fileBackend.ListDirectory("")
	var pErr *fs.PathError
	assert.True(t, errors.As(err, &pErr), "error is not of type fs.PathError")

	err = fileBackend.RemoveFile(path1)
	require.NoError(t, err, "Failed to remove file1 from S3")

	err = fileBackend.RemoveDirectory("19700101")
	require.NoError(t, err)
}
