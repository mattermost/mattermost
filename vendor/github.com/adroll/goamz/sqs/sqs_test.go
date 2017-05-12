package sqs

import (
	"crypto/md5"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"gopkg.in/check.v1"
	"hash"
	"reflect"
)

var _ = check.Suite(&S{})

type S struct {
	HTTPSuite
	sqs *SQS
}

func (s *S) SetUpSuite(c *check.C) {
	s.HTTPSuite.SetUpSuite(c)
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.sqs = New(auth, aws.Region{SQSEndpoint: testServer.URL})
}

func (s *S) TestCreateQueue(c *check.C) {
	testServer.PrepareResponse(200, nil, TestCreateQueueXmlOK)

	resp, err := s.sqs.CreateQueue("testQueue")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	fmt.Printf("%+v\n", req)
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"CreateQueue"})
	c.Assert(req.Form["Attribute.1.Name"], check.DeepEquals, []string{"VisibilityTimeout"})
	c.Assert(req.Form["Attribute.1.Value"], check.DeepEquals, []string{"30"})

	c.Assert(resp.Url, check.Equals, "http://sqs.us-east-1.amazonaws.com/123456789012/testQueue")
	c.Assert(err, check.IsNil)
}

func (s *S) TestCreateQueueWithTimeout(c *check.C) {
	testServer.PrepareResponse(200, nil, TestCreateQueueXmlOK)

	s.sqs.CreateQueueWithTimeout("testQueue", 180)
	req := testServer.WaitRequest()

	// TestCreateQueue() tests the core functionality, just check the timeout in this test
	c.Assert(req.Form["Attribute.1.Name"], check.DeepEquals, []string{"VisibilityTimeout"})
	c.Assert(req.Form["Attribute.1.Value"], check.DeepEquals, []string{"180"})
}

func (s *S) TestCreateQueueWithAttributes(c *check.C) {
	testServer.PrepareResponse(200, nil, TestCreateQueueXmlOK)

	s.sqs.CreateQueueWithAttributes("testQueue", map[string]string{
		"ReceiveMessageWaitTimeSeconds": "20",
		"MessageRetentionPeriod":        "60",
	})
	req := testServer.WaitRequest()

	// TestCreateQueue() tests the core functionality, just check the timeout in this test

	// Since attributes is a map the order is random,
	// So I modified the test so that it will not be sensitive to the order of the two attributes,
	c.Assert((reflect.DeepEqual(req.Form["Attribute.1.Name"], []string{"ReceiveMessageWaitTimeSeconds"}) ||
		reflect.DeepEqual(req.Form["Attribute.2.Name"], []string{"ReceiveMessageWaitTimeSeconds"})), check.Equals, true)
	c.Assert((reflect.DeepEqual(req.Form["Attribute.1.Value"], []string{"20"}) ||
		reflect.DeepEqual(req.Form["Attribute.2.Value"], []string{"20"})), check.Equals, true)
	c.Assert((reflect.DeepEqual(req.Form["Attribute.1.Name"], []string{"MessageRetentionPeriod"}) ||
		reflect.DeepEqual(req.Form["Attribute.2.Name"], []string{"MessageRetentionPeriod"})), check.Equals, true)
	c.Assert((reflect.DeepEqual(req.Form["Attribute.1.Value"], []string{"60"}) ||
		reflect.DeepEqual(req.Form["Attribute.2.Value"], []string{"60"})), check.Equals, true)
}

func (s *S) TestListQueues(c *check.C) {
	testServer.PrepareResponse(200, nil, TestListQueuesXmlOK)

	resp, err := s.sqs.ListQueues("")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.QueueUrl), check.Not(check.Equals), 0)
	c.Assert(resp.QueueUrl[0], check.Equals, "http://sqs.us-east-1.amazonaws.com/123456789012/testQueue")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "725275ae-0b9b-4762-b238-436d7c65a1ac")
	c.Assert(err, check.IsNil)
}

func (s *S) TestDeleteQueue(c *check.C) {
	testServer.PrepareResponse(200, nil, TestDeleteQueueXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	resp, err := q.Delete()
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "6fde8d1e-52cd-4581-8cd9-c512f4c64223")
	c.Assert(err, check.IsNil)
}

func (s *S) TestSendMessage(c *check.C) {
	testServer.PrepareResponse(200, nil, TestSendMessageXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	resp, err := q.SendMessage("This is a test message")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	msg := "This is a test message"
	var h hash.Hash = md5.New()
	h.Write([]byte(msg))
	c.Assert(resp.MD5, check.Equals, fmt.Sprintf("%x", h.Sum(nil)))
	c.Assert(resp.Id, check.Equals, "5fea7756-0ea4-451a-a703-a558b933e274")
	c.Assert(resp.AttributeMD5, check.Equals, "") // Since we sent no message attributes
	c.Assert(err, check.IsNil)
}

func (s *S) TestSendMessageWithMessageAttributes(c *check.C) {
	testServer.PrepareResponse(200, nil, TestSendMessageWithAttributesXmlOK)

	attributes := map[string]string{"red": "fish", "blue": "fish"}

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	resp, err := q.SendMessageWithAttributes("This is a test message", attributes)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	msg := "This is a test message"
	var h hash.Hash = md5.New()
	h.Write([]byte(msg))
	c.Assert(resp.MD5, check.Equals, fmt.Sprintf("%x", h.Sum(nil)))
	c.Assert(resp.Id, check.Equals, "5fea7756-0ea4-451a-a703-a558b933e274")
	c.Assert(resp.AttributeMD5, check.Equals, fmt.Sprintf("%x", calculateAttributeMD5(attributes)))
	c.Assert(err, check.IsNil)
}

func (s *S) TestSendMessageWithMessageAttributesInvalidAttributeMD5(c *check.C) {
	testServer.PrepareResponse(200, nil, TestSendMessageXmlInvalidAttributeMD5)

	attributes := map[string]string{"red": "fish", "blue": "fish"}

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	_, err := q.SendMessageWithAttributes("This is a test message", attributes)

	c.Assert(err.Error(), check.Equals, "Attribute MD5 mismatch, expecting `fe84d6b9875bc7a88b28014389b64ed0`, found `incorrect`")
}

func (s *S) TestSendMessageBatch(c *check.C) {
	testServer.PrepareResponse(200, nil, TestSendMessageBatchXmlOk)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}

	msgList := []string{"test message body 1", "test message body 2"}
	resp, err := q.SendMessageBatchString(msgList)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	for idx, msg := range msgList {
		var h hash.Hash = md5.New()
		h.Write([]byte(msg))
		c.Assert(resp.SendMessageBatchResult[idx].MD5OfMessageBody, check.Equals, fmt.Sprintf("%x", h.Sum(nil)))
		c.Assert(err, check.IsNil)
	}
}

func (s *S) TestSendMessageBatchWithAttributes(c *check.C) {
	testServer.PrepareResponse(200, nil, TestSendMessageWithAttributesBatchXmlOk)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}

	msgList := []Message{*(&Message{Body: "test message body 1"}), *(&Message{Body: "test message body 2"})}
	mAttrs := make(map[string]string)
	mAttrs["testKey"] = "testValue"
	resp, err := q.SendMessageBatchWithAttributes(msgList, mAttrs)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	for idx, msg := range msgList {
		var h hash.Hash = md5.New()
		h.Write([]byte(msg.Body))
		c.Assert(resp.SendMessageBatchResult[idx].MD5OfMessageBody, check.Equals, fmt.Sprintf("%x", h.Sum(nil)))
		c.Assert(err, check.IsNil)
	}
}

func (s *S) TestDeleteMessageBatch(c *check.C) {
	testServer.PrepareResponse(200, nil, TestDeleteMessageBatchXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}

	msgList := []Message{*(&Message{ReceiptHandle: "gfk0T0R0waama4fVFffkjPQrrvzMrOg0fTFk2LxT33EuB8wR0ZCFgKWyXGWFoqqpCIiprQUEhir%2F5LeGPpYTLzjqLQxyQYaQALeSNHb0us3uE84uujxpBhsDkZUQkjFFkNqBXn48xlMcVhTcI3YLH%2Bd%2BIqetIOHgBCZAPx6r%2B09dWaBXei6nbK5Ygih21DCDdAwFV68Jo8DXhb3ErEfoDqx7vyvC5nCpdwqv%2BJhU%2FTNGjNN8t51v5c%2FAXvQsAzyZVNapxUrHIt4NxRhKJ72uICcxruyE8eRXlxIVNgeNP8ZEDcw7zZU1Zw%3D%3D"}),
		*(&Message{ReceiptHandle: "gfk0T0R0waama4fVFffkjKzmhMCymjQvfTFk2LxT33G4ms5subrE0deLKWSscPU1oD3J9zgeS4PQQ3U30qOumIE6AdAv3w%2F%2Fa1IXW6AqaWhGsEPaLm3Vf6IiWqdM8u5imB%2BNTwj3tQRzOWdTOePjOjPcTpRxBtXix%2BEvwJOZUma9wabv%2BSw6ZHjwmNcVDx8dZXJhVp16Bksiox%2FGrUvrVTCJRTWTLc59oHLLF8sEkKzRmGNzTDGTiV%2BYjHfQj60FD3rVaXmzTsoNxRhKJ72uIHVMGVQiAGgB%2BqAbSqfKHDQtVOmJJgkHug%3D%3D"}),
	}

	resp, err := q.DeleteMessageBatch(msgList)
	c.Assert(err, check.IsNil)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	for idx, _ := range msgList {
		c.Assert(resp.DeleteMessageBatchResult[idx].Id, check.Equals, fmt.Sprintf("msg%d", idx+1))
	}
}

func (s *S) TestPurgeQueue(c *check.C) {
	testServer.PrepareResponse(200, nil, TestPurgeQueueXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	resp, err := q.PurgeQueue()
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "6fde8d1e-52cd-4581-8cd9-c512f4c64223")
	c.Assert(err, check.IsNil)
}

func (s *S) TestReceiveMessage(c *check.C) {
	testServer.PrepareResponse(200, nil, TestReceiveMessageXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	resp, err := q.ReceiveMessage(5)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Messages), check.Not(check.Equals), 0)
	c.Assert(resp.Messages[0].MessageId, check.Equals, "5fea7756-0ea4-451a-a703-a558b933e274")
	c.Assert(resp.Messages[0].MD5OfBody, check.Equals, "fafb00f5732ab283681e124bf8747ed1")
	c.Assert(resp.Messages[0].ReceiptHandle, check.Equals, "MbZj6wDWli+JvwwJaBV+3dcjk2YW2vA3+STFFljTM8tJJg6HRG6PYSasuWXPJB+CwLj1FjgXUv1uSj1gUPAWV66FU/WeR4mq2OKpEGYWbnLmpRCJVAyeMjeU5ZBdtcQ+QEauMZc8ZRv37sIW2iJKq3M9MFx1YvV11A2x/KSbkJ0=")
	c.Assert(resp.Messages[0].Body, check.Equals, "This is a test message")

	c.Assert(len(resp.Messages[0].Attribute), check.Not(check.Equals), 0)
	c.Assert(len(resp.Messages[0].MessageAttribute), check.Equals, 0)

	expectedAttributeResults := []struct {
		Name  string
		Value string
	}{
		{Name: "SenderId", Value: "195004372649"},
		{Name: "SentTimestamp", Value: "1238099229000"},
		{Name: "ApproximateReceiveCount", Value: "5"},
		{Name: "ApproximateFirstReceiveTimestamp", Value: "1250700979248"},
	}

	for i, expected := range expectedAttributeResults {
		c.Assert(resp.Messages[0].Attribute[i].Name, check.Equals, expected.Name)
		c.Assert(resp.Messages[0].Attribute[i].Value, check.Equals, expected.Value)
	}

	c.Assert(err, check.IsNil)
}

func (s *S) TestReceiveMessageWithAttributes(c *check.C) {
	testServer.PrepareResponse(200, nil, TestReceiveMessageWithAttributesXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}
	resp, err := q.ReceiveMessage(5)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(len(resp.Messages), check.Not(check.Equals), 0)
	c.Assert(resp.Messages[0].MessageId, check.Equals, "5fea7756-0ea4-451a-a703-a558b933e274")
	c.Assert(resp.Messages[0].MD5OfBody, check.Equals, "fafb00f5732ab283681e124bf8747ed1")
	c.Assert(resp.Messages[0].ReceiptHandle, check.Equals, "MbZj6wDWli+JvwwJaBV+3dcjk2YW2vA3+STFFljTM8tJJg6HRG6PYSasuWXPJB+CwLj1FjgXUv1uSj1gUPAWV66FU/WeR4mq2OKpEGYWbnLmpRCJVAyeMjeU5ZBdtcQ+QEauMZc8ZRv37sIW2iJKq3M9MFx1YvV11A2x/KSbkJ0=")
	c.Assert(resp.Messages[0].Body, check.Equals, "This is a test message")

	c.Assert(len(resp.Messages[0].Attribute), check.Not(check.Equals), 0)
	c.Assert(len(resp.Messages[0].MessageAttribute), check.Not(check.Equals), 0)

	expectedAttributeResults := []struct {
		Name  string
		Value string
	}{
		{Name: "SenderId", Value: "195004372649"},
		{Name: "SentTimestamp", Value: "1238099229000"},
		{Name: "ApproximateReceiveCount", Value: "5"},
		{Name: "ApproximateFirstReceiveTimestamp", Value: "1250700979248"},
	}

	for i, expected := range expectedAttributeResults {
		c.Assert(resp.Messages[0].Attribute[i].Name, check.Equals, expected.Name)
		c.Assert(resp.Messages[0].Attribute[i].Value, check.Equals, expected.Value)
	}

	expectedMessageAttributeResults := []struct {
		Name  string
		Value string
	}{
		{Name: "Hero", Value: "James Bond"},
		{Name: "Villian", Value: "Goldfinger"},
	}

	for i, expected := range expectedMessageAttributeResults {
		c.Assert(resp.Messages[0].MessageAttribute[i].Name, check.Equals, expected.Name)
		c.Assert(resp.Messages[0].MessageAttribute[i].Value.DataType, check.Equals, "String")
		c.Assert(resp.Messages[0].MessageAttribute[i].Value.StringValue, check.Equals, expected.Value)
	}

	c.Assert(err, check.IsNil)
}

func (s *S) TestChangeMessageVisibility(c *check.C) {
	testServer.PrepareResponse(200, nil, TestReceiveMessageXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}

	resp1, err := q.ReceiveMessage(1)
	req := testServer.WaitRequest()

	testServer.PrepareResponse(200, nil, TestChangeMessageVisibilityXmlOK)

	resp, err := q.ChangeMessageVisibility(&resp1.Messages[0], 50)
	req = testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "6a7a282a-d013-4a59-aba9-335b0fa48bed")
	c.Assert(err, check.IsNil)
}

func (s *S) TestGetQueueAttributes(c *check.C) {
	testServer.PrepareResponse(200, nil, TestGetQueueAttributesXmlOK)

	q := &Queue{s.sqs, testServer.URL + "/123456789012/testQueue/"}

	resp, err := q.GetQueueAttributes("All")
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/123456789012/testQueue/")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "1ea71be5-b5a2-4f9d-b85a-945d8d08cd0b")

	c.Assert(len(resp.Attributes), check.Equals, 9)

	expectedResults := []struct {
		Name  string
		Value string
	}{
		{Name: "ReceiveMessageWaitTimeSeconds", Value: "2"},
		{Name: "VisibilityTimeout", Value: "30"},
		{Name: "ApproximateNumberOfMessages", Value: "0"},
		{Name: "ApproximateNumberOfMessagesNotVisible", Value: "0"},
		{Name: "CreatedTimestamp", Value: "1286771522"},
		{Name: "LastModifiedTimestamp", Value: "1286771522"},
		{Name: "QueueArn", Value: "arn:aws:sqs:us-east-1:123456789012:qfoo"},
		{Name: "MaximumMessageSize", Value: "8192"},
		{Name: "MessageRetentionPeriod", Value: "345600"},
	}

	for i, expected := range expectedResults {
		c.Assert(resp.Attributes[i].Name, check.Equals, expected.Name)
		c.Assert(resp.Attributes[i].Value, check.Equals, expected.Value)
	}

	c.Assert(err, check.IsNil)
}
