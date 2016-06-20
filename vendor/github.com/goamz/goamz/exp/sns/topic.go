package sns

import (
	"errors"
)

type Topic struct {
	SNS      *SNS
	TopicArn string
}

type ListTopicsResp struct {
	Topics    []Topic `xml:"ListTopicsResult>Topics>member"`
	NextToken string
	ResponseMetadata
}

type CreateTopicResp struct {
	Topic Topic `xml:"CreateTopicResult"`
	ResponseMetadata
}

type DeleteTopicResp struct {
	ResponseMetadata
}

type GetTopicAttributesResp struct {
	Attributes []AttributeEntry `xml:"GetTopicAttributesResult>Attributes>entry"`
	ResponseMetadata
}

type SetTopicAttributesResponse struct {
	ResponseMetadata
}

// ListTopics
//
// See http://goo.gl/lfrMK for more details.
func (sns *SNS) ListTopics(NextToken *string) (resp *ListTopicsResp, err error) {
	resp = &ListTopicsResp{}
	params := makeParams("ListTopics")
	if NextToken != nil {
		params["NextToken"] = *NextToken
	}

	err = sns.query(params, resp)
	for i, _ := range resp.Topics {
		resp.Topics[i].SNS = sns
	}
	return
}

// CreateTopic
//
// See http://goo.gl/m9aAt for more details.
func (sns *SNS) CreateTopic(Name string) (resp *CreateTopicResp, err error) {
	resp = &CreateTopicResp{}
	params := makeParams("CreateTopic")
	params["Name"] = Name
	err = sns.query(params, resp)
	resp.Topic.SNS = sns
	return
}

// Delete
//
// Helper function for deleting a topic
func (topic *Topic) Delete() (resp *DeleteTopicResp, err error) {
	resp = &DeleteTopicResp{}
	params := makeParams("DeleteTopic")
	params["TopicArn"] = topic.TopicArn
	err = topic.SNS.query(params, resp)
	return
}

// GetTopicAttributes
//
// See http://goo.gl/WXRoX for more details.
func (sns *SNS) GetTopicAttributes(TopicArn string) (resp *GetTopicAttributesResp, err error) {
	resp = &GetTopicAttributesResp{}
	params := makeParams("GetTopicAttributes")
	params["TopicArn"] = TopicArn
	err = sns.query(params, resp)
	return
}

// SetTopicAttributes
//
// See http://goo.gl/oVYW7 for more details.
func (sns *SNS) SetTopicAttributes(AttributeName, AttributeValue, TopicArn string) (resp *SetTopicAttributesResponse, err error) {
	resp = &SetTopicAttributesResponse{}
	params := makeParams("SetTopicAttributes")

	if AttributeName == "" || TopicArn == "" {
		return nil, errors.New("Invalid Attribute Name or TopicArn")
	}

	params["AttributeName"] = AttributeName
	params["AttributeValue"] = AttributeValue
	params["TopicArn"] = TopicArn

	err = sns.query(params, resp)
	return
}
