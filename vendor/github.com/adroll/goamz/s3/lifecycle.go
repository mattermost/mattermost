package s3

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/xml"
	"net/url"
	"strconv"
	"time"
)

// Implements an interface for s3 bucket lifecycle configuration
// See goo.gl/d0bbDf for details.

const (
	LifecycleRuleStatusEnabled  = "Enabled"
	LifecycleRuleStatusDisabled = "Disabled"
	LifecycleRuleDateFormat     = "2006-01-02"
	StorageClassGlacier         = "GLACIER"
)

type Expiration struct {
	Days *uint  `xml:"Days,omitempty"`
	Date string `xml:"Date,omitempty"`
}

// Returns Date as a time.Time.
func (r *Expiration) ParseDate() (time.Time, error) {
	return time.Parse(LifecycleRuleDateFormat, r.Date)
}

type Transition struct {
	Days         *uint  `xml:"Days,omitempty"`
	Date         string `xml:"Date,omitempty"`
	StorageClass string `xml:"StorageClass"`
}

// Returns Date as a time.Time.
func (r *Transition) ParseDate() (time.Time, error) {
	return time.Parse(LifecycleRuleDateFormat, r.Date)
}

type NoncurrentVersionExpiration struct {
	Days *uint `xml:"NoncurrentDays,omitempty"`
}

type NoncurrentVersionTransition struct {
	Days         *uint  `xml:"NoncurrentDays,omitempty"`
	StorageClass string `xml:"StorageClass"`
}

type LifecycleRule struct {
	ID                          string                       `xml:"ID"`
	Prefix                      string                       `xml:"Prefix"`
	Status                      string                       `xml:"Status"`
	NoncurrentVersionTransition *NoncurrentVersionTransition `xml:"NoncurrentVersionTransition,omitempty"`
	NoncurrentVersionExpiration *NoncurrentVersionExpiration `xml:"NoncurrentVersionExpiration,omitempty"`
	Transition                  *Transition                  `xml:"Transition,omitempty"`
	Expiration                  *Expiration                  `xml:"Expiration,omitempty"`
}

// Create a lifecycle rule with arbitrary identifier id and object name prefix
// for which the rules should apply.
func NewLifecycleRule(id, prefix string) *LifecycleRule {
	rule := &LifecycleRule{
		ID:     id,
		Prefix: prefix,
		Status: LifecycleRuleStatusEnabled,
	}
	return rule
}

// Adds a transition rule in days.  Overwrites any previous transition rule.
func (r *LifecycleRule) SetTransitionDays(days uint) {
	r.Transition = &Transition{
		Days:         &days,
		StorageClass: StorageClassGlacier,
	}
}

// Adds a transition rule as a date.  Overwrites any previous transition rule.
func (r *LifecycleRule) SetTransitionDate(date time.Time) {
	r.Transition = &Transition{
		Date:         date.Format(LifecycleRuleDateFormat),
		StorageClass: StorageClassGlacier,
	}
}

// Adds an expiration rule in days.  Overwrites any previous expiration rule.
// Days must be > 0.
func (r *LifecycleRule) SetExpirationDays(days uint) {
	r.Expiration = &Expiration{
		Days: &days,
	}
}

// Adds an expiration rule as a date.  Overwrites any previous expiration rule.
func (r *LifecycleRule) SetExpirationDate(date time.Time) {
	r.Expiration = &Expiration{
		Date: date.Format(LifecycleRuleDateFormat),
	}
}

// Adds a noncurrent version transition rule.  Overwrites any previous
// noncurrent version transition rule.
func (r *LifecycleRule) SetNoncurrentVersionTransitionDays(days uint) {
	r.NoncurrentVersionTransition = &NoncurrentVersionTransition{
		Days:         &days,
		StorageClass: StorageClassGlacier,
	}
}

// Adds a noncurrent version expiration rule. Days must be > 0.  Overwrites
// any previous noncurrent version expiration rule.
func (r *LifecycleRule) SetNoncurrentVersionExpirationDays(days uint) {
	r.NoncurrentVersionExpiration = &NoncurrentVersionExpiration{
		Days: &days,
	}
}

// Marks the rule as disabled.
func (r *LifecycleRule) Disable() {
	r.Status = LifecycleRuleStatusDisabled
}

// Marks the rule as enabled (default).
func (r *LifecycleRule) Enable() {
	r.Status = LifecycleRuleStatusEnabled
}

type LifecycleConfiguration struct {
	XMLName xml.Name          `xml:"LifecycleConfiguration"`
	Rules   *[]*LifecycleRule `xml:"Rule,omitempty"`
}

// Adds a LifecycleRule to the configuration.
func (c *LifecycleConfiguration) AddRule(r *LifecycleRule) {
	var rules []*LifecycleRule
	if c.Rules != nil {
		rules = *c.Rules
	}
	rules = append(rules, r)
	c.Rules = &rules
}

// Sets the bucket's lifecycle configuration.
func (b *Bucket) PutLifecycleConfiguration(c *LifecycleConfiguration) error {
	doc, err := xml.Marshal(c)
	if err != nil {
		return err
	}

	buf := makeXmlBuffer(doc)
	digest := md5.New()
	size, err := digest.Write(buf.Bytes())
	if err != nil {
		return err
	}

	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(int64(size), 10)},
		"Content-MD5":    {base64.StdEncoding.EncodeToString(digest.Sum(nil))},
	}

	req := &request{
		path:    "/",
		method:  "PUT",
		bucket:  b.Name,
		headers: headers,
		payload: buf,
		params:  url.Values{"lifecycle": {""}},
	}

	return b.S3.queryV4Sign(req, nil)
}

// Retrieves the lifecycle configuration for the bucket.  AWS returns an error
// if no lifecycle found.
func (b *Bucket) GetLifecycleConfiguration() (*LifecycleConfiguration, error) {
	req := &request{
		method: "GET",
		bucket: b.Name,
		path:   "/",
		params: url.Values{"lifecycle": {""}},
	}

	conf := &LifecycleConfiguration{}
	err := b.S3.queryV4Sign(req, conf)
	return conf, err
}

// Delete the bucket's lifecycle configuration.
func (b *Bucket) DeleteLifecycleConfiguration() error {
	req := &request{
		method: "DELETE",
		bucket: b.Name,
		path:   "/",
		params: url.Values{"lifecycle": {""}},
	}

	return b.S3.queryV4Sign(req, nil)
}
