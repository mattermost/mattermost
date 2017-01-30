//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Copyright (c) 2011 AppsAttic Ltd.
//
// sdb package written by:
//
//      Andrew Chilton <chilts@appsattic.com>
//      Brad Rydzewski <brad.rydzewski@gmail.com>

// This package is in an experimental state, and does not currently
// follow conventions and style of the rest of goamz or common
// Go conventions. It must be polished before it's considered a
// first-class package in goamz.
package sdb

// BUG: SelectResp isn't properly organized. It must change.

//

import (
	"encoding/xml"
	"github.com/goamz/goamz/aws"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"time"
)

const debug = false

// The SDB type encapsulates operations with a specific SimpleDB region.
type SDB struct {
	aws.Auth
	aws.Region
	private byte // Reserve the right of using private data.
}

// New creates a new SDB.
func New(auth aws.Auth, region aws.Region) *SDB {
	return &SDB{auth, region, 0}
}

// The Domain type represents a collection of items that are described
// by name-value attributes.
type Domain struct {
	*SDB
	Name string
}

// Domain returns a Domain with the given name.
func (sdb *SDB) Domain(name string) *Domain {
	return &Domain{sdb, name}
}

// The Item type represent individual objects that contain one or more
// name-value attributes stored within a SDB Domain as rows.
type Item struct {
	*SDB
	*Domain
	Name string
}

// Item returns an Item with the given name.
func (domain *Domain) Item(name string) *Item {
	return &Item{domain.SDB, domain, name}
}

// The Attr type represent categories of data that can be assigned to items.
type Attr struct {
	Name  string
	Value string
}

// ----------------------------------------------------------------------------
// Service-level operations.

// --- ListDomains

// Response to a ListDomains request.
//
// See http://goo.gl/3u0Cf for more details.
type ListDomainsResp struct {
	Domains          []string `xml:"ListDomainsResult>DomainName"`
	NextToken        string   `xml:"ListDomainsResult>NextToken"`
	ResponseMetadata ResponseMetadata
}

// ListDomains lists all domains in sdb.
//
// See http://goo.gl/Dsw15 for more details.
func (sdb *SDB) ListDomains() (resp *ListDomainsResp, err error) {
	return sdb.ListDomainsN(0, "")
}

// ListDomainsN lists domains in sdb up to maxDomains.
// If nextToken is not empty, domains listed will start at the given token.
//
// See http://goo.gl/Dsw15 for more details.
func (sdb *SDB) ListDomainsN(maxDomains int, nextToken string) (resp *ListDomainsResp, err error) {
	params := makeParams("ListDomains")
	if maxDomains != 0 {
		params["MaxNumberOfDomains"] = []string{strconv.Itoa(maxDomains)}
	}
	if nextToken != "" {
		params["NextToken"] = []string{nextToken}
	}
	resp = &ListDomainsResp{}
	err = sdb.query(nil, nil, params, nil, resp)
	return
}

// --- SelectExpression

// Response to a Select request.
//
// See http://goo.gl/GTsSZ for more details.
type SelectResp struct {
	Items []struct {
		Name  string
		Attrs []Attr `xml:"Attribute"`
	} `xml:"SelectResult>Item"`
	ResponseMetadata ResponseMetadata
}

// Select returns a set of items and attributes that match expr.
// Select is similar to the standard SQL SELECT statement.
//
// See http://goo.gl/GTsSZ for more details.
func (sdb *SDB) Select(expr string, consistent bool) (resp *SelectResp, err error) {
	resp = &SelectResp{}
	params := makeParams("Select")
	params["SelectExpression"] = []string{expr}
	if consistent {
		params["ConsistentRead"] = []string{"true"}
	}
	err = sdb.query(nil, nil, params, nil, resp)
	return
}

// ----------------------------------------------------------------------------
// Domain-level operations.

// --- CreateDomain

// CreateDomain creates a new domain.
//
// See http://goo.gl/jDjGH for more details.
func (domain *Domain) CreateDomain() (resp *SimpleResp, err error) {
	params := makeParams("CreateDomain")
	resp = &SimpleResp{}
	err = domain.SDB.query(domain, nil, params, nil, resp)
	return
}

// DeleteDomain deletes an existing domain.
//
// See http://goo.gl/S0dCL for more details.
func (domain *Domain) DeleteDomain() (resp *SimpleResp, err error) {
	params := makeParams("DeleteDomain")
	resp = &SimpleResp{}
	err = domain.SDB.query(domain, nil, params, nil, resp)
	return
}

// ----------------------------------------------------------------------------
// Item-level operations.

type PutAttrs struct {
	attrs    []Attr
	expected []Attr
	replace  map[string]bool
	missing  map[string]bool
}

func (pa *PutAttrs) Add(name, value string) {
	pa.attrs = append(pa.attrs, Attr{name, value})
}

func (pa *PutAttrs) Replace(name, value string) {
	pa.Add(name, value)
	if pa.replace == nil {
		pa.replace = make(map[string]bool)
	}
	pa.replace[name] = true
}

// The PutAttrs request will only succeed if the existing
// item in SimpleDB contains a matching name / value pair.
func (pa *PutAttrs) IfValue(name, value string) {
	pa.expected = append(pa.expected, Attr{name, value})
}

// Flag to test the existence of an attribute while performing
// conditional updates. X can be any positive integer or 0.
//
// This should set Expected.N.Name=name and Expected.N.Exists=false
func (pa *PutAttrs) IfMissing(name string) {
	if pa.missing == nil {
		pa.missing = make(map[string]bool)
	}
	pa.missing[name] = true
}

// PutAttrs adds attrs to item.
//
// See http://goo.gl/yTAV4 for more details.
func (item *Item) PutAttrs(attrs *PutAttrs) (resp *SimpleResp, err error) {
	params := makeParams("PutAttributes")
	resp = &SimpleResp{}

	// copy these attrs over to the parameters
	itemNum := 1
	for _, attr := range attrs.attrs {
		itemNumStr := strconv.Itoa(itemNum)

		// do the name, value and replace
		params["Attribute."+itemNumStr+".Name"] = []string{attr.Name}
		params["Attribute."+itemNumStr+".Value"] = []string{attr.Value}

		if _, ok := attrs.replace[attr.Name]; ok {
			params["Attribute."+itemNumStr+".Replace"] = []string{"true"}
		}

		itemNum++
	}

	//append expected values to params
	expectedNum := 1
	for _, attr := range attrs.expected {
		expectedNumStr := strconv.Itoa(expectedNum)
		params["Expected."+expectedNumStr+".Name"] = []string{attr.Name}
		params["Expected."+expectedNumStr+".Value"] = []string{attr.Value}

		if attrs.missing[attr.Name] {
			params["Expected."+expectedNumStr+".Exists"] = []string{"false"}
		}
		expectedNum++
	}

	err = item.query(params, nil, resp)
	if err != nil {
		return nil, err
	}
	return
}

// Response to an Attrs request.
//
// See http://goo.gl/45X1M for more details.
type AttrsResp struct {
	Attrs            []Attr `xml:"GetAttributesResult>Attribute"`
	ResponseMetadata ResponseMetadata
}

// Attrs returns one or more of the named attributes, or
// all of item's attributes if names is nil.
// If consistent is true, previous writes will necessarily
// be observed.
//
// See http://goo.gl/45X1M for more details.
func (item *Item) Attrs(names []string, consistent bool) (resp *AttrsResp, err error) {
	params := makeParams("GetAttributes")
	params["ItemName"] = []string{item.Name}
	if consistent {
		params["ConsistentRead"] = []string{"true"}
	}

	// Copy these attributes over to the parameters
	for i, name := range names {
		params["AttributeName."+strconv.Itoa(i+1)] = []string{name}
	}

	resp = &AttrsResp{}
	err = item.query(params, nil, resp)
	if err != nil {
		return nil, err
	}
	return
}

// ----------------------------------------------------------------------------
// Generic data structures for all requests/responses.

// Error encapsulates an error returned by SDB.
type Error struct {
	StatusCode int     // HTTP status code (200, 403, ...)
	StatusMsg  string  // HTTP status message ("Service Unavailable", "Bad Request", ...)
	Code       string  // SimpleDB error code ("InvalidParameterValue", ...)
	Message    string  // The human-oriented error message
	RequestId  string  // A unique ID for this request
	BoxUsage   float64 // The measure of machine utilization for this request.
}

func (err *Error) Error() string {
	return err.Message
}

// SimpleResp represents a response to an SDB request which on success
// will return no other information besides ResponseMetadata.
type SimpleResp struct {
	ResponseMetadata ResponseMetadata
}

// ResponseMetadata
type ResponseMetadata struct {
	RequestId string  // A unique ID for tracking the request
	BoxUsage  float64 // The measure of machine utilization for this request.
}

func buildError(r *http.Response) error {
	err := Error{}
	err.StatusCode = r.StatusCode
	err.StatusMsg = r.Status
	xml.NewDecoder(r.Body).Decode(&err)
	return &err
}

// ----------------------------------------------------------------------------
// Request dispatching logic.

func (item *Item) query(params url.Values, headers http.Header, resp interface{}) error {
	return item.Domain.SDB.query(item.Domain, item, params, headers, resp)
}

func (domain *Domain) query(item *Item, params url.Values, headers http.Header, resp interface{}) error {
	return domain.SDB.query(domain, item, params, headers, resp)
}

func (sdb *SDB) query(domain *Domain, item *Item, params url.Values, headers http.Header, resp interface{}) error {
	// all SimpleDB operations have path="/"
	method := "GET"
	path := "/"

	// if we have been given no headers or params, create them
	if headers == nil {
		headers = map[string][]string{}
	}
	if params == nil {
		params = map[string][]string{}
	}

	// setup some default parameters
	params["Version"] = []string{"2009-04-15"}
	params["Timestamp"] = []string{time.Now().UTC().Format(time.RFC3339)}

	// set the DomainName param (every request must have one)
	if domain != nil {
		params["DomainName"] = []string{domain.Name}
	}

	// set the ItemName if we have one
	if item != nil {
		params["ItemName"] = []string{item.Name}
	}

	// check the endpoint URL
	u, err := url.Parse(sdb.Region.SDBEndpoint)
	if err != nil {
		return err
	}
	headers["Host"] = []string{u.Host}
	sign(sdb.Auth, method, path, params, headers)

	u.Path = path
	if len(params) > 0 {
		u.RawQuery = params.Encode()
	}
	req := http.Request{
		URL:        u,
		Method:     method,
		ProtoMajor: 1,
		ProtoMinor: 1,
		Close:      true,
		Header:     headers,
	}

	if v, ok := headers["Content-Length"]; ok {
		req.ContentLength, _ = strconv.ParseInt(v[0], 10, 64)
		delete(headers, "Content-Length")
	}

	r, err := http.DefaultClient.Do(&req)
	if err != nil {
		return err
	}
	defer r.Body.Close()

	if debug {
		dump, _ := httputil.DumpResponse(r, true)
		log.Printf("response:\n")
		log.Printf("%v\n}\n", string(dump))
	}

	// status code is always 200 when successful (since we're always doing a GET)
	if r.StatusCode != 200 {
		return buildError(r)
	}

	// everything was fine, so unmarshal the XML and return what it's err is (if any)
	err = xml.NewDecoder(r.Body).Decode(resp)
	return err
}

func makeParams(action string) map[string][]string {
	params := make(map[string][]string)
	params["Action"] = []string{action}
	return params
}
