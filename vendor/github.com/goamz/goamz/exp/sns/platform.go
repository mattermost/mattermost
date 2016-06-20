package sns

import (
	"fmt"
	"strconv"
)

type CreatePlatformApplicationResponse struct {
	PlatformApplicationArn string `xml:"CreatePlatformApplicationResult>PlatformApplicationArn"`
	ResponseMetadata
}

type PlatformApplicationOpt struct {
	Attributes []AttributeEntry
	Name       string
	Platform   string
}

type DeletePlatformApplicationResponse struct {
	ResponseMetadata
}

type GetPlatformApplicationAttributesResponse struct {
	Attributes []AttributeEntry `xml:"GetPlatformApplicationAttributesResult>Attributes>entry"`
	ResponseMetadata
}

type SetPlatformApplicationAttributesOpt struct {
	Attributes             []AttributeEntry
	PlatformApplicationArn string
}

type SetPlatformApplicationAttributesResponse struct {
	ResponseMetadata
}

type PlatformApplication struct {
	Attributes             []AttributeEntry `xml:"Attributes>entry"`
	PlatformApplicationArn string
}

type ListPlatformApplicationsResponse struct {
	NextToken            string
	PlatformApplications []PlatformApplication `xml:"ListPlatformApplicationsResult>PlatformApplications>member"`
	ResponseMetadata
}

// CreatePlatformApplication
//
// See http://goo.gl/Mbbl6Z for more details.

func (sns *SNS) CreatePlatformApplication(options *PlatformApplicationOpt) (resp *CreatePlatformApplicationResponse, err error) {
	resp = &CreatePlatformApplicationResponse{}
	params := makeParams("CreatePlatformApplication")

	params["Platform"] = options.Platform
	params["Name"] = options.Name

	for i, attr := range options.Attributes {
		params[fmt.Sprintf("Attributes.entry.%s.key", strconv.Itoa(i+1))] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%s.value", strconv.Itoa(i+1))] = attr.Value
	}

	err = sns.query(params, resp)

	return

}

// DeletePlatformApplication
//
// See http://goo.gl/6GB3DN for more details.
func (sns *SNS) DeletePlatformApplication(platformApplicationArn string) (resp *DeletePlatformApplicationResponse, err error) {
	resp = &DeletePlatformApplicationResponse{}

	params := makeParams("DeletePlatformApplication")

	params["PlatformApplicationArn"] = platformApplicationArn

	err = sns.query(params, resp)

	return
}

// GetPlatformApplicationAttributes
//
// See http://goo.gl/GswJ8I for more details.
func (sns *SNS) GetPlatformApplicationAttributes(platformApplicationArn, nextToken string) (resp *GetPlatformApplicationAttributesResponse, err error) {
	resp = &GetPlatformApplicationAttributesResponse{}

	params := makeParams("GetPlatformApplicationAttributes")

	params["PlatformApplicationArn"] = platformApplicationArn

	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	err = sns.query(params, resp)

	return
}

// ListPlatformApplications
//
// See http://goo.gl/vQ3ooV for more detail.
func (sns *SNS) ListPlatformApplications(nextToken string) (resp *ListPlatformApplicationsResponse, err error) {
	resp = &ListPlatformApplicationsResponse{}
	params := makeParams("ListPlatformApplications")

	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	err = sns.query(params, resp)
	return
}

// SetPlatformApplicationAttributes
//
// See http://goo.gl/RWnzzb for more detail.
func (sns *SNS) SetPlatformApplicationAttributes(options *SetPlatformApplicationAttributesOpt) (resp *SetPlatformApplicationAttributesResponse, err error) {
	resp = &SetPlatformApplicationAttributesResponse{}
	params := makeParams("SetPlatformApplicationAttributes")

	params["PlatformApplicationArn"] = options.PlatformApplicationArn

	for i, attr := range options.Attributes {
		params[fmt.Sprintf("Attributes.entry.%s.key", strconv.Itoa(i+1))] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%s.value", strconv.Itoa(i+1))] = attr.Value
	}

	err = sns.query(params, resp)
	return
}
