package cloudwatch_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/cloudwatch"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

type S struct {
	cw *cloudwatch.CloudWatch
}

var _ = check.Suite(&S{})

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.cw, _ = cloudwatch.NewCloudWatch(auth, aws.ServiceInfo{Endpoint: testServer.URL, Signer: aws.V2Signature})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func getTestAlarm() *cloudwatch.MetricAlarm {
	alarm := new(cloudwatch.MetricAlarm)

	alarm.AlarmDescription = "Test Description"
	alarm.AlarmName = "TestAlarm"
	alarm.MetricName = "TestMetric"
	alarm.Namespace = "TestNamespace"
	alarm.ComparisonOperator = "LessThanThreshold"
	alarm.Threshold = 1
	alarm.EvaluationPeriods = 5
	alarm.Period = 60
	alarm.Statistic = "Sum"

	return alarm
}

func (s *S) TestPutAlarm(c *check.C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"PutMetricAlarm"})
	c.Assert(req.Form["AlarmName"], check.DeepEquals, []string{"TestAlarm"})
	c.Assert(req.Form["ComparisonOperator"], check.DeepEquals, []string{"LessThanThreshold"})
	c.Assert(req.Form["EvaluationPeriods"], check.DeepEquals, []string{"5"})
	c.Assert(req.Form["Threshold"], check.DeepEquals, []string{"1.0000000000E+00"})
	c.Assert(req.Form["Period"], check.DeepEquals, []string{"60"})
	c.Assert(req.Form["Statistic"], check.DeepEquals, []string{"Sum"})
}

func (s *S) TestPutAlarmWithAction(c *check.C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	var actions []cloudwatch.AlarmAction
	action := new(cloudwatch.AlarmAction)
	action.ARN = "123"
	actions = append(actions, *action)

	alarm.AlarmActions = actions

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"PutMetricAlarm"})
	c.Assert(req.Form["AlarmActions.member.1"], check.DeepEquals, []string{"123"})
	c.Assert(req.Form["AlarmName"], check.DeepEquals, []string{"TestAlarm"})
	c.Assert(req.Form["ComparisonOperator"], check.DeepEquals, []string{"LessThanThreshold"})
	c.Assert(req.Form["EvaluationPeriods"], check.DeepEquals, []string{"5"})
	c.Assert(req.Form["Threshold"], check.DeepEquals, []string{"1.0000000000E+00"})
	c.Assert(req.Form["Period"], check.DeepEquals, []string{"60"})
	c.Assert(req.Form["Statistic"], check.DeepEquals, []string{"Sum"})
}

func (s *S) TestPutAlarmInvalidComapirsonOperator(c *check.C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	alarm.ComparisonOperator = "LessThan"

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, check.NotNil)
	c.Assert(err.Error(), check.Equals, "ComparisonOperator is not valid")
}

func (s *S) TestPutAlarmInvalidStatistic(c *check.C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	alarm.Statistic = "Count"

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, check.NotNil)
	c.Assert(err.Error(), check.Equals, "Invalid statistic value supplied")
}
