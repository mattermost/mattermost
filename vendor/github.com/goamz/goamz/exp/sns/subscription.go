package sns

type Subscription struct {
	Endpoint        string
	Owner           string
	Protocol        string
	SubscriptionArn string
	TopicArn        string
}

type ListSubscriptionsResp struct {
	Subscriptions []Subscription `xml:"ListSubscriptionsResult>Subscriptions>member"`
	NextToken     string
	ResponseMetadata
}

type PublishOpt struct {
	Message          string
	MessageStructure string
	Subject          string
	TopicArn         string
	TargetArn        string
}

type PublishResp struct {
	MessageId string `xml:"PublishResult>MessageId"`
	ResponseMetadata
}

type SubscribeResponse struct {
	SubscriptionArn string `xml:"SubscribeResult>SubscriptionArn"`
	ResponseMetadata
}

type UnsubscribeResponse struct {
	ResponseMetadata
}

type ConfirmSubscriptionResponse struct {
	SubscriptionArn string `xml:"ConfirmSubscriptionResult>SubscriptionArn"`
	ResponseMetadata
}

type ConfirmSubscriptionOpt struct {
	AuthenticateOnUnsubscribe string
	Token                     string
	TopicArn                  string
}

type ListSubscriptionByTopicResponse struct {
	Subscriptions []Subscription `xml:"ListSubscriptionsByTopicResult>Subscriptions>member"`
	ResponseMetadata
}

type ListSubscriptionByTopicOpt struct {
	NextToken string
	TopicArn  string
}

// Publish
//
// See http://goo.gl/AY2D8 for more details.
func (sns *SNS) Publish(options *PublishOpt) (resp *PublishResp, err error) {
	resp = &PublishResp{}
	params := makeParams("Publish")

	if options.Subject != "" {
		params["Subject"] = options.Subject
	}

	if options.MessageStructure != "" {
		params["MessageStructure"] = options.MessageStructure
	}

	if options.Message != "" {
		params["Message"] = options.Message
	}

	if options.TopicArn != "" {
		params["TopicArn"] = options.TopicArn
	}

	if options.TargetArn != "" {
		params["TargetArn"] = options.TargetArn
	}

	err = sns.query(params, resp)
	return
}

// Subscribe
//
// See http://goo.gl/c3iGS for more details.
func (sns *SNS) Subscribe(Endpoint, Protocol, TopicArn string) (resp *SubscribeResponse, err error) {
	resp = &SubscribeResponse{}
	params := makeParams("Subscribe")

	params["Endpoint"] = Endpoint
	params["Protocol"] = Protocol
	params["TopicArn"] = TopicArn

	err = sns.query(params, resp)
	return
}

// Unsubscribe
//
// See http://goo.gl/4l5Ge for more details.
func (sns *SNS) Unsubscribe(SubscriptionArn string) (resp *UnsubscribeResponse, err error) {
	resp = &UnsubscribeResponse{}
	params := makeParams("Unsubscribe")

	params["SubscriptionArn"] = SubscriptionArn

	err = sns.query(params, resp)
	return
}

// ConfirmSubscription
//
// See http://goo.gl/3hXzH for more details.
func (sns *SNS) ConfirmSubscription(options *ConfirmSubscriptionOpt) (resp *ConfirmSubscriptionResponse, err error) {
	resp = &ConfirmSubscriptionResponse{}
	params := makeParams("ConfirmSubscription")

	if options.AuthenticateOnUnsubscribe != "" {
		params["AuthenticateOnUnsubscribe"] = options.AuthenticateOnUnsubscribe
	}

	params["Token"] = options.Token
	params["TopicArn"] = options.TopicArn

	err = sns.query(params, resp)
	return
}

// ListSubscriptions
//
// See http://goo.gl/k3aGn for more details.
func (sns *SNS) ListSubscriptions(NextToken *string) (resp *ListSubscriptionsResp, err error) {
	resp = &ListSubscriptionsResp{}
	params := makeParams("ListSubscriptions")
	if NextToken != nil {
		params["NextToken"] = *NextToken
	}
	err = sns.query(params, resp)
	return
}

// ListSubscriptionByTopic
//
// See http://goo.gl/LaVcC for more details.
func (sns *SNS) ListSubscriptionByTopic(options *ListSubscriptionByTopicOpt) (resp *ListSubscriptionByTopicResponse, err error) {
	resp = &ListSubscriptionByTopicResponse{}
	params := makeParams("ListSbubscriptionByTopic")

	if options.NextToken != "" {
		params["NextToken"] = options.NextToken
	}

	params["TopicArn"] = options.TopicArn

	err = sns.query(params, resp)
	return
}
