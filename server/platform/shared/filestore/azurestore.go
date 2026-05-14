// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/google/uuid"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	pkgerr "github.com/pkg/errors"
)

// azureBlockSize is the chunk size used when staging block blob uploads.
// Matches the Azure SDK's default block size for UploadStream and keeps each
// StageBlock call well under the per-block REST limit (4000 MiB).
const azureBlockSize = 4 * 1024 * 1024

// AzureFileBackend stores files in Azure Blob Storage. Connections are
// authenticated with a shared key today; Microsoft Entra ID is a follow-up.
type AzureFileBackend struct {
	client     *azblob.Client
	container  string
	pathPrefix string
	timeout    time.Duration
}

func NewAzureFileBackend(settings FileBackendSettings) (*AzureFileBackend, error) {
	if err := settings.CheckMandatoryAzureFields(); err != nil {
		return nil, err
	}

	credential, err := azblob.NewSharedKeyCredential(settings.AzureStorageAccount, settings.AzureAccessKey)
	if err != nil {
		return nil, pkgerr.Wrap(err, "failed to create azure shared key credential")
	}

	scheme := "https"
	if !settings.AzureSSL {
		scheme = "http"
	}

	var serviceURL string
	if settings.AzureEndpoint == "" {
		// vhost-style production endpoint (Azure commercial cloud).
		serviceURL = fmt.Sprintf("%s://%s.blob.core.windows.net/", scheme, settings.AzureStorageAccount)
	} else {
		// Path-style endpoint where the account is part of the URL path
		// rather than the hostname. This covers Azurite and custom hosts
		// (reverse proxies, gateways) that expose Azure Blob Storage
		// without per-account DNS. Sovereign clouds (Azure Government,
		// Azure China) use vhost-style URLs and are not supported via
		// this setting; they require their own endpoint plumbing.
		serviceURL = fmt.Sprintf("%s://%s/%s/", scheme, strings.Trim(settings.AzureEndpoint, "/"), settings.AzureStorageAccount)
	}

	var clientOptions *azblob.ClientOptions
	if settings.SkipVerify {
		// Mirror the S3 backend: when the admin opts into skipping TLS
		// verification, plumb a custom transport into the SDK so the toggle
		// actually takes effect for Azure too.
		clientOptions = &azblob.ClientOptions{
			ClientOptions: azcore.ClientOptions{
				Transport: &http.Client{
					Transport: &http.Transport{
						TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
					},
				},
			},
		}
	}

	client, err := azblob.NewClientWithSharedKeyCredential(serviceURL, credential, clientOptions)
	if err != nil {
		return nil, pkgerr.Wrap(err, "failed to create azure blob client")
	}

	// Config.IsValid rejects non-positive timeouts before they reach this
	// constructor, but direct callers (tests, library users that build a
	// FileBackendSettings by hand) can still slip a zero or negative value
	// in. Fall back to a sane default in that case, and log loudly enough
	// for the substitution to show up if it ever happens in production.
	timeout := time.Duration(settings.AzureRequestTimeoutMilliseconds) * time.Millisecond
	if timeout <= 0 {
		mlog.Warn("AzureRequestTimeoutMilliseconds is non-positive; falling back to 30s default",
			mlog.Int("value", int(settings.AzureRequestTimeoutMilliseconds)))
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

// prefix joins the configured pathPrefix and the caller-supplied path.
// Using a plain path.Join, a value like "foo/../../secret" can escape
// the prefix entirely, so we compute the join and verify the result is
// the prefix directory itself or a descendant of it. The descendant check
// requires a path-separator boundary so a prefix of "mattermost" does not
// match a sibling like "mattermost-evil/...". If the joined path escapes,
// we fall back to joining the prefix with path.Base, which may drop any
// intermediate directories the caller intended.
func (b *AzureFileBackend) prefix(p string) string {
	joined := path.Join(b.pathPrefix, p)
	if b.pathPrefix == "" {
		return joined
	}

	cleanPrefix := strings.TrimSuffix(path.Clean(b.pathPrefix), "/")
	if joined == cleanPrefix || strings.HasPrefix(joined, cleanPrefix+"/") {
		return joined
	}
	return path.Join(cleanPrefix, path.Base(p))
}

func (b *AzureFileBackend) newBlobClient(p string) *blob.Client {
	return b.client.ServiceClient().NewContainerClient(b.container).NewBlobClient(b.prefix(p))
}

func (b *AzureFileBackend) newBlockBlobClient(p string) *blockblob.Client {
	return b.client.ServiceClient().NewContainerClient(b.container).NewBlockBlobClient(b.prefix(p))
}

func (b *AzureFileBackend) newContainerClient() *container.Client {
	return b.client.ServiceClient().NewContainerClient(b.container)
}

// TestConnection probes the configured container and reports the outcome
// using the typed errors shared with the other backends. Container
// creation is deliberately out of scope here - callers (Server.Start)
// decide whether to provision a missing container via MakeContainer.
// That separation keeps a typo in the System Console from silently
// provisioning an unwanted container, and matches the S3 contract where
// TestConnection returns FileBackendNoBucketError and MakeBucket is an
// explicit call.
func (b *AzureFileBackend) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.newContainerClient().GetProperties(ctx, nil)
	if err == nil {
		return nil
	}
	if bloberror.HasCode(err, bloberror.ContainerNotFound) {
		return &FileBackendNoBucketError{Err: pkgerr.Wrapf(err, "azure container %q does not exist", b.container)}
	}
	if isAzureAuthError(err) {
		return &FileBackendAuthError{Err: pkgerr.Wrap(err, "unable to authenticate against azure blob storage")}
	}
	return pkgerr.Wrap(err, "unable to connect to azure blob storage")
}

// MakeContainer creates the configured container. Mirrors S3FileBackend.MakeBucket
// so callers can opt into container provisioning explicitly. An already-existing
// container is treated as success so that concurrent boots (two nodes racing
// through TestConnection plus MakeContainer) both converge cleanly.
func (b *AzureFileBackend) MakeContainer() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	if _, err := b.newContainerClient().Create(ctx, nil); err != nil {
		if bloberror.HasCode(err, bloberror.ContainerAlreadyExists) {
			return nil
		}
		return pkgerr.Wrapf(err, "unable to create azure container %q", b.container)
	}
	return nil
}

func (b *AzureFileBackend) Reader(p string) (ReadCloseSeeker, error) {
	// Arm the deadline *before* the first network call, then hand the same
	// timer to the returned reader on success. The previous code only set up
	// the timer on the happy path, which left GetProperties running against a
	// no-deadline context.
	ctx, cancel := context.WithCancel(context.Background())
	timer := time.AfterFunc(b.timeout, cancel)
	blobClient := b.newBlobClient(p)

	props, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		timer.Stop()
		cancel()
		return nil, pkgerr.Wrapf(err, "unable to read file %q", p)
	}
	if props.ContentLength == nil {
		timer.Stop()
		cancel()
		return nil, pkgerr.Errorf("missing content length for %q", p)
	}

	return &azureRangeReader{
		ctx:        ctx,
		cancel:     cancel,
		timer:      timer,
		blobClient: blobClient,
		size:       *props.ContentLength,
	}, nil
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

	_, err := b.newBlobClient(p).GetProperties(ctx, nil)
	if err != nil {
		if bloberror.HasCode(err, bloberror.BlobNotFound) {
			return false, nil
		}
		return false, pkgerr.Wrapf(err, "unable to check existence of %q", p)
	}
	return true, nil
}

func (b *AzureFileBackend) FileSize(p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	props, err := b.newBlobClient(p).GetProperties(ctx, nil)
	if err != nil {
		return 0, pkgerr.Wrapf(err, "unable to get size of %q", p)
	}

	return model.SafeDereference(props.ContentLength), nil
}

func (b *AzureFileBackend) FileModTime(p string) (time.Time, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	props, err := b.newBlobClient(p).GetProperties(ctx, nil)
	if err != nil {
		return time.Time{}, pkgerr.Wrapf(err, "unable to get modification time of %q", p)
	}

	return model.SafeDereference(props.LastModified), nil
}

// CopyFile copies via StartCopyFromURL and polls the resulting blob's copy
// status until it succeeds, matching the synchronous semantics that the
// FileBackend interface (and the S3 driver via ComposeObject) provides.
func (b *AzureFileBackend) CopyFile(oldPath, newPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	src := b.newBlobClient(oldPath).URL()
	dst := b.newBlockBlobClient(newPath)
	if _, err := dst.StartCopyFromURL(ctx, src, nil); err != nil {
		return pkgerr.Wrapf(err, "unable to copy %q to %q", oldPath, newPath)
	}

	// Poll until the copy reports success. For server-to-server copies within
	// the same account this is typically synchronous, but the API is
	// asynchronous in general, so we wait.
	for {
		props, err := dst.GetProperties(ctx, nil)
		if err != nil {
			return pkgerr.Wrapf(err, "unable to read copy status for %q", newPath)
		}
		if props.CopyStatus == nil {
			return nil
		}
		switch *props.CopyStatus {
		case blob.CopyStatusTypeSuccess:
			return nil
		case blob.CopyStatusTypeFailed, blob.CopyStatusTypeAborted:
			desc := model.SafeDereference(props.CopyStatusDescription)
			return pkgerr.Errorf("azure copy from %q to %q ended in status %q: %q", oldPath, newPath, *props.CopyStatus, desc)
		}
		select {
		case <-ctx.Done():
			return pkgerr.Wrapf(ctx.Err(), "azure copy from %q to %q did not complete in time", oldPath, newPath)
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func (b *AzureFileBackend) MoveFile(oldPath, newPath string) error {
	if err := b.CopyFile(oldPath, newPath); err != nil {
		return err
	}
	return b.RemoveFile(oldPath)
}

func (b *AzureFileBackend) WriteFile(fr io.Reader, p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()
	return b.WriteFileContext(ctx, fr, p)
}

// stageBlocks reads fr in azureBlockSize chunks and stages each chunk as a
// block under a fresh ID. Returns the IDs of the newly staged blocks (in
// order) and the total byte count. The caller is responsible for committing
// the block list.
func (b *AzureFileBackend) stageBlocks(ctx context.Context, bb *blockblob.Client, fr io.Reader, p string) ([]string, int64, error) {
	buf := make([]byte, azureBlockSize)
	var ids []string
	var total int64

	for {
		n, err := io.ReadFull(fr, buf)
		if n > 0 {
			id, idErr := newAzureBlockID()
			if idErr != nil {
				return nil, 0, pkgerr.Wrap(idErr, "failed to generate azure block id")
			}
			if _, sbErr := bb.StageBlock(ctx, id, &readSeekNopCloser{Reader: bytes.NewReader(buf[:n])}, nil); sbErr != nil {
				return nil, 0, pkgerr.Wrapf(sbErr, "unable to stage block for %q", p)
			}
			ids = append(ids, id)
			total += int64(n)
		}
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			break
		}
		if err != nil {
			return nil, 0, pkgerr.Wrap(err, "failed to read input")
		}
	}
	return ids, total, nil
}

// WriteFileContext stages the body in fixed-size blocks and commits a fresh
// block list. It deliberately does not use the SDK's UploadStream helper:
// UploadStream's small-payload fast path falls back to single-shot PutBlob,
// which leaves the resulting blob with no committed block list. A subsequent
// AppendFile that calls CommitBlockList on that blob would then clobber its
// content. Routing every WriteFile through StageBlock + CommitBlockList keeps
// AppendFile correct regardless of payload size.
//
// The caller's context governs the entire upload - no inner timeout is added.
// TryWriteFileContext (filesstore.go) relies on this to let long-running
// callers like message-export bulk writes opt out of the per-operation
// timeout that WriteFile applies by default.
func (b *AzureFileBackend) WriteFileContext(ctx context.Context, fr io.Reader, p string) (int64, error) {
	bb := b.newBlockBlobClient(p)
	blockIDs, total, err := b.stageBlocks(ctx, bb, fr, p)
	if err != nil {
		return 0, err
	}

	if len(blockIDs) == 0 {
		// Empty input - still need to materialize an empty blob with a
		// committed block list so AppendFile can target it.
		id, idErr := newAzureBlockID()
		if idErr != nil {
			return 0, pkgerr.Wrap(idErr, "failed to generate azure block id")
		}
		if _, sbErr := bb.StageBlock(ctx, id, &readSeekNopCloser{Reader: bytes.NewReader(nil)}, nil); sbErr != nil {
			return 0, pkgerr.Wrapf(sbErr, "unable to stage empty block for %q", p)
		}
		blockIDs = append(blockIDs, id)
	}

	if _, err := bb.CommitBlockList(ctx, blockIDs, nil); err != nil {
		return 0, pkgerr.Wrapf(err, "unable to commit block list for %q", p)
	}
	return total, nil
}

// AppendFile stages the new chunk as one or more blocks and commits the
// existing committed block list plus the newly staged IDs. Each AppendFile
// call uploads the new bytes exactly once - no re-download, no
// re-concatenate, no re-upload of the prior contents. The S3-style contract
// is preserved: returns an error if the target blob does not yet exist;
// returns the number of bytes appended (not the resulting total size).
//
// Refuses to append to a blob that has content but no committed block list
// (i.e. was uploaded via Put Blob by another tool - Azure portal, azcopy,
// a migration script). Committing a new block list against such a blob
// would replace the existing content with only the appended bytes, so
// failing loud beats silent data loss.
func (b *AzureFileBackend) AppendFile(fr io.Reader, p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	bb := b.newBlockBlobClient(p)

	listResp, err := bb.GetBlockList(ctx, blockblob.BlockListTypeCommitted, nil)
	if err != nil {
		return 0, pkgerr.Wrapf(err, "unable to find file %q to append data", p)
	}

	var existingIDs []string
	if listResp.BlockList.CommittedBlocks != nil {
		for _, blk := range listResp.BlockList.CommittedBlocks {
			if blk.Name != nil {
				existingIDs = append(existingIDs, *blk.Name)
			}
		}
	}

	if len(existingIDs) == 0 {
		props, propsErr := bb.GetProperties(ctx, nil)
		if propsErr != nil {
			return 0, pkgerr.Wrapf(propsErr, "unable to inspect %q before append", p)
		}
		if model.SafeDereference(props.ContentLength) > 0 {
			return 0, pkgerr.Errorf("refusing to append to %q: blob has content but no committed block list (likely written via Put Blob by another tool)", p)
		}
	}

	newIDs, total, err := b.stageBlocks(ctx, bb, fr, p)
	if err != nil {
		return 0, err
	}

	if _, err := bb.CommitBlockList(ctx, append(existingIDs, newIDs...), nil); err != nil {
		return 0, pkgerr.Wrapf(err, "unable to commit block list for %q", p)
	}
	return total, nil
}

func (b *AzureFileBackend) RemoveFile(p string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.newBlobClient(p).Delete(ctx, nil)
	if err != nil && !bloberror.HasCode(err, bloberror.BlobNotFound) {
		return pkgerr.Wrapf(err, "unable to remove file %q", p)
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

	pager := b.newContainerClient().NewListBlobsHierarchyPager("/", &container.ListBlobsHierarchyOptions{
		Prefix: &prefix,
	})

	var entries []string
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, pkgerr.Wrapf(err, "unable to list directory %q", p)
		}
		for _, item := range page.Segment.BlobItems {
			if item.Name == nil {
				continue
			}
			name := strings.TrimPrefix(*item.Name, b.pathPrefix)
			name = strings.TrimPrefix(name, "/")
			entries = append(entries, name)
		}
		for _, item := range page.Segment.BlobPrefixes {
			if item.Name == nil {
				continue
			}
			name := strings.TrimPrefix(*item.Name, b.pathPrefix)
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

	pager := b.newContainerClient().NewListBlobsFlatPager(&container.ListBlobsFlatOptions{
		Prefix: &prefix,
	})

	var entries []string
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, pkgerr.Wrapf(err, "unable to list directory %q recursively", p)
		}
		for _, item := range page.Segment.BlobItems {
			if item.Name == nil {
				continue
			}
			name := strings.TrimPrefix(*item.Name, b.pathPrefix)
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
		zw := zip.NewWriter(pw)
		err := b.writeZip(zw, p, method)
		if cerr := zw.Close(); err == nil {
			err = cerr
		}
		pw.CloseWithError(err)
	}()
	return pr, nil
}

func (b *AzureFileBackend) writeZip(zw *zip.Writer, p string, method uint16) error {
	exists, err := b.FileExists(p)
	if err != nil {
		return err
	}
	if exists {
		return b.writeZipEntry(zw, p, path.Base(p), method)
	}

	files, err := b.ListDirectoryRecursively(p)
	if err != nil {
		return err
	}
	prefix := strings.TrimSuffix(p, "/") + "/"
	for _, f := range files {
		rel := strings.TrimPrefix(f, prefix)
		if err := b.writeZipEntry(zw, f, rel, method); err != nil {
			return err
		}
	}
	return nil
}

func (b *AzureFileBackend) writeZipEntry(zw *zip.Writer, blobPath, name string, method uint16) error {
	r, err := b.Reader(blobPath)
	if err != nil {
		return err
	}
	defer r.Close()
	header := &zip.FileHeader{Name: name, Method: method}
	header.SetMode(0644)
	w, err := zw.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, r)
	return err
}

// readSeekNopCloser adapts a Reader+Seeker into a ReadSeekCloser without
// closing the underlying source. The Azure SDK's StageBlock signature
// requires a ReadSeekCloser.
type readSeekNopCloser struct {
	io.Reader
}

func (r *readSeekNopCloser) Seek(offset int64, whence int) (int64, error) {
	return r.Reader.(io.Seeker).Seek(offset, whence)
}

func (r *readSeekNopCloser) Close() error { return nil }

// newAzureBlockID returns a fresh base64-encoded 16-byte random block ID,
// generated with github.com/google/uuid - the same library azblob uses
// internally for the block IDs it produces in UploadStream. All committed
// blocks in a single blob must share the same decoded length, so callers
// must use this for both WriteFile and AppendFile staging.
//
// Per https://learn.microsoft.com/en-us/rest/api/storageservices/put-block:
//
//	For a given blob, all block IDs must be the same length. If a block is
//	uploaded with a block ID of a different length than the block IDs for any
//	existing uncommitted blocks, the service returns error response code 400
//	(Bad Request).
func newAzureBlockID() (string, error) {
	u, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(u[:]), nil
}

func isAzureAuthError(err error) bool {
	if err == nil {
		return false
	}
	return bloberror.HasCode(err, bloberror.AuthenticationFailed) ||
		bloberror.HasCode(err, bloberror.AuthorizationFailure) ||
		bloberror.HasCode(err, bloberror.InvalidAuthenticationInfo)
}
