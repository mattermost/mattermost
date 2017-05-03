package sns

import (
	"encoding/xml"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"net/http"
)

type SNS struct {
	aws.Auth
	aws.Region
	service aws.Service
}

func New(auth aws.Auth, region aws.Region) (*SNS, error) {
	serviceInfo := aws.ServiceInfo{region.SNSEndpoint, aws.V2Signature}
	service, err := aws.NewService(auth, serviceInfo)

	return &SNS{auth, region, *service}, err
}

func (sns *SNS) query(method string, params map[string]string, responseType interface{}) error {
	response, err := sns.service.Query(method, "/", params)
	if err != nil {
		return err
	} else if response.StatusCode != http.StatusOK {
		return sns.service.BuildError(response)
	} else {
		return xml.NewDecoder(response.Body).Decode(responseType)
	}
}

// Returns a list of the requester's topics. Each call returns a limited list of topics, up to 100.
// If there are more topics, a NextToken is also returned.
// Use the NextToken parameter in a new ListTopics call to get further results.
func (sns *SNS) ListTopics(nextToken string) (*ListTopicsResponse, error) {
	params := aws.MakeParams("ListTopics")
	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	response := &ListTopicsResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

func (sns *SNS) ListAllTopics() ([]Topic, error) {
	topics := make([]Topic, 0)
	nextToken := ""

	for {
		response, err := sns.ListTopics(nextToken)
		if err != nil {
			return topics, err
		}
		for _, topic := range response.Topics {
			topics = append(topics, topic)
		}
		nextToken = response.NextToken
		if nextToken == "" {
			break
		}
	}

	return topics, nil
}

// Creates a topic to which notifications can be published. Users can create at most 3000 topics.
// This action is idempotent, so if the requester already owns a topic with the specified name, that topic's ARN is returned without creating a new topic.
func (sns *SNS) CreateTopic(name string) (*CreateTopicResponse, error) {
	params := aws.MakeParams("CreateTopic")
	params["Name"] = name

	response := &CreateTopicResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Deletes a topic and all its subscriptions.
// Deleting a topic might prevent some messages previously sent to the topic from being delivered to subscribers.
// This action is idempotent, so deleting a topic that does not exist does not result in an error.
func (sns *SNS) DeleteTopic(topicArn string) (*DeleteTopicResponse, error) {
	params := aws.MakeParams("DeleteTopic")
	params["TopicArn"] = topicArn

	response := &DeleteTopicResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Returns a list of the requester's subscriptions. Each call returns a limited list of subscriptions, up to 100.
// If there are more subscriptions, a NextToken is also returned.
// Use the NextToken parameter in a new ListSubscriptions call to get further results.
func (sns *SNS) ListSubscriptions(nextToken string) (*ListSubscriptionsResponse, error) {
	params := aws.MakeParams("ListSubscriptions")
	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	response := &ListSubscriptionsResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

func (sns *SNS) ListAllSubscriptions() ([]Subscription, error) {
	subscriptions := make([]Subscription, 0)
	nextToken := ""

	for {
		response, err := sns.ListSubscriptions(nextToken)
		if err != nil {
			return subscriptions, err
		}
		for _, subscription := range response.Subscriptions {
			subscriptions = append(subscriptions, subscription)
		}
		nextToken = response.NextToken
		if nextToken == "" {
			break
		}
	}

	return subscriptions, nil

}

// Returns all of the properties of a topic. Topic properties returned might differ based on the authorization of the user.
func (sns *SNS) GetTopicAttributes(topicArn string) (*GetTopicAttributesResponse, error) {
	params := aws.MakeParams("GetTopicAttributes")
	params["TopicArn"] = topicArn

	response := &GetTopicAttributesResponse{}
	err := sns.query("GET", params, response)
	return response, err
}

// Sets the attributes for an endpoint for a device on one of the supported push notification services, such as GCM and APNS.
func (sns *SNS) SetTopicAttributes(topicArn, attributeName, attributeValue string) (*SetTopicAttributesResponse, error) {
	params := aws.MakeParams("SetTopicAttributes")
	params["AttributeName"] = attributeName
	params["TopicArn"] = topicArn
	if attributeValue != "" {
		params["AttributeValue"] = attributeValue
	}

	response := &SetTopicAttributesResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Sends a message to all of a topic's subscribed endpoints.
// When a messageId is returned, the message has been saved and Amazon SNS will attempt to deliver it to the topic's subscribers shortly.
// The format of the outgoing message to each subscribed endpoint depends on the notification protocol selected.
// To use the Publish action for sending a message to a mobile endpoint, such as an app on a Kindle device or mobile phone, you must specify the EndpointArn.
func (sns *SNS) Publish(options *PublishOptions) (*PublishResponse, error) {
	params := aws.MakeParams("Publish")
	params["Message"] = options.Message
	params["MessageStructure"] = options.MessageStructure

	if options.Subject != "" {
		params["Subject"] = options.Subject
	}

	if options.TopicArn != "" {
		params["TopicArn"] = options.TopicArn
	}

	if options.TargetArn != "" {
		params["TargetArn"] = options.TargetArn
	}

	response := &PublishResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Prepares to subscribe an endpoint by sending the endpoint a confirmation message.
// To actually create a subscription, the endpoint owner must call the ConfirmSubscription action with the token from the confirmation message.
// Confirmation tokens are valid for three days.
func (sns *SNS) Subscribe(topicArn, protocol, endpoint string) (*SubscribeResponse, error) {
	params := aws.MakeParams("Subscribe")
	params["TopicArn"] = topicArn
	params["Protocol"] = protocol
	if endpoint != "" {
		params["Endpoint"] = endpoint
	}

	response := &SubscribeResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

func (sns *SNS) UnsubscribeFromHttp(notification *HttpNotification,
	authenticateOnUnsubscribe string) (*UnsubscribeResponse, error) {
	if notification.Type != MESSAGE_TYPE_NOTIFICATION {
		return nil, fmt.Errorf("Expected message type \"%S\", found \"%s\"",
			MESSAGE_TYPE_NOTIFICATION, notification.Type)
	}
	return sns.Unsubscribe(notification.TopicArn)
}

// Deletes a subscription.
// If the subscription requires authentication for deletion, only the owner of the subscription or the topic's owner can unsubscribe, and an AWS signature is required.
// If the Unsubscribe call does not require authentication and the requester is not the subscription owner, a final cancellation message is delivered to the endpoint, so that the endpoint owner can easily resubscribe to the topic if the Unsubscribe request was unintended.
func (sns *SNS) Unsubscribe(subscriptionArn string) (*UnsubscribeResponse, error) {
	params := aws.MakeParams("Unsubscribe")
	params["SubscriptionArn"] = subscriptionArn

	response := &UnsubscribeResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Verifies an endpoint owner's intent to receive messages by responding to
// json subscription notification or by re-subscribing after aving received
// an unsubscribed notification from an http post.
func (sns *SNS) ConfirmSubscriptionFromHttp(notification *HttpNotification,
	authenticateOnUnsubscribe string) (*ConfirmSubscriptionResponse, error) {
	if notification.Type != MESSAGE_TYPE_SUBSCRIPTION_CONFIRMATION &&
		notification.Type != MESSAGE_TYPE_UNSUBSCRIBE_CONFIRMATION {
		return nil, fmt.Errorf("Expected message type \"%S\" or \"%s\", found \"%s\"",
			MESSAGE_TYPE_SUBSCRIPTION_CONFIRMATION, MESSAGE_TYPE_UNSUBSCRIBE_CONFIRMATION, notification.Type)
	}
	return sns.ConfirmSubscription(notification.TopicArn, notification.Token, authenticateOnUnsubscribe)
}

// Verifies an endpoint owner's intent to receive messages by validating the token sent to the endpoint by an earlier Subscribe action.
// If the token is valid, the action creates a new subscription and returns its Amazon Resource Name (ARN).
// This call requires an AWS signature only when the AuthenticateOnUnsubscribe flag is set to "true".
func (sns *SNS) ConfirmSubscription(topicArn, token, authenticateOnUnsubscribe string) (*ConfirmSubscriptionResponse, error) {
	params := aws.MakeParams("ConfirmSubscription")
	params["TopicArn"] = topicArn
	params["Token"] = token
	if authenticateOnUnsubscribe != "" {
		params["AuthenticateOnUnsubscribe"] = authenticateOnUnsubscribe
	}

	response := &ConfirmSubscriptionResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Returns all of the properties of a subscription.
func (sns *SNS) GetSubscriptionAttributes(subscriptionArn string) (*GetSubscriptionAttributesResponse, error) {
	params := aws.MakeParams("GetSubscriptionAttributes")
	params["SubscriptionArn"] = subscriptionArn

	response := &GetSubscriptionAttributesResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

// Allows a subscription owner to set an attribute of the topic to a new value.
func (sns *SNS) SetSubscriptionAttributes(subscriptionArn, attributeName, attributeValue string) (*SetSubscriptionAttributesResponse, error) {
	params := aws.MakeParams("SetSubscriptionAttributes")
	params["SubscriptionArn"] = subscriptionArn
	params["AttributeName"] = attributeName

	if attributeValue != "" {
		params["AttributeValue"] = attributeValue
	}

	response := &SetSubscriptionAttributesResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Adds a statement to a topic's access control policy, granting access for the specified AWS accounts to the specified actions.
func (sns *SNS) AddPermission(label, topicArn string, permissions []Permission) (*AddPermissionResponse, error) {
	params := aws.MakeParams("AddPermission")
	params["Label"] = label
	params["TopicArn"] = topicArn

	for i, permission := range permissions {
		params[fmt.Sprintf("AWSAccountId.member.%d", i+1)] = permission.AccountId
		params[fmt.Sprintf("ActionName.member.%d", i+1)] = permission.ActionName
	}

	response := &AddPermissionResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Removes a statement from a topic's access control policy.
func (sns *SNS) RemovePermission(label, topicArn string) (*RemovePermissionResponse, error) {
	params := aws.MakeParams("RemovePermission")
	params["Label"] = label
	params["TopicArn"] = topicArn

	response := &RemovePermissionResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Returns a list of the subscriptions to a specific topic.
// Each call returns a limited list of subscriptions, up to 100.
// If there are more subscriptions, a NextToken is also returned.
// Use the NextToken parameter in a new ListSubscriptionsByTopic call to get further results.
func (sns *SNS) ListSubscriptionsByTopic(topicArn, nextToken string) (*ListSubscriptionByTopicResponse, error) {
	params := aws.MakeParams("ListSubscriptionsByTopic")
	params["TopicArn"] = topicArn
	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	response := &ListSubscriptionByTopicResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

// Returns a list of the all subscriptions to a specific topic.
func (sns *SNS) ListAllSubscriptionsByTopic(topicArn string) ([]Subscription, error) {
	subscriptions := make([]Subscription, 0)
	nextToken := ""

	for {
		response, err := sns.ListSubscriptionsByTopic(topicArn, nextToken)
		if err != nil {
			return subscriptions, err
		}
		for _, subscription := range response.Subscriptions {
			subscriptions = append(subscriptions, subscription)
		}
		nextToken = response.NextToken
		if nextToken == "" {
			break
		}
	}

	return subscriptions, nil
}

// Creates a platform application object for one of the supported push notification services, such as APNS and GCM, to which devices and mobile apps may register.
// You must specify PlatformPrincipal and PlatformCredential attributes when using the CreatePlatformApplication action.
func (sns *SNS) CreatePlatformApplication(name, platform string, attributes []Attribute) (*CreatePlatformApplicationResponse, error) {
	params := aws.MakeParams("CreatePlatformApplication")
	params["Name"] = name
	params["Platform"] = platform

	for i, attr := range attributes {
		params[fmt.Sprintf("Attributes.entry.%d.key", i+1)] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%d.value", i+1)] = attr.Value
	}

	response := &CreatePlatformApplicationResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Creates an endpoint for a device and mobile app on one of the supported push notification services, such as GCM and APNS.
// CreatePlatformEndpoint requires the PlatformApplicationArn that is returned from CreatePlatformApplication.
// The EndpointArn that is returned when using CreatePlatformEndpoint can then be used by the Publish action to send a message to a mobile app or by the Subscribe action for subscription to a topic.
// The CreatePlatformEndpoint action is idempotent, so if the requester already owns an endpoint with the same device token and attributes, that endpoint's ARN is returned without creating a new endpoint.
func (sns *SNS) CreatePlatformEndpoint(options *PlatformEndpointOptions) (*CreatePlatformEndpointResponse, error) {
	params := aws.MakeParams("CreatePlatformEndpoint")
	params["PlatformApplicationArn"] = options.PlatformApplicationArn
	params["Token"] = options.Token

	if options.CustomUserData != "" {
		params["CustomUserData"] = options.CustomUserData
	}

	for i, attr := range options.Attributes {
		params[fmt.Sprintf("Attributes.entry.%d.key", i+1)] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%d.value", i+1)] = attr.Value
	}

	response := &CreatePlatformEndpointResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Deletes the endpoint from Amazon SNS. This action is idempotent.
func (sns *SNS) DeleteEndpoint(endpointArn string) (*DeleteEndpointResponse, error) {
	params := aws.MakeParams("DeleteEndpoint")
	params["EndpointArn"] = endpointArn

	response := &DeleteEndpointResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Deletes a platform application object for one of the supported push notification services, such as APNS and GCM
func (sns *SNS) DeletePlatformApplication(platformApplicationArn string) (*DeletePlatformApplicationResponse, error) {
	params := aws.MakeParams("DeletePlatformApplication")
	params["PlatformApplicationArn"] = platformApplicationArn

	response := &DeletePlatformApplicationResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Retrieves the endpoint attributes for a device on one of the supported push notification services, such as GCM and APNS
func (sns *SNS) GetEndpointAttributes(endpointArn string) (*GetEndpointAttributesResponse, error) {
	params := aws.MakeParams("GetEndpointAttributes")
	params["EndpointArn"] = endpointArn

	response := &GetEndpointAttributesResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

// Retrieves the attributes of the platform application object for the supported push notification services, such as APNS and GCM
func (sns *SNS) GetPlatformApplicationAttributes(platformApplicationArn string) (*GetPlatformApplicationAttributesResponse, error) {
	params := aws.MakeParams("GetPlatformApplicationAttributes")
	params["PlatformApplicationArn"] = platformApplicationArn

	response := &GetPlatformApplicationAttributesResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

// Lists the endpoints and endpoint attributes for devices in a supported push notification service, such as GCM and APNS.
// The results for ListEndpointsByPlatformApplication are paginated and return a limited list of endpoints, up to 100.
// If additional records are available after the first page results, then a NextToken string will be returned.
// To receive the next page, you call ListEndpointsByPlatformApplication again using the NextToken string received from the previous call.
// When there are no more records to return, NextToken will be null.
func (sns *SNS) ListEndpointsByPlatformApplication(platformApplicationArn, nextToken string) (*ListEndpointsByPlatformApplicationResponse, error) {
	params := aws.MakeParams("ListEndpointsByPlatformApplication")
	params["PlatformApplicationArn"] = platformApplicationArn

	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	response := &ListEndpointsByPlatformApplicationResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

func (sns *SNS) ListAllEndpointsByPlatformApplication(platformApplicationArn string) ([]Endpoint, error) {
	endpoints := make([]Endpoint, 0)
	nextToken := ""

	for {
		response, err := sns.ListEndpointsByPlatformApplication(platformApplicationArn, nextToken)
		if err != nil {
			return endpoints, err
		}
		for _, endpoint := range response.Endpoints {
			endpoints = append(endpoints, endpoint)
		}
		nextToken = response.NextToken
		if nextToken == "" {
			break
		}
	}

	return endpoints, nil
}

// Lists the platform application objects for the supported push notification services, such as APNS and GCM.
// The results for ListPlatformApplications are paginated and return a limited list of applications, up to 100.
// If additional records are available after the first page results, then a NextToken string will be returned.
// To receive the next page, you call ListPlatformApplications using the NextToken string received from the previous call.
// When there are no more records to return, NextToken will be null.
func (sns *SNS) ListPlatformApplications(nextToken string) (*ListPlatformApplicationsResponse, error) {
	params := aws.MakeParams("ListPlatformApplications")

	if nextToken != "" {
		params["NextToken"] = nextToken
	}

	response := &ListPlatformApplicationsResponse{}
	err := sns.query("GET", params, response)

	return response, err
}

func (sns *SNS) ListAllPlatformApplications() ([]PlatformApplication, error) {
	applications := make([]PlatformApplication, 0)
	nextToken := ""

	for {
		response, err := sns.ListPlatformApplications(nextToken)
		if err != nil {
			return applications, err
		}
		for _, app := range response.PlatformApplications {
			applications = append(applications, app)
		}
		nextToken = response.NextToken
		if nextToken == "" {
			break
		}
	}

	return applications, nil
}

// Sets the attributes for an endpoint for a device on one of the supported push notification services, such as GCM and APNS
func (sns *SNS) SetEndpointAttributes(endpointArn string, attributes []Attribute) (*SetEndpointAttributesResponse, error) {
	params := aws.MakeParams("SetEndpointAttributes")
	params["EndpointArn"] = endpointArn

	for i, attr := range attributes {
		params[fmt.Sprintf("Attributes.entry.%d.key", i+1)] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%d.value", i+1)] = attr.Value
	}

	response := &SetEndpointAttributesResponse{}
	err := sns.query("POST", params, response)

	return response, err
}

// Sets the attributes of the platform application object for the supported push notification services, such as APNS and GCM
func (sns *SNS) SetPlatformApplicationAttributes(platformApplicationArn string, attributes []Attribute) (*SetPlatformApplicationAttributesResponse, error) {
	params := aws.MakeParams("SetPlatformApplicationAttributes")
	params["PlatformApplicationArn"] = platformApplicationArn

	for i, attr := range attributes {
		params[fmt.Sprintf("Attributes.entry.%d.key", i+1)] = attr.Key
		params[fmt.Sprintf("Attributes.entry.%d.value", i+1)] = attr.Value
	}

	response := &SetPlatformApplicationAttributesResponse{}
	err := sns.query("POST", params, response)

	return response, err
}
