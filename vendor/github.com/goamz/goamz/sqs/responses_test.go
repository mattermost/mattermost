package sqs

var TestCreateQueueXmlOK = `
<CreateQueueResponse>
  <CreateQueueResult>
    <QueueUrl>http://sqs.us-east-1.amazonaws.com/123456789012/testQueue</QueueUrl>
  </CreateQueueResult>
  <ResponseMetadata>
    <RequestId>7a62c49f-347e-4fc4-9331-6e8e7a96aa73</RequestId>
  </ResponseMetadata>
</CreateQueueResponse>
`

var TestListQueuesXmlOK = `
<ListQueuesResponse>
  <ListQueuesResult>
    <QueueUrl>http://sqs.us-east-1.amazonaws.com/123456789012/testQueue</QueueUrl>
  </ListQueuesResult>
  <ResponseMetadata>
    <RequestId>725275ae-0b9b-4762-b238-436d7c65a1ac</RequestId>
  </ResponseMetadata>
</ListQueuesResponse>
`

var TestDeleteQueueXmlOK = `
<DeleteQueueResponse>
  <ResponseMetadata>
    <RequestId>6fde8d1e-52cd-4581-8cd9-c512f4c64223</RequestId>
  </ResponseMetadata>
</DeleteQueueResponse>
`

var TestPurgeQueueXmlOK = `
<PurgeQueueResponse>
  <ResponseMetadata>
    <RequestId>6fde8d1e-52cd-4581-8cd9-c512f4c64223</RequestId>
  </ResponseMetadata>
</PurgeQueueResponse>
`

var TestSendMessageXmlOK = `
<SendMessageResponse>
  <SendMessageResult>
    <MD5OfMessageBody>fafb00f5732ab283681e124bf8747ed1</MD5OfMessageBody>
    <MessageId>5fea7756-0ea4-451a-a703-a558b933e274</MessageId>
    <MD5OfMessageAttributes>ba056227cfd9533dba1f72ad9816d233</MD5OfMessageAttributes>
  </SendMessageResult>
  <ResponseMetadata>
    <RequestId>27daac76-34dd-47df-bd01-1f6e873584a0</RequestId>
  </ResponseMetadata>
</SendMessageResponse>
`

var TestSendMessageBatchXmlOk = `
<SendMessageBatchResponse>
<SendMessageBatchResult>
    <SendMessageBatchResultEntry>
        <Id>test_msg_001</Id>
        <MessageId>0a5231c7-8bff-4955-be2e-8dc7c50a25fa</MessageId>
        <MD5OfMessageBody>0e024d309850c78cba5eabbeff7cae71</MD5OfMessageBody>
    </SendMessageBatchResultEntry>
    <SendMessageBatchResultEntry>
        <Id>test_msg_002</Id>
        <MessageId>15ee1ed3-87e7-40c1-bdaa-2e49968ea7e9</MessageId>
        <MD5OfMessageBody>7fb8146a82f95e0af155278f406862c2</MD5OfMessageBody>
    </SendMessageBatchResultEntry>
</SendMessageBatchResult>
<ResponseMetadata>
    <RequestId>ca1ad5d0-8271-408b-8d0f-1351bf547e74</RequestId>
</ResponseMetadata>
</SendMessageBatchResponse>
`

var TestReceiveMessageXmlOK = `
<ReceiveMessageResponse>
  <ReceiveMessageResult>
    <Message>
      <MessageId>5fea7756-0ea4-451a-a703-a558b933e274</MessageId>
      <ReceiptHandle>MbZj6wDWli+JvwwJaBV+3dcjk2YW2vA3+STFFljTM8tJJg6HRG6PYSasuWXPJB+CwLj1FjgXUv1uSj1gUPAWV66FU/WeR4mq2OKpEGYWbnLmpRCJVAyeMjeU5ZBdtcQ+QEauMZc8ZRv37sIW2iJKq3M9MFx1YvV11A2x/KSbkJ0=</ReceiptHandle>
      <MD5OfBody>fafb00f5732ab283681e124bf8747ed1</MD5OfBody>
      <Body>This is a test message</Body>
      <Attribute>
        <Name>SenderId</Name>
        <Value>195004372649</Value>
      </Attribute>
      <Attribute>
        <Name>SentTimestamp</Name>
        <Value>1238099229000</Value>
      </Attribute>
      <Attribute>
        <Name>ApproximateReceiveCount</Name>
        <Value>5</Value>
      </Attribute>
      <Attribute>
        <Name>ApproximateFirstReceiveTimestamp</Name>
        <Value>1250700979248</Value>
      </Attribute>
      <MessageAttribute>
        <Name>CustomAttribute</Name>
        <Value>
          <DataType>String</DataType>
          <StringValue>Testing, testing, 1, 2, 3</StringValue>
        </Value>
      </MessageAttribute>
      <MessageAttribute>
        <Name>BinaryCustomAttribute</Name>
        <Value>
          <DataType>Binary</DataType>
          <BinaryValue>iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAABA0lEQVQ4T72UrQ4CMRCEewhyiiBPopBgcfAUSIICB88CDhRB8hTgsCBRyJMEdUFwZJpMs/3LHQlhVdPufJ1ut03UjyKJcR5zVc4umbW87eeqvVFBjTdJwP54D+4xGXVUCGiBxoOsJOCd9IKgRnnV8wAezrnRmwGcpKtCJ8UgJBNWLFNzVAOimyqIhElXGkQ3LmQ6fKrdqaW1cixhdKVBcEOBLEwViBugVv8B1elVuLYcoTea624drcl5LW4KTRsFhQpLtVzzQKGCh2DuHI8FvdVH7vGQKEPerHRjgegKMESsXgAgWBtu5D1a9BQWCXSrzx9BvjPPkRQR6IJcQNTRV/cvkj93DqUTWzVDIQAAAABJRU5ErkJggg==</BinaryValue>
        </Value>
      </MessageAttribute>
    </Message>
  </ReceiveMessageResult>
<ResponseMetadata>
  <RequestId>b6633655-283d-45b4-aee4-4e84e0ae6afa</RequestId>
</ResponseMetadata>
</ReceiveMessageResponse>
`

var TestChangeMessageVisibilityXmlOK = `
<ChangeMessageVisibilityResponse>
    <ResponseMetadata>
            <RequestId>6a7a282a-d013-4a59-aba9-335b0fa48bed</RequestId>
    </ResponseMetadata>
</ChangeMessageVisibilityResponse>
`

var TestDeleteMessageBatchXmlOK = `
<DeleteMessageBatchResponse>
    <DeleteMessageBatchResult>
        <DeleteMessageBatchResultEntry>
            <Id>msg1</Id>
        </DeleteMessageBatchResultEntry>
        <DeleteMessageBatchResultEntry>
            <Id>msg2</Id>
        </DeleteMessageBatchResultEntry>
    </DeleteMessageBatchResult>
    <ResponseMetadata>
        <RequestId>d6f86b7a-74d1-4439-b43f-196a1e29cd85</RequestId>
    </ResponseMetadata>
</DeleteMessageBatchResponse>
`

var TestDeleteMessageUsingReceiptXmlOK = `
<DeleteMessageResponse>
    <ResponseMetadata>
        <RequestId>d6d86b7a-74d1-4439-b43f-196a1e29cd85</RequestId>
    </ResponseMetadata>
</DeleteMessageResponse>
`

var TestGetQueueAttributesXmlOK = `
<GetQueueAttributesResponse>
  <GetQueueAttributesResult>
    <Attribute>
      <Name>ReceiveMessageWaitTimeSeconds</Name>
      <Value>2</Value>
    </Attribute>
    <Attribute>
      <Name>VisibilityTimeout</Name>
      <Value>30</Value>
    </Attribute>
    <Attribute>
      <Name>ApproximateNumberOfMessages</Name>
      <Value>0</Value>
    </Attribute>
    <Attribute>
      <Name>ApproximateNumberOfMessagesNotVisible</Name>
      <Value>0</Value>
    </Attribute>
    <Attribute>
      <Name>CreatedTimestamp</Name>
      <Value>1286771522</Value>
    </Attribute>
    <Attribute>
      <Name>LastModifiedTimestamp</Name>
      <Value>1286771522</Value>
    </Attribute>
    <Attribute>
      <Name>QueueArn</Name>
      <Value>arn:aws:sqs:us-east-1:123456789012:qfoo</Value>
    </Attribute>
    <Attribute>
      <Name>MaximumMessageSize</Name>
      <Value>8192</Value>
    </Attribute>
    <Attribute>
      <Name>MessageRetentionPeriod</Name>
      <Value>345600</Value>
    </Attribute>
  </GetQueueAttributesResult>
  <ResponseMetadata>
    <RequestId>1ea71be5-b5a2-4f9d-b85a-945d8d08cd0b</RequestId>
  </ResponseMetadata>
</GetQueueAttributesResponse>
`
