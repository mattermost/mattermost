package ses_test

import (
	"encoding/json"
	"time"

	"gopkg.in/check.v1"

	"github.com/AdRoll/goamz/exp/ses"
)

func (s *S) TestSNSBounceNotificationUnmarshalling(c *check.C) {
	notification := ses.SNSNotification{}
	err := json.Unmarshal([]byte(SNSBounceNotification), &notification)
	c.Assert(err, check.IsNil)

	c.Assert(notification.NotificationType, check.Equals,
		ses.NOTIFICATION_TYPE_BOUNCE)

	c.Assert(notification.Mail, check.NotNil)
	c.Assert(notification.Mail.Timestamp, check.DeepEquals,
		parseJsonTime("2012-06-19T01:05:45.000Z"))
	c.Assert(notification.Mail.Source, check.Equals, "sender@example.com")
	c.Assert(notification.Mail.MessageId, check.Equals,
		"00000138111222aa-33322211-cccc-cccc-cccc-ddddaaaa0680-000000")
	c.Assert(notification.Mail.Destination, check.DeepEquals,
		[]string{"username@example.com"})
	c.Assert(notification.Mail.HeadersTruncated, check.Equals, false)
	c.Assert(notification.Mail.CommonHeaders, check.IsNil)
	c.Assert(notification.Mail.Headers, check.HasLen, 0)

	c.Assert(notification.Bounce, check.NotNil)
	c.Assert(notification.Bounce.BounceType, check.Equals,
		ses.BOUNCE_TYPE_PERMANENT)
	c.Assert(notification.Bounce.BounceSubType, check.Equals,
		ses.BOUNCE_SUBTYPE_GENERAL)
	c.Assert(notification.Bounce.FeedbackId, check.Equals,
		"00000138111222aa-33322211-cccc-cccc-cccc-ddddaaaa068a-000000")
	c.Assert(notification.Bounce.Timestamp, check.DeepEquals,
		parseJsonTime("2012-06-19T01:07:52.000Z"))
	c.Assert(notification.Bounce.ReportingMTA, check.Equals,
		"dns; email.example.com")
	c.Assert(notification.Bounce.BouncedRecipients, check.DeepEquals,
		[]*ses.BouncedRecipient{
			&ses.BouncedRecipient{
				EmailAddress:   "username@example.com",
				Status:         "5.1.1",
				Action:         "failed",
				DiagnosticCode: "smtp; 550 5.1.1 <username@example.com>... User",
			},
		})

	c.Assert(notification.Complaint, check.IsNil)

	c.Assert(notification.Delivery, check.IsNil)

	c.Assert(notification.Receipt, check.IsNil)

	c.Assert(notification.Content, check.IsNil)
}

func (s *S) TestSNSComplaintNotificationUnmarshalling(c *check.C) {
	notification := ses.SNSNotification{}
	err := json.Unmarshal([]byte(SNSComplaintNotification), &notification)
	c.Assert(err, check.IsNil)
	c.Assert(notification.Complaint, check.NotNil)

	c.Assert(notification.NotificationType, check.Equals,
		ses.NOTIFICATION_TYPE_COMPLAINT)

	c.Assert(notification.Mail, check.NotNil)
	c.Assert(notification.Mail.Timestamp, check.DeepEquals,
		parseJsonTime("2012-05-25T14:59:38.623-07:00"))
	c.Assert(notification.Mail.Source, check.Equals,
		"email_1337983178623@amazon.com")
	c.Assert(notification.Mail.MessageId, check.Equals,
		"000001378603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000")
	c.Assert(notification.Mail.Destination, check.DeepEquals,
		[]string{"recipient1@example.com", "recipient2@example.com",
			"recipient3@example.com", "recipient4@example.com"})
	c.Assert(notification.Mail.HeadersTruncated, check.Equals, false)
	c.Assert(notification.Mail.CommonHeaders, check.IsNil)
	c.Assert(notification.Mail.Headers, check.HasLen, 0)

	c.Assert(notification.Bounce, check.IsNil)

	c.Assert(notification.Complaint, check.NotNil)
	c.Assert(notification.Complaint.FeedbackId, check.Equals,
		"000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000")
	c.Assert(notification.Complaint.Timestamp, check.DeepEquals,
		parseJsonTime("2012-05-25T14:59:38.623-07:00"))
	c.Assert(notification.Complaint.ArrivalDate, check.DeepEquals,
		parseJsonTime("2009-12-03T04:24:21.000-05:00"))
	c.Assert(notification.Complaint.UserAgent, check.Equals,
		"Comcast Feedback Loop (V0.01)")
	c.Assert(notification.Complaint.ComplaintFeedbackType, check.Equals,
		ses.COMPLAINT_FEEDBACK_TYPE_ABUSE)
	c.Assert(notification.Complaint.ComplainedRecipients, check.DeepEquals,
		[]*ses.ComplainedRecipient{
			&ses.ComplainedRecipient{
				EmailAddress: "recipient1@example.com",
			},
		})

	c.Assert(notification.Delivery, check.IsNil)

	c.Assert(notification.Receipt, check.IsNil)

	c.Assert(notification.Content, check.IsNil)
}

func (s *S) TestSNSDeliveryNotificationUnmarshalling(c *check.C) {
	notification := ses.SNSNotification{}
	err := json.Unmarshal([]byte(SNSDeliveryNotification), &notification)
	c.Assert(err, check.IsNil)

	c.Assert(notification.NotificationType, check.Equals,
		ses.NOTIFICATION_TYPE_DELIVERY)

	c.Assert(notification.Mail, check.NotNil)
	c.Assert(notification.Mail.Timestamp, check.DeepEquals,
		parseJsonTime("2014-05-28T22:40:59.638Z"))
	c.Assert(notification.Mail.Source, check.Equals,
		"test@ses-example.com")
	c.Assert(notification.Mail.MessageId, check.Equals,
		"0000014644fe5ef6-9a483358-9170-4cb4-a269-f5dcdf415321-000000")
	c.Assert(notification.Mail.Destination, check.DeepEquals,
		[]string{"success@simulator.amazonses.com",
			"recipient@ses-example.com"})
	c.Assert(notification.Mail.HeadersTruncated, check.Equals, false)
	c.Assert(notification.Mail.CommonHeaders, check.IsNil)
	c.Assert(notification.Mail.Headers, check.HasLen, 0)

	c.Assert(notification.Bounce, check.IsNil)

	c.Assert(notification.Complaint, check.IsNil)

	c.Assert(notification.Delivery, check.NotNil)
	c.Assert(notification.Delivery.Timestamp, check.DeepEquals,
		parseJsonTime("2014-05-28T22:41:01.184Z"))
	c.Assert(notification.Delivery.ReportingMTA, check.Equals,
		"a8-70.smtp-out.amazonses.com")
	c.Assert(notification.Delivery.ProcessingTimeMillis, check.Equals,
		int64(546))
	c.Assert(notification.Delivery.SmtpResponse, check.Equals,
		"250 ok:  Message 64111812 accepted")
	c.Assert(notification.Delivery.Recipients, check.DeepEquals,
		[]string{"success@simulator.amazonses.com"})

	c.Assert(notification.Receipt, check.IsNil)

	c.Assert(notification.Content, check.IsNil)
}

func (s *S) TestSNSReceiptAlertNotificationUnmarshalling(c *check.C) {
	notification := ses.SNSNotification{}
	err := json.Unmarshal([]byte(SNSReceiptAlertNotification), &notification)
	c.Assert(err, check.IsNil)

	c.Assert(notification.NotificationType, check.Equals,
		ses.NOTIFICATION_TYPE_RECEIVED)

	c.Assert(notification.Mail, check.NotNil)
	c.Assert(notification.Mail.Timestamp, check.DeepEquals,
		parseJsonTime("2015-09-11T20:32:33.936Z"))
	c.Assert(notification.Mail.Source, check.Equals,
		"0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com")
	c.Assert(notification.Mail.MessageId, check.Equals,
		"d6iitobk75ur44p8kdnnp7g2n800")
	c.Assert(notification.Mail.Destination, check.DeepEquals,
		[]string{"recipient@example.com"})
	c.Assert(notification.Mail.HeadersTruncated, check.Equals, false)
	c.Assert(notification.Mail.CommonHeaders, check.DeepEquals, &ses.CommonHeaders{
		MessageId:  "<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>",
		To:         []string{"recipient@example.com"},
		From:       []string{"sender@example.com"},
		ReturnPath: "0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com",
		Date:       "Fri, 11 Sep 2015 20:32:32 +0000",
		Subject:    "Example subject",
	})
	c.Assert(notification.Mail.Headers, check.HasLen, 13)
	c.Assert(notification.Mail.Headers[0], check.Equals, ses.MailHeader{
		"Return-Path",
		"<0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com>",
	})
	c.Assert(notification.Mail.Headers[1], check.Equals, ses.MailHeader{
		"Received",
		"from a9-183.smtp-out.amazonses.com (a9-183.smtp-out.amazonses.com [54.240.9.183]) by inbound-smtp.us-east-1.amazonaws.com with SMTP id d6iitobk75ur44p8kdnnp7g2n800 for recipient@example.com; Fri, 11 Sep 2015 20:32:33 +0000 (UTC)",
	})
	c.Assert(notification.Mail.Headers[2], check.Equals, ses.MailHeader{
		"DKIM-Signature",
		"v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple; s=ug7nbtf4gccmlpwj322ax3p6ow6yfsug; d=amazonses.com; t=1442003552; h=From:To:Subject:MIME-Version:Content-Type:Content-Transfer-Encoding:Date:Message-ID:Feedback-ID; bh=DWr3IOmYWoXCA9ARqGC/UaODfghffiwFNRIb2Mckyt4=; b=p4ukUDSFqhqiub+zPR0DW1kp7oJZakrzupr6LBe6sUuvqpBkig56UzUwc29rFbJF hlX3Ov7DeYVNoN38stqwsF8ivcajXpQsXRC1cW9z8x875J041rClAjV7EGbLmudVpPX 4hHst1XPyX5wmgdHIhmUuh8oZKpVqGi6bHGzzf7g=",
	})
	c.Assert(notification.Mail.Headers[3], check.Equals, ses.MailHeader{
		"From",
		"sender@example.com",
	})
	c.Assert(notification.Mail.Headers[4], check.Equals, ses.MailHeader{
		"To",
		"recipient@example.com",
	})
	c.Assert(notification.Mail.Headers[5], check.Equals, ses.MailHeader{
		"Subject",
		"Example subject",
	})
	c.Assert(notification.Mail.Headers[6], check.Equals, ses.MailHeader{
		"MIME-Version",
		"1.0",
	})
	c.Assert(notification.Mail.Headers[7], check.Equals, ses.MailHeader{
		"Content-Type",
		"text/plain; charset=UTF-8",
	})
	c.Assert(notification.Mail.Headers[8], check.Equals, ses.MailHeader{
		"Content-Transfer-Encoding",
		"7bit",
	})
	c.Assert(notification.Mail.Headers[9], check.Equals, ses.MailHeader{
		"Date",
		"Fri, 11 Sep 2015 20:32:32 +0000",
	})
	c.Assert(notification.Mail.Headers[10], check.Equals, ses.MailHeader{
		"Message-ID",
		"<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>",
	})
	c.Assert(notification.Mail.Headers[11], check.Equals, ses.MailHeader{
		"X-SES-Outgoing",
		"2015.09.11-54.240.9.183",
	})
	c.Assert(notification.Mail.Headers[12], check.Equals, ses.MailHeader{
		"Feedback-ID",
		"1.us-east-1.Krv2FKpFdWV+KUYw3Qd6wcpPJ4Sv/pOPpEPSHn2u2o4=:AmazonSES",
	})

	c.Assert(notification.Bounce, check.IsNil)

	c.Assert(notification.Complaint, check.IsNil)

	c.Assert(notification.Delivery, check.IsNil)

	c.Assert(notification.Receipt, check.NotNil)
	c.Assert(notification.Receipt.Timestamp, check.DeepEquals,
		parseJsonTime("2015-09-11T20:32:33.936Z"))
	c.Assert(notification.Receipt.ProcessingTimeMillis, check.Equals, int64(406))
	c.Assert(notification.Receipt.Recipients, check.DeepEquals, []string{
		"recipient@example.com",
	})
	c.Assert(notification.Receipt.DkimVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.SpamVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.SpfVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.VirusVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.Action.Type, check.Equals,
		ses.RECEIPT_ACTION_S3)
	c.Assert(notification.Receipt.Action.TopicArn, check.Equals,
		"arn:aws:sns:us-east-1:012345678912:example-topic")
	c.Assert(notification.Receipt.Action.BucketName, check.Equals,
		"my-S3-bucket")
	c.Assert(notification.Receipt.Action.ObjectKey, check.Equals, "\\email")
	c.Assert(notification.Receipt.Action.SmtpReplyCode, check.Equals, "")
	c.Assert(notification.Receipt.Action.StatusCode, check.Equals, "")
	c.Assert(notification.Receipt.Action.Message, check.Equals, "")
	c.Assert(notification.Receipt.Action.Sender, check.Equals, "")
	c.Assert(notification.Receipt.Action.FunctionArn, check.Equals, "")
	c.Assert(notification.Receipt.Action.InvocationType, check.Equals, "")
	c.Assert(notification.Receipt.Action.OrganizationArn, check.Equals, "")

	c.Assert(notification.Content, check.IsNil)
}

func (s *S) TestSNSReceiptNotificationUnmarshalling(c *check.C) {
	notification := ses.SNSNotification{}
	err := json.Unmarshal([]byte(SNSReceiptNotification), &notification)
	c.Assert(err, check.IsNil)

	c.Assert(notification.NotificationType, check.Equals,
		ses.NOTIFICATION_TYPE_RECEIVED)

	c.Assert(notification.Mail, check.NotNil)
	c.Assert(notification.Mail.Timestamp, check.DeepEquals,
		parseJsonTime("2015-09-11T20:32:33.936Z"))
	c.Assert(notification.Mail.Source, check.Equals,
		"61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com")
	c.Assert(notification.Mail.MessageId, check.Equals,
		"d6iitobk75ur44p8kdnnp7g2n800")
	c.Assert(notification.Mail.Destination, check.DeepEquals,
		[]string{"recipient@example.com"})
	c.Assert(notification.Mail.HeadersTruncated, check.Equals, false)
	c.Assert(notification.Mail.CommonHeaders, check.DeepEquals, &ses.CommonHeaders{
		MessageId:  "<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>",
		To:         []string{"recipient@example.com"},
		From:       []string{"sender@example.com"},
		ReturnPath: "0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com",
		Date:       "Fri, 11 Sep 2015 20:32:32 +0000",
		Subject:    "Example subject",
	})
	c.Assert(notification.Mail.Headers, check.HasLen, 13)
	c.Assert(notification.Mail.Headers[0], check.Equals, ses.MailHeader{
		"Return-Path",
		"<0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com>",
	})
	c.Assert(notification.Mail.Headers[1], check.Equals, ses.MailHeader{
		"Received",
		"from a9-183.smtp-out.amazonses.com (a9-183.smtp-out.amazonses.com [54.240.9.183]) by inbound-smtp.us-east-1.amazonaws.com with SMTP id d6iitobk75ur44p8kdnnp7g2n800 for recipient@example.com; Fri, 11 Sep 2015 20:32:33 +0000 (UTC)",
	})
	c.Assert(notification.Mail.Headers[2], check.Equals, ses.MailHeader{
		"DKIM-Signature",
		"v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple; s=ug7nbtf4gccmlpwj322ax3p6ow6yfsug; d=amazonses.com; t=1442003552; h=From:To:Subject:MIME-Version:Content-Type:Content-Transfer-Encoding:Date:Message-ID:Feedback-ID; bh=DWr3IOmYWoXCA9ARqGC/UaODfghffiwFNRIb2Mckyt4=; b=p4ukUDSFqhqiub+zPR0DW1kp7oJZakrzupr6LBe6sUuvqpBkig56UzUwc29rFbJF hlX3Ov7DeYVNoN38stqwsF8ivcajXpQsXRC1cW9z8x875J041rClAjV7EGbLmudVpPX 4hHst1XPyX5wmgdHIhmUuh8oZKpVqGi6bHGzzf7g=",
	})
	c.Assert(notification.Mail.Headers[3], check.Equals, ses.MailHeader{
		"From",
		"sender@example.com",
	})
	c.Assert(notification.Mail.Headers[4], check.Equals, ses.MailHeader{
		"To",
		"recipient@example.com",
	})
	c.Assert(notification.Mail.Headers[5], check.Equals, ses.MailHeader{
		"Subject",
		"Example subject",
	})
	c.Assert(notification.Mail.Headers[6], check.Equals, ses.MailHeader{
		"MIME-Version",
		"1.0",
	})
	c.Assert(notification.Mail.Headers[7], check.Equals, ses.MailHeader{
		"Content-Type",
		"text/plain; charset=UTF-8",
	})
	c.Assert(notification.Mail.Headers[8], check.Equals, ses.MailHeader{
		"Content-Transfer-Encoding",
		"7bit",
	})
	c.Assert(notification.Mail.Headers[9], check.Equals, ses.MailHeader{
		"Date",
		"Fri, 11 Sep 2015 20:32:32 +0000",
	})
	c.Assert(notification.Mail.Headers[10], check.Equals, ses.MailHeader{
		"Message-ID",
		"<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>",
	})
	c.Assert(notification.Mail.Headers[11], check.Equals, ses.MailHeader{
		"X-SES-Outgoing",
		"2015.09.11-54.240.9.183",
	})
	c.Assert(notification.Mail.Headers[12], check.Equals, ses.MailHeader{
		"Feedback-ID",
		"1.us-east-1.Krv2FKpFdWV+KUYw3Qd6wcpPJ4Sv/pOPpEPSHn2u2o4=:AmazonSES",
	})

	c.Assert(notification.Bounce, check.IsNil)

	c.Assert(notification.Complaint, check.IsNil)

	c.Assert(notification.Delivery, check.IsNil)

	c.Assert(notification.Receipt, check.NotNil)
	c.Assert(notification.Receipt.Timestamp, check.DeepEquals,
		parseJsonTime("2015-09-11T20:32:33.936Z"))
	c.Assert(notification.Receipt.ProcessingTimeMillis, check.Equals, int64(222))
	c.Assert(notification.Receipt.Recipients, check.DeepEquals, []string{
		"recipient@example.com",
	})
	c.Assert(notification.Receipt.DkimVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.SpamVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.SpfVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.VirusVerdict.Status, check.Equals, "PASS")
	c.Assert(notification.Receipt.Action.Type, check.Equals,
		ses.RECEIPT_ACTION_SNS)
	c.Assert(notification.Receipt.Action.TopicArn, check.Equals,
		"arn:aws:sns:us-east-1:012345678912:example-topic")
	c.Assert(notification.Receipt.Action.BucketName, check.Equals, "")
	c.Assert(notification.Receipt.Action.ObjectKey, check.Equals, "")
	c.Assert(notification.Receipt.Action.SmtpReplyCode, check.Equals, "")
	c.Assert(notification.Receipt.Action.StatusCode, check.Equals, "")
	c.Assert(notification.Receipt.Action.Message, check.Equals, "")
	c.Assert(notification.Receipt.Action.Sender, check.Equals, "")
	c.Assert(notification.Receipt.Action.FunctionArn, check.Equals, "")
	c.Assert(notification.Receipt.Action.InvocationType, check.Equals, "")
	c.Assert(notification.Receipt.Action.OrganizationArn, check.Equals, "")

	c.Assert(notification.Content, check.NotNil)
	c.Assert(*notification.Content, check.Equals, SNSReceiptNotificationContent)
}

func parseJsonTime(str string) time.Time {
	t, _ := time.Parse(time.RFC3339, str)
	return t
}
