/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2015-2017 Minio, Inc.
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
	"encoding/xml"
	"io/ioutil"
	"net/http"
	"strconv"
)

// Contains common used utilities for tests.

// APIError Used for mocking error response from server.
type APIError struct {
	Code           string
	Description    string
	HTTPStatusCode int
}

// Mocks XML error response from the server.
func generateErrorResponse(resp *http.Response, APIErr APIError, bucketName string) *http.Response {
	// generate error response.
	errorResponse := getAPIErrorResponse(APIErr, bucketName)
	encodedErrorResponse := encodeResponse(errorResponse)
	// write Header.
	resp.StatusCode = APIErr.HTTPStatusCode
	resp.Body = ioutil.NopCloser(bytes.NewBuffer(encodedErrorResponse))

	return resp
}

// getErrorResponse gets in standard error and resource value and
// provides a encodable populated response values.
func getAPIErrorResponse(err APIError, bucketName string) ErrorResponse {
	var errResp = ErrorResponse{}
	errResp.Code = err.Code
	errResp.Message = err.Description
	errResp.BucketName = bucketName
	return errResp
}

// Encodes the response headers into XML format.
func encodeResponse(response interface{}) []byte {
	var bytesBuffer bytes.Buffer
	bytesBuffer.WriteString(xml.Header)
	encode := xml.NewEncoder(&bytesBuffer)
	encode.Encode(response)
	return bytesBuffer.Bytes()
}

// Convert string to bool and always return false if any error
func mustParseBool(str string) bool {
	b, err := strconv.ParseBool(str)
	if err != nil {
		return false
	}
	return b
}
