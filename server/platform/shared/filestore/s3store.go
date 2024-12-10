// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"crypto/tls"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	s3 "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/encrypt"
	"github.com/minio/minio-go/v7/pkg/s3utils"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// S3FileBackend contains all necessary information to communicate with
// an AWS S3 compatible API backend.
type S3FileBackend struct {
	endpoint       string
	accessKey      string
	secretKey      string
	secure         bool
	signV2         bool
	region         string
	bucket         string
	pathPrefix     string
	encrypt        bool
	trace          bool
	client         *s3.Client
	skipVerify     bool
	timeout        time.Duration
	presignExpires time.Duration
	isCloud        bool // field to indicate whether this is running under Mattermost cloud or not.
	uploadPartSize int64
	storageClass   string
}

type S3FileBackendAuthError struct {
	DetailedError string
}

// S3FileBackendNoBucketError is returned when testing a connection and no S3 bucket is found
type S3FileBackendNoBucketError struct{}

const (
	// This is not exported by minio. See: https://github.com/minio/minio-go/issues/1339
	bucketNotFound = "NoSuchBucket"
	invalidBucket  = "InvalidBucketName"
)

var (
	imageExtensions = map[string]bool{".jpg": true, ".jpeg": true, ".gif": true, ".bmp": true, ".png": true, ".tiff": true, "tif": true}
	imageMimeTypes  = map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".png": "image/png", ".tiff": "image/tiff", ".tif": "image/tif"}
)

var (
	// Ensure that the ReaderAt interface is implemented.
	_ io.ReaderAt                  = (*s3WithCancel)(nil)
	_ FileBackendWithLinkGenerator = (*S3FileBackend)(nil)
)

func isFileExtImage(ext string) bool {
	ext = strings.ToLower(ext)
	return imageExtensions[ext]
}

func getImageMimeType(ext string) string {
	ext = strings.ToLower(ext)
	if imageMimeTypes[ext] == "" {
		return "image"
	}
	return imageMimeTypes[ext]
}

func (s *S3FileBackendAuthError) Error() string {
	return s.DetailedError
}

func (s *S3FileBackendNoBucketError) Error() string {
	return "no such bucket"
}

// NewS3FileBackend returns an instance of an S3FileBackend and determine if we are in Mattermost cloud or not.
func NewS3FileBackend(settings FileBackendSettings) (*S3FileBackend, error) {
	return newS3FileBackend(settings, os.Getenv("MM_CLOUD_FILESTORE_BIFROST") != "")
}

// NewS3FileBackendWithoutBifrost returns an instance of an S3FileBackend that will not use bifrost.
func NewS3FileBackendWithoutBifrost(settings FileBackendSettings) (*S3FileBackend, error) {
	return newS3FileBackend(settings, false)
}

func newS3FileBackend(settings FileBackendSettings, isCloud bool) (*S3FileBackend, error) {
	timeout := time.Duration(settings.AmazonS3RequestTimeoutMilliseconds) * time.Millisecond
	backend := &S3FileBackend{
		endpoint:       settings.AmazonS3Endpoint,
		accessKey:      settings.AmazonS3AccessKeyId,
		secretKey:      settings.AmazonS3SecretAccessKey,
		secure:         settings.AmazonS3SSL,
		signV2:         settings.AmazonS3SignV2,
		region:         settings.AmazonS3Region,
		bucket:         settings.AmazonS3Bucket,
		pathPrefix:     settings.AmazonS3PathPrefix,
		encrypt:        settings.AmazonS3SSE,
		trace:          settings.AmazonS3Trace,
		skipVerify:     settings.SkipVerify,
		timeout:        timeout,
		presignExpires: time.Duration(settings.AmazonS3PresignExpiresSeconds) * time.Second,
		uploadPartSize: settings.AmazonS3UploadPartSizeBytes,
		storageClass:   settings.AmazonS3StorageClass,
	}
	cli, err := backend.s3New(isCloud)
	if err != nil {
		return nil, err
	}
	backend.client = cli
	backend.isCloud = isCloud
	return backend, nil
}

type s3Trace struct {
}

func (*s3Trace) Write(in []byte) (int, error) {
	mlog.Debug(string(in))
	return len(in), nil
}

// Similar to s3.New() but allows initialization of signature v2 or signature v4 client.
// If signV2 input is false, function always returns signature v4.
//
// Additionally this function also takes a user defined region, if set
// disables automatic region lookup.
func (b *S3FileBackend) s3New(isCloud bool) (*s3.Client, error) {
	var creds *credentials.Credentials

	if isCloud {
		creds = credentials.New(customProvider{isSignV2: b.signV2})
	} else if b.accessKey == "" && b.secretKey == "" {
		creds = credentials.NewIAM("")
	} else if b.signV2 {
		creds = credentials.NewStatic(b.accessKey, b.secretKey, "", credentials.SignatureV2)
	} else {
		creds = credentials.NewStatic(b.accessKey, b.secretKey, "", credentials.SignatureV4)
	}

	opts := s3.Options{
		Creds:  creds,
		Secure: b.secure,
		Region: b.region,
	}

	tr, err := s3.DefaultTransport(b.secure)
	if err != nil {
		return nil, err
	}
	if b.skipVerify {
		tr.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	opts.Transport = tr

	// If this is a cloud installation, we override the default transport.
	if isCloud {
		scheme := "http"
		if b.secure {
			scheme = "https"
		}
		newTransport := http.DefaultTransport.(*http.Transport).Clone()
		newTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: b.skipVerify}
		opts.Transport = &customTransport{
			host:   b.endpoint,
			scheme: scheme,
			client: http.Client{Transport: newTransport},
		}
	}

	s3Clnt, err := s3.New(b.endpoint, &opts)
	if err != nil {
		return nil, err
	}

	if b.trace {
		s3Clnt.TraceOn(&s3Trace{})
	}

	return s3Clnt, nil
}

func (b *S3FileBackend) DriverName() string {
	return driverS3
}

func (b *S3FileBackend) TestConnection() error {
	exists := true
	var err error
	// If a path prefix is present, we attempt to test the bucket by listing objects under the path
	// and just checking the first response. This is because the BucketExists call is only at a bucket level
	// and sometimes the user might only be allowed access to the specified path prefix.
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	if b.pathPrefix != "" {
		obj := <-b.client.ListObjects(ctx, b.bucket, s3.ListObjectsOptions{Prefix: b.pathPrefix})
		if obj.Err != nil {
			typedErr := s3.ToErrorResponse(obj.Err)
			if typedErr.Code != bucketNotFound && typedErr.Code != invalidBucket {
				return &S3FileBackendAuthError{DetailedError: "unable to list objects in the S3 bucket"}
			}
			exists = false
		}
	} else {
		exists, err = b.client.BucketExists(ctx, b.bucket)
		if err != nil {
			typedErr := s3.ToErrorResponse(err)
			if typedErr.Code != bucketNotFound && typedErr.Code != invalidBucket {
				return &S3FileBackendAuthError{DetailedError: "unable to check if the S3 bucket exists"}
			}
		}
	}

	if !exists {
		return &S3FileBackendNoBucketError{}
	}
	mlog.Debug("Connection to S3 or minio is good. Bucket exists.")
	return nil
}

func (b *S3FileBackend) MakeBucket() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	err := b.client.MakeBucket(ctx, b.bucket, s3.MakeBucketOptions{Region: b.region})
	if err != nil {
		return errors.Wrap(err, "unable to create the s3 bucket")
	}
	return nil
}

// s3WithCancel is a wrapper struct which cancels the context
// when the object is closed.
type s3WithCancel struct {
	*s3.Object
	timer  *time.Timer
	cancel context.CancelFunc
}

func (sc *s3WithCancel) Close() error {
	sc.timer.Stop()
	sc.cancel()
	return sc.Object.Close()
}

// CancelTimeout attempts to cancel the timeout for this reader. It allows calling
// code to ignore the timeout in case of longer running operations. The methods returns
// false if the timeout has already fired.
func (sc *s3WithCancel) CancelTimeout() bool {
	return sc.timer.Stop()
}

// Caller must close the first return value
func (b *S3FileBackend) Reader(path string) (ReadCloseSeeker, error) {
	path, err := b.prefixedPath(path)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to prefix path %s", path)
	}
	ctx, cancel := context.WithCancel(context.Background())
	minioObject, err := b.client.GetObject(ctx, b.bucket, path, s3.GetObjectOptions{})
	if err != nil {
		cancel()
		return nil, errors.Wrapf(err, "unable to open file %s", path)
	}

	sc := &s3WithCancel{
		Object: minioObject,
		timer:  time.AfterFunc(b.timeout, cancel),
		cancel: cancel,
	}

	return sc, nil
}

func (b *S3FileBackend) ReadFile(path string) ([]byte, error) {
	encodedPath, err := b.prefixedPath(path)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to prefix path %s", path)
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	minioObject, err := b.client.GetObject(ctx, b.bucket, encodedPath, s3.GetObjectOptions{})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to open file %s", encodedPath)
	}

	defer minioObject.Close()
	f, err := io.ReadAll(minioObject)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to read file %s", encodedPath)
	}
	return f, nil
}

func (b *S3FileBackend) FileExists(path string) (bool, error) {
	path, err := b.prefixedPath(path)
	if err != nil {
		return false, errors.Wrapf(err, "unable to prefix path %s", path)
	}

	return b._fileExists(path)
}

func (b *S3FileBackend) _fileExists(path string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	_, err := b.client.StatObject(ctx, b.bucket, path, s3.StatObjectOptions{})
	if err == nil {
		return true, nil
	}

	var s3Err s3.ErrorResponse
	if errors.As(err, &s3Err); s3Err.Code == "NoSuchKey" {
		return false, nil
	}

	return false, errors.Wrapf(err, "unable to know if file %s exists", path)
}

func (b *S3FileBackend) FileSize(path string) (int64, error) {
	path, err := b.prefixedPath(path)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to prefix path %s", path)
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	info, err := b.client.StatObject(ctx, b.bucket, path, s3.StatObjectOptions{})
	if err != nil {
		return 0, errors.Wrapf(err, "unable to get file size for %s", path)
	}

	return info.Size, nil
}

func (b *S3FileBackend) FileModTime(path string) (time.Time, error) {
	path, err := b.prefixedPath(path)
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to prefix path %s", path)
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	info, err := b.client.StatObject(ctx, b.bucket, path, s3.StatObjectOptions{})
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to get modification time for file %s", path)
	}

	return info.LastModified, nil
}

func (b *S3FileBackend) CopyFile(oldPath, newPath string) error {
	oldPath, err := b.prefixedPath(oldPath)
	if err != nil {
		return errors.Wrapf(err, "unable to prefix path %s", oldPath)
	}
	newPath = filepath.Join(b.pathPrefix, newPath)
	srcOpts := s3.CopySrcOptions{
		Bucket: b.bucket,
		Object: oldPath,
	}
	if b.encrypt {
		srcOpts.Encryption = encrypt.NewSSE()
	}

	dstOpts := s3.CopyDestOptions{
		Bucket: b.bucket,
		Object: newPath,
	}
	if b.encrypt {
		dstOpts.Encryption = encrypt.NewSSE()
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	if _, err := b.client.CopyObject(ctx, dstOpts, srcOpts); err != nil {
		return errors.Wrapf(err, "unable to copy file from %s to %s", oldPath, newPath)
	}

	return nil
}

// DecodeFilePathIfNeeded is a special method to URL decode all older
// file paths. It is only needed for the migration, and will be removed
// as soon as the migration is complete.
func (b *S3FileBackend) DecodeFilePathIfNeeded(path string) error {
	// Encode and check if file path changes.
	// If there is no change, then there is no need to do anything.
	if path == s3utils.EncodePath(path) {
		return nil
	}

	// Check if encoded path exists.
	exists, err := b.lookupOriginalPath(s3utils.EncodePath(path))
	if err != nil {
		return err
	}

	if !exists {
		return nil
	}

	// If yes, then it needs to be migrated.
	// This is basically a copy of MoveFile without the path encoding.
	// We avoid any further refactoring because this method will be removed anyways.
	oldPath := filepath.Join(b.pathPrefix, s3utils.EncodePath(path))
	newPath := filepath.Join(b.pathPrefix, path)
	srcOpts := s3.CopySrcOptions{
		Bucket: b.bucket,
		Object: oldPath,
	}
	if b.encrypt {
		srcOpts.Encryption = encrypt.NewSSE()
	}

	dstOpts := s3.CopyDestOptions{
		Bucket: b.bucket,
		Object: newPath,
	}
	if b.encrypt {
		dstOpts.Encryption = encrypt.NewSSE()
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	if _, err := b.client.CopyObject(ctx, dstOpts, srcOpts); err != nil {
		return errors.Wrapf(err, "unable to copy the file to %s to the new destination", newPath)
	}

	ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
	defer cancel2()
	if err := b.client.RemoveObject(ctx2, b.bucket, oldPath, s3.RemoveObjectOptions{}); err != nil {
		return errors.Wrapf(err, "unable to remove the file old file %s", oldPath)
	}

	return nil
}

func (b *S3FileBackend) MoveFile(oldPath, newPath string) error {
	oldPath, err := b.prefixedPath(oldPath)
	if err != nil {
		return errors.Wrapf(err, "unable to prefix path %s", oldPath)
	}
	newPath = filepath.Join(b.pathPrefix, newPath)
	srcOpts := s3.CopySrcOptions{
		Bucket: b.bucket,
		Object: oldPath,
	}
	if b.encrypt {
		srcOpts.Encryption = encrypt.NewSSE()
	}

	dstOpts := s3.CopyDestOptions{
		Bucket: b.bucket,
		Object: newPath,
	}
	if b.encrypt {
		dstOpts.Encryption = encrypt.NewSSE()
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	if _, err := b.client.CopyObject(ctx, dstOpts, srcOpts); err != nil {
		return errors.Wrapf(err, "unable to copy the file to %s to the new destination", newPath)
	}

	ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
	defer cancel2()
	if err := b.client.RemoveObject(ctx2, b.bucket, oldPath, s3.RemoveObjectOptions{}); err != nil {
		return errors.Wrapf(err, "unable to remove the file old file %s", oldPath)
	}

	return nil
}

func (b *S3FileBackend) WriteFile(fr io.Reader, path string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	return b.WriteFileContext(ctx, fr, path)
}

func (b *S3FileBackend) WriteFileContext(ctx context.Context, fr io.Reader, path string) (int64, error) {
	var contentType string
	path = filepath.Join(b.pathPrefix, path)
	if ext := filepath.Ext(path); isFileExtImage(ext) {
		contentType = getImageMimeType(ext)
	} else {
		contentType = "binary/octet-stream"
	}

	options := s3PutOptions(b.encrypt, contentType, b.uploadPartSize, b.storageClass)

	objSize := int64(-1)
	if b.isCloud {
		options.DisableContentSha256 = true
	} else {
		// We pass an object size only in situations where bifrost is not
		// used. Bifrost needs to run in HTTPS, which is not yet deployed.
		switch t := fr.(type) {
		case *bytes.Buffer:
			objSize = int64(t.Len())
		case *os.File:
			if s, err2 := t.Stat(); err2 == nil {
				objSize = s.Size()
			}
		}
	}

	info, err := b.client.PutObject(ctx, b.bucket, path, fr, objSize, options)
	if err != nil {
		return info.Size, errors.Wrapf(err, "unable write the data in the file %s", path)
	}

	return info.Size, nil
}

func (b *S3FileBackend) AppendFile(fr io.Reader, path string) (int64, error) {
	fp, err := b.prefixedPath(path)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to prefix path %s", path)
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	if _, err2 := b.client.StatObject(ctx, b.bucket, fp, s3.StatObjectOptions{}); err2 != nil {
		return 0, errors.Wrapf(err2, "unable to find the file %s to append the data", path)
	}

	var contentType string
	if ext := filepath.Ext(fp); isFileExtImage(ext) {
		contentType = getImageMimeType(ext)
	} else {
		contentType = "binary/octet-stream"
	}

	options := s3PutOptions(b.encrypt, contentType, b.uploadPartSize, b.storageClass)
	sse := options.ServerSideEncryption
	partName := fp + ".part"
	ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
	defer cancel2()
	objSize := -1
	if b.isCloud {
		options.DisableContentSha256 = true
	}
	// We pass an object size only in situations where bifrost is not
	// used. Bifrost needs to run in HTTPS, which is not yet deployed.
	if buf, ok := fr.(*bytes.Buffer); ok && !b.isCloud {
		objSize = buf.Len()
	}
	info, err := b.client.PutObject(ctx2, b.bucket, partName, fr, int64(objSize), options)
	if err != nil {
		return 0, errors.Wrapf(err, "unable append the data in the file %s", path)
	}
	defer func() {
		ctx4, cancel4 := context.WithTimeout(context.Background(), b.timeout)
		defer cancel4()
		b.client.RemoveObject(ctx4, b.bucket, partName, s3.RemoveObjectOptions{})
	}()

	src1Opts := s3.CopySrcOptions{
		Bucket: b.bucket,
		Object: fp,
	}
	src2Opts := s3.CopySrcOptions{
		Bucket: b.bucket,
		Object: partName,
	}
	dstOpts := s3.CopyDestOptions{
		Bucket:     b.bucket,
		Object:     fp,
		Encryption: sse,
	}
	ctx3, cancel3 := context.WithTimeout(context.Background(), b.timeout)
	defer cancel3()
	_, err = b.client.ComposeObject(ctx3, dstOpts, src1Opts, src2Opts)
	if err != nil {
		return 0, errors.Wrapf(err, "unable append the data in the file %s", path)
	}
	return info.Size, nil
}

func (b *S3FileBackend) RemoveFile(path string) error {
	path, err := b.prefixedPath(path)
	if err != nil {
		return errors.Wrapf(err, "unable to prefix path %s", path)
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	if err := b.client.RemoveObject(ctx, b.bucket, path, s3.RemoveObjectOptions{}); err != nil {
		return errors.Wrapf(err, "unable to remove the file %s", path)
	}

	return nil
}

func getPathsFromObjectInfos(in <-chan s3.ObjectInfo) <-chan s3.ObjectInfo {
	out := make(chan s3.ObjectInfo, 1)

	go func() {
		defer close(out)

		for {
			info, done := <-in

			if !done {
				break
			}

			out <- info
		}
	}()

	return out
}

func (b *S3FileBackend) listDirectory(path string, recursion bool) ([]string, error) {
	path, err := b.prefixedPath(path)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to prefix path %s", path)
	}
	if !strings.HasSuffix(path, "/") && path != "" {
		// s3Clnt returns only the path itself when "/" is not present
		// appending "/" to make it consistent across all filestores
		path = path + "/"
	}

	opts := s3.ListObjectsOptions{
		Prefix:    path,
		Recursive: recursion,
	}
	var paths []string
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	var count int
	for object := range b.client.ListObjects(ctx, b.bucket, opts) {
		if object.Err != nil {
			return nil, errors.Wrapf(object.Err, "unable to list the directory %s", path)
		}
		// We strip the path prefix that gets applied,
		// so that it remains transparent to the application.
		object.Key = strings.TrimPrefix(object.Key, b.pathPrefix)
		trimmed := strings.Trim(object.Key, "/")
		if trimmed != "" {
			paths = append(paths, trimmed)
		}
		count++
	}
	// Check if only one item was returned and it matches the path prefix
	if count == 1 && len(paths) > 0 && strings.TrimRight(path, "/") == paths[0] {
		// Return a fs.PathError to maintain consistency
		return nil, &fs.PathError{Op: "readdir", Path: path, Err: fs.ErrNotExist}
	}

	return paths, nil
}

func (b *S3FileBackend) ListDirectory(path string) ([]string, error) {
	return b.listDirectory(path, false)
}

func (b *S3FileBackend) ListDirectoryRecursively(path string) ([]string, error) {
	return b.listDirectory(path, true)
}

func (b *S3FileBackend) RemoveDirectory(path string) error {
	path, err := b.prefixedPath(path)
	if err != nil {
		return errors.Wrapf(err, "unable to prefix path %s", path)
	}
	opts := s3.ListObjectsOptions{
		Prefix:    path,
		Recursive: true,
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	list := b.client.ListObjects(ctx, b.bucket, opts)

	ctx2, cancel2 := context.WithTimeout(context.Background(), b.timeout)
	defer cancel2()
	objectsCh := b.client.RemoveObjects(ctx2, b.bucket, getPathsFromObjectInfos(list), s3.RemoveObjectsOptions{})
	for err := range objectsCh {
		if err.Err != nil {
			return errors.Wrapf(err.Err, "unable to remove the directory %s", path)
		}
	}

	return nil
}

func (b *S3FileBackend) GeneratePublicLink(path string) (string, time.Duration, error) {
	path, err := b.prefixedPath(path)
	if err != nil {
		return "", 0, errors.Wrapf(err, "unable to prefix path %s", path)
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	reqParams := make(url.Values)
	reqParams.Set("response-content-disposition", "attachment")

	req, err := b.client.PresignedGetObject(ctx, b.bucket, path, b.presignExpires, reqParams)
	if err != nil {
		return "", 0, errors.Wrapf(err, "unable to generate public link for %s", path)
	}

	return req.String(), b.presignExpires, nil
}

func (b *S3FileBackend) lookupOriginalPath(s string) (bool, error) {
	exists, err := b._fileExists(filepath.Join(b.pathPrefix, s))
	if err != nil {
		var s3Err s3.ErrorResponse
		// Sometimes S3 will not allow to access other paths.
		// In that case, we consider them as not exists.
		if errors.As(err, &s3Err); s3Err.Code == "AccessDenied" {
			return false, nil
		}
		return false, errors.Wrapf(err, "unable to check for file path %s", s)
	}
	return exists, nil
}

func (b *S3FileBackend) prefixedPath(s string) (string, error) {
	if b.isCloud {
		// We do a lookup of the original path for compatibility purposes.
		exists, err := b.lookupOriginalPath(s)
		if err != nil {
			return "", err
		}

		// If it exists, then we don't want to encode it
		// because it's an old path.
		if !exists {
			// If the request is routed via bifrost, then we need to encode the path
			// to avoid signature validation errors.
			// This happens because in bifrost, we are signing the URL outside the SDK
			// and therefore the signature sent from the bifrost client
			// will contain the encoded path, whereas the original path is sent
			// un-encoded.
			// More info at: https://github.com/aws/aws-sdk-go/blob/a57c4d92784a43b716645a57b6fa5fb94fb6e419/aws/signer/v4/v4.go#L8
			s = s3utils.EncodePath(s)
		}
	}
	return filepath.Join(b.pathPrefix, s), nil
}

func s3PutOptions(encrypted bool, contentType string, uploadPartSize int64, storageClass string) s3.PutObjectOptions {
	options := s3.PutObjectOptions{}
	if encrypted {
		options.ServerSideEncryption = encrypt.NewSSE()
	}
	options.ContentType = contentType
	options.PartSize = uint64(uploadPartSize)
	options.StorageClass = storageClass

	return options
}
