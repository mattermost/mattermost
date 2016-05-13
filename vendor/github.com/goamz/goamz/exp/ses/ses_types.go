// ses_types
package ses

// Private internal representation of message body.
type Body struct {
	Html Content
	Text Content
}

// Content data structure with charset and payload (Data).
type Content struct {
	Charset string
	Data    string
}

// Email data structure. Should be main data structure used
// for sending emails using SES.
type Email struct {
	destination *destination
	message     Message
	replyTo     []string
	returnPath  string
	source      string
}

// Private internal representation for email destinations.
type destination struct {
	bccAddresses []string
	ccAddresses  []string
	toAddresses  []string
}

// Message data structure.
type Message struct {
	Body    Body
	Subject Content
}

// SES Error structure.
type SESError struct {
	Type      string
	Code      string
	Message   string
	Detail    string
	RequestId string
}

func (err *SESError) Error() string {
	return err.Message
}

// Returns a pointer to an empty but initialized Email.
func NewEmail() *Email {
	return &Email{
		destination: newDestination(),
		replyTo:     make([]string, 5)}
}

// Private function to return an initialized destination.
func newDestination() *destination {
	return &destination{
		bccAddresses: make([]string, 5),
		ccAddresses:  make([]string, 5),
		toAddresses:  make([]string, 5)}
}

// Add a BCC destination to Email.
func (em *Email) AddBCC(address string) {
	em.destination.bccAddresses = append(em.destination.bccAddresses, address)
}

// Add multiple BCC destinations to Email.
func (em *Email) AddBCCs(addresses []string) {
	em.destination.bccAddresses = append(em.destination.bccAddresses, addresses...)
}

// Add a CC destination to Email.
func (em *Email) AddCC(address string) {
	em.destination.ccAddresses = append(em.destination.ccAddresses, address)
}

// Add multiple CC destinations to Email.
func (em *Email) AddCCs(addresses []string) {
	em.destination.ccAddresses = append(em.destination.ccAddresses, addresses...)
}

// Add a To destination to Email.
func (em *Email) AddTo(address string) {
	em.destination.toAddresses = append(em.destination.toAddresses, address)
}

// Add multiple To destinations to Email.
func (em *Email) AddTos(addresses []string) {
	em.destination.toAddresses = append(em.destination.toAddresses, addresses...)
}

// Add a reply-to address to Email.
func (em *Email) AddReplyTo(address string) {
	em.replyTo = append(em.replyTo, address)
}

// Add multiple reply-to addresses to Email.
func (em *Email) AddReplyTos(addresses []string) {
	em.replyTo = append(em.replyTo, addresses...)
}

// Set the return path for Email.
func (em *Email) SetReturnPath(path string) {
	em.returnPath = path
}

// Set the source address for Email.
func (em *Email) SetSource(source string) {
	em.source = source
}

// Set the Email message.
func (em *Email) SetMessage(message Message) {
	em.message = message
}

// Set the subject for the Email message.
// Uses ASCII as charset.
func (em *Email) SetSubject(subject string) {
	em.message.Subject = Content{Data: subject}
}

// Set the subject for the Email message.
// Uses the charset (or ASCII if none) of Content.
func (em *Email) SetSubjectAsContent(subject Content) {
	em.message.Subject = subject
}

// Sets the HTML body of the Email message.
// Uses ASCII as charset.
func (em *Email) SetBodyHtml(html string) {
	em.message.Body.Html = Content{Data: html}
}

// Sets the HTML body of the Email message.
// Uses the charset (or ASCII if none) of Content.
func (em *Email) SetBodyHtmlAsContent(html Content) {
	em.message.Body.Html = html
}

// Sets the raw text body of the Email message.
// Uses ASCII as charset.
func (em *Email) SetBodyRawText(text string) {
	em.message.Body.Text = Content{Data: text}
}

// Sets the raw test body of the Email message.
// Uses the charset (or ASCII if none) of Content.
func (em *Email) SetBodyRawTextAsContent(text Content) {
	em.message.Body.Text = text
}
