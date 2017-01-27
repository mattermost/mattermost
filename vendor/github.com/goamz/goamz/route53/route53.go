package route53

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"github.com/goamz/goamz/aws"
	"io"
	"net/http"
)

type Route53 struct {
	Auth     aws.Auth
	Endpoint string
	Signer   *aws.Route53Signer
	Service  *aws.Service
}

const route53_host = "https://route53.amazonaws.com"

// Factory for the route53 type
func NewRoute53(auth aws.Auth) (*Route53, error) {
	signer := aws.NewRoute53Signer(auth)

	return &Route53{
		Auth:     auth,
		Signer:   signer,
		Endpoint: route53_host + "/2013-04-01/hostedzone",
	}, nil
}

// General Structs used in all types of requests
type HostedZone struct {
	XMLName                xml.Name `xml:"HostedZone"`
	Id                     string
	Name                   string
	CallerReference        string
	Config                 Config
	ResourceRecordSetCount int
}

type Config struct {
	XMLName xml.Name `xml:"Config"`
	Comment string
}

// Structs for getting the existing Hosted Zones
type ListHostedZonesResponse struct {
	XMLName     xml.Name     `xml:"ListHostedZonesResponse"`
	HostedZones []HostedZone `xml:"HostedZones>HostedZone"`
	Marker      string
	IsTruncated bool
	NextMarker  string
	MaxItems    int
}

// Structs for Creating a New Host
type CreateHostedZoneRequest struct {
	XMLName          xml.Name `xml:"CreateHostedZoneRequest"`
	Xmlns            string   `xml:"xmlns,attr"`
	Name             string
	CallerReference  string
	HostedZoneConfig HostedZoneConfig
}

type ResourceRecordValue struct {
	Value string `xml:"Value"`
}

type AliasTarget struct {
	HostedZoneId         string `xml:"HostedZoneId"`
	DNSName              string `xml:"DNSName"`
	EvaluateTargetHealth bool   `xml:"EvaluateTargetHealth"`
}

// Wrapper for all the different resource record sets
type ResourceRecordSet interface{}

// Basic Change
type Change struct {
	Action        string                `xml:"Action"`
	Name          string                `xml:"ResourceRecordSet>Name"`
	Type          string                `xml:"ResourceRecordSet>Type"`
	TTL           int                   `xml:"ResourceRecordSet>TTL,omitempty"`
	Values        []ResourceRecordValue `xml:"ResourceRecordSet>ResourceRecords>ResourceRecord"`
	HealthCheckId string                `xml:"ResourceRecordSet>HealthCheckId,omitempty"`
}

// Basic Resource Recod Set
type BasicResourceRecordSet struct {
	Action        string                `xml:"Action"`
	Name          string                `xml:"ResourceRecordSet>Name"`
	Type          string                `xml:"ResourceRecordSet>Type"`
	TTL           int                   `xml:"ResourceRecordSet>TTL,omitempty"`
	Values        []ResourceRecordValue `xml:"ResourceRecordSet>ResourceRecords>ResourceRecord"`
	HealthCheckId string                `xml:"ResourceRecordSet>HealthCheckId,omitempty"`
}

// Alias Resource Record Set
type AliasResourceRecordSet struct {
	Action        string      `xml:"Action"`
	Name          string      `xml:"ResourceRecordSet>Name"`
	Type          string      `xml:"ResourceRecordSet>Type"`
	AliasTarget   AliasTarget `xml:"ResourceRecordSet>AliasTarget"`
	HealthCheckId string      `xml:"ResourceRecordSet>HealthCheckId,omitempty"`
}

type ChangeResourceRecordSetsRequest struct {
	XMLName xml.Name            `xml:"ChangeResourceRecordSetsRequest"`
	Xmlns   string              `xml:"xmlns,attr"`
	Changes []ResourceRecordSet `xml:"ChangeBatch>Changes>Change"`
}

type HostedZoneConfig struct {
	XMLName xml.Name `xml:"HostedZoneConfig"`
	Comment string
}

type CreateHostedZoneResponse struct {
	XMLName       xml.Name `xml:"CreateHostedZoneResponse"`
	HostedZone    HostedZone
	ChangeInfo    ChangeInfo
	DelegationSet DelegationSet
}

type ChangeResourceRecordSetsResponse struct {
	XMLName     xml.Name `xml:"ChangeResourceRecordSetsResponse"`
	Id          string   `xml:"ChangeInfo>Id"`
	Status      string   `xml:"ChangeInfo>Status"`
	SubmittedAt string   `xml:"ChangeInfo>SubmittedAt"`
}

type ChangeInfo struct {
	XMLName     xml.Name `xml:"ChangeInfo"`
	Id          string
	Status      string
	SubmittedAt string
}

type DelegationSet struct {
	XMLName     xml.Name `xml:"DelegationSet`
	NameServers NameServers
}

type NameServers struct {
	XMLName    xml.Name `xml:"NameServers`
	NameServer []string
}

type GetHostedZoneResponse struct {
	XMLName       xml.Name `xml:"GetHostedZoneResponse"`
	HostedZone    HostedZone
	DelegationSet DelegationSet
}

type DeleteHostedZoneResponse struct {
	XMLName    xml.Name `xml:"DeleteHostedZoneResponse"`
	Xmlns      string   `xml:"xmlns,attr"`
	ChangeInfo ChangeInfo
}

// query sends the specified HTTP request to the path and signs the request
// with the required authentication and headers based on the Auth.
//
// Automatically decodes the response into the the result interface
func (r *Route53) query(method string, path string, body io.Reader, result interface{}) error {
	var err error

	// Create the POST request and sign the headers
	req, err := http.NewRequest(method, path, body)
	r.Signer.Sign(req)

	// Send the request and capture the response
	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return err
	}

	if method == "POST" {
		defer req.Body.Close()
	}

	if res.StatusCode != 201 && res.StatusCode != 200 {
		err = r.Service.BuildError(res)
		return err
	}

	err = xml.NewDecoder(res.Body).Decode(result)

	return err
}

// CreateHostedZone send a creation request to the AWS Route53 API
func (r *Route53) CreateHostedZone(hostedZoneReq *CreateHostedZoneRequest) (*CreateHostedZoneResponse, error) {
	xmlBytes, err := xml.Marshal(hostedZoneReq)
	if err != nil {
		return nil, err
	}

	result := new(CreateHostedZoneResponse)
	err = r.query("POST", r.Endpoint, bytes.NewBuffer(xmlBytes), result)

	return result, err
}

// ChangeResourceRecordSet send a change resource record request to the AWS Route53 API
func (r *Route53) ChangeResourceRecordSet(req *ChangeResourceRecordSetsRequest, zoneId string) (*ChangeResourceRecordSetsResponse, error) {
	xmlBytes, err := xml.Marshal(req)
	if err != nil {
		return nil, err
	}
	xmlBytes = []byte(xml.Header + string(xmlBytes))

	result := new(ChangeResourceRecordSetsResponse)
	path := fmt.Sprintf("%s/%s/rrset", r.Endpoint, zoneId)
	err = r.query("POST", path, bytes.NewBuffer(xmlBytes), result)

	return result, err
}

// ListedHostedZones fetches a collection of HostedZones through the AWS Route53 API
func (r *Route53) ListHostedZones(marker string, maxItems int) (result *ListHostedZonesResponse, err error) {
	path := ""

	if marker == "" {
		path = fmt.Sprintf("%s?maxitems=%d", r.Endpoint, maxItems)
	} else {
		path = fmt.Sprintf("%s?marker=%v&maxitems=%d", r.Endpoint, marker, maxItems)
	}

	result = new(ListHostedZonesResponse)
	err = r.query("GET", path, nil, result)

	return
}

// GetHostedZone fetches a particular hostedzones DelegationSet by id
func (r *Route53) GetHostedZone(id string) (result *GetHostedZoneResponse, err error) {
	result = new(GetHostedZoneResponse)
	err = r.query("GET", fmt.Sprintf("%s/%v", r.Endpoint, id), nil, result)

	return
}

// DeleteHostedZone deletes the hosted zone with the given id
func (r *Route53) DeleteHostedZone(id string) (result *DeleteHostedZoneResponse, err error) {
	path := fmt.Sprintf("%s/%s", r.Endpoint, id)

	result = new(DeleteHostedZoneResponse)
	err = r.query("DELETE", path, nil, result)

	return
}
