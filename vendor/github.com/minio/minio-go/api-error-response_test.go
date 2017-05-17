/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2015 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required bZy applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package minio

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"net/http"
	"reflect"
	"strconv"
	"testing"
)

// Tests validate the Error generator function for http response with error.
func TestHttpRespToErrorResponse(t *testing.T) {
	// 'genAPIErrorResponse' generates ErrorResponse for given APIError.
	// provides a encodable populated response values.
	genAPIErrorResponse := func(err APIError, bucketName string) ErrorResponse {
		var errResp = ErrorResponse{}
		errResp.Code = err.Code
		errResp.Message = err.Description
		errResp.BucketName = bucketName
		return errResp
	}

	// Encodes the response headers into XML format.
	encodeErr := func(response interface{}) []byte {
		var bytesBuffer bytes.Buffer
		bytesBuffer.WriteString(xml.Header)
		encode := xml.NewEncoder(&bytesBuffer)
		encode.Encode(response)
		return bytesBuffer.Bytes()
	}

	// `createAPIErrorResponse` Mocks XML error response from the server.
	createAPIErrorResponse := func(APIErr APIError, bucketName string) *http.Response {
		// generate error response.
		// response body contains the XML error message.
		resp := &http.Response{}
		errorResponse := genAPIErrorResponse(APIErr, bucketName)
		encodedErrorResponse := encodeErr(errorResponse)
		// write Header.
		resp.StatusCode = APIErr.HTTPStatusCode
		resp.Body = ioutil.NopCloser(bytes.NewBuffer(encodedErrorResponse))

		return resp
	}

	// 'genErrResponse' contructs error response based http Status Code
	genErrResponse := func(resp *http.Response, code, message, bucketName, objectName string) ErrorResponse {
		errResp := ErrorResponse{
			Code:       code,
			Message:    message,
			BucketName: bucketName,
			Key:        objectName,
			RequestID:  resp.Header.Get("x-amz-request-id"),
			HostID:     resp.Header.Get("x-amz-id-2"),
			Region:     resp.Header.Get("x-amz-bucket-region"),
			Headers:    resp.Header,
		}
		return errResp
	}

	// Generate invalid argument error.
	genInvalidError := func(message string) error {
		errResp := ErrorResponse{
			Code:      "InvalidArgument",
			Message:   message,
			RequestID: "minio",
		}
		return errResp
	}

	// Set common http response headers.
	setCommonHeaders := func(resp *http.Response) *http.Response {
		// set headers.
		resp.Header = make(http.Header)
		resp.Header.Set("x-amz-request-id", "xyz")
		resp.Header.Set("x-amz-id-2", "abc")
		resp.Header.Set("x-amz-bucket-region", "us-east-1")
		return resp
	}

	// Generate http response with empty body.
	// Set the StatusCode to the argument supplied.
	// Sets common headers.
	genEmptyBodyResponse := func(statusCode int) *http.Response {
		resp := &http.Response{}
		// set empty response body.
		resp.Body = ioutil.NopCloser(bytes.NewBuffer([]byte("")))
		// set headers.
		setCommonHeaders(resp)
		// set status code.
		resp.StatusCode = statusCode
		return resp
	}

	// Decode XML error message from the http response body.
	decodeXMLError := func(resp *http.Response, t *testing.T) error {
		var errResp ErrorResponse
		err := xmlDecoder(resp.Body, &errResp)
		if err != nil {
			t.Fatal("XML decoding of response body failed")
		}
		return errResp
	}

	// List of APIErrors used to generate/mock server side XML error response.
	APIErrors := []APIError{
		{
			Code:           "NoSuchBucketPolicy",
			Description:    "The specified bucket does not have a bucket policy.",
			HTTPStatusCode: http.StatusNotFound,
		},
	}

	// List of expected response.
	// Used for asserting the actual response.
	expectedErrResponse := []error{
		genInvalidError("Response is empty. " + "Please report this issue at https://github.com/minio/minio-go/issues."),
		decodeXMLError(createAPIErrorResponse(APIErrors[0], "minio-bucket"), t),
		genErrResponse(setCommonHeaders(&http.Response{}), "NoSuchBucket", "The specified bucket does not exist.", "minio-bucket", ""),
		genErrResponse(setCommonHeaders(&http.Response{}), "NoSuchKey", "The specified key does not exist.", "minio-bucket", "Asia/"),
		genErrResponse(setCommonHeaders(&http.Response{}), "AccessDenied", "Access Denied.", "minio-bucket", ""),
		genErrResponse(setCommonHeaders(&http.Response{}), "Conflict", "Bucket not empty.", "minio-bucket", ""),
		genErrResponse(setCommonHeaders(&http.Response{}), "Bad Request", "Bad Request", "minio-bucket", ""),
	}

	// List of http response to be used as input.
	inputResponses := []*http.Response{
		nil,
		createAPIErrorResponse(APIErrors[0], "minio-bucket"),
		genEmptyBodyResponse(http.StatusNotFound),
		genEmptyBodyResponse(http.StatusNotFound),
		genEmptyBodyResponse(http.StatusForbidden),
		genEmptyBodyResponse(http.StatusConflict),
		genEmptyBodyResponse(http.StatusBadRequest),
	}

	testCases := []struct {
		bucketName    string
		objectName    string
		inputHTTPResp *http.Response
		// expected results.
		expectedResult error
		// flag indicating whether tests should pass.

	}{
		{"minio-bucket", "", inputResponses[0], expectedErrResponse[0]},
		{"minio-bucket", "", inputResponses[1], expectedErrResponse[1]},
		{"minio-bucket", "", inputResponses[2], expectedErrResponse[2]},
		{"minio-bucket", "Asia/", inputResponses[3], expectedErrResponse[3]},
		{"minio-bucket", "", inputResponses[4], expectedErrResponse[4]},
		{"minio-bucket", "", inputResponses[5], expectedErrResponse[5]},
	}

	for i, testCase := range testCases {
		actualResult := httpRespToErrorResponse(testCase.inputHTTPResp, testCase.bucketName, testCase.objectName)
		if !reflect.DeepEqual(testCase.expectedResult, actualResult) {
			t.Errorf("Test %d: Expected result to be '%#v', but instead got '%#v'", i+1, testCase.expectedResult, actualResult)
		}
	}
}

// Test validates 'ErrEntityTooLarge' error response.
func TestErrEntityTooLarge(t *testing.T) {
	msg := fmt.Sprintf("Your proposed upload size ‘%d’ exceeds the maximum allowed object size ‘%d’ for single PUT operation.", 1000000, 99999)
	expectedResult := ErrorResponse{
		Code:       "EntityTooLarge",
		Message:    msg,
		BucketName: "minio-bucket",
		Key:        "Asia/",
	}
	actualResult := ErrEntityTooLarge(1000000, 99999, "minio-bucket", "Asia/")
	if !reflect.DeepEqual(expectedResult, actualResult) {
		t.Errorf("Expected result to be '%+v', but instead got '%+v'", expectedResult, actualResult)
	}
}

// Test validates 'ErrEntityTooSmall' error response.
func TestErrEntityTooSmall(t *testing.T) {
	msg := fmt.Sprintf("Your proposed upload size ‘%d’ is below the minimum allowed object size '0B' for single PUT operation.", -1)
	expectedResult := ErrorResponse{
		Code:       "EntityTooLarge",
		Message:    msg,
		BucketName: "minio-bucket",
		Key:        "Asia/",
	}
	actualResult := ErrEntityTooSmall(-1, "minio-bucket", "Asia/")
	if !reflect.DeepEqual(expectedResult, actualResult) {
		t.Errorf("Expected result to be '%+v', but instead got '%+v'", expectedResult, actualResult)
	}
}

// Test validates 'ErrUnexpectedEOF' error response.
func TestErrUnexpectedEOF(t *testing.T) {
	msg := fmt.Sprintf("Data read ‘%s’ is not equal to the size ‘%s’ of the input Reader.",
		strconv.FormatInt(100, 10), strconv.FormatInt(101, 10))
	expectedResult := ErrorResponse{
		Code:       "UnexpectedEOF",
		Message:    msg,
		BucketName: "minio-bucket",
		Key:        "Asia/",
	}
	actualResult := ErrUnexpectedEOF(100, 101, "minio-bucket", "Asia/")
	if !reflect.DeepEqual(expectedResult, actualResult) {
		t.Errorf("Expected result to be '%+v', but instead got '%+v'", expectedResult, actualResult)
	}
}

// Test validates 'ErrInvalidBucketName' error response.
func TestErrInvalidBucketName(t *testing.T) {
	expectedResult := ErrorResponse{
		Code:      "InvalidBucketName",
		Message:   "Invalid Bucket name",
		RequestID: "minio",
	}
	actualResult := ErrInvalidBucketName("Invalid Bucket name")
	if !reflect.DeepEqual(expectedResult, actualResult) {
		t.Errorf("Expected result to be '%+v', but instead got '%+v'", expectedResult, actualResult)
	}
}

// Test validates 'ErrInvalidObjectName' error response.
func TestErrInvalidObjectName(t *testing.T) {
	expectedResult := ErrorResponse{
		Code:      "NoSuchKey",
		Message:   "Invalid Object Key",
		RequestID: "minio",
	}
	actualResult := ErrInvalidObjectName("Invalid Object Key")
	if !reflect.DeepEqual(expectedResult, actualResult) {
		t.Errorf("Expected result to be '%+v', but instead got '%+v'", expectedResult, actualResult)
	}
}

// Test validates 'ErrInvalidArgument' response.
func TestErrInvalidArgument(t *testing.T) {
	expectedResult := ErrorResponse{
		Code:      "InvalidArgument",
		Message:   "Invalid Argument",
		RequestID: "minio",
	}
	actualResult := ErrInvalidArgument("Invalid Argument")
	if !reflect.DeepEqual(expectedResult, actualResult) {
		t.Errorf("Expected result to be '%+v', but instead got '%+v'", expectedResult, actualResult)
	}
}

// Tests if the Message field is missing.
func TestErrWithoutMessage(t *testing.T) {
	errResp := ErrorResponse{
		Code:      "AccessDenied",
		RequestID: "minio",
	}
	if errResp.Error() != "Access Denied." {
		t.Errorf("Expected \"Access Denied.\", got %s", errResp)
	}
	errResp = ErrorResponse{
		Code:      "InvalidArgument",
		RequestID: "minio",
	}
	if errResp.Error() != "Error response code InvalidArgument." {
		t.Errorf("Expected \"Error response code InvalidArgument.\", got %s", errResp)
	}
}
