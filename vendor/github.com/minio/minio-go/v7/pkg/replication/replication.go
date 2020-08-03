/*
 * MinIO Client (C) 2020 MinIO, Inc.
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

package replication

import "encoding/xml"

// Config - replication configuration specified in
// https://docs.aws.amazon.com/AmazonS3/latest/dev/replication-add-config.html
type Config struct {
	XMLName xml.Name `xml:"ReplicationConfiguration" json:"-"`
	Rules   []Rule   `xml:"Rule" json:"Rules"`
	// ReplicationARN is a MinIO only extension and optional for AWS
	ReplicationARN string `xml:"ReplicationArn,omitempty" json:"ReplicationArn,omitempty"`
}

// Empty returns true if config is not set
func (c *Config) Empty() bool {
	return len(c.Rules) == 0
}

// Rule - a rule for replication configuration.
type Rule struct {
	XMLName                 xml.Name                `xml:"Rule" json:"-"`
	ID                      string                  `xml:"ID,omitempty"`
	Status                  Status                  `xml:"Status"`
	Priority                int                     `xml:"Priority"`
	DeleteMarkerReplication DeleteMarkerReplication `xml:"DeleteMarkerReplication"`
	Destination             Destination             `xml:"Destination"`
	Filter                  Filter                  `xml:"Filter" json:"Filter"`
}

// Filter - a filter for a replication configuration Rule.
type Filter struct {
	XMLName xml.Name `xml:"Filter" json:"-"`
	Prefix  string   `json:"Prefix,omitempty"`
	And     And      `xml:"And,omitempty" json:"And,omitempty"`
}

// Tag - a tag for a replication configuration Rule filter.
type Tag struct {
	XMLName xml.Name `json:"-"`
	Key     string   `xml:"Key,omitempty" json:"Key,omitempty"`
	Value   string   `xml:"Value,omitempty" json:"Value,omitempty"`
}

// Destination - destination in ReplicationConfiguration.
type Destination struct {
	XMLName      xml.Name `xml:"Destination" json:"-"`
	Bucket       string   `xml:"Bucket" json:"Bucket"`
	StorageClass string   `xml:"StorageClass,omitempty" json:"StorageClass,omitempty"`
}

// And - a tag to combine a prefix and multiple tags for replication configuration rule.
type And struct {
	XMLName xml.Name `xml:"And,omitempty" json:"-"`
	Prefix  string   `xml:"Prefix,omitempty" json:"Prefix,omitempty"`
	Tags    []Tag    `xml:"Tag,omitempty" json:"Tags,omitempty"`
}

// Status represents Enabled/Disabled status
type Status string

// Supported status types
const (
	Enabled  Status = "Enabled"
	Disabled Status = "Disabled"
)

// DeleteMarkerReplication - whether delete markers are replicated - https://docs.aws.amazon.com/AmazonS3/latest/dev/replication-add-config.html
type DeleteMarkerReplication struct {
	Status Status `xml:"Status" json:"Status"` // should be set to "Disabled" by default
}

// IsEmpty returns true if DeleteMarkerReplication is not set
func (d DeleteMarkerReplication) IsEmpty() bool {
	return len(d.Status) == 0
}
