package sns

import (
	"fmt"
	"strconv"
)

type DeleteEndpointResponse struct {
	ResponseMetadata
}

type GetEndpointAttributesResponse struct {
	Attributes []AttributeEntry `xml:"GetEndpointAttributesResult>Attributes>entry"`
	ResponseMetadata
}

type PlatformEndpointOpt struct {
	Attributes             []AttributeEntry
	PlatformApplicationArn string
	CustomUserData         string
	Token                  string
}

type CreatePlatformEndpointResponse struct {
	EndpointArn string `xml:"CreatePlatformEndpointResult>EndpointArn"`
	ResponseMetadata
}

type PlatformEndpoints struct {
	EndpointArn string           `xml:"EndpointArn"`
	Attributes  []AttributeEntry `xml:"Attributes>entry"`
}

type ListEndpointsByPlatformApplicationResponse struct {
	Endpoints []PlatformEndpoints `xml:"ListEndpointsByPlatformApplicationResult>Endpoints>member"`
	ResponseMetadata
}

type SetEndpointAttributesOpt struct {
	Attributes  []AttributeEntry
	EndpointArn string
}

type SetEndpointAttributesResponse struct {
	ResponseMetadata
}

// DeleteEndpoint
//
// See http://goo.gl/9SlUD9 for more details.
func (sns *SNS) DeleteEndpoint(endpointArn string) (resp *DeleteEndpointResponse, err error) {
	resp = &DeleteEndpointResponse{}
	params := makeParams("DeleteEndpoint")

	params["EndpointArn"] = endpointArn

	err = sns.query(params, resp)

	return
}

// GetEndpointAttributes
//
// See http://goo.gl/c8E5X1 for more details.
func (sns *SNS) GetEndpointAttributes(endpointArn string) (resp *GetEndpointAttributesResponse, err error) {
	resp = &GetEndpointAttributesResponse{}

	params := makeParams("GetEndpointAttributes")

	params["EndpointArn"] = endpointArn

	err = sns.query(params, resp)

	return
}

// CreatePlatformEndpoint
//
// See http://goo.gl/4tnngi for more details.
func (sns *SNS) CreatePlatformEndpoint(options *PlatformEndpointOpt) (resp *CreatePlatformEndpointResponse, err error) {

	resp = &CreatePlatformEndpointResponse{}
	params := makeParams("CreatePlatformEndpoint")

	params["PlatformApplicationArn"] = options.PlatformApplicationArn
	params["Token"] = options.Token

	if options.CustomUserData != "" {
		params["CustomUserData"] = options.CustomUserData
	}

	err = sns.query(params, resp)

	return
}

// ListEndpointsByPlatformApplication
//
// See http://goo.gl/L7ioyR for more detail.
func (sns *SNS) ListEndpointsByPlatformApplication(platformApplicationArn, nextToken string) (resp *ListEndpointsByPlatformApplicationResponse, err error) {
	resp = &ListEndpointsByPlatformApplicationResponse{}

	params := makeParams("ListEndpointsByPlatformApplication")

	params["PlatformApplicationArn"] = platformApplicationArn

	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	err = sns.query(params, resp)
	return

}

// SetEndpointAttributes
//
// See http://goo.gl/GTktCj for more detail.
func (sns *SNS) SetEndpointAttributes(options *SetEndpointAttributesOpt) (resp *SetEndpointAttributesResponse, err error) {
	resp = &SetEndpointAttributesResponse{}
	params := makeParams("SetEndpointAttributes")

	params["EndpointArn"] = options.EndpointArn

	for i, attr := range options.Attributes {
		params[fmt.Sprintf("Attributes.entry.%s.key", strconv.Itoa(i+1))] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%s.value", strconv.Itoa(i+1))] = attr.Value
	}

	err = sns.query(params, resp)
	return
}
