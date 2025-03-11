// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"context" 
	"fmt"
	"io"
	"net/url"
	"strconv"
	"path/filepath"
	"strings"
	"time"

	"github.com/Azure/azure-storage-blob-go/azblob"
	"github.com/pkg/errors"
)

type AzureFileBackend struct {
	containerURL   azblob.ContainerURL
	container      string
	pathPrefix     string
	timeout        time.Duration
	presignExpires time.Duration
	storageAccount string
	accessKey      string
}

func (b *AzureFileBackend) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.containerURL.GetProperties(ctx, azblob.LeaseAccessConditions{})
	if err != nil {
		return errors.Wrap(err, "unable to connect to Azure blob storage")
	}

	return nil
}

func (b *AzureFileBackend) Reader(path string) (ReadCloseSeeker, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobURL := b.containerURL.NewBlockBlobURL(path)
	download, err := blobURL.Download(ctx, 0, azblob.CountToEnd, azblob.BlobAccessConditions{}, false, azblob.ClientProvidedKeyOptions{})
	if err != nil {
		return nil, errors.Wrapf(err, "unable to read file %s", path)
	}

	// Wrap the body in a seekable reader
	body := download.Body(azblob.RetryReaderOptions{})
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read response body")
	}
	body.Close()
	
	return &seekableReader{
		reader: bytes.NewReader(data),
		data:   data,
	}, nil
}

func (b *AzureFileBackend) ReadFile(path string) ([]byte, error) {
	reader, err := b.Reader(path)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	return io.ReadAll(reader)
}

func (b *AzureFileBackend) FileExists(path string) (bool, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobURL := b.containerURL.NewBlockBlobURL(path)
	_, err := blobURL.GetProperties(ctx, azblob.BlobAccessConditions{}, azblob.ClientProvidedKeyOptions{})
	if err != nil {
		if serr, ok := err.(azblob.StorageError); ok {
			if serr.ServiceCode() == azblob.ServiceCodeBlobNotFound {
				return false, nil
			}
		}
		return false, errors.Wrapf(err, "unable to check if file %s exists", path)
	}

	return true, nil
}

func (b *AzureFileBackend) FileSize(path string) (int64, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobURL := b.containerURL.NewBlockBlobURL(path)
	props, err := blobURL.GetProperties(ctx, azblob.BlobAccessConditions{}, azblob.ClientProvidedKeyOptions{})
	if err != nil {
		return 0, errors.Wrapf(err, "unable to get file size for %s", path)
	}

	return props.ContentLength(), nil
}

func (b *AzureFileBackend) FileModTime(path string) (time.Time, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobURL := b.containerURL.NewBlockBlobURL(path)
	props, err := blobURL.GetProperties(ctx, azblob.BlobAccessConditions{}, azblob.ClientProvidedKeyOptions{})
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to get modification time for file %s", path)
	}

	return props.LastModified(), nil
}

func (b *AzureFileBackend) CopyFile(oldPath, newPath string) error {
	oldPath = filepath.Join(b.pathPrefix, oldPath)
	newPath = filepath.Join(b.pathPrefix, newPath)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	source := b.containerURL.NewBlockBlobURL(oldPath)
	destination := b.containerURL.NewBlockBlobURL(newPath)

	_, err := destination.StartCopyFromURL(ctx, source.URL(), nil, azblob.ModifiedAccessConditions{}, azblob.BlobAccessConditions{}, azblob.DefaultAccessTier, nil)
	if err != nil {
		return errors.Wrapf(err, "unable to copy file from %s to %s", oldPath, newPath)
	}

	return nil
}

func (b *AzureFileBackend) MoveFile(oldPath, newPath string) error {
	err := b.CopyFile(oldPath, newPath)
	if err != nil {
		return err
	}

	return b.RemoveFile(oldPath)
}

func (b *AzureFileBackend) WriteFile(fr io.Reader, path string) (int64, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobURL := b.containerURL.NewBlockBlobURL(path)
	uploadOptions := azblob.UploadStreamToBlockBlobOptions{
		BufferSize: 3 * 1024 * 1024,
		MaxBuffers: 2,
	}

	data, err := io.ReadAll(fr)
	if err != nil {
		return 0, errors.Wrap(err, "failed to read input")
	}

	_, err = azblob.UploadStreamToBlockBlob(ctx, bytes.NewReader(data), blobURL, uploadOptions)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to write file %s", path)
	}

	return int64(len(data)), nil
}

func (b *AzureFileBackend) AppendFile(fr io.Reader, path string) (int64, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	// Convert io.Reader to io.ReadSeeker
	data, err := io.ReadAll(fr)
	if err != nil {
		return 0, errors.Wrap(err, "failed to read input")
	}
	readSeeker := bytes.NewReader(data)

	blobURL := b.containerURL.NewAppendBlobURL(path)
	response, err := blobURL.AppendBlock(ctx, readSeeker, azblob.AppendBlobAccessConditions{}, nil, azblob.ClientProvidedKeyOptions{})
	if err != nil {
		return 0, errors.Wrapf(err, "unable to append to file %s", path)
	}

	offset, err := strconv.ParseInt(response.BlobAppendOffset(), 10, 64)
	if err != nil {
		return 0, errors.Wrap(err, "failed to parse blob append offset")
	}
	return offset, nil
}

func (b *AzureFileBackend) RemoveFile(path string) error {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobURL := b.containerURL.NewBlockBlobURL(path)
	_, err := blobURL.Delete(ctx, azblob.DeleteSnapshotsOptionNone, azblob.BlobAccessConditions{})
	if err != nil {
		return errors.Wrapf(err, "unable to remove file %s", path)
	}

	return nil
}

func (b *AzureFileBackend) ListDirectory(path string) ([]string, error) {
	path = filepath.Join(b.pathPrefix, path)
	if !strings.HasSuffix(path, "/") && path != "" {
		path = path + "/"
	}

	var files []string
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	for marker := (azblob.Marker{}); marker.NotDone(); {
		listBlob, err := b.containerURL.ListBlobsHierarchySegment(ctx, marker, "/", azblob.ListBlobsSegmentOptions{Prefix: path})
		if err != nil {
			return nil, errors.Wrapf(err, "unable to list directory %s", path)
		}

		marker = listBlob.NextMarker

		// Add files
		for _, blob := range listBlob.Segment.BlobItems {
			name := strings.TrimPrefix(blob.Name, b.pathPrefix)
			files = append(files, name)
		}

		// Add directories
		for _, prefix := range listBlob.Segment.BlobPrefixes {
			name := strings.TrimPrefix(prefix.Name, b.pathPrefix)
			name = strings.TrimSuffix(name, "/")
			files = append(files, name)
		}
	}

	return files, nil
}

func (b *AzureFileBackend) ListDirectoryRecursively(path string) ([]string, error) {
	path = filepath.Join(b.pathPrefix, path)
	if !strings.HasSuffix(path, "/") && path != "" {
		path = path + "/"
	}

	var files []string
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	for marker := (azblob.Marker{}); marker.NotDone(); {
		listBlob, err := b.containerURL.ListBlobsFlatSegment(ctx, marker, azblob.ListBlobsSegmentOptions{Prefix: path})
		if err != nil {
			return nil, errors.Wrapf(err, "unable to list directory %s recursively", path)
		}

		marker = listBlob.NextMarker

		for _, blob := range listBlob.Segment.BlobItems {
			files = append(files, strings.TrimPrefix(blob.Name, b.pathPrefix))
		}
	}

	return files, nil
}

func (b *AzureFileBackend) RemoveDirectory(path string) error {
	files, err := b.ListDirectoryRecursively(path)
	if err != nil {
		return err
	}

	for _, file := range files {
		if err := b.RemoveFile(file); err != nil {
			return err
		}
	}

	return nil
}

func (b *AzureFileBackend) GeneratePublicLink(path string) (string, time.Duration, error) {
	path = filepath.Join(b.pathPrefix, path)
	blobURL := b.containerURL.NewBlockBlobURL(path)

	// Create SAS query parameters with the specified permissions and expiry
	credential, err := azblob.NewSharedKeyCredential(b.storageAccount, b.accessKey)
	if err != nil {
		return "", 0, errors.Wrap(err, "failed to create shared key credential")
	}
	sasQueryParams, err := azblob.BlobSASSignatureValues{
		Protocol:      azblob.SASProtocolHTTPS,
		ExpiryTime:    time.Now().Add(b.presignExpires),
		ContainerName: b.container,
		BlobName:      path,
		Permissions:   azblob.BlobSASPermissions{Read: true}.String(),
	}.NewSASQueryParameters(credential)

	if err != nil {
		return "", 0, errors.Wrapf(err, "unable to generate public link for %s", path)
	}

	url := blobURL.URL()
	sasURL := fmt.Sprintf("%s?%s", (&url).String(), sasQueryParams.Encode())
	return sasURL, b.presignExpires, nil
}

func (b *AzureFileBackend) DriverName() string {
	return "azure"
}

// ZipReader will create a zip of path. If path is a single file, it will zip the single file.
// If deflate is true, the contents will be compressed. It will stream the zip to io.ReadCloser.
func (b *AzureFileBackend) ZipReader(path string, deflate bool) (io.ReadCloser, error) {
	deflateMethod := zip.Store
	if deflate {
		deflateMethod = zip.Deflate
	}

	path = filepath.Join(b.pathPrefix, path)
	
	pr, pw := io.Pipe()

	go func() {
		defer pw.Close()

		zipWriter := zip.NewWriter(pw)
		defer zipWriter.Close()

		ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
		defer cancel()

		// Try to check if this is a single file
		blobURL := b.containerURL.NewBlockBlobURL(path)
		props, err := blobURL.GetProperties(ctx, azblob.BlobAccessConditions{}, azblob.ClientProvidedKeyOptions{})
		
		if err == nil {
			// Found a file, add it directly 
			stripPath := filepath.Dir(path)
			if stripPath != "" {
				stripPath += "/"
			}

			// Create zip header for the file
			header := &zip.FileHeader{
				Name:     filepath.Base(path),
				Method:   deflateMethod,
				Modified: props.LastModified(),
			}
			header.SetMode(0644) // rw-r--r-- permissions

			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				pw.CloseWithError(errors.Wrapf(err, "unable to create zip entry for %s", path))
				return
			}

			data, err := b.ReadFile(strings.TrimPrefix(path, b.pathPrefix))
			if err != nil {
				pw.CloseWithError(errors.Wrapf(err, "unable to read file %s", path))
				return
			}

			_, err = writer.Write(data)
			if err != nil {
				pw.CloseWithError(errors.Wrapf(err, "unable to write data for %s", path))
				return
			}
			return
		}

		// Assume it's a directory, add a trailing slash
		if !strings.HasSuffix(path, "/") {
			path = path + "/"
		}

		// List all files in the directory and add them to the zip
		files, err := b.ListDirectoryRecursively(strings.TrimPrefix(path, b.pathPrefix))
		if err != nil {
			pw.CloseWithError(errors.Wrapf(err, "unable to list directory %s", path))
			return
		}

		for _, filePath := range files {
			fullPath := filepath.Join(b.pathPrefix, filePath)

			// Skip the directory itself
			if fullPath == path || fullPath+"/" == path {
				continue
			}

			// Create a relative path for the zip entry
			relPath := strings.TrimPrefix(fullPath, path)

			// Add the file to the zip
			header := &zip.FileHeader{
				Name:     relPath,
				Method:   deflateMethod,
			}
			header.SetMode(0644) // rw-r--r-- permissions

			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				pw.CloseWithError(errors.Wrapf(err, "unable to create zip entry for %s", fullPath))
				return
			}

			data, err := b.ReadFile(filePath)
			if err != nil {
				pw.CloseWithError(errors.Wrapf(err, "unable to read file %s", fullPath))
				return
			}

			_, err = writer.Write(data)
			if err != nil {
				pw.CloseWithError(errors.Wrapf(err, "unable to write data for %s", fullPath))
				return
			}
		}
	}()

	return pr, nil
}

// seekableReader implements ReadCloseSeeker interface
type seekableReader struct {
	reader *bytes.Reader
	data   []byte
}

func (s *seekableReader) Read(p []byte) (n int, err error) {
	return s.reader.Read(p)
}

func (s *seekableReader) Seek(offset int64, whence int) (int64, error) {
	return s.reader.Seek(offset, whence)
}

func (s *seekableReader) Close() error {
	return nil
}

func NewAzureFileBackend(settings FileBackendSettings) (*AzureFileBackend, error) {
	credential, err := azblob.NewSharedKeyCredential(settings.AzureAccessKey, settings.AzureAccessSecret)
	if err != nil {
		return nil, err
	}

	pipeline := azblob.NewPipeline(credential, azblob.PipelineOptions{})
	URL, err := url.Parse(fmt.Sprintf("https://%s.blob.core.windows.net/%s", settings.AzureStorageAccount, settings.AzureContainer))
	if err != nil {
		return nil, err
	}

	containerURL := azblob.NewContainerURL(*URL, pipeline)

	backend := &AzureFileBackend{
		containerURL:   containerURL,
		container:      settings.AzureContainer,
		pathPrefix:     settings.AzurePathPrefix,
		timeout:        time.Duration(settings.AzureRequestTimeoutMilliseconds) * time.Millisecond,
		presignExpires: time.Duration(settings.AzurePresignExpiresSeconds) * time.Second,
		storageAccount: settings.AzureStorageAccount,
		accessKey:      settings.AzureAccessKey,
	}

	return backend, nil
}
