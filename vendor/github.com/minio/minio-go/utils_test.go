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
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"
)

// Tests filter header function by filtering out
// some custom header keys.
func TestFilterHeader(t *testing.T) {
	header := http.Header{}
	header.Set("Content-Type", "binary/octet-stream")
	header.Set("Content-Encoding", "gzip")
	newHeader := filterHeader(header, []string{"Content-Type"})
	if len(newHeader) > 1 {
		t.Fatalf("Unexpected size of the returned header, should be 1, got %d", len(newHeader))
	}
	if newHeader.Get("Content-Encoding") != "gzip" {
		t.Fatalf("Unexpected content-encoding value, expected 'gzip', got %s", newHeader.Get("Content-Encoding"))
	}
}

// Tests for 'getEndpointURL(endpoint string, inSecure bool)'.
func TestGetEndpointURL(t *testing.T) {
	testCases := []struct {
		// Inputs.
		endPoint string
		secure   bool

		// Expected result.
		result string
		err    error
		// Flag indicating whether the test is expected to pass or not.
		shouldPass bool
	}{
		{"s3.amazonaws.com", true, "https://s3.amazonaws.com", nil, true},
		{"s3.cn-north-1.amazonaws.com.cn", true, "https://s3.cn-north-1.amazonaws.com.cn", nil, true},
		{"s3.amazonaws.com", false, "http://s3.amazonaws.com", nil, true},
		{"s3.cn-north-1.amazonaws.com.cn", false, "http://s3.cn-north-1.amazonaws.com.cn", nil, true},
		{"192.168.1.1:9000", false, "http://192.168.1.1:9000", nil, true},
		{"192.168.1.1:9000", true, "https://192.168.1.1:9000", nil, true},
		{"192.168.1.1::9000", false, "", fmt.Errorf("too many colons in address %s", "192.168.1.1::9000"), false},
		{"13333.123123.-", true, "", fmt.Errorf("Endpoint: %s does not follow ip address or domain name standards.", "13333.123123.-"), false},
		{"13333.123123.-", true, "", fmt.Errorf("Endpoint: %s does not follow ip address or domain name standards.", "13333.123123.-"), false},
		{"s3.amazonaws.com:443", true, "", fmt.Errorf("Amazon S3 endpoint should be 's3.amazonaws.com'."), false},
		{"storage.googleapis.com:4000", true, "", fmt.Errorf("Google Cloud Storage endpoint should be 'storage.googleapis.com'."), false},
		{"s3.aamzza.-", true, "", fmt.Errorf("Endpoint: %s does not follow ip address or domain name standards.", "s3.aamzza.-"), false},
		{"", true, "", fmt.Errorf("Endpoint:  does not follow ip address or domain name standards."), false},
	}

	for i, testCase := range testCases {
		result, err := getEndpointURL(testCase.endPoint, testCase.secure)
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
			if testCase.result != result.String() {
				t.Errorf("Test %d: Expected the result Url to be \"%s\", but found \"%s\" instead", i+1, testCase.result, result.String())
			}
		}
	}
}

// Tests validate end point validator.
func TestIsValidEndpointURL(t *testing.T) {
	testCases := []struct {
		url string
		err error
		// Flag indicating whether the test is expected to pass or not.
		shouldPass bool
	}{
		{"", fmt.Errorf("Endpoint url cannot be empty."), false},
		{"/", nil, true},
		{"https://s3.am1;4205;0cazonaws.com", nil, true},
		{"https://s3.cn-north-1.amazonaws.com.cn", nil, true},
		{"https://s3.amazonaws.com/", nil, true},
		{"https://storage.googleapis.com/", nil, true},
		{"192.168.1.1", fmt.Errorf("Endpoint url cannot have fully qualified paths."), false},
		{"https://amazon.googleapis.com/", fmt.Errorf("Google Cloud Storage endpoint should be 'storage.googleapis.com'."), false},
		{"https://storage.googleapis.com/bucket/", fmt.Errorf("Endpoint url cannot have fully qualified paths."), false},
		{"https://z3.amazonaws.com", fmt.Errorf("Amazon S3 endpoint should be 's3.amazonaws.com'."), false},
		{"https://s3.amazonaws.com/bucket/object", fmt.Errorf("Endpoint url cannot have fully qualified paths."), false},
	}

	for i, testCase := range testCases {
		var u url.URL
		if testCase.url == "" {
			u = sentinelURL
		} else {
			u1, err := url.Parse(testCase.url)
			if err != nil {
				t.Errorf("Test %d: Expected to pass, but failed with: <ERROR> %s", i+1, err)
			}
			u = *u1
		}
		err := isValidEndpointURL(u)
		if err != nil && testCase.shouldPass {
			t.Errorf("Test %d: Expected to pass, but failed with: <ERROR> %s", i+1, err)
		}
		if err == nil && !testCase.shouldPass {
			t.Errorf("Test %d: Expected to fail with <ERROR> \"%s\", but passed instead", i+1, testCase.err)
		}
		// Failed as expected, but does it fail for the expected reason.
		if err != nil && !testCase.shouldPass {
			if err.Error() != testCase.err.Error() {
				t.Errorf("Test %d: Expected to fail with error \"%s\", but instead failed with error \"%s\" instead", i+1, testCase.err, err)
			}
		}

	}
}

// Tests validate the expiry time validator.
func TestIsValidExpiry(t *testing.T) {
	testCases := []struct {
		// Input.
		duration time.Duration
		// Expected result.
		err error
		// Flag to indicate whether the test should pass.
		shouldPass bool
	}{
		{100 * time.Millisecond, fmt.Errorf("Expires cannot be lesser than 1 second."), false},
		{604801 * time.Second, fmt.Errorf("Expires cannot be greater than 7 days."), false},
		{0 * time.Second, fmt.Errorf("Expires cannot be lesser than 1 second."), false},
		{1 * time.Second, nil, true},
		{10000 * time.Second, nil, true},
		{999 * time.Second, nil, true},
	}

	for i, testCase := range testCases {
		err := isValidExpiry(testCase.duration)
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

	}
}

// Tests validate the bucket name validator.
func TestIsValidBucketName(t *testing.T) {
	testCases := []struct {
		// Input.
		bucketName string
		// Expected result.
		err error
		// Flag to indicate whether test should Pass.
		shouldPass bool
	}{
		{".mybucket", ErrInvalidBucketName("Bucket name cannot start or end with a '.' dot."), false},
		{"mybucket.", ErrInvalidBucketName("Bucket name cannot start or end with a '.' dot."), false},
		{"mybucket-", ErrInvalidBucketName("Bucket name contains invalid characters."), false},
		{"my", ErrInvalidBucketName("Bucket name cannot be smaller than 3 characters."), false},
		{"", ErrInvalidBucketName("Bucket name cannot be empty."), false},
		{"my..bucket", ErrInvalidBucketName("Bucket name cannot have successive periods."), false},
		{"my.bucket.com", nil, true},
		{"my-bucket", nil, true},
		{"123my-bucket", nil, true},
	}

	for i, testCase := range testCases {
		err := isValidBucketName(testCase.bucketName)
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

	}

}
