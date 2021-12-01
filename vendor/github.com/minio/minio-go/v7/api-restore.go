/*
 * MinIO Go Library for Amazon S3 Compatible Cloud Storage
 * (C) 2018-2021 MinIO, Inc.
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
	"context"
	"encoding/xml"
	"net/http"
	"net/url"

	"github.com/minio/minio-go/v7/pkg/s3utils"
	"github.com/minio/minio-go/v7/pkg/tags"
)

// RestoreType represents the restore request type
type RestoreType string

const (
	// RestoreSelect represents the restore SELECT operation
	RestoreSelect = RestoreType("SELECT")
)

// TierType represents a retrieval tier
type TierType string

const (
	// TierStandard is the standard retrieval tier
	TierStandard = TierType("Standard")
	// TierBulk is the bulk retrieval tier
	TierBulk = TierType("Bulk")
	// TierExpedited is the expedited retrieval tier
	TierExpedited = TierType("Expedited")
)

// GlacierJobParameters represents the retrieval tier parameter
type GlacierJobParameters struct {
	Tier TierType
}

// Encryption contains the type of server-side encryption used during object retrieval
type Encryption struct {
	EncryptionType string
	KMSContext     string
	KMSKeyID       string `xml:"KMSKeyId"`
}

// MetadataEntry represents a metadata information of the restored object.
type MetadataEntry struct {
	Name  string
	Value string
}

// S3 holds properties of the copy of the archived object
type S3 struct {
	AccessControlList *AccessControlList `xml:"AccessControlList,omitempty"`
	BucketName        string
	Prefix            string
	CannedACL         *string        `xml:"CannedACL,omitempty"`
	Encryption        *Encryption    `xml:"Encryption,omitempty"`
	StorageClass      *string        `xml:"StorageClass,omitempty"`
	Tagging           *tags.Tags     `xml:"Tagging,omitempty"`
	UserMetadata      *MetadataEntry `xml:"UserMetadata,omitempty"`
}

// SelectParameters holds the select request parameters
type SelectParameters struct {
	XMLName             xml.Name `xml:"SelectParameters"`
	ExpressionType      QueryExpressionType
	Expression          string
	InputSerialization  SelectObjectInputSerialization
	OutputSerialization SelectObjectOutputSerialization
}

// OutputLocation holds properties of the copy of the archived object
type OutputLocation struct {
	XMLName xml.Name `xml:"OutputLocation"`
	S3      S3       `xml:"S3"`
}

// RestoreRequest holds properties of the restore object request
type RestoreRequest struct {
	XMLName              xml.Name              `xml:"http://s3.amazonaws.com/doc/2006-03-01/ RestoreRequest"`
	Type                 *RestoreType          `xml:"Type,omitempty"`
	Tier                 *TierType             `xml:"Tier,omitempty"`
	Days                 *int                  `xml:"Days,omitempty"`
	GlacierJobParameters *GlacierJobParameters `xml:"GlacierJobParameters,omitempty"`
	Description          *string               `xml:"Description,omitempty"`
	SelectParameters     *SelectParameters     `xml:"SelectParameters,omitempty"`
	OutputLocation       *OutputLocation       `xml:"OutputLocation,omitempty"`
}

// SetDays sets the days parameter of the restore request
func (r *RestoreRequest) SetDays(v int) {
	r.Days = &v
}

// SetGlacierJobParameters sets the GlacierJobParameters of the restore request
func (r *RestoreRequest) SetGlacierJobParameters(v GlacierJobParameters) {
	r.GlacierJobParameters = &v
}

// SetType sets the type of the restore request
func (r *RestoreRequest) SetType(v RestoreType) {
	r.Type = &v
}

// SetTier sets the retrieval tier of the restore request
func (r *RestoreRequest) SetTier(v TierType) {
	r.Tier = &v
}

// SetDescription sets the description of the restore request
func (r *RestoreRequest) SetDescription(v string) {
	r.Description = &v
}

// SetSelectParameters sets SelectParameters of the restore select request
func (r *RestoreRequest) SetSelectParameters(v SelectParameters) {
	r.SelectParameters = &v
}

// SetOutputLocation sets the properties of the copy of the archived object
func (r *RestoreRequest) SetOutputLocation(v OutputLocation) {
	r.OutputLocation = &v
}

// RestoreObject is a implementation of https://docs.aws.amazon.com/AmazonS3/latest/API/API_RestoreObject.html AWS S3 API
func (c *Client) RestoreObject(ctx context.Context, bucketName, objectName, versionID string, req RestoreRequest) error {
	// Input validation.
	if err := s3utils.CheckValidBucketName(bucketName); err != nil {
		return err
	}
	if err := s3utils.CheckValidObjectName(objectName); err != nil {
		return err
	}

	restoreRequestBytes, err := xml.Marshal(req)
	if err != nil {
		return err
	}

	urlValues := make(url.Values)
	urlValues.Set("restore", "")
	if versionID != "" {
		urlValues.Set("versionId", versionID)
	}

	// Execute POST on bucket/object.
	resp, err := c.executeMethod(ctx, http.MethodPost, requestMetadata{
		bucketName:       bucketName,
		objectName:       objectName,
		queryValues:      urlValues,
		contentMD5Base64: sumMD5Base64(restoreRequestBytes),
		contentSHA256Hex: sum256Hex(restoreRequestBytes),
		contentBody:      bytes.NewReader(restoreRequestBytes),
		contentLength:    int64(len(restoreRequestBytes)),
	})
	defer closeResponse(resp)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusAccepted {
		return httpRespToErrorResponse(resp, bucketName, "")
	}
	return nil
}
