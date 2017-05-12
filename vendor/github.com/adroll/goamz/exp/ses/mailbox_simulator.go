package ses

var (
	tEST_TO_ADDRESSES = []string{
		"success@simulator.amazonses.com",
		"bounce@simulator.amazonses.com",
		"ooto@simulator.amazonses.com",
		"complaint@simulator.amazonses.com",
		"suppressionlist@simulator.amazonses.com"}
	tEST_CC_ADDRESSES  = []string{}
	tEST_BCC_ADDRESSES = []string{}
)

const (
	tEST_EMAIL_SUBJECT = "goamz TestSESIntegration"
	tEST_TEXT_BODY     = "This is a test email send by SimulateDelivery."

	tEST_HTML_BODY = `
<html>
<body>
	<h1>This is a test email send by SimulateDelivery.</h1>
	<p>Foo bar baz</p>
</body>
</html>
`
)

// This is an helper function to send emails to the mailbox simulator.
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/mailbox-simulator.html
//
// from: the source email address registered in your SES account
func (s *SES) SimulateDelivery(from string) (*SendEmailResponse, error) {
	destination := NewDestination(tEST_TO_ADDRESSES,
		tEST_CC_ADDRESSES, tEST_BCC_ADDRESSES)
	message := NewMessage(tEST_EMAIL_SUBJECT, tEST_TEXT_BODY, tEST_HTML_BODY)

	return s.SendEmail(from, destination, message)
}
