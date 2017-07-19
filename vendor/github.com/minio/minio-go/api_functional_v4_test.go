/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2015 Minio, Inc.
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
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/minio/minio-go/pkg/encrypt"
	"github.com/minio/minio-go/pkg/policy"
)

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

// Tests bucket re-create errors.
func TestMakeBucketError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}
	if os.Getenv(serverEndpoint) != "s3.amazonaws.com" {
		t.Skip("skipping region functional tests for non s3 runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Make a new bucket in 'eu-central-1'.
	if err = c.MakeBucket(bucketName, "eu-central-1"); err != nil {
		t.Fatal("Error:", err, bucketName)
	}
	if err = c.MakeBucket(bucketName, "eu-central-1"); err == nil {
		t.Fatal("Error: make bucket should should fail for", bucketName)
	}
	// Verify valid error response from server.
	if ToErrorResponse(err).Code != "BucketAlreadyExists" &&
		ToErrorResponse(err).Code != "BucketAlreadyOwnedByYou" {
		t.Fatal("Error: Invalid error returned by server", err)
	}
	if err = c.RemoveBucket(bucketName); err != nil {
		t.Fatal("Error:", err, bucketName)
	}
	if err = c.MakeBucket(bucketName+"..-1", "eu-central-1"); err == nil {
		t.Fatal("Error:", err, bucketName+"..-1")
	}
	// Verify valid error response.
	if err != nil && err.Error() != "Bucket name contains invalid characters" {
		t.Fatal("Error: Invalid error returned by server", err)
	}
	if err = c.MakeBucket(bucketName+"AAA-1", "eu-central-1"); err == nil {
		t.Fatal("Error:", err, bucketName+"..-1")
	}
	// Verify valid error response.
	if err != nil && err.Error() != "Bucket name contains invalid characters" {
		t.Fatal("Error: Invalid error returned by server", err)
	}
}

// Tests various bucket supported formats.
func TestMakeBucketRegions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}
	if os.Getenv(serverEndpoint) != "s3.amazonaws.com" {
		t.Skip("skipping region functional tests for non s3 runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Make a new bucket in 'eu-central-1'.
	if err = c.MakeBucket(bucketName, "eu-central-1"); err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	if err = c.RemoveBucket(bucketName); err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Make a new bucket with '.' in its name, in 'us-west-2'. This
	// request is internally staged into a path style instead of
	// virtual host style.
	if err = c.MakeBucket(bucketName+".withperiod", "us-west-2"); err != nil {
		t.Fatal("Error:", err, bucketName+".withperiod")
	}

	// Remove the newly created bucket.
	if err = c.RemoveBucket(bucketName + ".withperiod"); err != nil {
		t.Fatal("Error:", err, bucketName+".withperiod")
	}
}

// Test PutObject using a large data to trigger multipart readat
func TestPutObjectReadAt(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Generate data using 4 parts so that all 3 'workers' are utilized and a part is leftover.
	// Use different data for each part for multipart tests to ensure part order at the end.
	var buf []byte
	for i := 0; i < 4; i++ {
		buf = append(buf, bytes.Repeat([]byte(string('a'+i)), minPartSize)...)
	}

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	// Object content type
	objectContentType := "binary/octet-stream"

	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), objectContentType)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	// Read the data back
	r, err := c.GetObject(bucketName, objectName)
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

// Test PutObject using a large data to trigger multipart readat
func TestPutObjectWithMetadata(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Generate data using 2 parts
	// Use different data in each part for multipart tests to ensure part order at the end.
	var buf []byte
	for i := 0; i < 2; i++ {
		buf = append(buf, bytes.Repeat([]byte(string('a'+i)), minPartSize)...)
	}

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")

	// Object custom metadata
	customContentType := "custom/contenttype"

	n, err := c.PutObjectWithMetadata(bucketName, objectName, bytes.NewReader(buf), map[string][]string{
		"Content-Type": {customContentType},
	}, nil)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	// Read the data back
	r, err := c.GetObject(bucketName, objectName)
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
	if st.ContentType != customContentType {
		t.Fatalf("Error: Expected and found content types do not match, want %v, got %v\n",
			customContentType, st.ContentType)
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

// Test put object with streaming signature.
func TestPutObjectStreaming(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping function tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV4(
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
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()),
		"minio-go-test")

	// Make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Upload an object.
	sizes := []int64{0, 64*1024 - 1, 64 * 1024}
	objectName := "test-object"
	for i, size := range sizes {
		data := bytes.Repeat([]byte("a"), int(size))
		n, err := c.PutObjectStreaming(bucketName, objectName, bytes.NewReader(data))
		if err != nil {
			t.Fatalf("Test %d Error: %v %s %s", i+1, err, bucketName, objectName)
		}

		if n != size {
			t.Errorf("Test %d Expected upload object size %d but got %d", i+1, size, n)
		}
	}

	// Remove the object.
	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Remove the bucket.
	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Test listing no partially uploaded objects upon putObject error.
func TestListNoPartiallyUploadedObjects(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping function tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Set user agent.
	c.SetAppInfo("Minio-go-FunctionalTest", "0.1.0")

	// Enable tracing, write to stdout.
	// c.TraceOn(os.Stderr)

	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	r := bytes.NewReader(bytes.Repeat([]byte("0"), minPartSize*2))

	reader, writer := io.Pipe()
	go func() {
		i := 0
		for i < 25 {
			_, cerr := io.CopyN(writer, r, (minPartSize*2)/25)
			if cerr != nil {
				t.Fatal("Error:", cerr, bucketName)
			}
			i++
			r.Seek(0, 0)
		}
		writer.CloseWithError(errors.New("proactively closed to be verified later"))
	}()

	objectName := bucketName + "-resumable"
	_, err = c.PutObject(bucketName, objectName, reader, "application/octet-stream")
	if err == nil {
		t.Fatal("Error: PutObject should fail.")
	}
	if !strings.Contains(err.Error(), "proactively closed to be verified later") {
		t.Fatal("Error:", err)
	}

	doneCh := make(chan struct{})
	defer close(doneCh)

	isRecursive := true
	multiPartObjectCh := c.ListIncompleteUploads(bucketName, objectName, isRecursive, doneCh)

	var activeUploads bool
	for multiPartObject := range multiPartObjectCh {
		if multiPartObject.Err != nil {
			t.Fatalf("Error: Error when listing incomplete upload")
		}
		activeUploads = true
	}
	if activeUploads {
		t.Errorf("There should be no active uploads in progress upon error for %s/%s", bucketName, objectName)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Test get object seeker from the end, using whence set to '2'.
func TestGetOjectSeekEnd(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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
	buf := bytes.Repeat([]byte("1"), rand.Intn(1<<20)+32*1024)
	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	// Read the data back
	r, err := c.GetObject(bucketName, objectName)
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

	pos, err := r.Seek(-100, 2)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}
	if pos != st.Size-100 {
		t.Fatalf("Expected %d, got %d instead", pos, st.Size-100)
	}
	buf2 := make([]byte, 100)
	m, err := io.ReadFull(r, buf2)
	if err != nil {
		t.Fatal("Error: reading through io.ReadFull", err, bucketName, objectName)
	}
	if m != len(buf2) {
		t.Fatalf("Expected %d bytes, got %d", len(buf2), m)
	}
	hexBuf1 := fmt.Sprintf("%02x", buf[len(buf)-100:])
	hexBuf2 := fmt.Sprintf("%02x", buf2[:m])
	if hexBuf1 != hexBuf2 {
		t.Fatalf("Expected %s, got %s instead", hexBuf1, hexBuf2)
	}
	pos, err = r.Seek(-100, 2)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}
	if pos != st.Size-100 {
		t.Fatalf("Expected %d, got %d instead", pos, st.Size-100)
	}
	if err = r.Close(); err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}
}

// Test get object reader to not throw error on being closed twice.
func TestGetObjectClosedTwice(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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
	buf := bytes.Repeat([]byte("1"), rand.Intn(1<<20)+32*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	// Read the data back
	r, err := c.GetObject(bucketName, objectName)
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

// Test removing multiple objects with Remove API
func TestRemoveMultipleObjects(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping function tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)

	if err != nil {
		t.Fatal("Error:", err)
	}

	// Set user agent.
	c.SetAppInfo("Minio-go-FunctionalTest", "0.1.0")

	// Enable tracing, write to stdout.
	// c.TraceOn(os.Stderr)

	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	r := bytes.NewReader(bytes.Repeat([]byte("a"), 8))

	// Multi remove of 1100 objects
	nrObjects := 1100

	objectsCh := make(chan string)

	go func() {
		defer close(objectsCh)
		// Upload objects and send them to objectsCh
		for i := 0; i < nrObjects; i++ {
			objectName := "sample" + strconv.Itoa(i) + ".txt"
			_, err = c.PutObject(bucketName, objectName, r, "application/octet-stream")
			if err != nil {
				t.Error("Error: PutObject shouldn't fail.", err)
				continue
			}
			objectsCh <- objectName
		}
	}()

	// Call RemoveObjects API
	errorCh := c.RemoveObjects(bucketName, objectsCh)

	// Check if errorCh doesn't receive any error
	select {
	case r, more := <-errorCh:
		if more {
			t.Fatalf("Unexpected error, objName(%v) err(%v)", r.ObjectName, r.Err)
		}
	}

	// Clean the bucket created by the test
	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Tests FPutObject of a big file to trigger multipart
func TestFPutObjectMultipart(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Make a temp file with minPartSize*4 bytes of data.
	file, err := ioutil.TempFile(os.TempDir(), "FPutObjectTest")
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Upload 4 parts to utilize all 3 'workers' in multipart and still have a part to upload.
	var buffer []byte
	for i := 0; i < 4; i++ {
		buffer = append(buffer, bytes.Repeat([]byte(string('a'+i)), minPartSize)...)
	}

	size, err := file.Write(buffer)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, size)
	}

	// Close the file pro-actively for windows.
	err = file.Close()
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Set base object name
	objectName := bucketName + "FPutObject"
	objectContentType := "testapplication/octet-stream"

	// Perform standard FPutObject with contentType provided (Expecting application/octet-stream)
	n, err := c.FPutObject(bucketName, objectName+"-standard", file.Name(), objectContentType)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*4) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, n)
	}

	r, err := c.GetObject(bucketName, objectName+"-standard")
	if err != nil {
		t.Fatalf("Unexpected error: %v\n", err)
	}
	objInfo, err := r.Stat()
	if err != nil {
		t.Fatalf("Unexpected error: %v\n", err)
	}
	if objInfo.Size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, n)
	}
	if objInfo.ContentType != objectContentType {
		t.Fatalf("Error: Content types don't match, want %v, got %v\n", objectContentType, objInfo.ContentType)
	}

	// Remove all objects and bucket and temp file
	err = c.RemoveObject(bucketName, objectName+"-standard")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Tests FPutObject hidden contentType setting
func TestFPutObject(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Make a temp file with minPartSize*4 bytes of data.
	file, err := ioutil.TempFile(os.TempDir(), "FPutObjectTest")
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Upload 4 parts worth of data to use all 3 of multiparts 'workers' and have an extra part.
	// Use different data in part for multipart tests to check parts are uploaded in correct order.
	var buffer []byte
	for i := 0; i < 4; i++ {
		buffer = append(buffer, bytes.Repeat([]byte(string('a'+i)), minPartSize)...)
	}

	// Write the data to the file.
	size, err := file.Write(buffer)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, size)
	}

	// Close the file pro-actively for windows.
	err = file.Close()
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Set base object name
	objectName := bucketName + "FPutObject"

	// Perform standard FPutObject with contentType provided (Expecting application/octet-stream)
	n, err := c.FPutObject(bucketName, objectName+"-standard", file.Name(), "application/octet-stream")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*4) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, n)
	}

	// Perform FPutObject with no contentType provided (Expecting application/octet-stream)
	n, err = c.FPutObject(bucketName, objectName+"-Octet", file.Name(), "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*4) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, n)
	}

	// Add extension to temp file name
	fileName := file.Name()
	err = os.Rename(file.Name(), fileName+".gtar")
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Perform FPutObject with no contentType provided (Expecting application/x-gtar)
	n, err = c.FPutObject(bucketName, objectName+"-GTar", fileName+".gtar", "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*4) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, n)
	}

	// Check headers
	rStandard, err := c.StatObject(bucketName, objectName+"-standard")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName+"-standard")
	}
	if rStandard.ContentType != "application/octet-stream" {
		t.Fatalf("Error: Content-Type headers mismatched, want %v, got %v\n",
			"application/octet-stream", rStandard.ContentType)
	}

	rOctet, err := c.StatObject(bucketName, objectName+"-Octet")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName+"-Octet")
	}
	if rOctet.ContentType != "application/octet-stream" {
		t.Fatalf("Error: Content-Type headers mismatched, want %v, got %v\n",
			"application/octet-stream", rStandard.ContentType)
	}

	rGTar, err := c.StatObject(bucketName, objectName+"-GTar")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName+"-GTar")
	}
	if rGTar.ContentType != "application/x-gtar" {
		t.Fatalf("Error: Content-Type headers mismatched, want %v, got %v\n",
			"application/x-gtar", rStandard.ContentType)
	}

	// Remove all objects and bucket and temp file
	err = c.RemoveObject(bucketName, objectName+"-standard")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveObject(bucketName, objectName+"-Octet")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveObject(bucketName, objectName+"-GTar")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = os.Remove(fileName + ".gtar")
	if err != nil {
		t.Fatal("Error:", err)
	}

}

// Tests get object ReaderSeeker interface methods.
func TestGetObjectReadSeekFunctional(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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
	buf := bytes.Repeat([]byte("2"), rand.Intn(1<<20)+32*1024)
	bufSize := len(buf)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(bufSize) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	defer func() {
		err = c.RemoveObject(bucketName, objectName)
		if err != nil {
			t.Fatal("Error: ", err)
		}
		err = c.RemoveBucket(bucketName)
		if err != nil {
			t.Fatal("Error:", err)
		}
	}()

	// Read the data back
	r, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	st, err := r.Stat()
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}
	if st.Size != int64(bufSize) {
		t.Fatalf("Error: number of bytes in stat does not match, want %v, got %v\n",
			len(buf), st.Size)
	}

	// This following function helps us to compare data from the reader after seek
	// with the data from the original buffer
	cmpData := func(r io.Reader, start, end int) {
		if end-start == 0 {
			return
		}
		buffer := bytes.NewBuffer([]byte{})
		if _, err := io.CopyN(buffer, r, int64(bufSize)); err != nil {
			if err != io.EOF {
				t.Fatal("Error:", err)
			}
		}
		if !bytes.Equal(buf[start:end], buffer.Bytes()) {
			t.Fatal("Error: Incorrect read bytes v/s original buffer.")
		}
	}

	// Generic seek error for errors other than io.EOF
	seekErr := errors.New("seek error")

	testCases := []struct {
		offset    int64
		whence    int
		pos       int64
		err       error
		shouldCmp bool
		start     int
		end       int
	}{
		// Start from offset 0, fetch data and compare
		{0, 0, 0, nil, true, 0, 0},
		// Start from offset 2048, fetch data and compare
		{2048, 0, 2048, nil, true, 2048, bufSize},
		// Start from offset larger than possible
		{int64(bufSize) + 1024, 0, 0, seekErr, false, 0, 0},
		// Move to offset 0 without comparing
		{0, 0, 0, nil, false, 0, 0},
		// Move one step forward and compare
		{1, 1, 1, nil, true, 1, bufSize},
		// Move larger than possible
		{int64(bufSize), 1, 0, seekErr, false, 0, 0},
		// Provide negative offset with CUR_SEEK
		{int64(-1), 1, 0, seekErr, false, 0, 0},
		// Test with whence SEEK_END and with positive offset
		{1024, 2, int64(bufSize) - 1024, io.EOF, true, 0, 0},
		// Test with whence SEEK_END and with negative offset
		{-1024, 2, int64(bufSize) - 1024, nil, true, bufSize - 1024, bufSize},
		// Test with whence SEEK_END and with large negative offset
		{-int64(bufSize) * 2, 2, 0, seekErr, true, 0, 0},
	}

	for i, testCase := range testCases {
		// Perform seek operation
		n, err := r.Seek(testCase.offset, testCase.whence)
		// We expect an error
		if testCase.err == seekErr && err == nil {
			t.Fatalf("Test %d, unexpected err value: expected: %v, found: %v", i+1, testCase.err, err)
		}
		// We expect a specific error
		if testCase.err != seekErr && testCase.err != err {
			t.Fatalf("Test %d, unexpected err value: expected: %v, found: %v", i+1, testCase.err, err)
		}
		// If we expect an error go to the next loop
		if testCase.err != nil {
			continue
		}
		// Check the returned seek pos
		if n != testCase.pos {
			t.Fatalf("Test %d, error: number of bytes seeked does not match, want %v, got %v\n", i+1,
				testCase.pos, n)
		}
		// Compare only if shouldCmp is activated
		if testCase.shouldCmp {
			cmpData(r, testCase.start, testCase.end)
		}
	}
}

// Tests get object ReaderAt interface methods.
func TestGetObjectReadAtFunctional(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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
	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	// read the data back
	r, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}
	offset := int64(2048)

	// read directly
	buf1 := make([]byte, 512)
	buf2 := make([]byte, 512)
	buf3 := make([]byte, 512)
	buf4 := make([]byte, 512)

	// Test readAt before stat is called.
	m, err := r.ReadAt(buf1, offset)
	if err != nil {
		t.Fatal("Error:", err, len(buf1), offset)
	}
	if m != len(buf1) {
		t.Fatalf("Error: ReadAt read shorter bytes before reaching EOF, want %v, got %v\n", m, len(buf1))
	}
	if !bytes.Equal(buf1, buf[offset:offset+512]) {
		t.Fatal("Error: Incorrect read between two ReadAt from same offset.")
	}
	offset += 512

	st, err := r.Stat()
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}
	if st.Size != int64(len(buf)) {
		t.Fatalf("Error: number of bytes in stat does not match, want %v, got %v\n",
			len(buf), st.Size)
	}

	m, err = r.ReadAt(buf2, offset)
	if err != nil {
		t.Fatal("Error:", err, st.Size, len(buf2), offset)
	}
	if m != len(buf2) {
		t.Fatalf("Error: ReadAt read shorter bytes before reaching EOF, want %v, got %v\n", m, len(buf2))
	}
	if !bytes.Equal(buf2, buf[offset:offset+512]) {
		t.Fatal("Error: Incorrect read between two ReadAt from same offset.")
	}
	offset += 512
	m, err = r.ReadAt(buf3, offset)
	if err != nil {
		t.Fatal("Error:", err, st.Size, len(buf3), offset)
	}
	if m != len(buf3) {
		t.Fatalf("Error: ReadAt read shorter bytes before reaching EOF, want %v, got %v\n", m, len(buf3))
	}
	if !bytes.Equal(buf3, buf[offset:offset+512]) {
		t.Fatal("Error: Incorrect read between two ReadAt from same offset.")
	}
	offset += 512
	m, err = r.ReadAt(buf4, offset)
	if err != nil {
		t.Fatal("Error:", err, st.Size, len(buf4), offset)
	}
	if m != len(buf4) {
		t.Fatalf("Error: ReadAt read shorter bytes before reaching EOF, want %v, got %v\n", m, len(buf4))
	}
	if !bytes.Equal(buf4, buf[offset:offset+512]) {
		t.Fatal("Error: Incorrect read between two ReadAt from same offset.")
	}

	buf5 := make([]byte, n)
	// Read the whole object.
	m, err = r.ReadAt(buf5, 0)
	if err != nil {
		if err != io.EOF {
			t.Fatal("Error:", err, len(buf5))
		}
	}
	if m != len(buf5) {
		t.Fatalf("Error: ReadAt read shorter bytes before reaching EOF, want %v, got %v\n", m, len(buf5))
	}
	if !bytes.Equal(buf, buf5) {
		t.Fatal("Error: Incorrect data read in GetObject, than what was previously upoaded.")
	}

	buf6 := make([]byte, n+1)
	// Read the whole object and beyond.
	_, err = r.ReadAt(buf6, 0)
	if err != nil {
		if err != io.EOF {
			t.Fatal("Error:", err, len(buf6))
		}
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

// Test Presigned Post Policy
func TestPresignedPostPolicy(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping functional tests for short runs")
	}
	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object
	c, err := NewV4(
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

	// Make a new bucket in 'us-east-1' (source bucket).
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Generate data more than 32K
	buf := bytes.Repeat([]byte("4"), rand.Intn(1<<20)+32*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match want %v, got %v",
			len(buf), n)
	}

	policy := NewPostPolicy()

	if err := policy.SetBucket(""); err == nil {
		t.Fatalf("Error: %s", err)
	}
	if err := policy.SetKey(""); err == nil {
		t.Fatalf("Error: %s", err)
	}
	if err := policy.SetKeyStartsWith(""); err == nil {
		t.Fatalf("Error: %s", err)
	}
	if err := policy.SetExpires(time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC)); err == nil {
		t.Fatalf("Error: %s", err)
	}
	if err := policy.SetContentType(""); err == nil {
		t.Fatalf("Error: %s", err)
	}
	if err := policy.SetContentLengthRange(1024*1024, 1024); err == nil {
		t.Fatalf("Error: %s", err)
	}

	policy.SetBucket(bucketName)
	policy.SetKey(objectName)
	policy.SetExpires(time.Now().UTC().AddDate(0, 0, 10)) // expires in 10 days
	policy.SetContentType("image/png")
	policy.SetContentLengthRange(1024, 1024*1024)

	_, _, err = c.PresignedPostPolicy(policy)
	if err != nil {
		t.Fatal("Error:", err)
	}

	policy = NewPostPolicy()

	// Remove all objects and buckets
	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Tests copy object
func TestCopyObject(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping functional tests for short runs")
	}
	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object
	c, err := NewV4(
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

	// Make a new bucket in 'us-east-1' (source bucket).
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Make a new bucket in 'us-east-1' (destination bucket).
	err = c.MakeBucket(bucketName+"-copy", "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName+"-copy")
	}

	// Generate data more than 32K
	buf := bytes.Repeat([]byte("5"), rand.Intn(1<<20)+32*1024)

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName)
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match want %v, got %v",
			len(buf), n)
	}

	r, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}
	// Check the various fields of source object against destination object.
	objInfo, err := r.Stat()
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Copy Source
	src := NewSourceInfo(bucketName, objectName, nil)

	// Set copy conditions.

	// All invalid conditions first.
	err = src.SetModifiedSinceCond(time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC))
	if err == nil {
		t.Fatal("Error:", err)
	}
	err = src.SetUnmodifiedSinceCond(time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC))
	if err == nil {
		t.Fatal("Error:", err)
	}
	err = src.SetMatchETagCond("")
	if err == nil {
		t.Fatal("Error:", err)
	}
	err = src.SetMatchETagExceptCond("")
	if err == nil {
		t.Fatal("Error:", err)
	}

	err = src.SetModifiedSinceCond(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal("Error:", err)
	}
	err = src.SetMatchETagCond(objInfo.ETag)
	if err != nil {
		t.Fatal("Error:", err)
	}

	dst, err := NewDestinationInfo(bucketName+"-copy", objectName+"-copy", nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Perform the Copy
	err = c.CopyObject(dst, src)
	if err != nil {
		t.Fatal("Error:", err, bucketName+"-copy", objectName+"-copy")
	}

	// Source object
	reader, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}
	// Destination object
	readerCopy, err := c.GetObject(bucketName+"-copy", objectName+"-copy")
	if err != nil {
		t.Fatal("Error:", err)
	}
	// Check the various fields of source object against destination object.
	objInfo, err = reader.Stat()
	if err != nil {
		t.Fatal("Error:", err)
	}
	objInfoCopy, err := readerCopy.Stat()
	if err != nil {
		t.Fatal("Error:", err)
	}
	if objInfo.Size != objInfoCopy.Size {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n",
			objInfo.Size, objInfoCopy.Size)
	}

	// CopyObject again but with wrong conditions
	src = NewSourceInfo(bucketName, objectName, nil)
	err = src.SetUnmodifiedSinceCond(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal("Error:", err)
	}
	err = src.SetMatchETagExceptCond(objInfo.ETag)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Perform the Copy which should fail
	err = c.CopyObject(dst, src)
	if err == nil {
		t.Fatal("Error:", err, bucketName+"-copy", objectName+"-copy should fail")
	}

	// Remove all objects and buckets
	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = c.RemoveObject(bucketName+"-copy", objectName+"-copy")
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = c.RemoveBucket(bucketName + "-copy")
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// TestEncryptionPutGet tests client side encryption
func TestEncryptionPutGet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
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

	// Generate a symmetric key
	symKey := encrypt.NewSymmetricKey([]byte("my-secret-key-00"))

	// Generate an assymmetric key from predefine public and private certificates
	privateKey, err := hex.DecodeString(
		"30820277020100300d06092a864886f70d0101010500048202613082025d" +
			"0201000281810087b42ea73243a3576dc4c0b6fa245d339582dfdbddc20c" +
			"bb8ab666385034d997210c54ba79275c51162a1221c3fb1a4c7c61131ca6" +
			"5563b319d83474ef5e803fbfa7e52b889e1893b02586b724250de7ac6351" +
			"cc0b7c638c980acec0a07020a78eed7eaa471eca4b92071394e061346c06" +
			"15ccce2f465dee2080a89e43f29b5702030100010281801dd5770c3af8b3" +
			"c85cd18cacad81a11bde1acfac3eac92b00866e142301fee565365aa9af4" +
			"57baebf8bb7711054d071319a51dd6869aef3848ce477a0dc5f0dbc0c336" +
			"5814b24c820491ae2bb3c707229a654427e03307fec683e6b27856688f08" +
			"bdaa88054c5eeeb773793ff7543ee0fb0e2ad716856f2777f809ef7e6fa4" +
			"41024100ca6b1edf89e8a8f93cce4b98c76c6990a09eb0d32ad9d3d04fbf" +
			"0b026fa935c44f0a1c05dd96df192143b7bda8b110ec8ace28927181fd8c" +
			"d2f17330b9b63535024100aba0260afb41489451baaeba423bee39bcbd1e" +
			"f63dd44ee2d466d2453e683bf46d019a8baead3a2c7fca987988eb4d565e" +
			"27d6be34605953f5034e4faeec9bdb0241009db2cb00b8be8c36710aff96" +
			"6d77a6dec86419baca9d9e09a2b761ea69f7d82db2ae5b9aae4246599bb2" +
			"d849684d5ab40e8802cfe4a2b358ad56f2b939561d2902404e0ead9ecafd" +
			"bb33f22414fa13cbcc22a86bdf9c212ce1a01af894e3f76952f36d6c904c" +
			"bd6a7e0de52550c9ddf31f1e8bfe5495f79e66a25fca5c20b3af5b870241" +
			"0083456232aa58a8c45e5b110494599bda8dbe6a094683a0539ddd24e19d" +
			"47684263bbe285ad953d725942d670b8f290d50c0bca3d1dc9688569f1d5" +
			"9945cb5c7d")

	if err != nil {
		t.Fatal(err)
	}

	publicKey, err := hex.DecodeString("30819f300d06092a864886f70d010101050003818d003081890281810087" +
		"b42ea73243a3576dc4c0b6fa245d339582dfdbddc20cbb8ab666385034d9" +
		"97210c54ba79275c51162a1221c3fb1a4c7c61131ca65563b319d83474ef" +
		"5e803fbfa7e52b889e1893b02586b724250de7ac6351cc0b7c638c980ace" +
		"c0a07020a78eed7eaa471eca4b92071394e061346c0615ccce2f465dee20" +
		"80a89e43f29b570203010001")
	if err != nil {
		t.Fatal(err)
	}

	// Generate an asymmetric key
	asymKey, err := encrypt.NewAsymmetricKey(privateKey, publicKey)
	if err != nil {
		t.Fatal(err)
	}

	// Object custom metadata
	customContentType := "custom/contenttype"

	testCases := []struct {
		buf    []byte
		encKey encrypt.Key
	}{
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 0)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 1)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 15)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 16)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 17)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 31)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 32)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 33)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 1024)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 1024*2)},
		{encKey: symKey, buf: bytes.Repeat([]byte("F"), 1024*1024)},

		{encKey: asymKey, buf: bytes.Repeat([]byte("F"), 0)},
		{encKey: asymKey, buf: bytes.Repeat([]byte("F"), 1)},
		{encKey: asymKey, buf: bytes.Repeat([]byte("F"), 16)},
		{encKey: asymKey, buf: bytes.Repeat([]byte("F"), 32)},
		{encKey: asymKey, buf: bytes.Repeat([]byte("F"), 1024)},
		{encKey: asymKey, buf: bytes.Repeat([]byte("F"), 1024*1024)},
	}

	for i, testCase := range testCases {
		// Generate a random object name
		objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")

		// Secured object
		cbcMaterials, err := encrypt.NewCBCSecureMaterials(testCase.encKey)
		if err != nil {
			t.Fatal(err)
		}

		// Put encrypted data
		_, err = c.PutEncryptedObject(bucketName, objectName, bytes.NewReader(testCase.buf), cbcMaterials, map[string][]string{"Content-Type": {customContentType}}, nil)
		if err != nil {
			t.Fatalf("Test %d, error: %v %v %v", i+1, err, bucketName, objectName)
		}

		// Read the data back
		r, err := c.GetEncryptedObject(bucketName, objectName, cbcMaterials)
		if err != nil {
			t.Fatalf("Test %d, error: %v %v %v", i+1, err, bucketName, objectName)
		}
		defer r.Close()

		// Compare the sent object with the received one
		recvBuffer := bytes.NewBuffer([]byte{})
		if _, err = io.Copy(recvBuffer, r); err != nil {
			t.Fatalf("Test %d, error: %v", i+1, err)
		}
		if recvBuffer.Len() != len(testCase.buf) {
			t.Fatalf("Test %d, error: number of bytes of received object does not match, want %v, got %v\n",
				i+1, len(testCase.buf), recvBuffer.Len())
		}
		if !bytes.Equal(testCase.buf, recvBuffer.Bytes()) {
			t.Fatalf("Test %d, error: Encrypted sent is not equal to decrypted, want `%x`, go `%x`", i+1, testCase.buf, recvBuffer.Bytes())
		}

		// Remove test object
		err = c.RemoveObject(bucketName, objectName)
		if err != nil {
			t.Fatalf("Test %d, error: %v", i+1, err)
		}

	}

	// Remove test bucket
	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}

}

func TestBucketNotification(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}
	if os.Getenv("NOTIFY_BUCKET") == "" ||
		os.Getenv("NOTIFY_SERVICE") == "" ||
		os.Getenv("NOTIFY_REGION") == "" ||
		os.Getenv("NOTIFY_ACCOUNTID") == "" ||
		os.Getenv("NOTIFY_RESOURCE") == "" {
		t.Skip("skipping notification test if not configured")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	c, err := New(
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

	bucketName := os.Getenv("NOTIFY_BUCKET")

	topicArn := NewArn("aws", os.Getenv("NOTIFY_SERVICE"), os.Getenv("NOTIFY_REGION"), os.Getenv("NOTIFY_ACCOUNTID"), os.Getenv("NOTIFY_RESOURCE"))
	queueArn := NewArn("aws", "dummy-service", "dummy-region", "dummy-accountid", "dummy-resource")

	topicConfig := NewNotificationConfig(topicArn)
	topicConfig.AddEvents(ObjectCreatedAll, ObjectRemovedAll)
	topicConfig.AddFilterSuffix("jpg")

	queueConfig := NewNotificationConfig(queueArn)
	queueConfig.AddEvents(ObjectCreatedAll)
	queueConfig.AddFilterPrefix("photos/")

	bNotification := BucketNotification{}
	bNotification.AddTopic(topicConfig)

	// Add the same topicConfig again, should have no effect
	// because it is duplicated
	bNotification.AddTopic(topicConfig)
	if len(bNotification.TopicConfigs) != 1 {
		t.Fatal("Error: duplicated entry added")
	}

	// Add and remove a queue config
	bNotification.AddQueue(queueConfig)
	bNotification.RemoveQueueByArn(queueArn)

	err = c.SetBucketNotification(bucketName, bNotification)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	bNotification, err = c.GetBucketNotification(bucketName)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	if len(bNotification.TopicConfigs) != 1 {
		t.Fatal("Error: Topic config is empty")
	}

	if bNotification.TopicConfigs[0].Filter.S3Key.FilterRules[0].Value != "jpg" {
		t.Fatal("Error: cannot get the suffix")
	}

	err = c.RemoveAllBucketNotification(bucketName)
	if err != nil {
		t.Fatal("Error: cannot delete bucket notification")
	}
}

// Tests comprehensive list of all methods.
func TestFunctional(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	c, err := New(
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

	// Generate a random file name.
	fileName := randString(60, rand.NewSource(time.Now().UnixNano()), "")
	file, err := os.Create(fileName)
	if err != nil {
		t.Fatal("Error:", err)
	}
	for i := 0; i < 3; i++ {
		buf := make([]byte, rand.Intn(1<<19))
		_, err = file.Write(buf)
		if err != nil {
			t.Fatal("Error:", err)
		}
	}
	file.Close()

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
	policyAccess, err := c.GetBucketPolicy(bucketName, "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if policyAccess != "none" {
		t.Fatalf("Default bucket policy incorrect")
	}
	// Set the bucket policy to 'public readonly'.
	err = c.SetBucketPolicy(bucketName, "", policy.BucketPolicyReadOnly)
	if err != nil {
		t.Fatal("Error:", err)
	}
	// should return policy `readonly`.
	policyAccess, err = c.GetBucketPolicy(bucketName, "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if policyAccess != "readonly" {
		t.Fatalf("Expected bucket policy to be readonly")
	}

	// Make the bucket 'public writeonly'.
	err = c.SetBucketPolicy(bucketName, "", policy.BucketPolicyWriteOnly)
	if err != nil {
		t.Fatal("Error:", err)
	}
	// should return policy `writeonly`.
	policyAccess, err = c.GetBucketPolicy(bucketName, "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if policyAccess != "writeonly" {
		t.Fatalf("Expected bucket policy to be writeonly")
	}
	// Make the bucket 'public read/write'.
	err = c.SetBucketPolicy(bucketName, "", policy.BucketPolicyReadWrite)
	if err != nil {
		t.Fatal("Error:", err)
	}
	// should return policy `readwrite`.
	policyAccess, err = c.GetBucketPolicy(bucketName, "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if policyAccess != "readwrite" {
		t.Fatalf("Expected bucket policy to be readwrite")
	}
	// List all buckets.
	buckets, err := c.ListBuckets()
	if len(buckets) == 0 {
		t.Fatal("Error: list buckets cannot be empty", buckets)
	}
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Verify if previously created bucket is listed in list buckets.
	bucketFound := false
	for _, bucket := range buckets {
		if bucket.Name == bucketName {
			bucketFound = true
		}
	}

	// If bucket not found error out.
	if !bucketFound {
		t.Fatal("Error: bucket ", bucketName, "not found")
	}

	objectName := bucketName + "unique"

	// Generate data
	buf := bytes.Repeat([]byte("f"), 1<<19)

	n, err := c.PutObject(bucketName, objectName, bytes.NewReader(buf), "")
	if err != nil {
		t.Fatal("Error: ", err)
	}
	if n != int64(len(buf)) {
		t.Fatal("Error: bad length ", n, len(buf))
	}

	n, err = c.PutObject(bucketName, objectName+"-nolength", bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err, bucketName, objectName+"-nolength")
	}

	if n != int64(len(buf)) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", len(buf), n)
	}

	// Instantiate a done channel to close all listing.
	doneCh := make(chan struct{})
	defer close(doneCh)

	objFound := false
	isRecursive := true // Recursive is true.
	for obj := range c.ListObjects(bucketName, objectName, isRecursive, doneCh) {
		if obj.Key == objectName {
			objFound = true
			break
		}
	}
	if !objFound {
		t.Fatal("Error: object " + objectName + " not found.")
	}

	objFound = false
	isRecursive = true // Recursive is true.
	for obj := range c.ListObjectsV2(bucketName, objectName, isRecursive, doneCh) {
		if obj.Key == objectName {
			objFound = true
			break
		}
	}
	if !objFound {
		t.Fatal("Error: object " + objectName + " not found.")
	}

	incompObjNotFound := true
	for objIncompl := range c.ListIncompleteUploads(bucketName, objectName, isRecursive, doneCh) {
		if objIncompl.Key != "" {
			incompObjNotFound = false
			break
		}
	}
	if !incompObjNotFound {
		t.Fatal("Error: unexpected dangling incomplete upload found.")
	}

	newReader, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	newReadBytes, err := ioutil.ReadAll(newReader)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	if !bytes.Equal(newReadBytes, buf) {
		t.Fatal("Error: bytes mismatch.")
	}

	err = c.FGetObject(bucketName, objectName, fileName+"-f")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	// Generate presigned GET object url.
	presignedGetURL, err := c.PresignedGetObject(bucketName, objectName, 3600*time.Second, nil)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	// Verify if presigned url works.
	resp, err := http.Get(presignedGetURL.String())
	if err != nil {
		t.Fatal("Error: ", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatal("Error: ", resp.Status)
	}
	newPresignedBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	if !bytes.Equal(newPresignedBytes, buf) {
		t.Fatal("Error: bytes mismatch.")
	}

	// Set request parameters.
	reqParams := make(url.Values)
	reqParams.Set("response-content-disposition", "attachment; filename=\"test.txt\"")
	presignedGetURL, err = c.PresignedGetObject(bucketName, objectName, 3600*time.Second, reqParams)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	// Verify if presigned url works.
	resp, err = http.Get(presignedGetURL.String())
	if err != nil {
		t.Fatal("Error: ", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatal("Error: ", resp.Status)
	}
	newPresignedBytes, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	if !bytes.Equal(newPresignedBytes, buf) {
		t.Fatal("Error: bytes mismatch for presigned GET URL.")
	}
	if resp.Header.Get("Content-Disposition") != "attachment; filename=\"test.txt\"" {
		t.Fatalf("Error: wrong Content-Disposition received %s", resp.Header.Get("Content-Disposition"))
	}

	presignedPutURL, err := c.PresignedPutObject(bucketName, objectName+"-presigned", 3600*time.Second)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	buf = bytes.Repeat([]byte("g"), 1<<19)

	req, err := http.NewRequest("PUT", presignedPutURL.String(), bytes.NewReader(buf))
	if err != nil {
		t.Fatal("Error: ", err)
	}
	httpClient := &http.Client{
		// Setting a sensible time out of 30secs to wait for response
		// headers. Request is pro-actively cancelled after 30secs
		// with no response.
		Timeout:   30 * time.Second,
		Transport: http.DefaultTransport,
	}
	resp, err = httpClient.Do(req)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	newReader, err = c.GetObject(bucketName, objectName+"-presigned")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	newReadBytes, err = ioutil.ReadAll(newReader)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	if !bytes.Equal(newReadBytes, buf) {
		t.Fatal("Error: bytes mismatch.")
	}

	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	err = c.RemoveObject(bucketName, objectName+"-f")
	if err != nil {
		t.Fatal("Error: ", err)
	}
	err = c.RemoveObject(bucketName, objectName+"-nolength")
	if err != nil {
		t.Fatal("Error: ", err)
	}
	err = c.RemoveObject(bucketName, objectName+"-presigned")
	if err != nil {
		t.Fatal("Error: ", err)
	}
	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
	err = c.RemoveBucket(bucketName)
	if err == nil {
		t.Fatal("Error:")
	}
	if err.Error() != "The specified bucket does not exist" {
		t.Fatal("Error: ", err)
	}
	if err = os.Remove(fileName); err != nil {
		t.Fatal("Error: ", err)
	}
	if err = os.Remove(fileName + "-f"); err != nil {
		t.Fatal("Error: ", err)
	}
}

// Test for validating GetObject Reader* methods functioning when the
// object is modified in the object store.
func TestGetObjectObjectModified(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object.
	c, err := NewV4(
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

	// Make a new bucket.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}
	defer c.RemoveBucket(bucketName)

	// Upload an object.
	objectName := "myobject"
	content := "helloworld"
	_, err = c.PutObject(bucketName, objectName, strings.NewReader(content), "application/text")
	if err != nil {
		t.Fatalf("Failed to upload %s/%s: %v", bucketName, objectName, err)
	}

	defer c.RemoveObject(bucketName, objectName)

	reader, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatalf("Failed to get object %s/%s: %v", bucketName, objectName, err)
	}
	defer reader.Close()

	// Read a few bytes of the object.
	b := make([]byte, 5)
	n, err := reader.ReadAt(b, 0)
	if err != nil {
		t.Fatalf("Failed to read object %s/%s at an offset: %v", bucketName, objectName, err)
	}

	// Upload different contents to the same object while object is being read.
	newContent := "goodbyeworld"
	_, err = c.PutObject(bucketName, objectName, strings.NewReader(newContent), "application/text")
	if err != nil {
		t.Fatalf("Failed to upload %s/%s: %v", bucketName, objectName, err)
	}

	// Confirm that a Stat() call in between doesn't change the Object's cached etag.
	_, err = reader.Stat()
	if err.Error() != s3ErrorResponseMap["PreconditionFailed"] {
		t.Errorf("Expected Stat to fail with error %s but received %s", s3ErrorResponseMap["PreconditionFailed"], err.Error())
	}

	// Read again only to find object contents have been modified since last read.
	_, err = reader.ReadAt(b, int64(n))
	if err.Error() != s3ErrorResponseMap["PreconditionFailed"] {
		t.Errorf("Expected ReadAt to fail with error %s but received %s", s3ErrorResponseMap["PreconditionFailed"], err.Error())
	}
}

// Test validates putObject to upload a file seeked at a given offset.
func TestPutObjectUploadSeekedObject(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object.
	c, err := NewV4(
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

	// Make a new bucket.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}
	defer c.RemoveBucket(bucketName)

	tempfile, err := ioutil.TempFile("", "minio-go-upload-test-")
	if err != nil {
		t.Fatal("Error:", err)
	}

	var length = 120000
	data := bytes.Repeat([]byte("1"), length)

	if _, err = tempfile.Write(data); err != nil {
		t.Fatal("Error:", err)
	}

	objectName := fmt.Sprintf("test-file-%v", rand.Uint32())

	offset := length / 2
	if _, err := tempfile.Seek(int64(offset), 0); err != nil {
		t.Fatal("Error:", err)
	}

	n, err := c.PutObject(bucketName, objectName, tempfile, "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(length-offset) {
		t.Fatalf("Invalid length returned, want %v, got %v", int64(length-offset), n)
	}
	tempfile.Close()
	if err = os.Remove(tempfile.Name()); err != nil {
		t.Fatal("Error:", err)
	}

	length = int(n)

	obj, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	n, err = obj.Seek(int64(offset), 0)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(offset) {
		t.Fatalf("Invalid offset returned, want %v, got %v", int64(offset), n)
	}

	n, err = c.PutObject(bucketName, objectName+"getobject", obj, "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(length-offset) {
		t.Fatalf("Invalid length returned, want %v, got %v", int64(length-offset), n)
	}

	if err = c.RemoveObject(bucketName, objectName); err != nil {
		t.Fatal("Error:", err)
	}

	if err = c.RemoveObject(bucketName, objectName+"getobject"); err != nil {
		t.Fatal("Error:", err)
	}
}

// Test expected error cases
func TestComposeObjectErrorCases(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV4(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	testComposeObjectErrorCases(c, t)
}

// Test concatenating 10K objects
func TestCompose10KSources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV4(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	testComposeMultipleSources(c, t)
}

// Test encrypted copy object
func TestEncryptedCopyObject(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV4(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// c.TraceOn(os.Stderr)
	testEncryptedCopyObject(c, t)
}

func TestUserMetadataCopying(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV4(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// c.TraceOn(os.Stderr)
	testUserMetadataCopying(c, t)
}
