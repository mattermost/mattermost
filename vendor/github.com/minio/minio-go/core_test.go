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

package minio

import (
	"bytes"
	"io"
	"log"
	"os"
	"reflect"
	"testing"
	"time"

	"math/rand"
)

const (
	serverEndpoint = "SERVER_ENDPOINT"
	accessKey      = "ACCESS_KEY"
	secretKey      = "SECRET_KEY"
	enableSecurity = "ENABLE_HTTPS"
)

// Minimum part size
const MinPartSize = 1024 * 1024 * 64
const letterBytes = "abcdefghijklmnopqrstuvwxyz01234569"
const (
	letterIdxBits = 6                    // 6 bits to represent a letter index
	letterIdxMask = 1<<letterIdxBits - 1 // All 1-bits, as many as letterIdxBits
	letterIdxMax  = 63 / letterIdxBits   // # of letter indices fitting in 63 bits
)

// randString generates random names and prepends them with a known prefix.
func randString(n int, src rand.Source, prefix string) string {
	b := make([]byte, n)
	// A rand.Int63() generates 63 random bits, enough for letterIdxMax letters!
	for i, cache, remain := n-1, src.Int63(), letterIdxMax; i >= 0; {
		if remain == 0 {
			cache, remain = src.Int63(), letterIdxMax
		}
		if idx := int(cache & letterIdxMask); idx < len(letterBytes) {
			b[i] = letterBytes[idx]
			i--
		}
		cache >>= letterIdxBits
		remain--
	}
	return prefix + string(b[0:30-len(prefix)])
}

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
	n, err := c.Client.PutObject(bucketName, objectName, bytes.NewReader(buf), int64(len(buf)), PutObjectOptions{
		ContentType: "binary/octet-stream",
	})
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	offset := int64(2048)

	// read directly
	buf1 := make([]byte, 512)
	buf2 := make([]byte, 512)
	buf3 := make([]byte, n)
	buf4 := make([]byte, 1)

	opts := GetObjectOptions{}
	opts.SetRange(offset, offset+int64(len(buf1))-1)
	reader, objectInfo, err := c.GetObject(bucketName, objectName, opts)
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

	opts.SetRange(offset, offset+int64(len(buf2))-1)
	reader, objectInfo, err = c.GetObject(bucketName, objectName, opts)
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

	opts.SetRange(0, int64(len(buf3)))
	reader, objectInfo, err = c.GetObject(bucketName, objectName, opts)
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

	opts = GetObjectOptions{}
	opts.SetMatchETag("etag")
	_, _, err = c.GetObject(bucketName, objectName, opts)
	if err == nil {
		t.Fatal("Unexpected GetObject should fail with mismatching etags")
	}
	if errResp := ToErrorResponse(err); errResp.Code != "PreconditionFailed" {
		t.Fatalf("Expected \"PreconditionFailed\" as code, got %s instead", errResp.Code)
	}

	opts = GetObjectOptions{}
	opts.SetMatchETagExcept("etag")
	reader, objectInfo, err = c.GetObject(bucketName, objectName, opts)
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

	opts = GetObjectOptions{}
	opts.SetRange(0, 0)
	reader, objectInfo, err = c.GetObject(bucketName, objectName, opts)
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

// Tests GetObject to return Content-Encoding properly set
// and overrides any auto decoding.
func TestGetObjectContentEncoding(t *testing.T) {
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
	n, err := c.Client.PutObject(bucketName, objectName, bytes.NewReader(buf), int64(len(buf)), PutObjectOptions{
		ContentEncoding: "gzip",
	})
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	rwc, objInfo, err := c.GetObject(bucketName, objectName, GetObjectOptions{})
	if err != nil {
		t.Fatalf("Error: %v", err)
	}
	rwc.Close()
	if objInfo.Size <= 0 {
		t.Fatalf("Unexpected size of the object %v, expected %v", objInfo.Size, n)
	}
	value, ok := objInfo.Metadata["Content-Encoding"]
	if !ok {
		t.Fatalf("Expected Content-Encoding metadata to be set.")
	}
	if value[0] != "gzip" {
		t.Fatalf("Unexpected content-encoding found, want gzip, got %v", value)
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

// Tests Core CopyObject API implementation.
func TestCoreCopyObject(t *testing.T) {
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

	buf := bytes.Repeat([]byte("a"), 32*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	objInfo, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), int64(len(buf)), "", "", map[string]string{
		"Content-Type": "binary/octet-stream",
	})
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if objInfo.Size != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), objInfo.Size)
	}

	destBucketName := bucketName
	destObjectName := objectName + "-dest"

	cobjInfo, err := c.CopyObject(bucketName, objectName, destBucketName, destObjectName, map[string]string{
		"X-Amz-Metadata-Directive": "REPLACE",
		"Content-Type":             "application/javascript",
	})
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName, destBucketName, destObjectName)
	}
	if cobjInfo.ETag != objInfo.ETag {
		t.Fatalf("Error: expected etag to be same as source object %s, but found different etag :%s", objInfo.ETag, cobjInfo.ETag)
	}

	// Attempt to read from destBucketName and object name.
	r, err := c.Client.GetObject(destBucketName, destObjectName, GetObjectOptions{})
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

	if st.ContentType != "application/javascript" {
		t.Fatalf("Error: Content types don't match, expected: application/javascript, found: %+v\n", st.ContentType)
	}

	if st.ETag != objInfo.ETag {
		t.Fatalf("Error: expected etag to be same as source object %s, but found different etag :%s", objInfo.ETag, st.ETag)
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

	err = c.RemoveObject(destBucketName, destObjectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Do not need to remove destBucketName its same as bucketName.
}

// Test Core CopyObjectPart implementation
func TestCoreCopyObjectPart(t *testing.T) {
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

	// Make a buffer with 5MB of data
	buf := bytes.Repeat([]byte("abcde"), 1024*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	objInfo, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), int64(len(buf)), "", "", map[string]string{
		"Content-Type": "binary/octet-stream",
	})
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if objInfo.Size != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), objInfo.Size)
	}

	destBucketName := bucketName
	destObjectName := objectName + "-dest"

	uploadID, err := c.NewMultipartUpload(destBucketName, destObjectName, PutObjectOptions{})
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	// Content of the destination object will be two copies of
	// `objectName` concatenated, followed by first byte of
	// `objectName`.

	// First of three parts
	fstPart, err := c.CopyObjectPart(bucketName, objectName, destBucketName, destObjectName, uploadID, 1, 0, -1, nil)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}

	// Second of three parts
	sndPart, err := c.CopyObjectPart(bucketName, objectName, destBucketName, destObjectName, uploadID, 2, 0, -1, nil)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}

	// Last of three parts
	lstPart, err := c.CopyObjectPart(bucketName, objectName, destBucketName, destObjectName, uploadID, 3, 0, 1, nil)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}

	// Complete the multipart upload
	err = c.CompleteMultipartUpload(destBucketName, destObjectName, uploadID, []CompletePart{fstPart, sndPart, lstPart})
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}

	// Stat the object and check its length matches
	objInfo, err = c.StatObject(destBucketName, destObjectName, StatObjectOptions{})
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}

	if objInfo.Size != (5*1024*1024)*2+1 {
		t.Fatal("Destination object has incorrect size!")
	}

	// Now we read the data back
	getOpts := GetObjectOptions{}
	getOpts.SetRange(0, 5*1024*1024-1)
	r, _, err := c.GetObject(destBucketName, destObjectName, getOpts)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}
	getBuf := make([]byte, 5*1024*1024)
	_, err = io.ReadFull(r, getBuf)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}
	if !bytes.Equal(getBuf, buf) {
		t.Fatal("Got unexpected data in first 5MB")
	}

	getOpts.SetRange(5*1024*1024, 0)
	r, _, err = c.GetObject(destBucketName, destObjectName, getOpts)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}
	getBuf = make([]byte, 5*1024*1024+1)
	_, err = io.ReadFull(r, getBuf)
	if err != nil {
		t.Fatal("Error:", err, destBucketName, destObjectName)
	}
	if !bytes.Equal(getBuf[:5*1024*1024], buf) {
		t.Fatal("Got unexpected data in second 5MB")
	}
	if getBuf[5*1024*1024] != buf[0] {
		t.Fatal("Got unexpected data in last byte of copied object!")
	}

	if err := c.RemoveObject(destBucketName, destObjectName); err != nil {
		t.Fatal("Error: ", err)
	}

	if err := c.RemoveObject(bucketName, objectName); err != nil {
		t.Fatal("Error: ", err)
	}

	if err := c.RemoveBucket(bucketName); err != nil {
		t.Fatal("Error: ", err)
	}

	// Do not need to remove destBucketName its same as bucketName.
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

	buf := bytes.Repeat([]byte("a"), 32*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	// Object content type
	objectContentType := "binary/octet-stream"
	metadata := make(map[string]string)
	metadata["Content-Type"] = objectContentType

	objInfo, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), int64(len(buf)), "1B2M2Y8AsgTpgAmY7PhCfg==", "", metadata)
	if err == nil {
		t.Fatal("Error expected: error, got: nil(success)")
	}

	objInfo, err = c.PutObject(bucketName, objectName, bytes.NewReader(buf), int64(len(buf)), "", "", metadata)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if objInfo.Size != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), objInfo.Size)
	}

	// Read the data back
	r, err := c.Client.GetObject(bucketName, objectName, GetObjectOptions{})
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

func TestCoreGetObjectMetadata(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	core, err := NewCore(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)))
	if err != nil {
		log.Fatalln(err)
	}

	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket.
	err = core.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	metadata := map[string]string{
		"X-Amz-Meta-Key-1": "Val-1",
	}

	_, err = core.PutObject(bucketName, "my-objectname",
		bytes.NewReader([]byte("hello")), 5, "", "", metadata)
	if err != nil {
		log.Fatalln(err)
	}

	reader, objInfo, err := core.GetObject(bucketName, "my-objectname", GetObjectOptions{})
	if err != nil {
		log.Fatalln(err)
	}
	defer reader.Close()

	if objInfo.Metadata.Get("X-Amz-Meta-Key-1") != "Val-1" {
		log.Fatalln("Expected metadata to be available but wasn't")
	}
}
