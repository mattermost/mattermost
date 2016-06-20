//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Copyright (c) 2011 Canonical Ltd.
//
// Written by Graham Miller <graham.miller@gmail.com>

// This package is in an experimental state, and does not currently
// follow conventions and style of the rest of goamz or common
// Go conventions. It must be polished before it's considered a
// first-class package in goamz.
package mturk

import (
	"encoding/xml"
	"errors"
	"fmt"
	"github.com/goamz/goamz/aws"
	"net/http"
	//"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type MTurk struct {
	aws.Auth
	URL *url.URL
}

func New(auth aws.Auth, sandbox bool) *MTurk {
	mt := &MTurk{Auth: auth}
	var err error
	if sandbox {
		mt.URL, err = url.Parse("https://mechanicalturk.sandbox.amazonaws.com/")
	} else {
		mt.URL, err = url.Parse("https://mechanicalturk.amazonaws.com/")
	}
	if err != nil {
		panic(err.Error())
	}
	return mt
}

// ----------------------------------------------------------------------------
// Request dispatching logic.

// Error encapsulates an error returned by MTurk.
type Error struct {
	StatusCode int    // HTTP status code (200, 403, ...)
	Code       string // EC2 error code ("UnsupportedOperation", ...)
	Message    string // The human-oriented error message
	RequestId  string
}

func (err *Error) Error() string {
	return err.Message
}

// The request stanza included in several response types, for example
// in a "CreateHITResponse".  http://goo.gl/qGeKf
type xmlRequest struct {
	RequestId string
	IsValid   string
	Errors    []Error `xml:"Errors>Error"`
}

/*
A Price represents an amount of money in a given currency.

Reference:
http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_PriceDataStructureArticle.html
*/
type Price struct {
	// The amount of money, as a number. The amount is in the currency specified
	// by the CurrencyCode. For example, if CurrencyCode is USD, the amount will
	// be in United States dollars (e.g. 12.75 is $12.75 US).
	Amount string

	// A code that represents the country and units of the currency. Its value is
	// Type an ISO 4217 currency code, such as USD for United States dollars.
	//
	// Constraints: Currently only USD is supported.
	CurrencyCode string

	// A textual representation of the price, using symbols and formatting
	// appropriate for the currency. Symbols are represented using the Unicode
	// character set. You do not need to specify FormattedPrice in a request.
	// It is only provided by the service in responses, as a convenience to
	// your application.
	FormattedPrice string
}

/*
Really just a country string.

Reference:

- http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_LocaleDataStructureArticle.html
- http://www.iso.org/iso/country_codes/country_codes
*/
type Locale string

/*
A QualificationRequirement describes a Qualification a Worker must
have before the Worker is allowed to accept a HIT. A requirement may optionally
state that a Worker must have the Qualification to preview the HIT.

Reference:

http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_QualificationRequirementDataStructureArticle.html
*/
type QualificationRequirement struct {
	// The ID of the Qualification type for the requirement.
	// See http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_QualificationRequirementDataStructureArticle.html#ApiReference_QualificationType-IDs
	QualificationTypeId string

	// The kind of comparison to make against a Qualification's value.
	// Two values can be compared to see if one value is "LessThan",
	// "LessThanOrEqualTo", "GreaterThan", "GreaterThanOrEqualTo", "EqualTo", or
	// "NotEqualTo" the other. A Qualification requirement can also test if a
	// Qualification "Exists" in the user's profile, regardless of its value.
	Comparator string

	// The integer value to compare against the Qualification's value.
	IntegerValue int

	// The locale value to compare against the Qualification's value, if the
	// Qualification being compared is the locale Qualification.
	LocaleValue Locale

	// If true, the question data for the HIT will not be shown when a Worker
	// whose Qualifications do not meet this requirement tries to preview the HIT.
	// That is, a Worker's Qualifications must meet all of the requirements for
	// which RequiredToPreview is true in order to preview the HIT.
	//
	// If a Worker meets all of the requirements where RequiredToPreview is true
	// (or if there are no such requirements), but does not meet all of the
	// requirements for the HIT, the Worker will be allowed to preview the HIT's
	// question data, but will not be allowed to accept and complete the HIT.
	RequiredToPreview bool
}

// Data structure holding the contents of an "external"
// question. http://goo.gl/NP8Aa
type ExternalQuestion struct {
	XMLName     xml.Name `xml:"http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd ExternalQuestion"`
	ExternalURL string
	FrameHeight int
}

// Holds the html content of the HTMLQuestion.
type HTMLContent struct {
	Content string `xml:",innerxml"`
}

// Data structure holding the contents of an "html"
// question. http://goo.gl/hQn5An
type HTMLQuestion struct {
	XMLName     xml.Name `xml:"http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2011-11-11/HTMLQuestion.xsd HTMLQuestion"`
	HTMLContent HTMLContent

	FrameHeight int
}

// The data structure representing a "human interface task" (HIT)
// Currently only supports "external" questions, because Go
// structs don't support union types.  http://goo.gl/NP8Aa
// This type is returned, for example, from SearchHITs
// http://goo.gl/PskcX
type HIT struct {
	Request xmlRequest

	HITId                        string
	HITTypeId                    string
	CreationTime                 string
	Title                        string
	Description                  string
	Keywords                     string
	HITStatus                    string
	Reward                       Price
	LifetimeInSeconds            uint
	AssignmentDurationInSeconds  uint
	MaxAssignments               uint
	AutoApprovalDelayInSeconds   uint
	QualificationRequirement     QualificationRequirement
	Question                     interface{}
	RequesterAnnotation          string
	NumberofSimilarHITs          uint
	HITReviewStatus              string
	NumberOfAssignmentsPending   uint
	NumberOfAssignmentsAvailable uint
	NumberOfAssignmentsCompleted uint
}

// The main data structure returned by SearchHITs
// http://goo.gl/PskcX
type SearchHITsResult struct {
	NumResults      uint
	PageNumber      uint
	TotalNumResults uint
	HITs            []HIT `xml:"HIT"`
}

// The wrapper data structure returned by SearchHITs
// http://goo.gl/PskcX
type SearchHITsResponse struct {
	RequestId        string `xml:"OperationRequest>RequestId"`
	SearchHITsResult SearchHITsResult
}

// The wrapper data structure returned by CreateHIT
// http://goo.gl/PskcX
type CreateHITResponse struct {
	RequestId string `xml:"OperationRequest>RequestId"`
	HIT       HIT
}

type Assignment struct {
	AssignmentId     string
	WorkerId         string
	HITId            string
	AssignmentStatus string
	AutoApprovalTime string
	AcceptTime       string
	SubmitTime       string
	ApprovalTime     string
	Answer           string
}

func (a Assignment) Answers() (answers map[string]string) {
	answers = make(map[string]string)

	decoder := xml.NewDecoder(strings.NewReader(a.Answer))

	for {
		token, _ := decoder.Token()
		if token == nil {
			break
		}
		switch startElement := token.(type) {
		case xml.StartElement:
			if startElement.Name.Local == "Answer" {
				var answer struct {
					QuestionIdentifier string
					FreeText           string
				}

				decoder.DecodeElement(&answer, &startElement)
				answers[answer.QuestionIdentifier] = answer.FreeText
			}
		}
	}

	return
}

type GetAssignmentsForHITResponse struct {
	RequestId                  string `xml:"OperationRequest>RequestId"`
	GetAssignmentsForHITResult struct {
		Request         xmlRequest
		NumResults      uint
		TotalNumResults uint
		PageNumber      uint
		Assignment      Assignment
	}
}

/*
CreateHIT corresponds to the "CreateHIT" operation of the Mechanical Turk
API.  Currently only supports "external" questions (see "HIT" struct above).

Here are the detailed description for the parameters:

  title         Required. A title should be short and descriptive about the
                kind of task the HIT contains. On the Amazon Mechanical Turk
                web site, the HIT title appears in search results, and
                everywhere the HIT is mentioned.
  description   Required. A description includes detailed information about the
                kind of task the HIT contains. On the Amazon Mechanical Turk
                web site, the HIT description appears in the expanded view of
                search results, and in the HIT and assignment screens. A good
                description gives the user enough information to evaluate the
                HIT before accepting it.
  question      Required. The data the person completing the HIT uses to produce
                the results. Consstraints: Must be a QuestionForm data structure,
                an ExternalQuestion data structure, or an HTMLQuestion data
                structure. The XML question data must not be larger than 64
                kilobytes (65,535 bytes) in size, including whitespace.
  reward        Required. The amount of money the Requester will pay a Worker
                for successfully completing the HIT.
  assignmentDurationInSeconds   Required. The amount of time, in seconds, that
                                a Worker has to complete the HIT after accepting
                                it. If a Worker does not complete the assignment
                                within the specified duration, the assignment is
                                considered abandoned.  If the HIT is still
                                active (that is, its lifetime has not elapsed),
                                the assignment becomes available for other users
                                to find and accept. Valid Values: any integer
                                between 30 (30 seconds) and 31536000 (365 days).
  lifetimeInSeconds     Required. An amount of time, in seconds, after which the
                        HIT is no longer available for users to accept. After
                        the lifetime of the HIT elapses, the HIT no longer
                        appears in HIT searches, even if not all of the
                        assignments for the HIT have been accepted. Valid Values:
                        any integer between 30 (30 seconds) and 31536000 (365 days).
  keywords              One or more words or phrases that describe the HIT,
                        separated by commas. These words are used in searches to
                        find HITs. Constraints: cannot be more than 1,000
                        characters.
  maxAssignments        The number of times the HIT can be accepted and completed
                        before the HIT becomes unavailable. Valid Values: any
                        integer between 1 and 1000000000 (1 billion). Default: 1
  qualificationRequirement    A condition that a Worker's Qualifications must
                              meet before the Worker is allowed to accept and
                              complete the HIT. Constraints: no more than 10
                              QualificationRequirement for each HIT.
  requesterAnnotation   An arbitrary data field. The RequesterAnnotation
                        parameter lets your application attach arbitrary data to
                        the HIT for tracking purposes.  For example, the
                        RequesterAnnotation parameter could be an identifier
                        internal to the Requester's application that corresponds
                        with the HIT. Constraints: must not be longer than 255
                        characters in length.

Reference:
http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_CreateHITOperation.html
*/
func (mt *MTurk) CreateHIT(
	title, description string,
	question interface{},
	reward Price,
	assignmentDurationInSeconds,
	lifetimeInSeconds uint,
	keywords string,
	maxAssignments uint,
	qualificationRequirement *QualificationRequirement,
	requesterAnnotation string) (h *HIT, err error) {

	params := make(map[string]string)
	params["Title"] = title
	params["Description"] = description
	params["Question"], err = xmlEncode(&question)
	if err != nil {
		return
	}
	params["Reward.1.Amount"] = reward.Amount
	params["Reward.1.CurrencyCode"] = reward.CurrencyCode
	params["AssignmentDurationInSeconds"] = strconv.FormatUint(uint64(assignmentDurationInSeconds), 10)

	params["LifetimeInSeconds"] = strconv.FormatUint(uint64(lifetimeInSeconds), 10)
	if keywords != "" {
		params["Keywords"] = keywords
	}
	if maxAssignments != 0 {
		params["MaxAssignments"] = strconv.FormatUint(uint64(maxAssignments), 10)
	}
	if qualificationRequirement != nil {
		params["QualificationRequirement"], err = xmlEncode(qualificationRequirement)
		if err != nil {
			return
		}
	}
	if requesterAnnotation != "" {
		params["RequesterAnnotation"] = requesterAnnotation
	}

	var response CreateHITResponse
	err = mt.query(params, "CreateHIT", &response)
	if err == nil {
		h = &response.HIT
	}
	return
}

// Corresponds to the "CreateHIT" operation of the Mechanical Turk
// API, using an existing "hit type".  http://goo.gl/cDBRc Currently only
// supports "external" questions (see "HIT" struct above).  If
// "maxAssignments" or "requesterAnnotation" are the zero value for
// their types, they will not be included in the request.
func (mt *MTurk) CreateHITOfType(hitTypeId string, q ExternalQuestion, lifetimeInSeconds uint, maxAssignments uint, requesterAnnotation string) (h *HIT, err error) {
	params := make(map[string]string)
	params["HITTypeId"] = hitTypeId
	params["Question"], err = xmlEncode(&q)
	if err != nil {
		return
	}
	params["LifetimeInSeconds"] = strconv.FormatUint(uint64(lifetimeInSeconds), 10)
	if maxAssignments != 0 {
		params["MaxAssignments"] = strconv.FormatUint(uint64(maxAssignments), 10)
	}
	if requesterAnnotation != "" {
		params["RequesterAnnotation"] = requesterAnnotation
	}

	var response CreateHITResponse
	err = mt.query(params, "CreateHIT", &response)
	if err == nil {
		h = &response.HIT
	}
	return
}

// Get the Assignments for a HIT.
func (mt *MTurk) GetAssignmentsForHIT(hitId string) (r *Assignment, err error) {
	params := make(map[string]string)
	params["HITId"] = hitId
	var response GetAssignmentsForHITResponse
	err = mt.query(params, "GetAssignmentsForHIT", &response)
	if err == nil {
		r = &response.GetAssignmentsForHITResult.Assignment
	}
	return
}

// Corresponds to "SearchHITs" operation of Mechanical Turk. http://goo.gl/PskcX
// Currenlty supports none of the optional parameters.
func (mt *MTurk) SearchHITs() (s *SearchHITsResult, err error) {
	params := make(map[string]string)
	var response SearchHITsResponse
	err = mt.query(params, "SearchHITs", &response)
	if err == nil {
		s = &response.SearchHITsResult
	}
	return
}

// Adds common parameters to the "params" map, signs the request,
// adds the signature to the "params" map and sends the request
// to the server.  It then unmarshals the response in to the "resp"
// parameter using xml.Unmarshal()
func (mt *MTurk) query(params map[string]string, operation string, resp interface{}) error {
	service := "AWSMechanicalTurkRequester"
	timestamp := time.Now().UTC().Format("2006-01-02T15:04:05Z")

	params["AWSAccessKeyId"] = mt.Auth.AccessKey
	params["Service"] = service
	params["Timestamp"] = timestamp
	params["Operation"] = operation

	// make a copy
	url := *mt.URL

	sign(mt.Auth, service, operation, timestamp, params)
	url.RawQuery = multimap(params).Encode()
	r, err := http.Get(url.String())
	if err != nil {
		return err
	}
	//dump, _ := httputil.DumpResponse(r, true)
	//println("DUMP:\n", string(dump))
	if r.StatusCode != 200 {
		return errors.New(fmt.Sprintf("%d: unexpected status code", r.StatusCode))
	}
	dec := xml.NewDecoder(r.Body)
	err = dec.Decode(resp)
	r.Body.Close()
	return err
}

func multimap(p map[string]string) url.Values {
	q := make(url.Values, len(p))
	for k, v := range p {
		q[k] = []string{v}
	}
	return q
}

func xmlEncode(i interface{}) (s string, err error) {
	var buf []byte
	buf, err = xml.Marshal(i)
	if err != nil {
		return
	}
	s = string(buf)
	return
}
