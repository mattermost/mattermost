/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2017 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package credentials

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFileAWS(t *testing.T) {
	os.Clearenv()

	creds := NewFileAWSCredentials("credentials.sample", "")
	credValues, err := creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "accessKey" {
		t.Errorf("Expected 'accessKey', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "secret" {
		t.Errorf("Expected 'secret', got %s'", credValues.SecretAccessKey)
	}
	if credValues.SessionToken != "token" {
		t.Errorf("Expected 'token', got %s'", credValues.SessionToken)
	}

	os.Setenv("AWS_SHARED_CREDENTIALS_FILE", "credentials.sample")
	creds = NewFileAWSCredentials("", "")
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "accessKey" {
		t.Errorf("Expected 'accessKey', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "secret" {
		t.Errorf("Expected 'secret', got %s'", credValues.SecretAccessKey)
	}
	if credValues.SessionToken != "token" {
		t.Errorf("Expected 'token', got %s'", credValues.SessionToken)
	}

	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}

	os.Setenv("AWS_SHARED_CREDENTIALS_FILE", filepath.Join(wd, "credentials.sample"))
	creds = NewFileAWSCredentials("", "")
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "accessKey" {
		t.Errorf("Expected 'accessKey', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "secret" {
		t.Errorf("Expected 'secret', got %s'", credValues.SecretAccessKey)
	}
	if credValues.SessionToken != "token" {
		t.Errorf("Expected 'token', got %s'", credValues.SessionToken)
	}

	os.Clearenv()
	os.Setenv("AWS_PROFILE", "no_token")

	creds = NewFileAWSCredentials("credentials.sample", "")
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "accessKey" {
		t.Errorf("Expected 'accessKey', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "secret" {
		t.Errorf("Expected 'secret', got %s'", credValues.SecretAccessKey)
	}

	os.Clearenv()

	creds = NewFileAWSCredentials("credentials.sample", "no_token")
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "accessKey" {
		t.Errorf("Expected 'accessKey', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "secret" {
		t.Errorf("Expected 'secret', got %s'", credValues.SecretAccessKey)
	}

	creds = NewFileAWSCredentials("credentials-non-existent.sample", "no_token")
	_, err = creds.Get()
	if !os.IsNotExist(err) {
		t.Errorf("Expected open non-existent.json: no such file or directory, got %s", err)
	}
	if !creds.IsExpired() {
		t.Error("Should be expired if not loaded")
	}
}

func TestFileMinioClient(t *testing.T) {
	os.Clearenv()

	creds := NewFileMinioClient("config.json.sample", "")
	credValues, err := creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "accessKey" {
		t.Errorf("Expected 'accessKey', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "secret" {
		t.Errorf("Expected 'secret', got %s'", credValues.SecretAccessKey)
	}
	if credValues.SignerType != SignatureV4 {
		t.Errorf("Expected 'S3v4', got %s'", credValues.SignerType)
	}

	os.Clearenv()
	os.Setenv("MINIO_ALIAS", "play")

	creds = NewFileMinioClient("config.json.sample", "")
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "Q3AM3UQ867SPQQA43P2F" {
		t.Errorf("Expected 'Q3AM3UQ867SPQQA43P2F', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG" {
		t.Errorf("Expected 'zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG', got %s'", credValues.SecretAccessKey)
	}
	if credValues.SignerType != SignatureV2 {
		t.Errorf("Expected 'S3v2', got %s'", credValues.SignerType)
	}

	os.Clearenv()

	creds = NewFileMinioClient("config.json.sample", "play")
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if credValues.AccessKeyID != "Q3AM3UQ867SPQQA43P2F" {
		t.Errorf("Expected 'Q3AM3UQ867SPQQA43P2F', got %s'", credValues.AccessKeyID)
	}
	if credValues.SecretAccessKey != "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG" {
		t.Errorf("Expected 'zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG', got %s'", credValues.SecretAccessKey)
	}
	if credValues.SignerType != SignatureV2 {
		t.Errorf("Expected 'S3v2', got %s'", credValues.SignerType)
	}

	creds = NewFileMinioClient("non-existent.json", "play")
	_, err = creds.Get()
	if !os.IsNotExist(err) {
		t.Errorf("Expected open non-existent.json: no such file or directory, got %s", err)
	}
	if !creds.IsExpired() {
		t.Error("Should be expired if not loaded")
	}
}
