/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2017 Minio, Inc.
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

package minio

import (
	"bytes"
	"crypto/md5"

	"io"
	"math/rand"
	"os"
	"reflect"
	"testing"
	"time"
)

const (
	serverEndpoint = "SERVER_ENDPOINT"
	accessKey      = "ACCESS_KEY"
	secretKey      = "SECRET_KEY"
	enableSecurity = "ENABLE_HTTPS"
)

// Tests for Core GetObject() function.
func TestGetObjectCore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio core client object.
	c, err := NewCore(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Enable tracing, write to stderr.
	// c.TraceOn(os.Stderr)

	// Set user agent.
	c.SetAppInfo("Minio-go-FunctionalTest", "0.1.0")

	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Generate data more than 32K
	buf := bytes.Repeat([]byte("3"), rand.Intn(1<<20)+32*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	n, err := c.Client.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	reqHeaders := NewGetReqHeaders()

	offset := int64(2048)

	// read directly
	buf1 := make([]byte, 512)
	buf2 := make([]byte, 512)
	buf3 := make([]byte, n)
	buf4 := make([]byte, 1)

	reqHeaders.SetRange(offset, offset+int64(len(buf1))-1)
	reader, objectInfo, err := c.GetObject(bucketName, objectName, reqHeaders)
	if err != nil {
		t.Fatal(err)
	}
	m, err := io.ReadFull(reader, buf1)
	reader.Close()
	if err != nil {
		t.Fatal(err)
	}

	if objectInfo.Size != int64(m) {
		t.Fatalf("Error: GetObject read shorter bytes before reaching EOF, want %v, got %v\n", objectInfo.Size, m)
	}
	if !bytes.Equal(buf1, buf[offset:offset+512]) {
		t.Fatal("Error: Incorrect read between two GetObject from same offset.")
	}
	offset += 512

	reqHeaders.SetRange(offset, offset+int64(len(buf2))-1)
	reader, objectInfo, err = c.GetObject(bucketName, objectName, reqHeaders)
	if err != nil {
		t.Fatal(err)
	}

	m, err = io.ReadFull(reader, buf2)
	reader.Close()
	if err != nil {
		t.Fatal(err)
	}

	if objectInfo.Size != int64(m) {
		t.Fatalf("Error: GetObject read shorter bytes before reaching EOF, want %v, got %v\n", objectInfo.Size, m)
	}
	if !bytes.Equal(buf2, buf[offset:offset+512]) {
		t.Fatal("Error: Incorrect read between two GetObject from same offset.")
	}

	reqHeaders.SetRange(0, int64(len(buf3)))
	reader, objectInfo, err = c.GetObject(bucketName, objectName, reqHeaders)
	if err != nil {
		t.Fatal(err)
	}

	m, err = io.ReadFull(reader, buf3)
	if err != nil {
		reader.Close()
		t.Fatal(err)
	}
	reader.Close()

	if objectInfo.Size != int64(m) {
		t.Fatalf("Error: GetObject read shorter bytes before reaching EOF, want %v, got %v\n", objectInfo.Size, m)
	}
	if !bytes.Equal(buf3, buf) {
		t.Fatal("Error: Incorrect data read in GetObject, than what was previously upoaded.")
	}

	reqHeaders = NewGetReqHeaders()
	reqHeaders.SetMatchETag("etag")
	_, _, err = c.GetObject(bucketName, objectName, reqHeaders)
	if err == nil {
		t.Fatal("Unexpected GetObject should fail with mismatching etags")
	}
	if errResp := ToErrorResponse(err); errResp.Code != "PreconditionFailed" {
		t.Fatalf("Expected \"PreconditionFailed\" as code, got %s instead", errResp.Code)
	}

	reqHeaders = NewGetReqHeaders()
	reqHeaders.SetMatchETagExcept("etag")
	reader, objectInfo, err = c.GetObject(bucketName, objectName, reqHeaders)
	if err != nil {
		t.Fatal(err)
	}

	m, err = io.ReadFull(reader, buf3)
	reader.Close()
	if err != nil {
		t.Fatal(err)
	}

	if objectInfo.Size != int64(m) {
		t.Fatalf("Error: GetObject read shorter bytes before reaching EOF, want %v, got %v\n", objectInfo.Size, m)
	}
	if !bytes.Equal(buf3, buf) {
		t.Fatal("Error: Incorrect data read in GetObject, than what was previously upoaded.")
	}

	reqHeaders = NewGetReqHeaders()
	reqHeaders.SetRange(0, 0)
	reader, objectInfo, err = c.GetObject(bucketName, objectName, reqHeaders)
	if err != nil {
		t.Fatal(err)
	}

	m, err = io.ReadFull(reader, buf4)
	reader.Close()
	if err != nil {
		t.Fatal(err)
	}

	if objectInfo.Size != int64(m) {
		t.Fatalf("Error: GetObject read shorter bytes before reaching EOF, want %v, got %v\n", objectInfo.Size, m)
	}

	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Tests get bucket policy core API.
func TestGetBucketPolicy(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewCore(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Enable to debug
	// c.TraceOn(os.Stderr)

	// Set user agent.
	c.SetAppInfo("Minio-go-FunctionalTest", "0.1.0")

	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Verify if bucket exits and you have access.
	var exists bool
	exists, err = c.BucketExists(bucketName)
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}
	if !exists {
		t.Fatal("Error: could not find ", bucketName)
	}

	// Asserting the default bucket policy.
	bucketPolicy, err := c.GetBucketPolicy(bucketName)
	if err != nil {
		errResp := ToErrorResponse(err)
		if errResp.Code != "NoSuchBucketPolicy" {
			t.Error("Error:", err, bucketName)
		}
	}
	if !reflect.DeepEqual(bucketPolicy, emptyBucketAccessPolicy) {
		t.Errorf("Bucket policy expected %#v, got %#v", emptyBucketAccessPolicy, bucketPolicy)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Test Core PutObject.
func TestCorePutObject(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewCore(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Enable tracing, write to stderr.
	// c.TraceOn(os.Stderr)

	// Set user agent.
	c.SetAppInfo("Minio-go-FunctionalTest", "0.1.0")

	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	buf := bytes.Repeat([]byte("a"), minPartSize)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	// Object content type
	objectContentType := "binary/octet-stream"
	metadata := make(map[string][]string)
	metadata["Content-Type"] = []string{objectContentType}

	objInfo, err := c.PutObject(bucketName, objectName, int64(len(buf)), bytes.NewReader(buf), md5.New().Sum(nil), nil, metadata)
	if err == nil {
		t.Fatal("Error expected: nil, got: ", err)
	}

	objInfo, err = c.PutObject(bucketName, objectName, int64(len(buf)), bytes.NewReader(buf), nil, sum256(nil), metadata)
	if err == nil {
		t.Fatal("Error expected: nil, got: ", err)
	}

	objInfo, err = c.PutObject(bucketName, objectName, int64(len(buf)), bytes.NewReader(buf), nil, nil, metadata)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if objInfo.Size != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), objInfo.Size)
	}

	// Read the data back
	r, err := c.Client.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	st, err := r.Stat()
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if st.Size != int64(len(buf)) {
		t.Fatalf("Error: number of bytes in stat does not match, want %v, got %v\n",
			len(buf), st.Size)
	}

	if st.ContentType != objectContentType {
		t.Fatalf("Error: Content types don't match, expected: %+v, found: %+v\n", objectContentType, st.ContentType)
	}

	if err := r.Close(); err != nil {
		t.Fatal("Error:", err)
	}

	if err := r.Close(); err == nil {
		t.Fatal("Error: object is already closed, should return error")
	}

	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}
