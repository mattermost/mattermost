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
	"net/url"
	"testing"
	"time"
)

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

// Tests for 'isValidDomain(host string) bool'.
func TestIsValidDomain(t *testing.T) {
	testCases := []struct {
		// Input.
		host string
		// Expected result.
		result bool
	}{
		{"s3.amazonaws.com", true},
		{"s3.cn-north-1.amazonaws.com.cn", true},
		{"s3.amazonaws.com_", false},
		{"%$$$", false},
		{"s3.amz.test.com", true},
		{"s3.%%", false},
		{"localhost", true},
		{"-localhost", false},
		{"", false},
		{"\n \t", false},
		{"   ", false},
	}

	for i, testCase := range testCases {
		result := isValidDomain(testCase.host)
		if testCase.result != result {
			t.Errorf("Test %d: Expected isValidDomain test to be '%v', but found '%v' instead", i+1, testCase.result, result)
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
		err := isValidEndpointURL(testCase.url)
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

// Tests validate IP address validator.
func TestIsValidIP(t *testing.T) {
	testCases := []struct {
		// Input.
		ip string
		// Expected result.
		result bool
	}{
		{"192.168.1.1", true},
		{"192.168.1", false},
		{"192.168.1.1.1", false},
		{"-192.168.1.1", false},
		{"260.192.1.1", false},
	}

	for i, testCase := range testCases {
		result := isValidIP(testCase.ip)
		if testCase.result != result {
			t.Errorf("Test %d: Expected isValidIP to be '%v' for input \"%s\", but found it to be '%v' instead", i+1, testCase.result, testCase.ip, result)
		}
	}

}

// Tests validate virtual host validator.
func TestIsVirtualHostSupported(t *testing.T) {
	testCases := []struct {
		url    string
		bucket string
		// Expeceted result.
		result bool
	}{
		{"https://s3.amazonaws.com", "my-bucket", true},
		{"https://s3.cn-north-1.amazonaws.com.cn", "my-bucket", true},
		{"https://s3.amazonaws.com", "my-bucket.", false},
		{"https://amazons3.amazonaws.com", "my-bucket.", false},
		{"https://storage.googleapis.com/", "my-bucket", true},
		{"https://mystorage.googleapis.com/", "my-bucket", false},
	}

	for i, testCase := range testCases {
		result := isVirtualHostSupported(testCase.url, testCase.bucket)
		if testCase.result != result {
			t.Errorf("Test %d: Expected isVirtualHostSupported to be '%v' for input url \"%s\" and bucket \"%s\", but found it to be '%v' instead", i+1, testCase.result, testCase.url, testCase.bucket, result)
		}
	}
}

// Tests validate Amazon endpoint validator.
func TestIsAmazonEndpoint(t *testing.T) {
	testCases := []struct {
		url string
		// Expected result.
		result bool
	}{
		{"https://192.168.1.1", false},
		{"192.168.1.1", false},
		{"http://storage.googleapis.com", false},
		{"https://storage.googleapis.com", false},
		{"storage.googleapis.com", false},
		{"s3.amazonaws.com", false},
		{"https://amazons3.amazonaws.com", false},
		{"-192.168.1.1", false},
		{"260.192.1.1", false},
		// valid inputs.
		{"https://s3.amazonaws.com", true},
		{"https://s3.cn-north-1.amazonaws.com.cn", true},
	}

	for i, testCase := range testCases {
		result := isAmazonEndpoint(testCase.url)
		if testCase.result != result {
			t.Errorf("Test %d: Expected isAmazonEndpoint to be '%v' for input \"%s\", but found it to be '%v' instead", i+1, testCase.result, testCase.url, result)
		}
	}

}

// Tests validate Amazon S3 China endpoint validator.
func TestIsAmazonChinaEndpoint(t *testing.T) {
	testCases := []struct {
		url string
		// Expected result.
		result bool
	}{
		{"https://192.168.1.1", false},
		{"192.168.1.1", false},
		{"http://storage.googleapis.com", false},
		{"https://storage.googleapis.com", false},
		{"storage.googleapis.com", false},
		{"s3.amazonaws.com", false},
		{"https://amazons3.amazonaws.com", false},
		{"-192.168.1.1", false},
		{"260.192.1.1", false},
		// s3.amazonaws.com is not a valid Amazon S3 China end point.
		{"https://s3.amazonaws.com", false},
		// valid input.
		{"https://s3.cn-north-1.amazonaws.com.cn", true},
	}

	for i, testCase := range testCases {
		result := isAmazonChinaEndpoint(testCase.url)
		if testCase.result != result {
			t.Errorf("Test %d: Expected isAmazonEndpoint to be '%v' for input \"%s\", but found it to be '%v' instead", i+1, testCase.result, testCase.url, result)
		}
	}

}

// Tests validate Google Cloud end point validator.
func TestIsGoogleEndpoint(t *testing.T) {
	testCases := []struct {
		url string
		// Expected result.
		result bool
	}{
		{"192.168.1.1", false},
		{"https://192.168.1.1", false},
		{"s3.amazonaws.com", false},
		{"http://s3.amazonaws.com", false},
		{"https://s3.amazonaws.com", false},
		{"https://s3.cn-north-1.amazonaws.com.cn", false},
		{"-192.168.1.1", false},
		{"260.192.1.1", false},
		// valid inputs.
		{"http://storage.googleapis.com", true},
		{"https://storage.googleapis.com", true},
	}

	for i, testCase := range testCases {
		result := isGoogleEndpoint(testCase.url)
		if testCase.result != result {
			t.Errorf("Test %d: Expected isGoogleEndpoint to be '%v' for input \"%s\", but found it to be '%v' instead", i+1, testCase.result, testCase.url, result)
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

func TestPercentEncodeSlash(t *testing.T) {
	testCases := []struct {
		input  string
		output string
	}{
		{"test123", "test123"},
		{"abc,+_1", "abc,+_1"},
		{"%40prefix=test%40123", "%40prefix=test%40123"},
		{"key1=val1/val2", "key1=val1%2Fval2"},
		{"%40prefix=test%40123/", "%40prefix=test%40123%2F"},
	}

	for i, testCase := range testCases {
		receivedOutput := percentEncodeSlash(testCase.input)
		if testCase.output != receivedOutput {
			t.Errorf(
				"Test %d: Input: \"%s\" --> Expected percentEncodeSlash to return \"%s\", but it returned \"%s\" instead!",
				i+1, testCase.input, testCase.output,
				receivedOutput,
			)

		}
	}
}

// Tests validate the query encoder.
func TestQueryEncode(t *testing.T) {
	testCases := []struct {
		queryKey      string
		valueToEncode []string
		// Expected result.
		result string
	}{
		{"prefix", []string{"test@123", "test@456"}, "prefix=test%40123&prefix=test%40456"},
		{"@prefix", []string{"test@123"}, "%40prefix=test%40123"},
		{"@prefix", []string{"a/b/c/"}, "%40prefix=a%2Fb%2Fc%2F"},
		{"prefix", []string{"test#123"}, "prefix=test%23123"},
		{"prefix#", []string{"test#123"}, "prefix%23=test%23123"},
		{"prefix", []string{"test123"}, "prefix=test123"},
		{"prefix", []string{"test本語123", "test123"}, "prefix=test%E6%9C%AC%E8%AA%9E123&prefix=test123"},
	}

	for i, testCase := range testCases {
		urlValues := make(url.Values)
		for _, valueToEncode := range testCase.valueToEncode {
			urlValues.Add(testCase.queryKey, valueToEncode)
		}
		result := queryEncode(urlValues)
		if testCase.result != result {
			t.Errorf("Test %d: Expected queryEncode result to be \"%s\", but found it to be \"%s\" instead", i+1, testCase.result, result)
		}
	}
}

// Tests validate the URL path encoder.
func TestUrlEncodePath(t *testing.T) {
	testCases := []struct {
		// Input.
		inputStr string
		// Expected result.
		result string
	}{
		{"thisisthe%url", "thisisthe%25url"},
		{"本語", "%E6%9C%AC%E8%AA%9E"},
		{"本語.1", "%E6%9C%AC%E8%AA%9E.1"},
		{">123", "%3E123"},
		{"myurl#link", "myurl%23link"},
		{"space in url", "space%20in%20url"},
		{"url+path", "url%2Bpath"},
	}

	for i, testCase := range testCases {
		result := urlEncodePath(testCase.inputStr)
		if testCase.result != result {
			t.Errorf("Test %d: Expected queryEncode result to be \"%s\", but found it to be \"%s\" instead", i+1, testCase.result, result)
		}
	}
}
