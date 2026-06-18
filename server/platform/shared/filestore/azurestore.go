// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/service"
	"github.com/google/uuid"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// azureBlockSize is the chunk size used when staging block blob uploads.
// Matches the Azure SDK's default block size for UploadStream and keeps each
// StageBlock call well under the per-block REST limit (4000 MiB).
const azureBlockSize = 4 * 1024 * 1024

// AzureFileBackend stores files in Azure Blob Storage. Two authentication
// modes are supported: shared key (an account access key configured by the
// admin) and Microsoft Entra ID via DefaultAzureCredential (managed identity,
// service principal, workload identity, or az login - whichever the host
// environment provides).
type AzureFileBackend struct {
	client *azblob.Client
	// sharedKey holds the account credential when authMode is shared key, and is
	// nil under default credential. GeneratePublicLink needs it to sign a Service
	// SAS by hand, since GetSASURL does not allow to change the ContentDisposition
	// if not at the blob level, and the parsing it does of the URL to retrieve
	// container and blob names does not support custom endpoints.
	sharedKey      *azblob.SharedKeyCredential
	authMode       string
	container      string
	pathPrefix     string
	timeout        time.Duration
	presignExpires time.Duration
	ssl            bool
}

var _ FileBackendWithLinkGenerator = (*AzureFileBackend)(nil)

func NewAzureFileBackend(settings FileBackendSettings) (*AzureFileBackend, error) {
	if err := settings.CheckMandatoryAzureFields(); err != nil {
		return nil, err
	}

	scheme := "https"
	if !settings.AzureSSL {
		scheme = "http"
	}

	serviceURL, err := buildAzureServiceURL(settings.AzureCloud, scheme, settings.AzureStorageAccount, settings.AzureEndpoint)
	if err != nil {
		return nil, err
	}

	client, sharedKey, err := newAzureClient(settings, serviceURL, buildAzureClientOptions(settings))
	if err != nil {
		return nil, err
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
		client:         client,
		sharedKey:      sharedKey,
		authMode:       settings.AzureAuthMode,
		container:      settings.AzureContainer,
		pathPrefix:     settings.AzurePathPrefix,
		timeout:        timeout,
		presignExpires: time.Duration(settings.AzurePresignExpiresSeconds) * time.Second,
		ssl:            settings.AzureSSL,
	}, nil
}

func (b *AzureFileBackend) DriverName() string {
	return driverAzure
}

// newAzureClient builds an azblob client for the configured authentication
// mode. Shared key uses NewClientWithSharedKeyCredential; default credential
// uses NewClient with DefaultAzureCredential, which discovers managed
// identity, workload identity, service principal env vars, and az login in
// that order at runtime.
//
// The shared-key credential is returned alongside the client when shared-key
// auth is in use, so callers (GeneratePublicLink in particular) can sign
// Service SAS tokens without round-tripping to Entra ID. It is nil in the
// default-credential path; that path obtains a user-delegation credential
// lazily at link-generation time.
func newAzureClient(settings FileBackendSettings, serviceURL string, clientOptions *azblob.ClientOptions) (*azblob.Client, *azblob.SharedKeyCredential, error) {
	switch settings.AzureAuthMode {
	case model.AzureAuthModeDefaultCredential:
		cred, err := azidentity.NewDefaultAzureCredential(nil)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create azure default credential: %w", err)
		}
		client, err := azblob.NewClient(serviceURL, cred, clientOptions)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create azure blob client: %w", err)
		}
		return client, nil, nil
	case model.AzureAuthModeSharedKey:
		cred, err := azblob.NewSharedKeyCredential(settings.AzureStorageAccount, settings.AzureAccessKey)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create azure shared key credential: %w", err)
		}
		client, err := azblob.NewClientWithSharedKeyCredential(serviceURL, cred, clientOptions)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create azure blob client: %w", err)
		}
		return client, cred, nil
	default:
		return nil, nil, fmt.Errorf("unknown azure auth mode %q", settings.AzureAuthMode)
	}
}

// buildAzureClientOptions selects the HTTP transport for the Azure SDK. The
// custom cloud routes requests through httpservice's transport, honoring
// AllowedUntrustedInternalConnections. The commercial and government clouds use
// a fixed Azure host (which may resolve to a private address under Private
// Link), so they keep the SDK default transport and only override it to honor
// SkipVerify, mirroring the S3 backend.
func buildAzureClientOptions(settings FileBackendSettings) *azblob.ClientOptions {
	if settings.AzureCloud == model.AzureCloudCustom {
		return &azblob.ClientOptions{
			ClientOptions: azcore.ClientOptions{
				Transport: &http.Client{
					Transport: httpservice.NewTransportForInternalConnections(settings.SkipVerify, settings.AllowedUntrustedInternalConnections),
				},
			},
		}
	}

	if settings.SkipVerify {
		return &azblob.ClientOptions{
			ClientOptions: azcore.ClientOptions{
				Transport: &http.Client{
					Transport: &http.Transport{
						TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
					},
				},
			},
		}
	}

	return nil
}

// buildAzureServiceURL renders the Blob service URL that the SDK signs
// requests against. The cloud value selects the topology:
//
//   - commercial -> vhost-style against blob.core.windows.net, e.g.
//     https://{account}.blob.core.windows.net/.
//   - government -> vhost-style against blob.core.usgovcloudapi.net,
//     e.g. https://{account}.blob.core.usgovcloudapi.net/.
//   - custom -> the admin-provided endpoint is the full service URL,
//     including scheme and storage account (vhost-style for production
//     Azure, path-style for Azurite or reverse proxies). Mattermost
//     does not modify the URL.
//
// Empty cloud is treated as commercial so existing configs that pre-date
// this field keep working. Shared-key auth signs against the URL host,
// so for custom deployments the admin is responsible for ensuring the
// host actually serves the storage account named in the credential.
func buildAzureServiceURL(cloud, scheme, account, endpoint string) (string, error) {
	switch cloud {
	case model.AzureCloudCommercial, "":
		if !model.IsValidAzureStorageAccountName(account) {
			return "", fmt.Errorf("invalid azure storage account name %q", account)
		}
		return fmt.Sprintf("%s://%s.blob.core.windows.net/", scheme, account), nil
	case model.AzureCloudGovernment:
		if !model.IsValidAzureStorageAccountName(account) {
			return "", fmt.Errorf("invalid azure storage account name %q", account)
		}
		return fmt.Sprintf("%s://%s.blob.core.usgovcloudapi.net/", scheme, account), nil
	case model.AzureCloudCustom:
		if endpoint == "" {
			return "", errors.New("AzureCloud=custom requires AzureEndpoint to be set")
		}
		// The admin owns this URL end to end, but we still reject inputs
		// that the SDK is guaranteed to fail on later (missing scheme,
		// missing host, a scheme other than http/https) so the
		// failure mode is a clear configuration error at startup rather
		// than an opaque SDK error on the first blob request.
		parsed, err := url.Parse(endpoint)
		if err != nil {
			return "", fmt.Errorf("AzureEndpoint is not a valid URL: %w", err)
		}
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return "", fmt.Errorf("AzureEndpoint must use http or https, got %q", endpoint)
		}
		if parsed.Host == "" {
			return "", fmt.Errorf("AzureEndpoint must include a host, got %q", endpoint)
		}
		return endpoint, nil
	default:
		return "", fmt.Errorf("unknown AzureCloud value %q", cloud)
	}
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
		return &FileBackendNoBucketError{Err: fmt.Errorf("azure container %q does not exist: %w", b.container, err)}
	}
	if isAzureAuthError(err) {
		return &FileBackendAuthError{Err: fmt.Errorf("unable to authenticate against azure blob storage: %w", err)}
	}
	return fmt.Errorf("unable to connect to azure blob storage: %w", err)
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
		return fmt.Errorf("unable to create azure container %q: %w", b.container, err)
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
		return nil, fmt.Errorf("unable to read file %q: %w", p, err)
	}
	if props.ContentLength == nil {
		timer.Stop()
		cancel()
		return nil, fmt.Errorf("missing content length for %q", p)
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
		return false, fmt.Errorf("unable to check existence of %q: %w", p, err)
	}
	return true, nil
}

func (b *AzureFileBackend) FileSize(p string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	props, err := b.newBlobClient(p).GetProperties(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("unable to get size of %q: %w", p, err)
	}

	return model.SafeDereference(props.ContentLength), nil
}

func (b *AzureFileBackend) FileModTime(p string) (time.Time, error) {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	props, err := b.newBlobClient(p).GetProperties(ctx, nil)
	if err != nil {
		return time.Time{}, fmt.Errorf("unable to get modification time of %q: %w", p, err)
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
		return fmt.Errorf("unable to copy %q to %q: %w", oldPath, newPath, err)
	}

	// Poll until the copy reports success. For server-to-server copies within
	// the same account this is typically synchronous, but the API is
	// asynchronous in general, so we wait.
	for {
		props, err := dst.GetProperties(ctx, nil)
		if err != nil {
			return fmt.Errorf("unable to read copy status for %q: %w", newPath, err)
		}
		if props.CopyStatus == nil {
			return nil
		}
		switch *props.CopyStatus {
		case blob.CopyStatusTypeSuccess:
			return nil
		case blob.CopyStatusTypeFailed, blob.CopyStatusTypeAborted:
			desc := model.SafeDereference(props.CopyStatusDescription)
			return fmt.Errorf("azure copy from %q to %q ended in status %q: %q", oldPath, newPath, *props.CopyStatus, desc)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("azure copy from %q to %q did not complete in time: %w", oldPath, newPath, ctx.Err())
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
				return nil, 0, fmt.Errorf("failed to generate azure block id: %w", idErr)
			}
			if _, sbErr := bb.StageBlock(ctx, id, &readSeekNopCloser{Reader: bytes.NewReader(buf[:n])}, nil); sbErr != nil {
				return nil, 0, fmt.Errorf("unable to stage block for %q: %w", p, sbErr)
			}
			ids = append(ids, id)
			total += int64(n)
		}
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			break
		}
		if err != nil {
			return nil, 0, fmt.Errorf("failed to read input: %w", err)
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
			return 0, fmt.Errorf("failed to generate azure block id: %w", idErr)
		}
		if _, sbErr := bb.StageBlock(ctx, id, &readSeekNopCloser{Reader: bytes.NewReader(nil)}, nil); sbErr != nil {
			return 0, fmt.Errorf("unable to stage empty block for %q: %w", p, sbErr)
		}
		blockIDs = append(blockIDs, id)
	}

	if _, err := bb.CommitBlockList(ctx, blockIDs, nil); err != nil {
		return 0, fmt.Errorf("unable to commit block list for %q: %w", p, err)
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
		return 0, fmt.Errorf("unable to find file %q to append data: %w", p, err)
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
			return 0, fmt.Errorf("unable to inspect %q before append: %w", p, propsErr)
		}
		if model.SafeDereference(props.ContentLength) > 0 {
			return 0, fmt.Errorf("refusing to append to %q: blob has content but no committed block list (likely written via Put Blob by another tool)", p)
		}
	}

	newIDs, total, err := b.stageBlocks(ctx, bb, fr, p)
	if err != nil {
		return 0, err
	}

	if _, err := bb.CommitBlockList(ctx, append(existingIDs, newIDs...), nil); err != nil {
		return 0, fmt.Errorf("unable to commit block list for %q: %w", p, err)
	}
	return total, nil
}

// GeneratePublicLink returns a time-limited, read-only URL to the blob at path
// using a Shared Access Signature. The SAS is auth-mode aware:
//
//   - shared-key auth signs a Service SAS in-process with the stored
//     SharedKeyCredential.
//   - default-credential auth fetches a user-delegation key from Entra ID
//     (one round trip per call) and signs a user-delegation SAS with it.
//
// This is intended for the export-download flow (App.GeneratePresignURLForExport
// and the /exportlink slash command). End users never reach this code path.
func (b *AzureFileBackend) GeneratePublicLink(path string) (string, time.Duration, error) {
	if b.presignExpires <= 0 {
		return "", 0, errors.New("azure presign expiration is not configured")
	}

	prefixed := b.prefix(path)

	// Back-date the start by a small fixed amount to absorb minor clock skew
	// between this host and Azure, matching the azure-sdk-for-go SAS examples:
	// https://github.com/Azure/azure-sdk-for-go/blob/65c3b792856d9ad7ce0b59c127ce299358e41a01/sdk/storage/azblob/sas/examples_test.go#L71
	// https://github.com/Azure/azure-sdk-for-go/blob/65c3b792856d9ad7ce0b59c127ce299358e41a01/sdk/storage/azblob/service/examples_test.go#L315
	const clockSkew = 10 * time.Second
	start := time.Now().UTC().Add(-clockSkew)
	expiry := start.Add(b.presignExpires)

	protocol := sas.ProtocolHTTPSandHTTP
	if b.ssl {
		protocol = sas.ProtocolHTTPS
	}

	values := sas.BlobSignatureValues{
		Protocol:      protocol,
		StartTime:     start,
		ExpiryTime:    expiry,
		Permissions:   (&sas.BlobPermissions{Read: true}).String(),
		ContainerName: b.container,
		BlobName:      prefixed,
		// Request browsers to download the file instead of rendering it
		ContentDisposition: "attachment",
	}

	var (
		qps sas.QueryParameters
		err error
	)
	switch b.authMode {
	case model.AzureAuthModeSharedKey:
		if b.sharedKey == nil {
			return "", 0, errors.New("shared key credential is unavailable")
		}
		qps, err = values.SignWithSharedKey(b.sharedKey)
		if err != nil {
			return "", 0, fmt.Errorf("unable to sign service SAS for %q: %w", path, err)
		}
	case model.AzureAuthModeDefaultCredential:
		ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
		defer cancel()
		udc, udcErr := b.client.ServiceClient().GetUserDelegationCredential(ctx, service.KeyInfo{
			Start:  new(start.Format(sas.TimeFormat)),
			Expiry: new(expiry.Format(sas.TimeFormat)),
		}, nil)
		if udcErr != nil {
			return "", 0, fmt.Errorf("unable to obtain user delegation key for %q: %w", path, udcErr)
		}
		qps, err = values.SignWithUserDelegation(udc)
		if err != nil {
			return "", 0, fmt.Errorf("unable to sign user-delegation SAS for %q: %w", path, err)
		}
	default:
		return "", 0, fmt.Errorf("unknown azure auth mode %q", b.authMode)
	}

	return b.newBlobClient(path).URL() + "?" + qps.Encode(), b.presignExpires, nil
}

func (b *AzureFileBackend) RemoveFile(p string) error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.newBlobClient(p).Delete(ctx, nil)
	if err != nil && !bloberror.HasCode(err, bloberror.BlobNotFound) {
		return fmt.Errorf("unable to remove file %q: %w", p, err)
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
			return nil, fmt.Errorf("unable to list directory %q: %w", p, err)
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
			return nil, fmt.Errorf("unable to list directory %q recursively: %w", p, err)
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
