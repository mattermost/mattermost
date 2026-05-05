// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	pkgerr "github.com/pkg/errors"
)

type AzureFileBackend struct {
	client     *azblob.Client
	container  string
	pathPrefix string
	timeout    time.Duration
}

func NewAzureFileBackend(settings FileBackendSettings) (*AzureFileBackend, error) {
	if settings.AzureStorageAccount == "" {
		return nil, errors.New("missing azure storage account setting")
	}
	if settings.AzureContainer == "" {
		return nil, errors.New("missing azure container setting")
	}
	if settings.AzureAccessKey == "" {
		return nil, errors.New("missing azure access key setting")
	}

	credential, err := azblob.NewSharedKeyCredential(settings.AzureStorageAccount, settings.AzureAccessKey)
	if err != nil {
		return nil, pkgerr.Wrap(err, "failed to create shared key credential")
	}

	scheme := "https"
	if !settings.AzureSSL {
		scheme = "http"
	}

	endpoint := settings.AzureEndpoint
	var serviceURL string
	if endpoint == "" {
		serviceURL = fmt.Sprintf("%s://%s.blob.core.windows.net/", scheme, settings.AzureStorageAccount)
	} else {
		// For path-style endpoints (e.g. Azurite at host:port/account), append the account.
		// For virtual-host endpoints already including the account, the caller can configure
		// the bare host and account separately.
		serviceURL = fmt.Sprintf("%s://%s/%s/", scheme, strings.Trim(endpoint, "/"), settings.AzureStorageAccount)
	}

	client, err := azblob.NewClientWithSharedKeyCredential(serviceURL, credential, nil)
	if err != nil {
		return nil, pkgerr.Wrap(err, "failed to create azure blob client")
	}

	timeout := time.Duration(settings.AzureRequestTimeoutMilliseconds) * time.Millisecond
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	return &AzureFileBackend{
		client:     client,
		container:  settings.AzureContainer,
		pathPrefix: settings.AzurePathPrefix,
		timeout:    timeout,
	}, nil
}

func (b *AzureFileBackend) DriverName() string {
	return driverAzure
}

func (b *AzureFileBackend) prefix(p string) string {
	if b.pathPrefix == "" {
		return p
	}
	return path.Join(b.pathPrefix, p)
}

func (b *AzureFileBackend) blobClient(p string) *blob.Client {
	return b.client.ServiceClient().NewContainerClient(b.container).NewBlobClient(b.prefix(p))
}

func (b *AzureFileBackend) blockBlobClient(p string) *blockblob.Client {
	return b.client.ServiceClient().NewContainerClient(b.container).NewBlockBlobClient(b.prefix(p))
}

func (b *AzureFileBackend) containerClient() *container.Client {
	return b.client.ServiceClient().NewContainerClient(b.container)
}

func (b *AzureFileBackend) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.containerClient().GetProperties(ctx, nil)
	if err == nil {
		return nil
	}
	if bloberror.HasCode(err, bloberror.ContainerNotFound) {
		// Auto-create the container, matching the S3 backend's auto-create-bucket behavior.
		_, createErr := b.containerClient().Create(ctx, nil)
		if createErr != nil {
			return pkgerr.Wrap(createErr, "unable to create azure container")
		}
		return nil
	}
	return pkgerr.Wrap(err, "unable to connect to azure blob storage")
}

func (b *AzureFileBackend) Reader(p string) (ReadCloseSeeker, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	resp, err := b.blobClient(p).DownloadStream(ctx, nil)
	if err != nil {
		return nil, pkgerr.Wrapf(err, "unable to read file %s", p)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, pkgerr.Wrap(err, "failed to read response body")
	}

	return &seekableReadCloser{Reader: bytes.NewReader(data)}, nil
}

func (b *AzureFileBackend) ReadFile(p string) ([]byte, error) {
	r, err := b.Reader(p)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	return io.ReadAll(r)
}

func (b *AzureFileBackend) FileExists(p string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.blobClient(p).GetProperties(ctx, nil)
	if err != nil {
		if bloberror.HasCode(err, bloberror.BlobNotFound) {
			return false, nil
		}
		return false, pkgerr.Wrapf(err, "unable to check existence of %s", p)
	}
	return true, nil
}

func (b *AzureFileBackend) FileSize(p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	props, err := b.blobClient(p).GetProperties(ctx, nil)
	if err != nil {
		return 0, pkgerr.Wrapf(err, "unable to get size of %s", p)
	}
	if props.ContentLength == nil {
		return 0, nil
	}
	return *props.ContentLength, nil
}

func (b *AzureFileBackend) FileModTime(p string) (time.Time, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	props, err := b.blobClient(p).GetProperties(ctx, nil)
	if err != nil {
		return time.Time{}, pkgerr.Wrapf(err, "unable to get modification time of %s", p)
	}
	if props.LastModified == nil {
		return time.Time{}, nil
	}
	return *props.LastModified, nil
}

func (b *AzureFileBackend) CopyFile(oldPath, newPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	src := b.blobClient(oldPath).URL()
	_, err := b.blockBlobClient(newPath).StartCopyFromURL(ctx, src, nil)
	if err != nil {
		return pkgerr.Wrapf(err, "unable to copy %s to %s", oldPath, newPath)
	}
	return nil
}

func (b *AzureFileBackend) MoveFile(oldPath, newPath string) error {
	if err := b.CopyFile(oldPath, newPath); err != nil {
		return err
	}
	return b.RemoveFile(oldPath)
}

func (b *AzureFileBackend) WriteFile(fr io.Reader, p string) (int64, error) {
	return b.WriteFileContext(context.Background(), fr, p)
}

func (b *AzureFileBackend) WriteFileContext(ctx context.Context, fr io.Reader, p string) (int64, error) {
	// Azure SDK uploads buffer the body internally for retries; an UploadStream avoids
	// holding the whole file in memory.
	ctx, cancel := context.WithTimeout(ctx, b.timeout)
	defer cancel()

	cnt := &countingReader{r: fr}
	_, err := b.blockBlobClient(p).UploadStream(ctx, cnt, nil)
	if err != nil {
		return 0, pkgerr.Wrapf(err, "unable to write %s", p)
	}
	return cnt.n, nil
}

// AppendFile appends data to a block blob using StageBlock + CommitBlockList. Each
// AppendFile call stages a single new block with a freshly generated random ID and
// commits the existing block list plus the new ID. This avoids the O(n^2)
// download-concatenate-reupload pattern: the new bytes go up exactly once.
//
// Notes:
//   - Block IDs are random base64 strings of equal length, as required by the Azure
//     block-blob protocol.
//   - This implementation reads the new chunk fully into memory because the SDK's
//     StageBlock requires a ReadSeekCloser. Callers (the upload session machinery)
//     already chunk uploads, so this is bounded.
func (b *AzureFileBackend) AppendFile(fr io.Reader, p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	data, err := io.ReadAll(fr)
	if err != nil {
		return 0, pkgerr.Wrap(err, "failed to read input")
	}
	if len(data) == 0 {
		// Match the S3 AppendFile contract: returning the existing size is fine here.
		size, _ := b.FileSize(p)
		return size, nil
	}

	bb := b.blockBlobClient(p)

	var existingIDs []string
	var existingSize int64
	listResp, err := bb.GetBlockList(ctx, blockblob.BlockListTypeCommitted, nil)
	if err != nil && !bloberror.HasCode(err, bloberror.BlobNotFound) {
		return 0, pkgerr.Wrapf(err, "unable to list existing blocks for %s", p)
	}
	if err == nil && listResp.BlockList.CommittedBlocks != nil {
		for _, blk := range listResp.BlockList.CommittedBlocks {
			if blk.Name != nil {
				existingIDs = append(existingIDs, *blk.Name)
			}
			if blk.Size != nil {
				existingSize += *blk.Size
			}
		}
	}

	newID, err := newBlockID()
	if err != nil {
		return 0, pkgerr.Wrap(err, "failed to generate block id")
	}

	_, err = bb.StageBlock(ctx, newID, &readSeekNopCloser{Reader: bytes.NewReader(data)}, nil)
	if err != nil {
		return 0, pkgerr.Wrapf(err, "unable to stage block for %s", p)
	}

	allIDs := append(existingIDs, newID)
	_, err = bb.CommitBlockList(ctx, allIDs, nil)
	if err != nil {
		return 0, pkgerr.Wrapf(err, "unable to commit block list for %s", p)
	}

	return existingSize, nil
}

func (b *AzureFileBackend) RemoveFile(p string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.blobClient(p).Delete(ctx, nil)
	if err != nil && !bloberror.HasCode(err, bloberror.BlobNotFound) {
		return pkgerr.Wrapf(err, "unable to remove file %s", p)
	}
	return nil
}

func (b *AzureFileBackend) ListDirectory(p string) ([]string, error) {
	prefix := b.prefix(p)
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	pager := b.containerClient().NewListBlobsHierarchyPager("/", &container.ListBlobsHierarchyOptions{
		Prefix: to.Ptr(prefix),
	})

	var entries []string
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, pkgerr.Wrapf(err, "unable to list directory %s", p)
		}
		for _, blob := range page.Segment.BlobItems {
			if blob.Name == nil {
				continue
			}
			name := strings.TrimPrefix(*blob.Name, b.pathPrefix)
			name = strings.TrimPrefix(name, "/")
			entries = append(entries, name)
		}
		for _, prefixItem := range page.Segment.BlobPrefixes {
			if prefixItem.Name == nil {
				continue
			}
			name := strings.TrimPrefix(*prefixItem.Name, b.pathPrefix)
			name = strings.TrimPrefix(name, "/")
			name = strings.TrimSuffix(name, "/")
			entries = append(entries, name)
		}
	}
	return entries, nil
}

func (b *AzureFileBackend) ListDirectoryRecursively(p string) ([]string, error) {
	prefix := b.prefix(p)
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	pager := b.containerClient().NewListBlobsFlatPager(&container.ListBlobsFlatOptions{
		Prefix: to.Ptr(prefix),
	})

	var entries []string
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, pkgerr.Wrapf(err, "unable to list directory %s recursively", p)
		}
		for _, blob := range page.Segment.BlobItems {
			if blob.Name == nil {
				continue
			}
			name := strings.TrimPrefix(*blob.Name, b.pathPrefix)
			name = strings.TrimPrefix(name, "/")
			entries = append(entries, name)
		}
	}
	return entries, nil
}

func (b *AzureFileBackend) RemoveDirectory(p string) error {
	files, err := b.ListDirectoryRecursively(p)
	if err != nil {
		return err
	}
	for _, f := range files {
		if err := b.RemoveFile(f); err != nil {
			return err
		}
	}
	return nil
}

func (b *AzureFileBackend) ZipReader(p string, deflate bool) (io.ReadCloser, error) {
	method := zip.Store
	if deflate {
		method = zip.Deflate
	}

	pr, pw := io.Pipe()

	go func() {
		defer pw.Close()
		zw := zip.NewWriter(pw)
		defer zw.Close()

		// First check whether p points at a single file.
		exists, err := b.FileExists(p)
		if err != nil {
			pw.CloseWithError(err)
			return
		}

		if exists {
			data, err := b.ReadFile(p)
			if err != nil {
				pw.CloseWithError(err)
				return
			}
			h := &zip.FileHeader{Name: path.Base(p), Method: method}
			h.SetMode(0644)
			w, err := zw.CreateHeader(h)
			if err != nil {
				pw.CloseWithError(err)
				return
			}
			if _, err := w.Write(data); err != nil {
				pw.CloseWithError(err)
				return
			}
			return
		}

		files, err := b.ListDirectoryRecursively(p)
		if err != nil {
			pw.CloseWithError(err)
			return
		}
		for _, f := range files {
			data, err := b.ReadFile(f)
			if err != nil {
				pw.CloseWithError(err)
				return
			}
			rel := strings.TrimPrefix(f, strings.TrimSuffix(p, "/")+"/")
			h := &zip.FileHeader{Name: rel, Method: method}
			h.SetMode(0644)
			w, err := zw.CreateHeader(h)
			if err != nil {
				pw.CloseWithError(err)
				return
			}
			if _, err := w.Write(data); err != nil {
				pw.CloseWithError(err)
				return
			}
		}
	}()

	return pr, nil
}

// seekableReadCloser wraps a bytes.Reader to satisfy ReadCloseSeeker.
type seekableReadCloser struct {
	*bytes.Reader
}

func (s *seekableReadCloser) Close() error { return nil }

// readSeekNopCloser wraps a Reader+Seeker into a ReadSeekCloser without closing.
type readSeekNopCloser struct {
	io.Reader
}

func (r *readSeekNopCloser) Seek(offset int64, whence int) (int64, error) {
	return r.Reader.(io.Seeker).Seek(offset, whence)
}

func (r *readSeekNopCloser) Close() error { return nil }

// countingReader counts bytes flowing through an io.Reader.
type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

// newBlockID generates a 16-byte random block ID, base64-encoded. All committed
// blocks must share the same decoded length, so callers should always use this.
func newBlockID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b[:]), nil
}
