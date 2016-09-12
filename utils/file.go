// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/mattermost/platform/model"
)

func WriteFile(f []byte, path string) *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		var auth aws.Auth
		auth.AccessKey = Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, awsRegion())
		bucket := s.Bucket(Cfg.FileSettings.AmazonS3Bucket)

		ext := filepath.Ext(path)

		var err error
		if model.IsFileExtImage(ext) {
			options := s3.Options{}
			err = bucket.Put(path, f, model.GetImageMimeType(ext), s3.Private, options)

		} else {
			options := s3.Options{}
			err = bucket.Put(path, f, "binary/octet-stream", s3.Private, options)
		}

		if err != nil {
			return model.NewLocAppError("WriteFile", "utils.file.write_file.s3.app_error", nil, err.Error())
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := writeFileLocally(f, Cfg.FileSettings.Directory+path); err != nil {
			return err
		}
	} else {
		return model.NewLocAppError("WriteFile", "utils.file.write_file.configured.app_error", nil, "")
	}

	return nil
}

func MoveFile(oldPath, newPath string) *model.AppError {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		fileBytes, _ := ReadFile(oldPath)

		if fileBytes == nil {
			return model.NewLocAppError("moveFile", "utils.file.move_file.get_from_s3.app_error", nil, "")
		}

		var auth aws.Auth
		auth.AccessKey = Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, awsRegion())
		bucket := s.Bucket(Cfg.FileSettings.AmazonS3Bucket)

		if err := bucket.Del(oldPath); err != nil {
			return model.NewLocAppError("moveFile", "utils.file.move_file.delete_from_s3.app_error", nil, err.Error())
		}

		if err := WriteFile(fileBytes, newPath); err != nil {
			return err
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {

		if err := os.MkdirAll(filepath.Dir(Cfg.FileSettings.Directory+newPath), 0774); err != nil {
			return model.NewLocAppError("moveFile", "utils.file.move_file.rename.app_error", nil, err.Error())
		}

		if err := os.Rename(Cfg.FileSettings.Directory+oldPath, Cfg.FileSettings.Directory+newPath); err != nil {
			return model.NewLocAppError("moveFile", "utils.file.move_file.rename.app_error", nil, err.Error())
		}
	} else {
		return model.NewLocAppError("moveFile", "utils.file.move_file.configured.app_error", nil, "")
	}

	return nil
}

func writeFileLocally(f []byte, path string) *model.AppError {
	if err := os.MkdirAll(filepath.Dir(path), 0774); err != nil {
		directory, _ := filepath.Abs(filepath.Dir(path))
		return model.NewLocAppError("WriteFile", "utils.file.write_file_locally.create_dir.app_error", nil, "directory="+directory+", err="+err.Error())
	}

	if err := ioutil.WriteFile(path, f, 0644); err != nil {
		return model.NewLocAppError("WriteFile", "utils.file.write_file_locally.writing.app_error", nil, err.Error())
	}

	return nil
}

func ReadFile(path string) ([]byte, *model.AppError) {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		var auth aws.Auth
		auth.AccessKey = Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, awsRegion())
		bucket := s.Bucket(Cfg.FileSettings.AmazonS3Bucket)

		// try to get the file from S3 with some basic retry logic
		tries := 0
		for {
			tries++

			f, err := bucket.Get(path)

			if f != nil {
				return f, nil
			} else if tries >= 3 {
				return nil, model.NewLocAppError("readFile", "utils.file.read_file.get.app_error", nil, "path="+path+", err="+err.Error())
			}
			time.Sleep(3000 * time.Millisecond)
		}
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if f, err := ioutil.ReadFile(Cfg.FileSettings.Directory + path); err != nil {
			return nil, model.NewLocAppError("readFile", "utils.file.read_file.reading_local.app_error", nil, err.Error())
		} else {
			return f, nil
		}
	} else {
		return nil, model.NewLocAppError("readFile", "utils.file.read_file.configured.app_error", nil, "")
	}
}

func openFileWriteStream(path string) (io.Writer, *model.AppError) {
	if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		return nil, model.NewLocAppError("openFileWriteStream", "utils.file.open_file_write_stream.s3.app_error", nil, "")
	} else if Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.MkdirAll(filepath.Dir(Cfg.FileSettings.Directory+path), 0774); err != nil {
			return nil, model.NewLocAppError("openFileWriteStream", "utils.file.open_file_write_stream.creating_dir.app_error", nil, err.Error())
		}

		if fileHandle, err := os.Create(Cfg.FileSettings.Directory + path); err != nil {
			return nil, model.NewLocAppError("openFileWriteStream", "utils.file.open_file_write_stream.local_server.app_error", nil, err.Error())
		} else {
			fileHandle.Chmod(0644)
			return fileHandle, nil
		}
	}

	return nil, model.NewLocAppError("openFileWriteStream", "utils.file.open_file_write_stream.configured.app_error", nil, "")
}

func closeFileWriteStream(file io.Writer) {
	file.(*os.File).Close()
}

func awsRegion() aws.Region {
	if region, ok := aws.Regions[Cfg.FileSettings.AmazonS3Region]; ok {
		return region
	}

	return aws.Region{
		Name:                 Cfg.FileSettings.AmazonS3Region,
		S3Endpoint:           Cfg.FileSettings.AmazonS3Endpoint,
		S3BucketEndpoint:     Cfg.FileSettings.AmazonS3BucketEndpoint,
		S3LocationConstraint: *Cfg.FileSettings.AmazonS3LocationConstraint,
		S3LowercaseBucket:    *Cfg.FileSettings.AmazonS3LowercaseBucket,
	}
}
