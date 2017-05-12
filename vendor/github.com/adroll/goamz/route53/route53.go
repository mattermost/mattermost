package route53

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"io"
	"net/http"
	"strconv"
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
	VPC                    HostedZoneVPC `xml:"VPC,omitempty"` // used on CreateHostedZone
	CallerReference        string
	Config                 Config
	ResourceRecordSetCount int
}

type Config struct {
	XMLName     xml.Name `xml:"Config"`
	Comment     string
	PrivateZone bool
}

// Structs for getting the existing Hosted Zones
type ListHostedZonesResponse struct {
	XMLName     xml.Name     `xml:"https://route53.amazonaws.com/doc/2013-04-01/ ListHostedZonesResponse"`
	HostedZones []HostedZone `xml:"HostedZones>HostedZone"`
	Marker      string
	IsTruncated bool
	NextMarker  string
	MaxItems    int
}

// Structs for Creating a New Host
type CreateHostedZoneRequest struct {
	XMLName          xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ CreateHostedZoneRequest"`
	Name             string
	CallerReference  string
	VPC              HostedZoneVPC
	HostedZoneConfig HostedZoneConfig
}

type ResourceRecordValue struct {
	Value string `xml:"ResourceRecord>Value"`
}

type Change struct {
	Action      string                `xml:"Action"`
	Name        string                `xml:"ResourceRecordSet>Name"`
	Type        string                `xml:"ResourceRecordSet>Type"`
	TTL         int                   `xml:"ResourceRecordSet>TTL,omitempty"`
	AliasTarget *AliasTarget          `xml:"ResourceRecordSet>AliasTarget,omitempty"`
	Values      []ResourceRecordValue `xml:"ResourceRecordSet>ResourceRecords,omitempty"`
}

type ChangeResourceRecordSetsRequest struct {
	XMLName xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ ChangeResourceRecordSetsRequest"`
	Changes []Change `xml:"ChangeBatch>Changes>Change"`
}

type AssociateVPCWithHostedZoneRequest struct {
	XMLName xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ AssociateVPCWithHostedZoneRequest"`
	VPC     HostedZoneVPC
	Comment string
}

type DisassociateVPCWithHostedZoneRequest struct {
	XMLName xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ DisassociateVPCWithHostedZoneRequest"`
	VPC     HostedZoneVPC
	Comment string
}

type HostedZoneConfig struct {
	XMLName xml.Name `xml:"HostedZoneConfig"`
	Comment string
}

type HostedZoneVPC struct {
	XMLName   xml.Name `xml:"VPC"`
	VPCId     string
	VPCRegion string
}

type CreateHostedZoneResponse struct {
	XMLName       xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ CreateHostedZoneResponse"`
	HostedZone    HostedZone
	ChangeInfo    ChangeInfo
	DelegationSet DelegationSet
}

type AliasTarget struct {
	HostedZoneId         string
	DNSName              string
	EvaluateTargetHealth bool
}

type ResourceRecord struct {
	XMLName xml.Name `xml:"ResourceRecord"`
	Value   string
}

type ResourceRecords struct {
	XMLName        xml.Name `xml:"ResourceRecords"`
	ResourceRecord []ResourceRecord
}

type ResourceRecordSet struct {
	XMLName         xml.Name `xml:"ResourceRecordSet"`
	Name            string
	Type            string
	TTL             int
	ResourceRecords []ResourceRecords
	HealthCheckId   string
	Region          string
	Failover        string
	AliasTarget     AliasTarget
}

type ResourceRecordSets struct {
	XMLName           xml.Name `xml:"ResourceRecordSets"`
	ResourceRecordSet []ResourceRecordSet
}

type ListResourceRecordSetsResponse struct {
	XMLName              xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ ListResourceRecordSetsResponse"`
	ResourceRecordSets   []ResourceRecordSets
	IsTruncated          bool
	MaxItems             int
	NextRecordName       string
	NextRecordType       string
	NextRecordIdentifier string
}

type ChangeResourceRecordSetsResponse struct {
	XMLName     xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ ChangeResourceRecordSetsResponse"`
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
	XMLName       xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ GetHostedZoneResponse"`
	HostedZone    HostedZone
	DelegationSet DelegationSet
	VPCs          []HostedZoneVPC `xml:"VPCs>VPC"`
}

type DeleteHostedZoneResponse struct {
	XMLName    xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ DeleteHostedZoneResponse"`
	ChangeInfo ChangeInfo
}

type AssociateVPCWithHostedZoneResponse struct {
	XMLName    xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ AssociateVPCWithHostedZoneResponse"`
	ChangeInfo ChangeInfo
}

type DisassociateVPCWithHostedZoneResponse struct {
	XMLName    xml.Name `xml:"https://route53.amazonaws.com/doc/2013-04-01/ DisassociateVPCWithHostedZoneResponse"`
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

// ListResourceRecordSets fetches a collection of ResourceRecordSets through the AWS Route53 API
func (r *Route53) ListResourceRecordSets(hostedZone string, name string, _type string, identifier string, maxitems int) (result *ListResourceRecordSetsResponse, err error) {
	var buffer bytes.Buffer
	addParam(&buffer, "name", name)
	addParam(&buffer, "type", _type)
	addParam(&buffer, "identifier", identifier)
	if maxitems > 0 {
		addParam(&buffer, "maxitems", strconv.Itoa(maxitems))
	}
	path := fmt.Sprintf("%s/%s/rrset?%s", r.Endpoint, hostedZone, buffer.String())

	result = new(ListResourceRecordSetsResponse)
	err = r.query("GET", path, nil, result)

	return
}

func (response *ListResourceRecordSetsResponse) GetResourceRecordSets() []ResourceRecordSet {
	return response.ResourceRecordSets[0].ResourceRecordSet
}

func (recordset *ResourceRecordSet) GetValues() []string {
	if len(recordset.ResourceRecords) > 0 {
		result := make([]string, len(recordset.ResourceRecords[0].ResourceRecord))
		for i, record := range recordset.ResourceRecords[0].ResourceRecord {
			result[i] = record.Value
		}
		return result
	}
	return make([]string, 0)
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

// AssociateVPCWithHostedZone associates a VPC with specified private hosted zone
func (r *Route53) AssociateVPCWithHostedZone(zoneid string, req *AssociateVPCWithHostedZoneRequest) (result *AssociateVPCWithHostedZoneResponse, err error) {
	xmlBytes, err := xml.Marshal(req)
	if err != nil {
		return nil, err
	}

	xmlBytes = []byte(xml.Header + string(xmlBytes))
	path := fmt.Sprintf("%s/%s/associatevpc", r.Endpoint, zoneid)
	result = new(AssociateVPCWithHostedZoneResponse)
	err = r.query("POST", path, bytes.NewBuffer(xmlBytes), result)

	return
}

// DisassociateVPCWithHostedZone disassociates a VPC from specified private hosted zone
func (r *Route53) DisassociateVPCWithHostedZone(zoneid string, req *DisassociateVPCWithHostedZoneRequest) (result *DisassociateVPCWithHostedZoneResponse, err error) {
	xmlBytes, err := xml.Marshal(req)
	if err != nil {
		return nil, err
	}

	xmlBytes = []byte(xml.Header + string(xmlBytes))
	path := fmt.Sprintf("%s/%s/disassociatevpc", r.Endpoint, zoneid)
	result = new(DisassociateVPCWithHostedZoneResponse)
	err = r.query("POST", path, bytes.NewBuffer(xmlBytes), result)

	return
}

func addParam(buffer *bytes.Buffer, name, value string) {
	if value != "" {
		if buffer.Len() > 0 {
			buffer.WriteString("&")
		}
		buffer.WriteString(fmt.Sprintf("%s=%s", name, value))
	}
}
