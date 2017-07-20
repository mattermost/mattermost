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
	"errors"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/minio/minio-go/pkg/policy"
)

// Tests bucket re-create errors.
func TestMakeBucketErrorV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}
	if os.Getenv(serverEndpoint) != "s3.amazonaws.com" {
		t.Skip("skipping region functional tests for non s3 runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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

	// Make a new bucket in 'eu-west-1'.
	if err = c.MakeBucket(bucketName, "eu-west-1"); err != nil {
		t.Fatal("Error:", err, bucketName)
	}
	if err = c.MakeBucket(bucketName, "eu-west-1"); err == nil {
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

// Test get object reader to not throw error on being closed twice.
func TestGetObjectClosedTwiceV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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

	// Generate data more than 32K.
	buf := bytes.Repeat([]byte("h"), rand.Intn(1<<20)+32*1024)

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

// Tests removing partially uploaded objects.
func TestRemovePartiallyUploadedV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping function tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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

	// make a new bucket.
	err = c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	r := bytes.NewReader(bytes.Repeat([]byte("a"), 128*1024))

	reader, writer := io.Pipe()
	go func() {
		i := 0
		for i < 25 {
			_, cerr := io.CopyN(writer, r, 128*1024)
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
	if err.Error() != "proactively closed to be verified later" {
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

// Tests FPutObject hidden contentType setting
func TestFPutObjectV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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

	// Make a temp file with 11*1024*1024 bytes of data.
	file, err := ioutil.TempFile(os.TempDir(), "FPutObjectTest")
	if err != nil {
		t.Fatal("Error:", err)
	}

	r := bytes.NewReader(bytes.Repeat([]byte("b"), 11*1024*1024))
	n, err := io.CopyN(file, r, 11*1024*1024)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(11*1024*1024) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", 11*1024*1024, n)
	}

	// Close the file pro-actively for windows.
	err = file.Close()
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Set base object name
	objectName := bucketName + "FPutObject"

	// Perform standard FPutObject with contentType provided (Expecting application/octet-stream)
	n, err = c.FPutObject(bucketName, objectName+"-standard", file.Name(), "application/octet-stream")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(11*1024*1024) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", 11*1024*1024, n)
	}

	// Perform FPutObject with no contentType provided (Expecting application/octet-stream)
	n, err = c.FPutObject(bucketName, objectName+"-Octet", file.Name(), "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	if n != int64(11*1024*1024) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", 11*1024*1024, n)
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
	if n != int64(11*1024*1024) {
		t.Fatalf("Error: number of bytes does not match, want %v, got %v\n", 11*1024*1024, n)
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

// Tests various bucket supported formats.
func TestMakeBucketRegionsV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}
	if os.Getenv(serverEndpoint) != "s3.amazonaws.com" {
		t.Skip("skipping region functional tests for non s3 runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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
	if err = c.MakeBucket(bucketName, "eu-west-1"); err != nil {
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

// Tests get object ReaderSeeker interface methods.
func TestGetObjectReadSeekFunctionalV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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

	// Generate data more than 32K.
	buf := bytes.Repeat([]byte("2"), rand.Intn(1<<20)+32*1024)

	// Save the data.
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
func TestGetObjectReadAtFunctionalV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object.
	c, err := NewV2(
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
	buf := bytes.Repeat([]byte("8"), rand.Intn(1<<20)+32*1024)

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

	// Read directly
	buf2 := make([]byte, 512)
	buf3 := make([]byte, 512)
	buf4 := make([]byte, 512)

	m, err := r.ReadAt(buf2, offset)
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

// Tests copy object
func TestCopyObjectV2(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping functional tests for short runs")
	}
	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	// Instantiate new minio client object
	c, err := NewV2(
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
	buf := bytes.Repeat([]byte("9"), rand.Intn(1<<20)+32*1024)

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

	dst, err := NewDestinationInfo(bucketName+"-copy", objectName+"-copy", nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	src := NewSourceInfo(bucketName, objectName, nil)
	err = src.SetModifiedSinceCond(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal("Error:", err)
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
	objInfo, err := reader.Stat()
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

// Tests comprehensive list of all methods.
func TestFunctionalV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Seed random based on current time.
	rand.Seed(time.Now().Unix())

	c, err := NewV2(
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

	// Make the bucket 'public read/write'.
	err = c.SetBucketPolicy(bucketName, "", policy.BucketPolicyReadWrite)
	if err != nil {
		t.Fatal("Error:", err)
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
	buf := bytes.Repeat([]byte("n"), rand.Intn(1<<19))

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
	for obj := range c.ListObjects(bucketName, objectName, isRecursive, doneCh) {
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
	// Generate presigned GET object url.
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
		t.Fatal("Error: bytes mismatch for presigned GET url.")
	}
	// Verify content disposition.
	if resp.Header.Get("Content-Disposition") != "attachment; filename=\"test.txt\"" {
		t.Fatalf("Error: wrong Content-Disposition received %s", resp.Header.Get("Content-Disposition"))
	}

	presignedPutURL, err := c.PresignedPutObject(bucketName, objectName+"-presigned", 3600*time.Second)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	// Generate data more than 32K
	buf = bytes.Repeat([]byte("1"), rand.Intn(1<<20)+32*1024)

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

func testComposeObjectErrorCases(c *Client, t *testing.T) {
	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")

	// Make a new bucket in 'us-east-1' (source bucket).
	err := c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Test that more than 10K source objects cannot be
	// concatenated.
	srcArr := [10001]SourceInfo{}
	srcSlice := srcArr[:]
	dst, err := NewDestinationInfo(bucketName, "object", nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	if err := c.ComposeObject(dst, srcSlice); err == nil {
		t.Fatal("Error was expected.")
	} else if err.Error() != "There must be as least one and upto 10000 source objects." {
		t.Fatal("Got unexpected error: ", err)
	}

	// Create a source with invalid offset spec and check that
	// error is returned:
	// 1. Create the source object.
	const badSrcSize = 5 * 1024 * 1024
	buf := bytes.Repeat([]byte("1"), badSrcSize)
	_, err = c.PutObject(bucketName, "badObject", bytes.NewReader(buf), "")
	if err != nil {
		t.Fatal("Error:", err)
	}
	// 2. Set invalid range spec on the object (going beyond
	// object size)
	badSrc := NewSourceInfo(bucketName, "badObject", nil)
	err = badSrc.SetRange(1, badSrcSize)
	if err != nil {
		t.Fatal("Error:", err)
	}
	// 3. ComposeObject call should fail.
	if err := c.ComposeObject(dst, []SourceInfo{badSrc}); err == nil {
		t.Fatal("Error was expected.")
	} else if !strings.Contains(err.Error(), "has invalid segment-to-copy") {
		t.Fatal("Got unexpected error: ", err)
	}
}

// Test expected error cases
func TestComposeObjectErrorCasesV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV2(
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

func testComposeMultipleSources(c *Client, t *testing.T) {
	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")
	// Make a new bucket in 'us-east-1' (source bucket).
	err := c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	// Upload a small source object
	const srcSize = 1024 * 1024 * 5
	buf := bytes.Repeat([]byte("1"), srcSize)
	_, err = c.PutObject(bucketName, "srcObject", bytes.NewReader(buf), "binary/octet-stream")
	if err != nil {
		t.Fatal("Error:", err)
	}

	// We will append 10 copies of the object.
	srcs := []SourceInfo{}
	for i := 0; i < 10; i++ {
		srcs = append(srcs, NewSourceInfo(bucketName, "srcObject", nil))
	}
	// make the last part very small
	err = srcs[9].SetRange(0, 0)
	if err != nil {
		t.Fatal("unexpected error:", err)
	}

	dst, err := NewDestinationInfo(bucketName, "dstObject", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	err = c.ComposeObject(dst, srcs)
	if err != nil {
		t.Fatal("Error:", err)
	}

	objProps, err := c.StatObject(bucketName, "dstObject")
	if err != nil {
		t.Fatal("Error:", err)
	}

	if objProps.Size != 9*srcSize+1 {
		t.Fatal("Size mismatched! Expected:", 10000*srcSize, "but got:", objProps.Size)
	}
}

// Test concatenating multiple objects objects
func TestCompose10KSourcesV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV2(
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

func testEncryptedCopyObject(c *Client, t *testing.T) {
	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")
	// Make a new bucket in 'us-east-1' (source bucket).
	err := c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	key1 := NewSSEInfo([]byte("32byteslongsecretkeymustbegiven1"), "AES256")
	key2 := NewSSEInfo([]byte("32byteslongsecretkeymustbegiven2"), "AES256")

	// 1. create an sse-c encrypted object to copy by uploading
	const srcSize = 1024 * 1024
	buf := bytes.Repeat([]byte("abcde"), srcSize) // gives a buffer of 5MiB
	metadata := make(map[string][]string)
	for k, v := range key1.GetSSEHeaders() {
		metadata[k] = append(metadata[k], v)
	}
	_, err = c.PutObjectWithSize(bucketName, "srcObject", bytes.NewReader(buf), int64(len(buf)), metadata, nil)
	if err != nil {
		t.Fatal("PutObjectWithSize Error:", err)
	}

	// 2. copy object and change encryption key
	src := NewSourceInfo(bucketName, "srcObject", &key1)
	dst, err := NewDestinationInfo(bucketName, "dstObject", &key2, nil)
	if err != nil {
		t.Fatal("Error:", err)
	}

	err = c.CopyObject(dst, src)
	if err != nil {
		t.Fatal("CopyObject Error:", err)
	}

	// 3. get copied object and check if content is equal
	reqH := NewGetReqHeaders()
	for k, v := range key2.GetSSEHeaders() {
		reqH.Set(k, v)
	}
	coreClient := Core{c}
	reader, _, err := coreClient.GetObject(bucketName, "dstObject", reqH)
	if err != nil {
		t.Fatal("GetObject Error:", err)
	}
	defer reader.Close()

	decBytes, err := ioutil.ReadAll(reader)
	if err != nil {
		log.Fatalln(err)
	}
	if !bytes.Equal(decBytes, buf) {
		log.Fatal("downloaded object mismatched for encrypted object")
	}
}

// Test encrypted copy object
func TestEncryptedCopyObjectV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV2(
		os.Getenv(serverEndpoint),
		os.Getenv(accessKey),
		os.Getenv(secretKey),
		mustParseBool(os.Getenv(enableSecurity)),
	)
	if err != nil {
		t.Fatal("Error:", err)
	}

	testEncryptedCopyObject(c, t)
}

func testUserMetadataCopying(c *Client, t *testing.T) {
	// Generate a new random bucket name.
	bucketName := randString(60, rand.NewSource(time.Now().UnixNano()), "minio-go-test")
	// Make a new bucket in 'us-east-1' (source bucket).
	err := c.MakeBucket(bucketName, "us-east-1")
	if err != nil {
		t.Fatal("Error:", err, bucketName)
	}

	fetchMeta := func(object string) (h http.Header) {
		objInfo, err := c.StatObject(bucketName, object)
		if err != nil {
			t.Fatal("Metadata fetch error:", err)
		}
		h = make(http.Header)
		for k, vs := range objInfo.Metadata {
			if strings.HasPrefix(strings.ToLower(k), "x-amz-meta-") {
				for _, v := range vs {
					h.Add(k, v)
				}
			}
		}
		return h
	}

	// 1. create a client encrypted object to copy by uploading
	const srcSize = 1024 * 1024
	buf := bytes.Repeat([]byte("abcde"), srcSize) // gives a buffer of 5MiB
	metadata := make(http.Header)
	metadata.Set("x-amz-meta-myheader", "myvalue")
	_, err = c.PutObjectWithMetadata(bucketName, "srcObject",
		bytes.NewReader(buf), metadata, nil)
	if err != nil {
		t.Fatal("Put Error:", err)
	}
	if !reflect.DeepEqual(metadata, fetchMeta("srcObject")) {
		t.Fatal("Unequal metadata")
	}

	// 2. create source
	src := NewSourceInfo(bucketName, "srcObject", nil)
	// 2.1 create destination with metadata set
	dst1, err := NewDestinationInfo(bucketName, "dstObject-1", nil, map[string]string{"notmyheader": "notmyvalue"})
	if err != nil {
		t.Fatal("Error:", err)
	}

	// 3. Check that copying to an object with metadata set resets
	// the headers on the copy.
	err = c.CopyObject(dst1, src)
	if err != nil {
		t.Fatal("Error:", err)
	}

	expectedHeaders := make(http.Header)
	expectedHeaders.Set("x-amz-meta-notmyheader", "notmyvalue")
	if !reflect.DeepEqual(expectedHeaders, fetchMeta("dstObject-1")) {
		t.Fatal("Unequal metadata")
	}

	// 4. create destination with no metadata set and same source
	dst2, err := NewDestinationInfo(bucketName, "dstObject-2", nil, nil)
	if err != nil {
		t.Fatal("Error:", err)

	}
	src = NewSourceInfo(bucketName, "srcObject", nil)

	// 5. Check that copying to an object with no metadata set,
	// copies metadata.
	err = c.CopyObject(dst2, src)
	if err != nil {
		t.Fatal("Error:", err)
	}

	expectedHeaders = metadata
	if !reflect.DeepEqual(expectedHeaders, fetchMeta("dstObject-2")) {
		t.Fatal("Unequal metadata")
	}

	// 6. Compose a pair of sources.
	srcs := []SourceInfo{
		NewSourceInfo(bucketName, "srcObject", nil),
		NewSourceInfo(bucketName, "srcObject", nil),
	}
	dst3, err := NewDestinationInfo(bucketName, "dstObject-3", nil, nil)
	if err != nil {
		t.Fatal("Error:", err)

	}

	err = c.ComposeObject(dst3, srcs)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Check that no headers are copied in this case
	if !reflect.DeepEqual(make(http.Header), fetchMeta("dstObject-3")) {
		t.Fatal("Unequal metadata")
	}

	// 7. Compose a pair of sources with dest user metadata set.
	srcs = []SourceInfo{
		NewSourceInfo(bucketName, "srcObject", nil),
		NewSourceInfo(bucketName, "srcObject", nil),
	}
	dst4, err := NewDestinationInfo(bucketName, "dstObject-4", nil, map[string]string{"notmyheader": "notmyvalue"})
	if err != nil {
		t.Fatal("Error:", err)

	}

	err = c.ComposeObject(dst4, srcs)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Check that no headers are copied in this case
	expectedHeaders = make(http.Header)
	expectedHeaders.Set("x-amz-meta-notmyheader", "notmyvalue")
	if !reflect.DeepEqual(expectedHeaders, fetchMeta("dstObject-4")) {
		t.Fatal("Unequal metadata")
	}
}

func TestUserMetadataCopyingV2(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping functional tests for the short runs")
	}

	// Instantiate new minio client object
	c, err := NewV2(
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
