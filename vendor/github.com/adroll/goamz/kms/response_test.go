package kms_test

var DescribeKeyExample = `
{
	"KeyMetadata": {
		"AWSAccountId": "987654321",
		"Arn": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
		"CreationDate": 123456.789,
		"Description": "This is a test",
		"Enabled": true,
		"KeyId": "12345678-1234-1234-1234-123456789012",
		"KeyUsage": "ENCRYPT_DECRYPT"
	}
}
`

var ErrorExample = `
{
    "__type": "TestException",
    "message": "This is a error test"
}
`
