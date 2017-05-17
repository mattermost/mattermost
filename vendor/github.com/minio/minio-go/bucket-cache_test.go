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
	"encoding/hex"
	"encoding/xml"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"reflect"
	"testing"

	"github.com/minio/minio-go/pkg/credentials"
	"github.com/minio/minio-go/pkg/s3signer"
)

// Test validates `newBucketLocationCache`.
func TestNewBucketLocationCache(t *testing.T) {
	expectedBucketLocationcache := &bucketLocationCache{
		items: make(map[string]string),
	}
	actualBucketLocationCache := newBucketLocationCache()

	if !reflect.DeepEqual(actualBucketLocationCache, expectedBucketLocationcache) {
		t.Errorf("Unexpected return value")
	}
}

// Tests validate bucketLocationCache operations.
func TestBucketLocationCacheOps(t *testing.T) {
	testBucketLocationCache := newBucketLocationCache()
	expectedBucketName := "minio-bucket"
	expectedLocation := "us-east-1"
	testBucketLocationCache.Set(expectedBucketName, expectedLocation)
	actualLocation, ok := testBucketLocationCache.Get(expectedBucketName)
	if !ok {
		t.Errorf("Bucket location cache not set")
	}
	if expectedLocation != actualLocation {
		t.Errorf("Bucket location cache not set to expected value")
	}
	testBucketLocationCache.Delete(expectedBucketName)
	_, ok = testBucketLocationCache.Get(expectedBucketName)
	if ok {
		t.Errorf("Bucket location cache not deleted as expected")
	}
}

// Tests validate http request generation for 'getBucketLocation'.
func TestGetBucketLocationRequest(t *testing.T) {
	// Generates expected http request for getBucketLocation.
	// Used for asserting with the actual request generated.
	createExpectedRequest := func(c *Client, bucketName string, req *http.Request) (*http.Request, error) {
		// Set location query.
		urlValues := make(url.Values)
		urlValues.Set("location", "")

		// Set get bucket location always as path style.
		targetURL := c.endpointURL
		targetURL.Path = path.Join(bucketName, "") + "/"
		targetURL.RawQuery = urlValues.Encode()

		// Get a new HTTP request for the method.
		var err error
		req, err = http.NewRequest("GET", targetURL.String(), nil)
		if err != nil {
			return nil, err
		}

		// Set UserAgent for the request.
		c.setUserAgent(req)

		// Get credentials from the configured credentials provider.
		value, err := c.credsProvider.Get()
		if err != nil {
			return nil, err
		}

		var (
			signerType      = value.SignerType
			accessKeyID     = value.AccessKeyID
			secretAccessKey = value.SecretAccessKey
			sessionToken    = value.SessionToken
		)

		// Custom signer set then override the behavior.
		if c.overrideSignerType != credentials.SignatureDefault {
			signerType = c.overrideSignerType
		}

		// If signerType returned by credentials helper is anonymous,
		// then do not sign regardless of signerType override.
		if value.SignerType == credentials.SignatureAnonymous {
			signerType = credentials.SignatureAnonymous
		}

		// Set sha256 sum for signature calculation only
		// with signature version '4'.
		switch {
		case signerType.IsV4():
			var contentSha256 string
			if c.secure {
				contentSha256 = unsignedPayload
			} else {
				contentSha256 = hex.EncodeToString(sum256([]byte{}))
			}
			req.Header.Set("X-Amz-Content-Sha256", contentSha256)
			req = s3signer.SignV4(*req, accessKeyID, secretAccessKey, sessionToken, "us-east-1")
		case signerType.IsV2():
			req = s3signer.SignV2(*req, accessKeyID, secretAccessKey)
		}

		return req, nil

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
		// data for new client creation.
		info infoForClient
		// error in the output.
		err error
		// flag indicating whether tests should pass.
		shouldPass bool
	}{
		// Client is constructed using the info struct.
		// case with empty location.
		{"my-bucket", info[0], nil, true},
		// case with location set to standard 'us-east-1'.
		{"my-bucket", info[0], nil, true},
		// case with location set to a value different from 'us-east-1'.
		{"my-bucket", info[0], nil, true},

		{"my-bucket", info[1], nil, true},
		{"my-bucket", info[1], nil, true},
		{"my-bucket", info[1], nil, true},

		{"my-bucket", info[2], nil, true},
		{"my-bucket", info[2], nil, true},
		{"my-bucket", info[2], nil, true},

		{"my-bucket", info[3], nil, true},
		{"my-bucket", info[3], nil, true},
		{"my-bucket", info[3], nil, true},

		{"my-bucket", info[4], nil, true},
		{"my-bucket", info[4], nil, true},
		{"my-bucket", info[4], nil, true},

		{"my-bucket", info[5], nil, true},
		{"my-bucket", info[5], nil, true},
		{"my-bucket", info[5], nil, true},

		{"my-bucket", info[6], nil, true},
		{"my-bucket", info[6], nil, true},
		{"my-bucket", info[6], nil, true},

		{"my-bucket", info[7], nil, true},
		{"my-bucket", info[7], nil, true},
		{"my-bucket", info[7], nil, true},

		{"my-bucket", info[8], nil, true},
		{"my-bucket", info[8], nil, true},
		{"my-bucket", info[8], nil, true},

		{"my-bucket", info[9], nil, true},
		{"my-bucket", info[9], nil, true},
		{"my-bucket", info[9], nil, true},

		{"my-bucket", info[10], nil, true},
		{"my-bucket", info[10], nil, true},
		{"my-bucket", info[10], nil, true},

		{"my-bucket", info[11], nil, true},
		{"my-bucket", info[11], nil, true},
		{"my-bucket", info[11], nil, true},
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

		actualReq, err := client.getBucketLocationRequest(testCase.bucketName)
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
			expectedReq, err = createExpectedRequest(client, testCase.bucketName, expectedReq)
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
		}
	}
}

// generates http response with bucket location set in the body.
func generateLocationResponse(resp *http.Response, bodyContent []byte) (*http.Response, error) {
	resp.StatusCode = http.StatusOK
	resp.Body = ioutil.NopCloser(bytes.NewBuffer(bodyContent))
	return resp, nil
}

// Tests the processing of GetPolicy response from server.
func TestProcessBucketLocationResponse(t *testing.T) {
	// LocationResponse - format for location response.
	type LocationResponse struct {
		XMLName  xml.Name `xml:"http://s3.amazonaws.com/doc/2006-03-01/ LocationConstraint" json:"-"`
		Location string   `xml:",chardata"`
	}

	APIErrors := []APIError{
		{
			Code:           "AccessDenied",
			Description:    "Access Denied",
			HTTPStatusCode: http.StatusUnauthorized,
		},
	}
	testCases := []struct {
		bucketName    string
		inputLocation string
		isAPIError    bool
		apiErr        APIError
		// expected results.
		expectedResult string
		err            error
		// flag indicating whether tests should pass.
		shouldPass bool
	}{
		{"my-bucket", "", true, APIErrors[0], "us-east-1", nil, true},
		{"my-bucket", "", false, APIError{}, "us-east-1", nil, true},
		{"my-bucket", "EU", false, APIError{}, "eu-west-1", nil, true},
		{"my-bucket", "eu-central-1", false, APIError{}, "eu-central-1", nil, true},
		{"my-bucket", "us-east-1", false, APIError{}, "us-east-1", nil, true},
	}

	for i, testCase := range testCases {
		inputResponse := &http.Response{}
		var err error
		if testCase.isAPIError {
			inputResponse = generateErrorResponse(inputResponse, testCase.apiErr, testCase.bucketName)
		} else {
			inputResponse, err = generateLocationResponse(inputResponse, encodeResponse(LocationResponse{
				Location: testCase.inputLocation,
			}))
			if err != nil {
				t.Fatalf("Test %d: Creation of valid response failed", i+1)
			}
		}
		actualResult, err := processBucketLocationResponse(inputResponse, "my-bucket")
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
		if err == nil && testCase.shouldPass {
			if !reflect.DeepEqual(testCase.expectedResult, actualResult) {
				t.Errorf("Test %d: The expected BucketPolicy doesn't match the actual BucketPolicy", i+1)
			}
		}
	}
}
