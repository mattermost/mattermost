/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2015, 2016 Minio, Inc.
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
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"io"
	"io/ioutil"
	"net/http"
	"path"
	"testing"

	"github.com/minio/minio-go/pkg/s3signer"
)

// Tests validate http request formulated for creation of bucket.
func TestMakeBucketRequest(t *testing.T) {
	// Generates expected http request for bucket creation.
	// Used for asserting with the actual request generated.
	createExpectedRequest := func(c *Client, bucketName string, location string, req *http.Request) (*http.Request, error) {
		targetURL := c.endpointURL
		targetURL.Path = path.Join(bucketName, "") + "/"

		// get a new HTTP request for the method.
		var err error
		req, err = http.NewRequest("PUT", targetURL.String(), nil)
		if err != nil {
			return nil, err
		}

		// set UserAgent for the request.
		c.setUserAgent(req)

		// set sha256 sum for signature calculation only with signature version '4'.
		if c.signature.isV4() {
			req.Header.Set("X-Amz-Content-Sha256", hex.EncodeToString(sum256([]byte{})))
		}

		// If location is not 'us-east-1' create bucket location config.
		if location != "us-east-1" && location != "" {
			createBucketConfig := createBucketConfiguration{}
			createBucketConfig.Location = location
			var createBucketConfigBytes []byte
			createBucketConfigBytes, err = xml.Marshal(createBucketConfig)
			if err != nil {
				return nil, err
			}
			createBucketConfigBuffer := bytes.NewBuffer(createBucketConfigBytes)
			req.Body = ioutil.NopCloser(createBucketConfigBuffer)
			req.ContentLength = int64(len(createBucketConfigBytes))
			// Set content-md5.
			req.Header.Set("Content-Md5", base64.StdEncoding.EncodeToString(sumMD5(createBucketConfigBytes)))
			if c.signature.isV4() {
				// Set sha256.
				req.Header.Set("X-Amz-Content-Sha256", hex.EncodeToString(sum256(createBucketConfigBytes)))
			}
		}

		// Sign the request.
		if c.signature.isV4() {
			// Signature calculated for MakeBucket request should be for 'us-east-1',
			// regardless of the bucket's location constraint.
			req = s3signer.SignV4(*req, c.accessKeyID, c.secretAccessKey, "us-east-1")
		} else if c.signature.isV2() {
			req = s3signer.SignV2(*req, c.accessKeyID, c.secretAccessKey)
		}

		// Return signed request.
		return req, nil
	}

	// Get Request body.
	getReqBody := func(reqBody io.ReadCloser) (string, error) {
		contents, err := ioutil.ReadAll(reqBody)
		if err != nil {
			return "", err
		}
		return string(contents), nil
	}

	// Info for 'Client' creation.
	// Will be used as arguments for 'NewClient'.
	type infoForClient struct {
		endPoint       string
		accessKey      string
		secretKey      string
		enableInsecure bool
	}
	// dataset for 'NewClient' call.
	info := []infoForClient{
		// endpoint localhost.
		// both access-key and secret-key are empty.
		{"localhost:9000", "", "", false},
		// both access-key are secret-key exists.
		{"localhost:9000", "my-access-key", "my-secret-key", false},
		// one of acess-key and secret-key are empty.
		{"localhost:9000", "", "my-secret-key", false},

		// endpoint amazon s3.
		{"s3.amazonaws.com", "", "", false},
		{"s3.amazonaws.com", "my-access-key", "my-secret-key", false},
		{"s3.amazonaws.com", "my-acess-key", "", false},

		// endpoint google cloud storage.
		{"storage.googleapis.com", "", "", false},
		{"storage.googleapis.com", "my-access-key", "my-secret-key", false},
		{"storage.googleapis.com", "", "my-secret-key", false},

		// endpoint custom domain running Minio server.
		{"play.minio.io", "", "", false},
		{"play.minio.io", "my-access-key", "my-secret-key", false},
		{"play.minio.io", "my-acess-key", "", false},
	}

	testCases := []struct {
		bucketName string
		location   string
		// data for new client creation.
		info infoForClient
		// error in the output.
		err error
		// flag indicating whether tests should pass.
		shouldPass bool
	}{
		// Test cases with Invalid bucket name.
		{".mybucket", "", infoForClient{}, ErrInvalidBucketName("Bucket name cannot start or end with a '.' dot."), false},
		{"mybucket.", "", infoForClient{}, ErrInvalidBucketName("Bucket name cannot start or end with a '.' dot."), false},
		{"mybucket-", "", infoForClient{}, ErrInvalidBucketName("Bucket name contains invalid characters."), false},
		{"my", "", infoForClient{}, ErrInvalidBucketName("Bucket name cannot be smaller than 3 characters."), false},
		{"", "", infoForClient{}, ErrInvalidBucketName("Bucket name cannot be empty."), false},
		{"my..bucket", "", infoForClient{}, ErrInvalidBucketName("Bucket name cannot have successive periods."), false},

		// Test case with all valid values for S3 bucket location.
		// Client is constructed using the info struct.
		// case with empty location.
		{"my-bucket", "", info[0], nil, true},
		// case with location set to standard 'us-east-1'.
		{"my-bucket", "us-east-1", info[0], nil, true},
		// case with location set to a value different from 'us-east-1'.
		{"my-bucket", "eu-central-1", info[0], nil, true},

		{"my-bucket", "", info[1], nil, true},
		{"my-bucket", "us-east-1", info[1], nil, true},
		{"my-bucket", "eu-central-1", info[1], nil, true},

		{"my-bucket", "", info[2], nil, true},
		{"my-bucket", "us-east-1", info[2], nil, true},
		{"my-bucket", "eu-central-1", info[2], nil, true},

		{"my-bucket", "", info[3], nil, true},
		{"my-bucket", "us-east-1", info[3], nil, true},
		{"my-bucket", "eu-central-1", info[3], nil, true},

		{"my-bucket", "", info[4], nil, true},
		{"my-bucket", "us-east-1", info[4], nil, true},
		{"my-bucket", "eu-central-1", info[4], nil, true},

		{"my-bucket", "", info[5], nil, true},
		{"my-bucket", "us-east-1", info[5], nil, true},
		{"my-bucket", "eu-central-1", info[5], nil, true},

		{"my-bucket", "", info[6], nil, true},
		{"my-bucket", "us-east-1", info[6], nil, true},
		{"my-bucket", "eu-central-1", info[6], nil, true},

		{"my-bucket", "", info[7], nil, true},
		{"my-bucket", "us-east-1", info[7], nil, true},
		{"my-bucket", "eu-central-1", info[7], nil, true},

		{"my-bucket", "", info[8], nil, true},
		{"my-bucket", "us-east-1", info[8], nil, true},
		{"my-bucket", "eu-central-1", info[8], nil, true},

		{"my-bucket", "", info[9], nil, true},
		{"my-bucket", "us-east-1", info[9], nil, true},
		{"my-bucket", "eu-central-1", info[9], nil, true},

		{"my-bucket", "", info[10], nil, true},
		{"my-bucket", "us-east-1", info[10], nil, true},
		{"my-bucket", "eu-central-1", info[10], nil, true},

		{"my-bucket", "", info[11], nil, true},
		{"my-bucket", "us-east-1", info[11], nil, true},
		{"my-bucket", "eu-central-1", info[11], nil, true},
	}

	for i, testCase := range testCases {
		// cannot create a newclient with empty endPoint value.
		// validates and creates a new client only if the endPoint value is not empty.
		client := &Client{}
		var err error
		if testCase.info.endPoint != "" {

			client, err = New(testCase.info.endPoint, testCase.info.accessKey, testCase.info.secretKey, testCase.info.enableInsecure)
			if err != nil {
				t.Fatalf("Test %d: Failed to create new Client: %s", i+1, err.Error())
			}
		}

		actualReq, err := client.makeBucketRequest(testCase.bucketName, testCase.location)
		if err != nil && testCase.shouldPass {
			t.Errorf("Test %d: Expected to pass, but failed with: <ERROR> %s", i+1, err.Error())
		}
		if err == nil && !testCase.shouldPass {
			t.Errorf("Test %d: Expected to fail with <ERROR> \"%s\", but passed instead", i+1, testCase.err.Error())
		}
		// Failed as expected, but does it fail for the expected reason.
		if err != nil && !testCase.shouldPass {
			if err.Error() != testCase.err.Error() {
				t.Errorf("Test %d: Expected to fail with error \"%s\", but instead failed with error \"%s\" instead", i+1, testCase.err.Error(), err.Error())
			}
		}

		// Test passes as expected, but the output values are verified for correctness here.
		if err == nil && testCase.shouldPass {
			expectedReq := &http.Request{}
			expectedReq, err = createExpectedRequest(client, testCase.bucketName, testCase.location, expectedReq)
			if err != nil {
				t.Fatalf("Test %d: Expected request Creation failed", i+1)
			}
			if expectedReq.Method != actualReq.Method {
				t.Errorf("Test %d: The expected Request method doesn't match with the actual one", i+1)
			}
			if expectedReq.URL.String() != actualReq.URL.String() {
				t.Errorf("Test %d: Expected the request URL to be '%s', but instead found '%s'", i+1, expectedReq.URL.String(), actualReq.URL.String())
			}
			if expectedReq.ContentLength != actualReq.ContentLength {
				t.Errorf("Test %d: Expected the request body Content-Length to be '%d', but found '%d' instead", i+1, expectedReq.ContentLength, actualReq.ContentLength)
			}

			if expectedReq.Header.Get("X-Amz-Content-Sha256") != actualReq.Header.Get("X-Amz-Content-Sha256") {
				t.Errorf("Test %d: 'X-Amz-Content-Sha256' header of the expected request doesn't match with that of the actual request", i+1)
			}
			if expectedReq.Header.Get("User-Agent") != actualReq.Header.Get("User-Agent") {
				t.Errorf("Test %d: Expected 'User-Agent' header to be \"%s\",but found \"%s\" instead", i+1, expectedReq.Header.Get("User-Agent"), actualReq.Header.Get("User-Agent"))
			}

			if testCase.location != "us-east-1" && testCase.location != "" {
				expectedContent, err := getReqBody(expectedReq.Body)
				if err != nil {
					t.Fatalf("Test %d: Coudln't parse request body", i+1)
				}
				actualContent, err := getReqBody(actualReq.Body)
				if err != nil {
					t.Fatalf("Test %d: Coudln't parse request body", i+1)
				}
				if expectedContent != actualContent {
					t.Errorf("Test %d: Expected request body doesn't match actual content body", i+1)
				}
				if expectedReq.Header.Get("Content-Md5") != actualReq.Header.Get("Content-Md5") {
					t.Errorf("Test %d: Request body Md5 differs from the expected result", i+1)
				}
			}
		}
	}
}
