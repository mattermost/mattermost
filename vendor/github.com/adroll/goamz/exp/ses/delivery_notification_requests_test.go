package ses_test

const SNSBounceNotification = `
    {
       "notificationType":"Bounce",
       "bounce":{
          "bounceType":"Permanent",
          "reportingMTA":"dns; email.example.com",
          "bouncedRecipients":[
             {
                "emailAddress":"username@example.com",
                "status":"5.1.1",
                "action":"failed",
                "diagnosticCode":"smtp; 550 5.1.1 <username@example.com>... User"
             }
          ],
          "bounceSubType":"General",
          "timestamp":"2012-06-19T01:07:52.000Z",
          "feedbackId":"00000138111222aa-33322211-cccc-cccc-cccc-ddddaaaa068a-000000"
       },
       "mail":{
          "timestamp":"2012-06-19T01:05:45.000Z",
          "source":"sender@example.com",
          "messageId":"00000138111222aa-33322211-cccc-cccc-cccc-ddddaaaa0680-000000",
          "destination":[
             "username@example.com"
          ]
       }
    }
`

const SNSComplaintNotification = `
    {
      "notificationType":"Complaint",
      "complaint":{
         "userAgent":"Comcast Feedback Loop (V0.01)",
         "complainedRecipients":[
            {
               "emailAddress":"recipient1@example.com"
            }
         ],
         "complaintFeedbackType":"abuse",
         "arrivalDate":"2009-12-03T04:24:21.000-05:00",
         "timestamp":"2012-05-25T14:59:38.623-07:00",
         "feedbackId":"000001378603177f-18c07c78-fa81-4a58-9dd1-fedc3cb8f49a-000000"
      },
      "mail":{
         "timestamp":"2012-05-25T14:59:38.623-07:00",
         "messageId":"000001378603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000",
         "source":"email_1337983178623@amazon.com",
         "destination":[
            "recipient1@example.com",
            "recipient2@example.com",
            "recipient3@example.com",
            "recipient4@example.com"
         ]
      }
   }
`

const SNSDeliveryNotification = `
   {
      "notificationType":"Delivery",
      "mail":{
         "timestamp":"2014-05-28T22:40:59.638Z",
         "messageId":"0000014644fe5ef6-9a483358-9170-4cb4-a269-f5dcdf415321-000000",
         "source":"test@ses-example.com",
         "destination":[
            "success@simulator.amazonses.com",
            "recipient@ses-example.com" 
         ]
      },
      "delivery":{
         "timestamp":"2014-05-28T22:41:01.184Z",
         "recipients":["success@simulator.amazonses.com"],
         "processingTimeMillis":546,     
         "reportingMTA":"a8-70.smtp-out.amazonses.com",
         "smtpResponse":"250 ok:  Message 64111812 accepted"
      } 
   }
`

const SNSReceiptAlertNotification = `{
    "notificationType": "Received",
    "receipt": {
        "timestamp": "2015-09-11T20:32:33.936Z",
        "processingTimeMillis": 406,
        "recipients": [
            "recipient@example.com"
        ],
        "spamVerdict": {
            "status": "PASS"
        },
        "virusVerdict": {
            "status": "PASS"
        },
        "spfVerdict": {
            "status": "PASS"
        },
        "dkimVerdict": {
            "status": "PASS"
        },
        "action": {
            "type": "S3",
            "topicArn": "arn:aws:sns:us-east-1:012345678912:example-topic",
            "bucketName": "my-S3-bucket",
            "objectKey": "\\email"
        }
    },
    "mail": {
        "timestamp": "2015-09-11T20:32:33.936Z",
        "source": "0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com",
        "messageId": "d6iitobk75ur44p8kdnnp7g2n800",
        "destination": [
            "recipient@example.com"
        ],
        "headersTruncated": false,
        "headers": [
            {
                "name": "Return-Path",
                "value": "<0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com>"
            },
            {
                "name": "Received",
                "value": "from a9-183.smtp-out.amazonses.com (a9-183.smtp-out.amazonses.com [54.240.9.183]) by inbound-smtp.us-east-1.amazonaws.com with SMTP id d6iitobk75ur44p8kdnnp7g2n800 for recipient@example.com; Fri, 11 Sep 2015 20:32:33 +0000 (UTC)"
            },
            {
                "name": "DKIM-Signature",
                "value": "v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple; s=ug7nbtf4gccmlpwj322ax3p6ow6yfsug; d=amazonses.com; t=1442003552; h=From:To:Subject:MIME-Version:Content-Type:Content-Transfer-Encoding:Date:Message-ID:Feedback-ID; bh=DWr3IOmYWoXCA9ARqGC/UaODfghffiwFNRIb2Mckyt4=; b=p4ukUDSFqhqiub+zPR0DW1kp7oJZakrzupr6LBe6sUuvqpBkig56UzUwc29rFbJF hlX3Ov7DeYVNoN38stqwsF8ivcajXpQsXRC1cW9z8x875J041rClAjV7EGbLmudVpPX 4hHst1XPyX5wmgdHIhmUuh8oZKpVqGi6bHGzzf7g="
            },
            {
                "name": "From",
                "value": "sender@example.com"
            },
            {
                "name": "To",
                "value": "recipient@example.com"
            },
            {
                "name": "Subject",
                "value": "Example subject"
            },
            {
                "name": "MIME-Version",
                "value": "1.0"
            },
            {
                "name": "Content-Type",
                "value": "text/plain; charset=UTF-8"
            },
            {
                "name": "Content-Transfer-Encoding",
                "value": "7bit"
            },
            {
                "name": "Date",
                "value": "Fri, 11 Sep 2015 20:32:32 +0000"
            },
            {
                "name": "Message-ID",
                "value": "<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>"
            },
            {
                "name": "X-SES-Outgoing",
                "value": "2015.09.11-54.240.9.183"
            },
            {
                "name": "Feedback-ID",
                "value": "1.us-east-1.Krv2FKpFdWV+KUYw3Qd6wcpPJ4Sv/pOPpEPSHn2u2o4=:AmazonSES"
            }
        ],
        "commonHeaders": {
            "returnPath": "0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com",
            "from": [
                "sender@example.com"
            ],
            "date": "Fri, 11 Sep 2015 20:32:32 +0000",
            "to": [
                "recipient@example.com"
            ],
            "messageId": "<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>",
            "subject": "Example subject"
        }
    }
}`

const SNSReceiptNotification = `{
    "notificationType": "Received",
    "receipt": {
        "timestamp": "2015-09-11T20:32:33.936Z",
        "processingTimeMillis": 222,
        "recipients": [
            "recipient@example.com"
        ],
        "spamVerdict": {
            "status": "PASS"
        },
        "virusVerdict": {
            "status": "PASS"
        },
        "spfVerdict": {
            "status": "PASS"
        },
        "dkimVerdict": {
            "status": "PASS"
        },
        "action": {
            "type": "SNS",
            "topicArn": "arn:aws:sns:us-east-1:012345678912:example-topic"
        }
    },
    "mail": {
        "timestamp": "2015-09-11T20:32:33.936Z",
        "source": "61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com",
        "messageId": "d6iitobk75ur44p8kdnnp7g2n800",
        "destination": [
            "recipient@example.com"
        ],
        "headersTruncated": false,
        "headers": [
            {
                "name": "Return-Path",
                "value": "<0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com>"
            },
            {
                "name": "Received",
                "value": "from a9-183.smtp-out.amazonses.com (a9-183.smtp-out.amazonses.com [54.240.9.183]) by inbound-smtp.us-east-1.amazonaws.com with SMTP id d6iitobk75ur44p8kdnnp7g2n800 for recipient@example.com; Fri, 11 Sep 2015 20:32:33 +0000 (UTC)"
            },
            {
                "name": "DKIM-Signature",
                "value": "v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple; s=ug7nbtf4gccmlpwj322ax3p6ow6yfsug; d=amazonses.com; t=1442003552; h=From:To:Subject:MIME-Version:Content-Type:Content-Transfer-Encoding:Date:Message-ID:Feedback-ID; bh=DWr3IOmYWoXCA9ARqGC/UaODfghffiwFNRIb2Mckyt4=; b=p4ukUDSFqhqiub+zPR0DW1kp7oJZakrzupr6LBe6sUuvqpBkig56UzUwc29rFbJF hlX3Ov7DeYVNoN38stqwsF8ivcajXpQsXRC1cW9z8x875J041rClAjV7EGbLmudVpPX 4hHst1XPyX5wmgdHIhmUuh8oZKpVqGi6bHGzzf7g="
            },
            {
                "name": "From",
                "value": "sender@example.com"
            },
            {
                "name": "To",
                "value": "recipient@example.com"
            },
            {
                "name": "Subject",
                "value": "Example subject"
            },
            {
                "name": "MIME-Version",
                "value": "1.0"
            },
            {
                "name": "Content-Type",
                "value": "text/plain; charset=UTF-8"
            },
            {
                "name": "Content-Transfer-Encoding",
                "value": "7bit"
            },
            {
                "name": "Date",
                "value": "Fri, 11 Sep 2015 20:32:32 +0000"
            },
            {
                "name": "Message-ID",
                "value": "<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>"
            },
            {
                "name": "X-SES-Outgoing",
                "value": "2015.09.11-54.240.9.183"
            },
            {
                "name": "Feedback-ID",
                "value": "1.us-east-1.Krv2FKpFdWV+KUYw3Qd6wcpPJ4Sv/pOPpEPSHn2u2o4=:AmazonSES"
            }
        ],
        "commonHeaders": {
            "returnPath": "0000014fbe1c09cf-7cb9f704-7531-4e53-89a1-5fa9744f5eb6-000000@amazonses.com",
            "from": [
                "sender@example.com"
            ],
            "date": "Fri, 11 Sep 2015 20:32:32 +0000",
            "to": [
                "recipient@example.com"
            ],
            "messageId": "<61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>",
            "subject": "Example subject"
        }
    },
    "content": "Return-Path: <61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>\r\nReceived: from a9-183.smtp-out.amazonses.com (a9-183.smtp-out.amazonses.com [54.240.9.183])\r\n by inbound-smtp.us-east-1.amazonaws.com with SMTP id d6iitobk75ur44p8kdnnp7g2n800\r\n for recipient@example.com;\r\n Fri, 11 Sep 2015 20:32:33 +0000 (UTC)\r\nDKIM-Signature: v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple;\r\n\ts=ug7nbtf4gccmlpwj322ax3p6ow6yfsug; d=amazonses.com; t=1442003552;\r\n\th=From:To:Subject:MIME-Version:Content-Type:Content-Transfer-Encoding:Date:Message-ID:Feedback-ID;\r\n\tbh=DWr3IOmYWoXCA9ARqGC/UaODfghffiwFNRIb2Mckyt4=;\r\n\tb=p4ukUDSFqhqiub+zPR0DW1kp7oJZakrzupr6LBe6sUuvqpBkig56UzUwc29rFbJF\r\n\thlX3Ov7DeYVNoN38stqwsF8ivcajXpQsXRC1cW9z8x875J041rClAjV7EGbLmudVpPX\r\n\t4hHst1XPyX5wmgdHIhmUuh8oZKpVqGi6bHGzzf7g=\r\nFrom: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Example subject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\nDate: Fri, 11 Sep 2015 20:32:32 +0000\r\nMessage-ID: <61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>\r\nX-SES-Outgoing: 2015.09.11-54.240.9.183\r\nFeedback-ID: 1.us-east-1.Krv2FKpFdWV+KUYw3Qd6wcpPJ4Sv/pOPpEPSHn2u2o4=:AmazonSES\r\n\r\nExample content\r\n"
}`

const SNSReceiptNotificationContent = "Return-Path: <61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>\r\nReceived: from a9-183.smtp-out.amazonses.com (a9-183.smtp-out.amazonses.com [54.240.9.183])\r\n by inbound-smtp.us-east-1.amazonaws.com with SMTP id d6iitobk75ur44p8kdnnp7g2n800\r\n for recipient@example.com;\r\n Fri, 11 Sep 2015 20:32:33 +0000 (UTC)\r\nDKIM-Signature: v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple;\r\n\ts=ug7nbtf4gccmlpwj322ax3p6ow6yfsug; d=amazonses.com; t=1442003552;\r\n\th=From:To:Subject:MIME-Version:Content-Type:Content-Transfer-Encoding:Date:Message-ID:Feedback-ID;\r\n\tbh=DWr3IOmYWoXCA9ARqGC/UaODfghffiwFNRIb2Mckyt4=;\r\n\tb=p4ukUDSFqhqiub+zPR0DW1kp7oJZakrzupr6LBe6sUuvqpBkig56UzUwc29rFbJF\r\n\thlX3Ov7DeYVNoN38stqwsF8ivcajXpQsXRC1cW9z8x875J041rClAjV7EGbLmudVpPX\r\n\t4hHst1XPyX5wmgdHIhmUuh8oZKpVqGi6bHGzzf7g=\r\nFrom: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Example subject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\nDate: Fri, 11 Sep 2015 20:32:32 +0000\r\nMessage-ID: <61967230-7A45-4A9D-BEC9-87CBCF2211C9@example.com>\r\nX-SES-Outgoing: 2015.09.11-54.240.9.183\r\nFeedback-ID: 1.us-east-1.Krv2FKpFdWV+KUYw3Qd6wcpPJ4Sv/pOPpEPSHn2u2o4=:AmazonSES\r\n\r\nExample content\r\n"
