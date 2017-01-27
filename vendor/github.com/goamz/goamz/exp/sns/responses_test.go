package sns_test

var TestListTopicsXmlOK = `
<?xml version="1.0"?>
<ListTopicsResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ListTopicsResult>
    <Topics>
      <member>
        <TopicArn>arn:aws:sns:us-west-1:331995417492:Transcoding</TopicArn>
      </member>
    </Topics>
  </ListTopicsResult>
  <ResponseMetadata>
    <RequestId>bd10b26c-e30e-11e0-ba29-93c3aca2f103</RequestId>
  </ResponseMetadata>
</ListTopicsResponse>
`

var TestCreateTopicXmlOK = `
<?xml version="1.0"?>
<CreateTopicResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <CreateTopicResult>
    <TopicArn>arn:aws:sns:us-east-1:123456789012:My-Topic</TopicArn>
  </CreateTopicResult>
  <ResponseMetadata>
    <RequestId>a8dec8b3-33a4-11df-8963-01868b7c937a</RequestId>
  </ResponseMetadata>
</CreateTopicResponse>
`

var TestDeleteTopicXmlOK = `
<DeleteTopicResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>f3aa9ac9-3c3d-11df-8235-9dab105e9c32</RequestId>
  </ResponseMetadata>
</DeleteTopicResponse>
`

var TestListSubscriptionsXmlOK = `
<ListSubscriptionsResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ListSubscriptionsResult>
    <Subscriptions>
      <member>
        <TopicArn>arn:aws:sns:us-east-1:698519295917:My-Topic</TopicArn>
        <Protocol>email</Protocol>
        <SubscriptionArn>arn:aws:sns:us-east-1:123456789012:My-Topic:80289ba6-0fd4-4079-afb4-ce8c8260f0ca</SubscriptionArn>
        <Owner>123456789012</Owner>
        <Endpoint>example@amazon.com</Endpoint>
      </member>
    </Subscriptions>
  </ListSubscriptionsResult>
  <ResponseMetadata>
    <RequestId>384ac68d-3775-11df-8963-01868b7c937a</RequestId>
  </ResponseMetadata>
</ListSubscriptionsResponse>
`

var TestGetTopicAttributesXmlOK = `
<GetTopicAttributesResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <GetTopicAttributesResult>
     <Attributes>
       <entry>
         <key>Owner</key>
         <value>123456789012</value>
       </entry>
       <entry>
         <key>Policy</key>
         <value>{"Version":"2008-10-17","Id":"us-east-1/698519295917/test__default_policy_ID","Statement" : [{"Effect":"Allow","Sid":"us-east-1/698519295917/test__default_statement_ID","Principal" : {"AWS": "*"},"Action":["SNS:GetTopicAttributes","SNS:SetTopicAttributes","SNS:AddPermission","SNS:RemovePermission","SNS:DeleteTopic","SNS:Subscribe","SNS:ListSubscriptionsByTopic","SNS:Publish","SNS:Receive"],"Resource":"arn:aws:sns:us-east-1:698519295917:test","Condition" : {"StringLike" : {"AWS:SourceArn": "arn:aws:*:*:698519295917:*"}}}]}</value>
       </entry>
       <entry>
         <key>TopicArn</key>
         <value>arn:aws:sns:us-east-1:123456789012:My-Topic</value>
       </entry>
     </Attributes>
  </GetTopicAttributesResult>
  <ResponseMetadata>
    <RequestId>057f074c-33a7-11df-9540-99d0768312d3</RequestId>
  </ResponseMetadata>
</GetTopicAttributesResponse>
`

var TestPublishXmlOK = `
<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <PublishResult>
    <MessageId>94f20ce6-13c5-43a0-9a9e-ca52d816e90b</MessageId>
  </PublishResult>
  <ResponseMetadata>
    <RequestId>f187a3c1-376f-11df-8963-01868b7c937a</RequestId>
  </ResponseMetadata>
</PublishResponse>
`

var TestSetTopicAttributesXmlOK = `
<SetTopicAttributesResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>a8763b99-33a7-11df-a9b7-05d48da6f042</RequestId>
  </ResponseMetadata>
</SetTopicAttributesResponse>
`

var TestSubscribeXmlOK = `
<SubscribeResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <SubscribeResult>
    <SubscriptionArn>pending confirmation</SubscriptionArn>
  </SubscribeResult>
  <ResponseMetadata>
    <RequestId>a169c740-3766-11df-8963-01868b7c937a</RequestId>
  </ResponseMetadata>
</SubscribeResponse>
`

var TestUnsubscribeXmlOK = `
<UnsubscribeResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>18e0ac39-3776-11df-84c0-b93cc1666b84</RequestId>
  </ResponseMetadata>
</UnsubscribeResponse>
`

var TestConfirmSubscriptionXmlOK = `
<ConfirmSubscriptionResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ConfirmSubscriptionResult>
    <SubscriptionArn>arn:aws:sns:us-east-1:123456789012:My-Topic:80289ba6-0fd4-4079-afb4-ce8c8260f0ca</SubscriptionArn>
  </ConfirmSubscriptionResult>
  <ResponseMetadata>
    <RequestId>7a50221f-3774-11df-a9b7-05d48da6f042</RequestId>
  </ResponseMetadata>
</ConfirmSubscriptionResponse>
`

var TestAddPermissionXmlOK = `
<AddPermissionResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>6a213e4e-33a8-11df-9540-99d0768312d3</RequestId>
  </ResponseMetadata>
</AddPermissionResponse>
`

var TestRemovePermissionXmlOK = `
<RemovePermissionResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>d170b150-33a8-11df-995a-2d6fbe836cc1</RequestId>
  </ResponseMetadata>
</RemovePermissionResponse>
`

var TestListSubscriptionsByTopicXmlOK = `
<ListSubscriptionsByTopicResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ListSubscriptionsByTopicResult>
    <Subscriptions>
      <member>
        <TopicArn>arn:aws:sns:us-east-1:123456789012:My-Topic</TopicArn>
        <Protocol>email</Protocol>
        <SubscriptionArn>arn:aws:sns:us-east-1:123456789012:My-Topic:80289ba6-0fd4-4079-afb4-ce8c8260f0ca</SubscriptionArn>
        <Owner>123456789012</Owner>
        <Endpoint>example@amazon.com</Endpoint>
      </member>
    </Subscriptions>
  </ListSubscriptionsByTopicResult>
  <ResponseMetadata>
    <RequestId>b9275252-3774-11df-9540-99d0768312d3</RequestId>
  </ResponseMetadata>
</ListSubscriptionsByTopicResponse>
`

var TestCreatePlatformApplicationXmlOK = `
<CreatePlatformApplicationResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <CreatePlatformApplicationResult>
    <PlatformApplicationArn>arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp</PlatformApplicationArn>
  </CreatePlatformApplicationResult>
  <ResponseMetadata>
    <RequestId>b6f0e78b-e9d4-5a0e-b973-adc04e8a4ff9</RequestId>
  </ResponseMetadata>
</CreatePlatformApplicationResponse>
`

var TestCreatePlatformEndpointXmlOK = `
<CreatePlatformEndpointResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <CreatePlatformEndpointResult>
    <EndpointArn>arn:aws:sns:us-west-2:123456789012:endpoint/GCM/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3</EndpointArn>
  </CreatePlatformEndpointResult>
  <ResponseMetadata>
    <RequestId>6613341d-3e15-53f7-bf3c-7e56994ba278</RequestId>
  </ResponseMetadata>
</CreatePlatformEndpointResponse>
`

var DeleteEndpointXmlOK = `
<DeleteEndpointResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>c1d2b191-353c-5a5f-8969-fbdd3900afa8</RequestId>
  </ResponseMetadata>
</DeleteEndpointResponse>
`

var TestDeletePlatformApplicationXmlOK = `
<DeletePlatformApplicationResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>097dac18-7a77-5823-a8dd-e65476dcb037</RequestId>
  </ResponseMetadata>
</DeletePlatformApplicationResponse>
`

var TestGetEndpointAttributesXmlOK = `
<GetEndpointAttributesResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <GetEndpointAttributesResult>
    <Attributes>
      <entry>
        <key>Enabled</key>
        <value>true</value>
      </entry>
      <entry>
        <key>CustomUserData</key>
        <value>UserId=01234567</value>
      </entry>
      <entry>
        <key>Token</key>
        <value>APA91bGi7fFachkC1xjlqT66VYEucGHochmf1VQAr9k...jsM0PKPxKhddCzx6paEsyay9Zn3D4wNUJb8m6HZrBEXAMPLE</value>
      </entry>
    </Attributes>
  </GetEndpointAttributesResult>
  <ResponseMetadata>
    <RequestId>6c725a19-a142-5b77-94f9-1055a9ea04e7</RequestId>
  </ResponseMetadata>
</GetEndpointAttributesResponse>
`

var TestGetPlatformApplicationAttributesXmlOK = `
<GetPlatformApplicationAttributesResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <GetPlatformApplicationAttributesResult>
    <Attributes>
      <entry>
        <key>AllowEndpointPolicies</key>
        <value>false</value>
      </entry>
    </Attributes>
  </GetPlatformApplicationAttributesResult>
  <ResponseMetadata>
    <RequestId>74848df2-87f6-55ed-890c-c7be80442462</RequestId>
  </ResponseMetadata>
</GetPlatformApplicationAttributesResponse>
`

var TestListEndpointsByPlatformApplicationXmlOK = `
<ListEndpointsByPlatformApplicationResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ListEndpointsByPlatformApplicationResult>
    <Endpoints>
      <member>
        <EndpointArn>arn:aws:sns:us-west-2:123456789012:endpoint/GCM/gcmpushapp/5e3e9847-3183-3f18-a7e8-671c3a57d4b3</EndpointArn>
        <Attributes>
          <entry>
            <key>Enabled</key>
            <value>true</value>
          </entry>
          <entry>
            <key>CustomUserData</key>
            <value>UserId=27576823</value>
          </entry>
          <entry>
            <key>Token</key>
            <value>APA91bGi7fFachkC1xjlqT66VYEucGHochmf1VQAr9k...jsM0PKPxKhddCzx6paEsyay9Zn3D4wNUJb8m6HZrBEXAMPLE</value>
          </entry>
        </Attributes>
      </member>
    </Endpoints>
  </ListEndpointsByPlatformApplicationResult>
  <ResponseMetadata>
    <RequestId>9a48768c-dac8-5a60-aec0-3cc27ea08d96</RequestId>
  </ResponseMetadata>
</ListEndpointsByPlatformApplicationResponse>
`

var TestListPlatformApplicationsXmlOK = `
<ListPlatformApplicationsResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ListPlatformApplicationsResult>
    <PlatformApplications>
      <member>
        <PlatformApplicationArn>arn:aws:sns:us-west-2:123456789012:app/APNS_SANDBOX/apnspushapp</PlatformApplicationArn>
        <Attributes>
          <entry>
            <key>AllowEndpointPolicies</key>
            <value>false</value>
          </entry>
        </Attributes>
      </member>
      <member>
        <PlatformApplicationArn>arn:aws:sns:us-west-2:123456789012:app/GCM/gcmpushapp</PlatformApplicationArn>
        <Attributes>
          <entry>
            <key>AllowEndpointPolicies</key>
            <value>false</value>
          </entry>
        </Attributes>
      </member>
    </PlatformApplications>
  </ListPlatformApplicationsResult>
  <ResponseMetadata>
    <RequestId>315a335e-85d8-52df-9349-791283cbb529</RequestId>
  </ResponseMetadata>
</ListPlatformApplicationsResponse>
`

var TestSetEndpointAttributesXmlOK = `
<SetEndpointAttributesResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>2fe0bfc7-3e85-5ee5-a9e2-f58b35e85f6a</RequestId>
  </ResponseMetadata>
</SetEndpointAttributesResponse>
`

var TestSetPlatformApplicationAttributesXmlOK = `
<SetPlatformApplicationAttributesResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">
  <ResponseMetadata>
    <RequestId>cf577bcc-b3dc-5463-88f1-3180b9412395</RequestId>
  </ResponseMetadata>
</SetPlatformApplicationAttributesResponse>
`
