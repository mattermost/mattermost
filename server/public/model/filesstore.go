package model

import (
	"io"
	"time"

	"github.com/pkg/errors"
)

const (
	FileStoreDriverS3    = "amazons3"
	FileStoreDriverLocal = "local"
)

type ReadCloseSeeker interface {
	io.ReadCloser
	io.Seeker
}

type FileBackend interface {
	DriverName() string
	TestConnection() error

	Reader(path string) (ReadCloseSeeker, error)
	ReadFile(path string) ([]byte, error)
	FileExists(path string) (bool, error)
	FileSize(path string) (int64, error)
	CopyFile(oldPath, newPath string) error
	MoveFile(oldPath, newPath string) error
	WriteFile(fr io.Reader, path string) (int64, error)
	AppendFile(fr io.Reader, path string) (int64, error)
	RemoveFile(path string) error
	FileModTime(path string) (time.Time, error)

	ListDirectory(path string) ([]string, error)
	ListDirectoryRecursively(path string) ([]string, error)
	RemoveDirectory(path string) error
	ZipReader(path string, deflate bool) (io.ReadCloser, error)
}

type FileBackendWithLinkGenerator interface {
	GeneratePublicLink(path string) (string, time.Duration, error)
}

type FileBackendSettings struct {
	DriverName                         string
	Directory                          string
	AmazonS3AccessKeyId                string
	AmazonS3SecretAccessKey            string
	AmazonS3Bucket                     string
	AmazonS3PathPrefix                 string
	AmazonS3Region                     string
	AmazonS3Endpoint                   string
	AmazonS3SSL                        bool
	AmazonS3SignV2                     bool
	AmazonS3SSE                        bool
	AmazonS3Trace                      bool
	SkipVerify                         bool
	AmazonS3RequestTimeoutMilliseconds int64
	AmazonS3PresignExpiresSeconds      int64
	AmazonS3UploadPartSizeBytes        int64
	AmazonS3StorageClass               string
}

func (settings *FileBackendSettings) CheckMandatoryS3Fields() error {
	if settings.AmazonS3Bucket == "" {
		return errors.New("missing s3 bucket settings")
	}

	// if S3 endpoint is not set call the set defaults to set that
	if settings.AmazonS3Endpoint == "" {
		settings.AmazonS3Endpoint = "s3.amazonaws.com"
	}

	return nil
}

func NewFileBackendSettingsFromConfig(fileSettings *FileSettings, enableComplianceFeature bool, skipVerify bool) FileBackendSettings {
	if *fileSettings.ExportDriverName == FileStoreDriverLocal {
		return FileBackendSettings{
			DriverName: *fileSettings.ExportDriverName,
			Directory:  *fileSettings.ExportDirectory,
		}
	}
	return FileBackendSettings{
		DriverName:                         *fileSettings.ExportDriverName,
		AmazonS3AccessKeyId:                *fileSettings.ExportAmazonS3AccessKeyId,
		AmazonS3SecretAccessKey:            *fileSettings.ExportAmazonS3SecretAccessKey,
		AmazonS3Bucket:                     *fileSettings.ExportAmazonS3Bucket,
		AmazonS3PathPrefix:                 *fileSettings.ExportAmazonS3PathPrefix,
		AmazonS3Region:                     *fileSettings.ExportAmazonS3Region,
		AmazonS3Endpoint:                   *fileSettings.ExportAmazonS3Endpoint,
		AmazonS3SSL:                        fileSettings.ExportAmazonS3SSL == nil || *fileSettings.ExportAmazonS3SSL,
		AmazonS3SignV2:                     fileSettings.ExportAmazonS3SignV2 != nil && *fileSettings.ExportAmazonS3SignV2,
		AmazonS3SSE:                        fileSettings.ExportAmazonS3SSE != nil && *fileSettings.ExportAmazonS3SSE && enableComplianceFeature,
		AmazonS3Trace:                      fileSettings.ExportAmazonS3Trace != nil && *fileSettings.ExportAmazonS3Trace,
		AmazonS3RequestTimeoutMilliseconds: *fileSettings.ExportAmazonS3RequestTimeoutMilliseconds,
		AmazonS3PresignExpiresSeconds:      *fileSettings.ExportAmazonS3PresignExpiresSeconds,
		AmazonS3UploadPartSizeBytes:        *fileSettings.ExportAmazonS3UploadPartSizeBytes,
		AmazonS3StorageClass:               *fileSettings.ExportAmazonS3StorageClass,
		SkipVerify:                         skipVerify,
	}
}

func NewExportFileBackendSettingsFromConfig(fileSettings *FileSettings, enableComplianceFeature bool, skipVerify bool) FileBackendSettings {
	if *fileSettings.ExportDriverName == ImageDriverLocal {
		return FileBackendSettings{
			DriverName: *fileSettings.ExportDriverName,
			Directory:  *fileSettings.ExportDirectory,
		}
	}

	return FileBackendSettings{
		DriverName:                         *fileSettings.ExportDriverName,
		AmazonS3AccessKeyId:                *fileSettings.ExportAmazonS3AccessKeyId,
		AmazonS3SecretAccessKey:            *fileSettings.ExportAmazonS3SecretAccessKey,
		AmazonS3Bucket:                     *fileSettings.ExportAmazonS3Bucket,
		AmazonS3PathPrefix:                 *fileSettings.ExportAmazonS3PathPrefix,
		AmazonS3Region:                     *fileSettings.ExportAmazonS3Region,
		AmazonS3Endpoint:                   *fileSettings.ExportAmazonS3Endpoint,
		AmazonS3SSL:                        fileSettings.ExportAmazonS3SSL == nil || *fileSettings.ExportAmazonS3SSL,
		AmazonS3SignV2:                     fileSettings.ExportAmazonS3SignV2 != nil && *fileSettings.ExportAmazonS3SignV2,
		AmazonS3SSE:                        fileSettings.ExportAmazonS3SSE != nil && *fileSettings.ExportAmazonS3SSE && enableComplianceFeature,
		AmazonS3Trace:                      fileSettings.ExportAmazonS3Trace != nil && *fileSettings.ExportAmazonS3Trace,
		AmazonS3RequestTimeoutMilliseconds: *fileSettings.ExportAmazonS3RequestTimeoutMilliseconds,
		AmazonS3PresignExpiresSeconds:      *fileSettings.ExportAmazonS3PresignExpiresSeconds,
		AmazonS3UploadPartSizeBytes:        *fileSettings.ExportAmazonS3UploadPartSizeBytes,
		AmazonS3StorageClass:               *fileSettings.ExportAmazonS3StorageClass,
		SkipVerify:                         skipVerify,
	}
}
