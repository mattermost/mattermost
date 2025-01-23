// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

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
	AzureAccessKey                     string
	AzureAccessSecret                  string
	AzureContainer                     string
	AzureStorageAccount                string
	AzurePathPrefix                    string
	AzureRequestTimeoutMilliseconds    int64
	AzurePresignExpiresSeconds         int64
}
