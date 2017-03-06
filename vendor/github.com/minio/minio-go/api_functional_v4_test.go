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
	crand "crypto/rand"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"

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

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
}

// Tests various bucket supported formats.
func TestMakeBucketRegions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
	buf := make([]byte, minPartSize*4)
	// Use crand.Reader for multipart tests to ensure part order at the end.
	size, err := io.ReadFull(crand.Reader, buf)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, size)
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
	buf := make([]byte, minPartSize*2)
	// Use crand.Reader for multipart tests to ensure part order at the end.
	size, err := io.ReadFull(crand.Reader, buf)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*2 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*2, size)
	}

	// Save the data
	objectName := randString(60, rand.NewSource(time.Now().UnixNano()), "")

	// Object custom metadata
	customContentType := "custom/contenttype"

	n, err := c.PutObjectWithMetadata(bucketName, objectName, bytes.NewReader(buf), map[string][]string{"Content-Type": []string{customContentType}}, nil)
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

// Test listing partially uploaded objects.
func TestListPartiallyUploaded(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping function tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
			_, err = io.CopyN(writer, r, (minPartSize*2)/25)
			if err != nil {
				t.Fatal("Error:", err, bucketName)
			}
			i++
			r.Seek(0, 0)
		}
		err := writer.CloseWithError(errors.New("Proactively closed to be verified later."))
		if err != nil {
			t.Fatal("Error:", err)
		}
	}()

	objectName := bucketName + "-resumable"
	_, err = c.PutObject(bucketName, objectName, reader, "application/octet-stream")
	if err == nil {
		t.Fatal("Error: PutObject should fail.")
	}
	if err.Error() != "Proactively closed to be verified later." {
		t.Fatal("Error:", err)
	}

	doneCh := make(chan struct{})
	defer close(doneCh)
	isRecursive := true
	multiPartObjectCh := c.ListIncompleteUploads(bucketName, objectName, isRecursive, doneCh)
	for multiPartObject := range multiPartObjectCh {
		if multiPartObject.Err != nil {
			t.Fatalf("Error: Error when listing incomplete upload")
		}
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
				t.Fatal("Error: PutObject shouldn't fail.")
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

// Tests removing partially uploaded objects.
func TestRemovePartiallyUploaded(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping function tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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

	r := bytes.NewReader(bytes.Repeat([]byte("a"), 128*1024))

	reader, writer := io.Pipe()
	go func() {
		i := 0
		for i < 25 {
			_, err = io.CopyN(writer, r, 128*1024)
			if err != nil {
				t.Fatal("Error:", err, bucketName)
			}
			i++
			r.Seek(0, 0)
		}
		err := writer.CloseWithError(errors.New("Proactively closed to be verified later."))
		if err != nil {
			t.Fatal("Error:", err)
		}
	}()

	objectName := bucketName + "-resumable"
	_, err = c.PutObject(bucketName, objectName, reader, "application/octet-stream")
	if err == nil {
		t.Fatal("Error: PutObject should fail.")
	}
	if err.Error() != "Proactively closed to be verified later." {
		t.Fatal("Error:", err)
	}
	err = c.RemoveIncompleteUpload(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}
	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Tests resumable put object cloud to cloud.
func TestResumablePutObject(t *testing.T) {
	// By passing 'go test -short' skips these tests.
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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

	// Create a temporary file.
	file, err := ioutil.TempFile(os.TempDir(), "resumable")
	if err != nil {
		t.Fatal("Error:", err)
	}
	r := bytes.NewReader(bytes.Repeat([]byte("b"), minPartSize*2))
	// Copy 11MiB worth of random data.
	n, err := io.CopyN(file, r, minPartSize*2)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*2) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*2, n)
	}

	// Close the file pro-actively for windows.
	if err = file.Close(); err != nil {
		t.Fatal("Error:", err)
	}

	// New object name.
	objectName := bucketName + "-resumable"
	objectContentType := "application/custom-octet-stream"

	// Upload the file.
	n, err = c.FPutObject(bucketName, objectName, file.Name(), objectContentType)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*2) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*2, n)
	}

	// Get the uploaded object.
	reader, err := c.GetObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Get object info.
	objInfo, err := reader.Stat()
	if err != nil {
		t.Fatal("Error:", err)
	}

	if objInfo.ContentType != objectContentType {
		t.Fatalf("Error: Content types don't match, want %v, got %v\n", objectContentType, objInfo.ContentType)
	}

	// Upload now cloud to cloud.
	n, err = c.PutObject(bucketName, objectName+"-put", reader, objectContentType)
	if err != nil {
		t.Fatal("Error:", err)
	}

	if n != objInfo.Size {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", objInfo.Size, n)
	}

	// Remove all temp files, objects and bucket.
	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveObject(bucketName, objectName+"-put")
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = os.Remove(file.Name())
	if err != nil {
		t.Fatal("Error:", err)
	}
}

// Tests resumable file based put object multipart upload.
func TestResumableFPutObject(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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

	file, err := ioutil.TempFile(os.TempDir(), "resumable")
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Upload 4 parts to use all 3 multipart 'workers' and have an extra part.
	buffer := make([]byte, minPartSize*4)
	// Use crand.Reader for multipart tests to ensure parts are uploaded in correct order.
	size, err := io.ReadFull(crand.Reader, buffer)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, size)
	}
	size, err = file.Write(buffer)
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

	objectName := bucketName + "-resumable"

	n, err := c.FPutObject(bucketName, objectName, file.Name(), "application/octet-stream")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(minPartSize*4) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, n)
	}

	err = c.RemoveObject(bucketName, objectName)
	if err != nil {
		t.Fatal("Error: ", err)
	}

	err = c.RemoveBucket(bucketName)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = os.Remove(file.Name())
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
	buffer := make([]byte, minPartSize*4)

	size, err := io.ReadFull(crand.Reader, buffer)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, size)
	}
	size, err = file.Write(buffer)
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
	buffer := make([]byte, minPartSize*4)
	// Use random data for multipart tests to check parts are uploaded in correct order.
	size, err := io.ReadFull(crand.Reader, buffer)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != minPartSize*4 {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", minPartSize*4, size)
	}

	// Write the data to the file.
	size, err = file.Write(buffer)
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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

	offset := int64(2048)
	n, err = r.Seek(offset, 0)
	if err != nil {
		t.Fatal("Error:", err, offset)
	}
	if n != offset {
		t.Fatalf("Error: number of bytes seeked does not match, want %v, got %v\n",
			offset, n)
	}
	n, err = r.Seek(0, 1)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != offset {
		t.Fatalf("Error: number of current seek does not match, want %v, got %v\n",
			offset, n)
	}
	_, err = r.Seek(offset, 2)
	if err == nil {
		t.Fatal("Error: seek on positive offset for whence '2' should error out")
	}
	n, err = r.Seek(-offset, 2)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != st.Size-offset {
		t.Fatalf("Error: number of bytes seeked back does not match, want %d, got %v\n", st.Size-offset, n)
	}

	var buffer1 bytes.Buffer
	if _, err = io.CopyN(&buffer1, r, st.Size); err != nil {
		if err != io.EOF {
			t.Fatal("Error:", err)
		}
	}
	if !bytes.Equal(buf[len(buf)-int(offset):], buffer1.Bytes()) {
		t.Fatal("Error: Incorrect read bytes v/s original buffer.")
	}

	// Seek again and read again.
	n, err = r.Seek(offset-1, 0)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != (offset - 1) {
		t.Fatalf("Error: number of bytes seeked back does not match, want %v, got %v\n", offset-1, n)
	}

	var buffer2 bytes.Buffer
	if _, err = io.CopyN(&buffer2, r, st.Size); err != nil {
		if err != io.EOF {
			t.Fatal("Error:", err)
		}
	}
	// Verify now lesser bytes.
	if !bytes.Equal(buf[2047:], buffer2.Bytes()) {
		t.Fatal("Error: Incorrect read bytes v/s original buffer.")
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

// Tests get object ReaderAt interface methods.
func TestGetObjectReadAtFunctional(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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

	// Set copy conditions.
	copyConds := NewCopyConditions()

	// Start by setting wrong conditions
	err = copyConds.SetModified(time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC))
	if err == nil {
		t.Fatal("Error:", err)
	}
	err = copyConds.SetUnmodified(time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC))
	if err == nil {
		t.Fatal("Error:", err)
	}
	err = copyConds.SetMatchETag("")
	if err == nil {
		t.Fatal("Error:", err)
	}
	err = copyConds.SetMatchETagExcept("")
	if err == nil {
		t.Fatal("Error:", err)
	}

	err = copyConds.SetModified(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal("Error:", err)
	}
	err = copyConds.SetMatchETag(objInfo.ETag)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Copy source.
	copySource := bucketName + "/" + objectName

	// Perform the Copy
	err = c.CopyObject(bucketName+"-copy", objectName+"-copy", copySource, copyConds)
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
	copyConds = NewCopyConditions()
	err = copyConds.SetUnmodified(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal("Error:", err)
	}
	err = copyConds.SetMatchETagExcept(objInfo.ETag)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Perform the Copy which should fail
	err = c.CopyObject(bucketName+"-copy", objectName+"-copy", copySource, copyConds)
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

func TestBucketNotification(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	c, err := New(
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
		os.Getenv("S3_ADDRESS"),
		os.Getenv("ACCESS_KEY"),
		os.Getenv("SECRET_KEY"),
		mustParseBool(os.Getenv("S3_SECURE")),
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
