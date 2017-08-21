// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	l4g "github.com/alecthomas/log4go"
	s3 "github.com/minio/minio-go"
	"github.com/minio/minio-go/pkg/credentials"

	"github.com/mattermost/platform/model"
)

const (
	TEST_FILE_PATH = "/testfile"
)

// Similar to s3.New() but allows initialization of signature v2 or signature v4 client.
// If signV2 input is false, function always returns signature v4.
//
// Additionally this function also takes a user defined region, if set
// disables automatic region lookup.
func s3New(endpoint, accessKey, secretKey string, secure bool, signV2 bool, region string) (*s3.Client, error) {
	var creds *credentials.Credentials
	if signV2 {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV2)
	} else {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV4)
	}
	return s3.NewWithCredentials(endpoint, creds, secure, region)
}

func TestFileConnection() *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := Cfg.FileSettings.AmazonS3Endpoint
		accessKey := Cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := Cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *Cfg.FileSettings.AmazonS3SSL
		signV2 := *Cfg.FileSettings.AmazonS3SignV2
		region := Cfg.FileSettings.AmazonS3Region
		bucket := Cfg.FileSettings.AmazonS3Bucket

		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return model.NewLocAppError("TestFileConnection", "Bad connection to S3 or minio.", nil, err.Error())
		}

		exists, err := s3Clnt.BucketExists(bucket)
		if err != nil {
			return model.NewLocAppError("TestFileConnection", "Error checking if bucket exists.", nil, err.Error())
		}

		if !exists {
			l4g.Warn("Bucket specified does not exist. Attempting to create...")
			err := s3Clnt.MakeBucket(bucket, region)
			if err != nil {
				l4g.Error("Unable to create bucket.")
				return model.NewAppError("TestFileConnection", "Unable to create bucket", nil, err.Error(), http.StatusInternalServerError)
			}
		}
		l4g.Info("Connection to S3 or minio is good. Bucket exists.")
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		f := []byte("testingwrite")
		if err := writeFileLocally(f, Cfg.FileSettings.Directory+TEST_FILE_PATH); err != nil {
			return model.NewAppError("TestFileConnection", "Don't have permissions to write to local path specified or other error.", nil, err.Error(), http.StatusInternalServerError)
		}
		os.Remove(Cfg.FileSettings.Directory + TEST_FILE_PATH)
		l4g.Info("Able to write files to local storage.")
	} else {
		return model.NewLocAppError("TestFileConnection", "No file driver selected.", nil, "")
	}

	return nil
}

func ReadFile(path string) ([]byte, *model.AppError) {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := Cfg.FileSettings.AmazonS3Endpoint
		accessKey := Cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := Cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *Cfg.FileSettings.AmazonS3SSL
		signV2 := *Cfg.FileSettings.AmazonS3SignV2
		region := Cfg.FileSettings.AmazonS3Region
		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return nil, model.NewLocAppError("ReadFile", "api.file.read_file.s3.app_error", nil, err.Error())
		}
		bucket := Cfg.FileSettings.AmazonS3Bucket
		minioObject, err := s3Clnt.GetObject(bucket, path)
		defer minioObject.Close()
		if err != nil {
			return nil, model.NewLocAppError("ReadFile", "api.file.read_file.s3.app_error", nil, err.Error())
		}
		if f, err := ioutil.ReadAll(minioObject); err != nil {
			return nil, model.NewLocAppError("ReadFile", "api.file.read_file.s3.app_error", nil, err.Error())
		} else {
			return f, nil
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if f, err := ioutil.ReadFile(Cfg.FileSettings.Directory + path); err != nil {
			return nil, model.NewLocAppError("ReadFile", "api.file.read_file.reading_local.app_error", nil, err.Error())
		} else {
			return f, nil
		}
	} else {
		return nil, model.NewAppError("ReadFile", "api.file.read_file.configured.app_error", nil, "", http.StatusNotImplemented)
	}
}

func MoveFile(oldPath, newPath string) *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := Cfg.FileSettings.AmazonS3Endpoint
		accessKey := Cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := Cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *Cfg.FileSettings.AmazonS3SSL
		signV2 := *Cfg.FileSettings.AmazonS3SignV2
		region := Cfg.FileSettings.AmazonS3Region
		encrypt := false
		if *Cfg.FileSettings.AmazonS3SSE && IsLicensed() && *License().Features.Compliance {
			encrypt = true
		}
		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return model.NewLocAppError("moveFile", "api.file.write_file.s3.app_error", nil, err.Error())
		}
		bucket := Cfg.FileSettings.AmazonS3Bucket

		source := s3.NewSourceInfo(bucket, oldPath, nil)
		destination, err := s3.NewDestinationInfo(bucket, newPath, nil, CopyMetadata(encrypt))
		if err != nil {
			return model.NewLocAppError("moveFile", "api.file.write_file.s3.app_error", nil, err.Error())
		}
		if err = s3Clnt.CopyObject(destination, source); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.delete_from_s3.app_error", nil, err.Error())
		}
		if err = s3Clnt.RemoveObject(bucket, oldPath); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.delete_from_s3.app_error", nil, err.Error())
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.MkdirAll(filepath.Dir(Cfg.FileSettings.Directory+newPath), 0774); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.rename.app_error", nil, err.Error())
		}

		if err := os.Rename(Cfg.FileSettings.Directory+oldPath, Cfg.FileSettings.Directory+newPath); err != nil {
			return model.NewLocAppError("moveFile", "api.file.move_file.rename.app_error", nil, err.Error())
		}
	} else {
		return model.NewLocAppError("moveFile", "api.file.move_file.configured.app_error", nil, "")
	}

	return nil
}

func WriteFile(f []byte, path string) *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := Cfg.FileSettings.AmazonS3Endpoint
		accessKey := Cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := Cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *Cfg.FileSettings.AmazonS3SSL
		signV2 := *Cfg.FileSettings.AmazonS3SignV2
		region := Cfg.FileSettings.AmazonS3Region
		encrypt := false
		if *Cfg.FileSettings.AmazonS3SSE && IsLicensed() && *License().Features.Compliance {
			encrypt = true
		}

		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return model.NewLocAppError("WriteFile", "api.file.write_file.s3.app_error", nil, err.Error())
		}

		bucket := Cfg.FileSettings.AmazonS3Bucket
		ext := filepath.Ext(path)
		metaData := S3Metadata(encrypt, "binary/octet-stream")
		if model.IsFileExtImage(ext) {
			metaData = S3Metadata(encrypt, model.GetImageMimeType(ext))
		}

		_, err = s3Clnt.PutObjectWithMetadata(bucket, path, bytes.NewReader(f), metaData, nil)
		if err != nil {
			return model.NewLocAppError("WriteFile", "api.file.write_file.s3.app_error", nil, err.Error())
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := writeFileLocally(f, Cfg.FileSettings.Directory+path); err != nil {
			return err
		}
	} else {
		return model.NewLocAppError("WriteFile", "api.file.write_file.configured.app_error", nil, "")
	}

	return nil
}

func writeFileLocally(f []byte, path string) *model.AppError {
	if err := os.MkdirAll(filepath.Dir(path), 0774); err != nil {
		directory, _ := filepath.Abs(filepath.Dir(path))
		return model.NewLocAppError("WriteFile", "api.file.write_file_locally.create_dir.app_error", nil, "directory="+directory+", err="+err.Error())
	}

	if err := ioutil.WriteFile(path, f, 0644); err != nil {
		return model.NewLocAppError("WriteFile", "api.file.write_file_locally.writing.app_error", nil, err.Error())
	}

	return nil
}

func RemoveFile(path string) *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := Cfg.FileSettings.AmazonS3Endpoint
		accessKey := Cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := Cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *Cfg.FileSettings.AmazonS3SSL
		signV2 := *Cfg.FileSettings.AmazonS3SignV2
		region := Cfg.FileSettings.AmazonS3Region

		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return model.NewLocAppError("RemoveFile", "utils.file.remove_file.s3.app_error", nil, err.Error())
		}

		bucket := Cfg.FileSettings.AmazonS3Bucket
		if err := s3Clnt.RemoveObject(bucket, path); err != nil {
			return model.NewLocAppError("RemoveFile", "utils.file.remove_file.s3.app_error", nil, err.Error())
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.Remove(Cfg.FileSettings.Directory + path); err != nil {
			return model.NewLocAppError("RemoveFile", "utils.file.remove_file.local.app_error", nil, err.Error())
		}
	} else {
		return model.NewLocAppError("RemoveFile", "utils.file.remove_file.configured.app_error", nil, "")
	}

	return nil
}

func getPathsFromObjectInfos(in <-chan s3.ObjectInfo) <-chan string {
	out := make(chan string, 1)

	go func() {
		defer close(out)

		for {
			info, done := <-in

			if !done {
				break
			}

			out <- info.Key
		}
	}()

	return out
}

func RemoveDirectory(path string) *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := Cfg.FileSettings.AmazonS3Endpoint
		accessKey := Cfg.FileSettings.AmazonS3AccessKeyId
		secretKey := Cfg.FileSettings.AmazonS3SecretAccessKey
		secure := *Cfg.FileSettings.AmazonS3SSL
		signV2 := *Cfg.FileSettings.AmazonS3SignV2
		region := Cfg.FileSettings.AmazonS3Region

		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return model.NewLocAppError("RemoveDirectory", "utils.file.remove_directory.s3.app_error", nil, err.Error())
		}

		doneCh := make(chan struct{})

		bucket := Cfg.FileSettings.AmazonS3Bucket
		for err := range s3Clnt.RemoveObjects(bucket, getPathsFromObjectInfos(s3Clnt.ListObjects(bucket, path, true, doneCh))) {
			if err.Err != nil {
				doneCh <- struct{}{}
				return model.NewLocAppError("RemoveDirectory", "utils.file.remove_directory.s3.app_error", nil, err.Err.Error())
			}
		}

		close(doneCh)
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.RemoveAll(Cfg.FileSettings.Directory + path); err != nil {
			return model.NewLocAppError("RemoveDirectory", "utils.file.remove_directory.local.app_error", nil, err.Error())
		}
	} else {
		return model.NewLocAppError("RemoveDirectory", "utils.file.remove_directory.configured.app_error", nil, "")
	}

	return nil
}

func S3Metadata(encrypt bool, contentType string) map[string][]string {
	metaData := make(map[string][]string)
	if contentType != "" {
		metaData["Content-Type"] = []string{"contentType"}
	}
	if encrypt {
		metaData["x-amz-server-side-encryption"] = []string{"AES256"}
	}
	return metaData
}

func CopyMetadata(encrypt bool) map[string]string {
	metaData := make(map[string]string)
	metaData["x-amz-server-side-encryption"] = "AES256"
	return metaData
}
