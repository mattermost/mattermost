package mturk_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/exp/mturk"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"net/url"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	mturk *mturk.MTurk
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	u, err := url.Parse(testServer.URL)
	if err != nil {
		panic(err.Error())
	}

	s.mturk = &mturk.MTurk{
		Auth: auth,
		URL:  u,
	}
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestCreateHITExternalQuestion(c *check.C) {
	testServer.Response(200, nil, BasicHitResponse)

	question := mturk.ExternalQuestion{
		ExternalURL: "http://www.amazon.com",
		FrameHeight: 200,
	}
	reward := mturk.Price{
		Amount:       "0.01",
		CurrencyCode: "USD",
	}
	hit, err := s.mturk.CreateHIT("title", "description", question, reward, 1, 2, "key1,key2", 3, nil, "annotation")

	testServer.WaitRequest()

	c.Assert(err, check.IsNil)
	c.Assert(hit, check.NotNil)

	c.Assert(hit.HITId, check.Equals, "28J4IXKO2L927XKJTHO34OCDNASCDW")
	c.Assert(hit.HITTypeId, check.Equals, "2XZ7D1X3V0FKQVW7LU51S7PKKGFKDF")
}

func (s *S) TestCreateHITHTMLQuestion(c *check.C) {
	testServer.Response(200, nil, BasicHitResponse)

	question := mturk.HTMLQuestion{
		HTMLContent: mturk.HTMLContent{`<![CDATA[
<!DOCTYPE html>
<html>
 <head>
  <meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/>
  <script type='text/javascript' src='https://s3.amazonaws.com/mturk-public/externalHIT_v1.js'></script>
 </head>
 <body>
  <form name='mturk_form' method='post' id='mturk_form' action='https://www.mturk.com/mturk/externalSubmit'>
  <input type='hidden' value='' name='assignmentId' id='assignmentId'/>
  <h1>What's up?</h1>
  <p><textarea name='comment' cols='80' rows='3'></textarea></p>
  <p><input type='submit' id='submitButton' value='Submit' /></p></form>
  <script language='Javascript'>turkSetAssignmentID();</script>
 </body>
</html>
]]>`},
		FrameHeight: 200,
	}
	reward := mturk.Price{
		Amount:       "0.01",
		CurrencyCode: "USD",
	}
	hit, err := s.mturk.CreateHIT("title", "description", question, reward, 1, 2, "key1,key2", 3, nil, "annotation")

	testServer.WaitRequest()

	c.Assert(err, check.IsNil)
	c.Assert(hit, check.NotNil)

	c.Assert(hit.HITId, check.Equals, "28J4IXKO2L927XKJTHO34OCDNASCDW")
	c.Assert(hit.HITTypeId, check.Equals, "2XZ7D1X3V0FKQVW7LU51S7PKKGFKDF")
}

func (s *S) TestSearchHITs(c *check.C) {
	testServer.Response(200, nil, SearchHITResponse)

	hitResult, err := s.mturk.SearchHITs()

	c.Assert(err, check.IsNil)
	c.Assert(hitResult, check.NotNil)

	c.Assert(hitResult.NumResults, check.Equals, uint(1))
	c.Assert(hitResult.PageNumber, check.Equals, uint(1))
	c.Assert(hitResult.TotalNumResults, check.Equals, uint(1))

	c.Assert(len(hitResult.HITs), check.Equals, 1)
	c.Assert(hitResult.HITs[0].HITId, check.Equals, "2BU26DG67D1XTE823B3OQ2JF2XWF83")
	c.Assert(hitResult.HITs[0].HITTypeId, check.Equals, "22OWJ5OPB0YV6IGL5727KP9U38P5XR")
	c.Assert(hitResult.HITs[0].CreationTime, check.Equals, "2011-12-28T19:56:20Z")
	c.Assert(hitResult.HITs[0].Title, check.Equals, "test hit")
	c.Assert(hitResult.HITs[0].Description, check.Equals, "please disregard, testing only")
	c.Assert(hitResult.HITs[0].HITStatus, check.Equals, "Reviewable")
	c.Assert(hitResult.HITs[0].MaxAssignments, check.Equals, uint(1))
	c.Assert(hitResult.HITs[0].Reward.Amount, check.Equals, "0.01")
	c.Assert(hitResult.HITs[0].Reward.CurrencyCode, check.Equals, "USD")
	c.Assert(hitResult.HITs[0].AutoApprovalDelayInSeconds, check.Equals, uint(2592000))
	c.Assert(hitResult.HITs[0].AssignmentDurationInSeconds, check.Equals, uint(30))
	c.Assert(hitResult.HITs[0].NumberOfAssignmentsPending, check.Equals, uint(0))
	c.Assert(hitResult.HITs[0].NumberOfAssignmentsAvailable, check.Equals, uint(1))
	c.Assert(hitResult.HITs[0].NumberOfAssignmentsCompleted, check.Equals, uint(0))
}

func (s *S) TestGetAssignmentsForHIT_NoAnswer(c *check.C) {
	testServer.Response(200, nil, GetAssignmentsForHITNoAnswerResponse)

	assignments, err := s.mturk.GetAssignmentsForHIT("emptyassignment")

	testServer.WaitRequest()

	c.Assert(err, check.IsNil)
	c.Assert(assignments, check.IsNil)
}

func (s *S) TestGetAssignmentsForHIT_Answer(c *check.C) {
	testServer.Response(200, nil, GetAssignmentsForHITAnswerResponse)

	assignment, err := s.mturk.GetAssignmentsForHIT("emptyassignment")

	testServer.WaitRequest()

	c.Assert(err, check.IsNil)
	c.Assert(assignment, check.NotNil)

	c.Assert(assignment[0].AssignmentId, check.Equals, "2QKNTL0XULRGFAQWUWDD05FP94V2O3")
	c.Assert(assignment[0].WorkerId, check.Equals, "A1ZUQ2YDM61713")
	c.Assert(assignment[0].HITId, check.Equals, "2W36VCPWZ9RN5DX1MBJ7VN3D6WEPAM")
	c.Assert(assignment[0].AssignmentStatus, check.Equals, "Submitted")
	c.Assert(assignment[0].AutoApprovalTime, check.Equals, "2014-02-26T09:39:48Z")
	c.Assert(assignment[0].AcceptTime, check.Equals, "2014-01-27T09:39:38Z")
	c.Assert(assignment[0].SubmitTime, check.Equals, "2014-01-27T09:39:48Z")
	c.Assert(assignment[0].ApprovalTime, check.Equals, "")

	answers := assignment[0].Answers()
	c.Assert(len(answers), check.Equals, 4)
	c.Assert(answers["tags"], check.Equals, "asd")
	c.Assert(answers["text_in_image"], check.Equals, "asd")
	c.Assert(answers["is_pattern"], check.Equals, "yes")
	c.Assert(answers["is_map"], check.Equals, "yes")
}
