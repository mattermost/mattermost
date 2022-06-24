/*
 * MinIO Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2021 MinIO, Inc.
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

package credentials

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"io/ioutil"
)

// ErrorResponse - Is the typed error returned.
// ErrorResponse struct should be comparable since it is compared inside
// golang http API (https://github.com/golang/go/issues/29768)
type ErrorResponse struct {
	XMLName  xml.Name `xml:"https://sts.amazonaws.com/doc/2011-06-15/ ErrorResponse" json:"-"`
	STSError struct {
		Type    string `xml:"Type"`
		Code    string `xml:"Code"`
		Message string `xml:"Message"`
	} `xml:"Error"`
	RequestID string `xml:"RequestId"`
}

// Error - Is the typed error returned by all API operations.
type Error struct {
	XMLName    xml.Name `xml:"Error" json:"-"`
	Code       string
	Message    string
	BucketName string
	Key        string
	Resource   string
	RequestID  string `xml:"RequestId"`
	HostID     string `xml:"HostId"`

	// Region where the bucket is located. This header is returned
	// only in HEAD bucket and ListObjects response.
	Region string

	// Captures the server string returned in response header.
	Server string

	// Underlying HTTP status code for the returned error
	StatusCode int `xml:"-" json:"-"`
}

// Error - Returns S3 error string.
func (e Error) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("Error response code %s.", e.Code)
	}
	return e.Message
}

// Error - Returns STS error string.
func (e ErrorResponse) Error() string {
	if e.STSError.Message == "" {
		return fmt.Sprintf("Error response code %s.", e.STSError.Code)
	}
	return e.STSError.Message
}

// xmlDecoder provide decoded value in xml.
func xmlDecoder(body io.Reader, v interface{}) error {
	d := xml.NewDecoder(body)
	return d.Decode(v)
}

// xmlDecodeAndBody reads the whole body up to 1MB and
// tries to XML decode it into v.
// The body that was read and any error from reading or decoding is returned.
func xmlDecodeAndBody(bodyReader io.Reader, v interface{}) ([]byte, error) {
	// read the whole body (up to 1MB)
	const maxBodyLength = 1 << 20
	body, err := ioutil.ReadAll(io.LimitReader(bodyReader, maxBodyLength))
	if err != nil {
		return nil, err
	}
	return bytes.TrimSpace(body), xmlDecoder(bytes.NewReader(body), v)
}
