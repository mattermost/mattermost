// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
	"github.com/pkg/errors"
)

type AzureFileBackend struct {
	containerClient *container.Client
	container       string
	pathPrefix      string
	timeout         time.Duration
	presignExpires  time.Duration
	storageAccount  string
	accessKey       string
}

func (b *AzureFileBackend) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	_, err := b.containerClient.GetProperties(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "unable to connect to Azure blob storage")
	}

	return nil
}

func (b *AzureFileBackend) Reader(path string) (ReadCloseSeeker, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	// Usamos DownloadStream en el cliente principal
	download, err := b.containerClient.NewBlobClient(path).DownloadStream(ctx, nil)
	if err != nil {
		return nil, errors.Wrapf(err, "unable to read file %s", path)
	}

	// Wrap the body in a seekable reader - Body ya es un ReadCloser, no una función
	data, err := io.ReadAll(download.Body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read response body")
	}
	download.Body.Close()

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

	blobClient := b.containerClient.NewBlockBlobClient(path)
	_, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		// La estructura de errores cambió en la nueva versión del SDK
		if strings.Contains(err.Error(), "BlobNotFound") {
			return false, nil
		}
		return false, errors.Wrapf(err, "unable to check if file %s exists", path)
	}

	return true, nil
}

func (b *AzureFileBackend) FileSize(path string) (int64, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobClient := b.containerClient.NewBlockBlobClient(path)
	props, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		return 0, errors.Wrapf(err, "unable to get file size for %s", path)
	}

	return *props.ContentLength, nil
}

func (b *AzureFileBackend) FileModTime(path string) (time.Time, error) {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobClient := b.containerClient.NewBlockBlobClient(path)
	props, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		return time.Time{}, errors.Wrapf(err, "unable to get modification time for file %s", path)
	}

	return *props.LastModified, nil
}

func (b *AzureFileBackend) CopyFile(oldPath, newPath string) error {
	oldPath = filepath.Join(b.pathPrefix, oldPath)
	newPath = filepath.Join(b.pathPrefix, newPath)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	sourceBlobClient := b.containerClient.NewBlockBlobClient(oldPath)
	destinationBlobClient := b.containerClient.NewBlockBlobClient(newPath)

	_, err := destinationBlobClient.StartCopyFromURL(ctx, sourceBlobClient.URL(), nil)
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

	blobClient := b.containerClient.NewBlockBlobClient(path)

	data, err := io.ReadAll(fr)
	if err != nil {
		return 0, errors.Wrap(err, "failed to read input")
	}

	// Usar UploadBuffer en lugar de Upload ya que acepta []byte directamente
	_, err = blobClient.UploadBuffer(ctx, data, &blockblob.UploadBufferOptions{})
	if err != nil {
		return 0, errors.Wrapf(err, "unable to write file %s", path)
	}

	return int64(len(data)), nil
}

// noCopyReader es un wrapper sobre bytes.Reader que también implementa Close()
type noCopyReader struct {
	*bytes.Reader
}

func (r *noCopyReader) Close() error {
	return nil
}

func newNoCopyReader(data []byte) *noCopyReader {
	return &noCopyReader{bytes.NewReader(data)}
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

	// La nueva API no tiene un AppendBlobClient específico, necesitamos usar ContainerClient para crear un cliente específico
	blobClient := b.containerClient.NewBlockBlobClient(path)

	// Primera, verificamos si el blob existe
	exists, err := b.FileExists(strings.TrimPrefix(path, b.pathPrefix))
	if err != nil {
		return 0, errors.Wrapf(err, "unable to check if file %s exists", path)
	}

	var offset int64
	if !exists {
		// Si no existe, creamos un nuevo blob
		_, err = blobClient.UploadBuffer(ctx, data, nil)
		if err != nil {
			return 0, errors.Wrapf(err, "unable to create new file %s", path)
		}
		offset = 0
	} else {
		// Si existe, obtenemos el tamaño actual y luego agregamos datos
		size, err := b.FileSize(strings.TrimPrefix(path, b.pathPrefix))
		if err != nil {
			return 0, errors.Wrapf(err, "unable to get size of file %s", path)
		}

		// Descargamos el contenido existente
		existingContent, err := b.ReadFile(strings.TrimPrefix(path, b.pathPrefix))
		if err != nil {
			return 0, errors.Wrapf(err, "unable to read existing file %s", path)
		}

		// Concatenamos el contenido existente con los nuevos datos
		newContent := append(existingContent, data...)

		// Subimos el contenido combinado
		_, err = blobClient.UploadBuffer(ctx, newContent, nil)
		if err != nil {
			return 0, errors.Wrapf(err, "unable to append to file %s", path)
		}

		offset = size
	}

	return offset, nil
}

func (b *AzureFileBackend) RemoveFile(path string) error {
	path = filepath.Join(b.pathPrefix, path)
	ctx, cancel := context.WithTimeout(context.Background(), b.timeout)
	defer cancel()

	blobClient := b.containerClient.NewBlockBlobClient(path)
	_, err := blobClient.Delete(ctx, nil)
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

	// Usar el nuevo paginador para listar blobs jerárquicamente
	pager := b.containerClient.NewListBlobsHierarchyPager("/", &container.ListBlobsHierarchyOptions{
		Prefix: &path,
	})

	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, errors.Wrapf(err, "unable to list directory %s", path)
		}

		// Add files
		for _, blob := range page.Segment.BlobItems {
			name := strings.TrimPrefix(*blob.Name, b.pathPrefix)
			files = append(files, name)
		}

		// Add directories
		for _, prefix := range page.Segment.BlobPrefixes {
			name := strings.TrimPrefix(*prefix.Name, b.pathPrefix)
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

	// Usar el nuevo paginador para listar blobs de forma plana (sin jerarquía)
	pager := b.containerClient.NewListBlobsFlatPager(&container.ListBlobsFlatOptions{
		Prefix: &path,
	})

	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			return nil, errors.Wrapf(err, "unable to list directory %s recursively", path)
		}

		for _, blob := range page.Segment.BlobItems {
			files = append(files, strings.TrimPrefix(*blob.Name, b.pathPrefix))
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
	blobClient := b.containerClient.NewBlockBlobClient(path)

	// Create SAS query parameters with the specified permissions and expiry
	credential, err := azblob.NewSharedKeyCredential(b.storageAccount, b.accessKey)
	if err != nil {
		return "", 0, errors.Wrap(err, "failed to create shared key credential")
	}

	permissions := sas.BlobPermissions{
		Read: true,
	}

	startTime := time.Now().UTC().Add(-1 * time.Minute) // Comenzar 1 minuto antes para evitar problemas de reloj
	expiryTime := time.Now().UTC().Add(b.presignExpires)

	blobSASBuilder := sas.BlobSignatureValues{
		Protocol:      sas.ProtocolHTTPS,
		StartTime:     startTime,
		ExpiryTime:    expiryTime,
		ContainerName: b.container,
		BlobName:      path,
		Permissions:   permissions.String(),
	}

	sasQueryParams, err := blobSASBuilder.SignWithSharedKey(credential)
	if err != nil {
		return "", 0, errors.Wrapf(err, "unable to generate public link for %s", path)
	}

	sasURL := fmt.Sprintf("%s?%s", blobClient.URL(), sasQueryParams.Encode())
	return sasURL, b.presignExpires, nil
}

func (b *AzureFileBackend) DriverName() string {
	return driverAzure
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
		blobClient := b.containerClient.NewBlockBlobClient(path)
		props, err := blobClient.GetProperties(ctx, nil)

		if err == nil {
			// Create zip header for the file
			header := &zip.FileHeader{
				Name:     filepath.Base(path),
				Method:   deflateMethod,
				Modified: *props.LastModified,
			}
			header.SetMode(0644) // rw-r--r-- permissions

			writer, err2 := zipWriter.CreateHeader(header)
			if err2 != nil {
				pw.CloseWithError(errors.Wrapf(err2, "unable to create zip entry for %s", path))
				return
			}

			data, err2 := b.ReadFile(strings.TrimPrefix(path, b.pathPrefix))
			if err2 != nil {
				pw.CloseWithError(errors.Wrapf(err2, "unable to read file %s", path))
				return
			}

			_, err2 = writer.Write(data)
			if err2 != nil {
				pw.CloseWithError(errors.Wrapf(err2, "unable to write data for %s", path))
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
				Name:   relPath,
				Method: deflateMethod,
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
	credential, err := azblob.NewSharedKeyCredential(settings.AzureStorageAccount, settings.AzureAccessSecret)
	if err != nil {
		return nil, err
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net", settings.AzureStorageAccount)

	// Crear el cliente del servicio primero
	serviceClient, err := azblob.NewClientWithSharedKeyCredential(serviceURL, credential, nil)
	if err != nil {
		return nil, err
	}

	// Obtener el cliente del contenedor
	containerClient := serviceClient.ServiceClient().NewContainerClient(settings.AzureContainer)

	backend := &AzureFileBackend{
		containerClient: containerClient,
		container:       settings.AzureContainer,
		pathPrefix:      settings.AzurePathPrefix,
		timeout:         time.Duration(settings.AzureRequestTimeoutMilliseconds) * time.Millisecond,
		presignExpires:  time.Duration(settings.AzurePresignExpiresSeconds) * time.Second,
		storageAccount:  settings.AzureStorageAccount,
		accessKey:       settings.AzureAccessKey,
	}

	return backend, nil
}
