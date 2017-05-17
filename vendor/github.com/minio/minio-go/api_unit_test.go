/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * (C) 2015, 2016, 2017 Minio, Inc.
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
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/minio/minio-go/pkg/credentials"
	"github.com/minio/minio-go/pkg/policy"
)

type customReader struct{}

func (c *customReader) Read(p []byte) (n int, err error) {
	return 0, nil
}

func (c *customReader) Size() (n int64) {
	return 10
}

// Tests getReaderSize() for various Reader types.
func TestGetReaderSize(t *testing.T) {
	var reader io.Reader
	size, err := getReaderSize(reader)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != -1 {
		t.Fatal("Reader shouldn't have any length.")
	}

	bytesReader := bytes.NewReader([]byte("Hello World"))
	size, err = getReaderSize(bytesReader)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != int64(len("Hello World")) {
		t.Fatalf("Reader length doesn't match got: %v, want: %v", size, len("Hello World"))
	}

	size, err = getReaderSize(new(customReader))
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != int64(10) {
		t.Fatalf("Reader length doesn't match got: %v, want: %v", size, 10)
	}

	stringsReader := strings.NewReader("Hello World")
	size, err = getReaderSize(stringsReader)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != int64(len("Hello World")) {
		t.Fatalf("Reader length doesn't match got: %v, want: %v", size, len("Hello World"))
	}

	// Create request channel.
	reqCh := make(chan getRequest, 1)
	// Create response channel.
	resCh := make(chan getResponse, 1)
	// Create done channel.
	doneCh := make(chan struct{})

	objectInfo := ObjectInfo{Size: 10}
	// Create the first request.
	firstReq := getRequest{
		isReadOp:   false, // Perform only a HEAD object to get objectInfo.
		isFirstReq: true,
	}
	// Create the expected response.
	firstRes := getResponse{
		objectInfo: objectInfo,
	}
	// Send the expected response.
	resCh <- firstRes

	// Test setting size on the first request.
	objectReaderFirstReq := newObject(reqCh, resCh, doneCh)
	defer objectReaderFirstReq.Close()
	// Not checking the response here...just that the reader size is correct.
	_, err = objectReaderFirstReq.doGetRequest(firstReq)
	if err != nil {
		t.Fatal("Error:", err)
	}

	// Validate that the reader size is the objectInfo size.
	size, err = getReaderSize(objectReaderFirstReq)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != int64(10) {
		t.Fatalf("Reader length doesn't match got: %d, wanted %d", size, objectInfo.Size)
	}

	fileReader, err := ioutil.TempFile(os.TempDir(), "prefix")
	if err != nil {
		t.Fatal("Error:", err)
	}
	defer fileReader.Close()
	defer os.RemoveAll(fileReader.Name())

	size, err = getReaderSize(fileReader)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size == -1 {
		t.Fatal("Reader length for file cannot be -1.")
	}

	// Verify for standard input, output and error file descriptors.
	size, err = getReaderSize(os.Stdin)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != -1 {
		t.Fatal("Stdin should have length of -1.")
	}
	size, err = getReaderSize(os.Stdout)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != -1 {
		t.Fatal("Stdout should have length of -1.")
	}
	size, err = getReaderSize(os.Stderr)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if size != -1 {
		t.Fatal("Stderr should have length of -1.")
	}
	file, err := os.Open(os.TempDir())
	if err != nil {
		t.Fatal("Error:", err)
	}
	defer file.Close()
	_, err = getReaderSize(file)
	if err == nil {
		t.Fatal("Input file as directory should throw an error.")
	}
}

// Tests valid hosts for location.
func TestValidBucketLocation(t *testing.T) {
	s3Hosts := []struct {
		bucketLocation string
		endpoint       string
	}{
		{"us-east-1", "s3.amazonaws.com"},
		{"unknown", "s3.amazonaws.com"},
		{"ap-southeast-1", "s3-ap-southeast-1.amazonaws.com"},
	}
	for _, s3Host := range s3Hosts {
		endpoint := getS3Endpoint(s3Host.bucketLocation)
		if endpoint != s3Host.endpoint {
			t.Fatal("Error: invalid bucket location", endpoint)
		}
	}
}

// Tests temp file.
func TestTempFile(t *testing.T) {
	tmpFile, err := newTempFile("testing")
	if err != nil {
		t.Fatal("Error:", err)
	}
	fileName := tmpFile.Name()
	// Closing temporary file purges the file.
	err = tmpFile.Close()
	if err != nil {
		t.Fatal("Error:", err)
	}
	st, err := os.Stat(fileName)
	if err != nil && !os.IsNotExist(err) {
		t.Fatal("Error:", err)
	}
	if err == nil && st != nil {
		t.Fatal("Error: file should be deleted and should not exist.")
	}
}

// Tests error response structure.
func TestErrorResponse(t *testing.T) {
	var err error
	err = ErrorResponse{
		Code: "Testing",
	}
	errResp := ToErrorResponse(err)
	if errResp.Code != "Testing" {
		t.Fatal("Type conversion failed, we have an empty struct.")
	}

	// Test http response decoding.
	var httpResponse *http.Response
	// Set empty variables
	httpResponse = nil
	var bucketName, objectName string

	// Should fail with invalid argument.
	err = httpRespToErrorResponse(httpResponse, bucketName, objectName)
	errResp = ToErrorResponse(err)
	if errResp.Code != "InvalidArgument" {
		t.Fatal("Empty response input should return invalid argument.")
	}
}

// Tests signature type.
func TestSignatureType(t *testing.T) {
	clnt := Client{}
	if !clnt.overrideSignerType.IsV4() {
		t.Fatal("Error")
	}
	clnt.overrideSignerType = credentials.SignatureV2
	if !clnt.overrideSignerType.IsV2() {
		t.Fatal("Error")
	}
	if clnt.overrideSignerType.IsV4() {
		t.Fatal("Error")
	}
	clnt.overrideSignerType = credentials.SignatureV4
	if !clnt.overrideSignerType.IsV4() {
		t.Fatal("Error")
	}
}

// Tests bucket policy types.
func TestBucketPolicyTypes(t *testing.T) {
	want := map[string]bool{
		"none":      true,
		"readonly":  true,
		"writeonly": true,
		"readwrite": true,
		"invalid":   false,
	}
	for bucketPolicy, ok := range want {
		if policy.BucketPolicy(bucketPolicy).IsValidBucketPolicy() != ok {
			t.Fatal("Error")
		}
	}
}

// Tests optimal part size.
func TestPartSize(t *testing.T) {
	_, _, _, err := optimalPartInfo(5000000000000000000)
	if err == nil {
		t.Fatal("Error: should fail")
	}
	totalPartsCount, partSize, lastPartSize, err := optimalPartInfo(5497558138880)
	if err != nil {
		t.Fatal("Error: ", err)
	}
	if totalPartsCount != 9103 {
		t.Fatalf("Error: expecting total parts count of 9987: got %v instead", totalPartsCount)
	}
	if partSize != 603979776 {
		t.Fatalf("Error: expecting part size of 550502400: got %v instead", partSize)
	}
	if lastPartSize != 134217728 {
		t.Fatalf("Error: expecting last part size of 241172480: got %v instead", lastPartSize)
	}
	_, partSize, _, err = optimalPartInfo(5000000000)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if partSize != minPartSize {
		t.Fatalf("Error: expecting part size of %v: got %v instead", minPartSize, partSize)
	}
	totalPartsCount, partSize, lastPartSize, err = optimalPartInfo(-1)
	if err != nil {
		t.Fatal("Error:", err)
	}
	if totalPartsCount != 9103 {
		t.Fatalf("Error: expecting total parts count of 9987: got %v instead", totalPartsCount)
	}
	if partSize != 603979776 {
		t.Fatalf("Error: expecting part size of 550502400: got %v instead", partSize)
	}
	if lastPartSize != 134217728 {
		t.Fatalf("Error: expecting last part size of 241172480: got %v instead", lastPartSize)
	}
}
