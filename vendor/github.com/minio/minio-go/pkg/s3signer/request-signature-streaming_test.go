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

package s3signer

import (
	"bytes"
	"io/ioutil"
	"testing"
	"time"
)

func TestGetSeedSignature(t *testing.T) {
	accessKeyID := "AKIAIOSFODNN7EXAMPLE"
	secretAccessKeyID := "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
	dataLen := 66560
	data := bytes.Repeat([]byte("a"), dataLen)
	body := ioutil.NopCloser(bytes.NewReader(data))

	req := NewRequest("PUT", "/examplebucket/chunkObject.txt", body)
	req.Header.Set("x-amz-storage-class", "REDUCED_REDUNDANCY")
	req.Host = "s3.amazonaws.com"

	reqTime, err := time.Parse("20060102T150405Z", "20130524T000000Z")
	if err != nil {
		t.Fatalf("Failed to parse time - %v", err)
	}

	req = StreamingSignV4(req, accessKeyID, secretAccessKeyID, "", "us-east-1", int64(dataLen), reqTime)
	actualSeedSignature := req.Body.(*StreamingReader).seedSignature

	expectedSeedSignature := "38cab3af09aa15ddf29e26e36236f60fb6bfb6243a20797ae9a8183674526079"
	if actualSeedSignature != expectedSeedSignature {
		t.Errorf("Expected %s but received %s", expectedSeedSignature, actualSeedSignature)
	}
}

func TestChunkSignature(t *testing.T) {
	chunkData := bytes.Repeat([]byte("a"), 65536)
	reqTime, _ := time.Parse(iso8601DateFormat, "20130524T000000Z")
	previousSignature := "4f232c4386841ef735655705268965c44a0e4690baa4adea153f7db9fa80a0a9"
	location := "us-east-1"
	secretAccessKeyID := "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
	expectedSignature := "ad80c730a21e5b8d04586a2213dd63b9a0e99e0e2307b0ade35a65485a288648"
	actualSignature := buildChunkSignature(chunkData, reqTime, location, previousSignature, secretAccessKeyID)
	if actualSignature != expectedSignature {
		t.Errorf("Expected %s but received %s", expectedSignature, actualSignature)
	}
}

func TestSetStreamingAuthorization(t *testing.T) {
	location := "us-east-1"
	secretAccessKeyID := "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
	accessKeyID := "AKIAIOSFODNN7EXAMPLE"

	req := NewRequest("PUT", "/examplebucket/chunkObject.txt", nil)
	req.Header.Set("x-amz-storage-class", "REDUCED_REDUNDANCY")
	req.Host = ""
	req.URL.Host = "s3.amazonaws.com"

	dataLen := int64(65 * 1024)
	reqTime, _ := time.Parse(iso8601DateFormat, "20130524T000000Z")
	req = StreamingSignV4(req, accessKeyID, secretAccessKeyID, "", location, dataLen, reqTime)

	expectedAuthorization := "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-decoded-content-length;x-amz-storage-class,Signature=38cab3af09aa15ddf29e26e36236f60fb6bfb6243a20797ae9a8183674526079"

	actualAuthorization := req.Header.Get("Authorization")
	if actualAuthorization != expectedAuthorization {
		t.Errorf("Expected %s but received %s", expectedAuthorization, actualAuthorization)
	}
}

func TestStreamingReader(t *testing.T) {
	reqTime, _ := time.Parse("20060102T150405Z", "20130524T000000Z")
	location := "us-east-1"
	secretAccessKeyID := "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
	accessKeyID := "AKIAIOSFODNN7EXAMPLE"
	dataLen := int64(65 * 1024)

	req := NewRequest("PUT", "/examplebucket/chunkObject.txt", nil)
	req.Header.Set("x-amz-storage-class", "REDUCED_REDUNDANCY")
	req.ContentLength = 65 * 1024
	req.Host = ""
	req.URL.Host = "s3.amazonaws.com"

	baseReader := ioutil.NopCloser(bytes.NewReader(bytes.Repeat([]byte("a"), 65*1024)))
	req.Body = baseReader
	req = StreamingSignV4(req, accessKeyID, secretAccessKeyID, "", location, dataLen, reqTime)

	b, err := ioutil.ReadAll(req.Body)
	if err != nil {
		t.Errorf("Expected no error but received %v  %d", err, len(b))
	}
	req.Body.Close()
}
