package cloudwatch_test

import (
	"testing"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/cloudwatch"
	"github.com/goamz/goamz/testutil"
	. "gopkg.in/check.v1"
)

func Test(t *testing.T) {
	TestingT(t)
}

type S struct {
	cw *cloudwatch.CloudWatch
}

var _ = Suite(&S{})

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.cw, _ = cloudwatch.NewCloudWatch(auth, aws.ServiceInfo{testServer.URL, aws.V2Signature})
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func getTestAlarm() *cloudwatch.MetricAlarm {
	alarm := new(cloudwatch.MetricAlarm)

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

func (s *S) TestPutAlarm(c *C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, Equals, "POST")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Form["Action"], DeepEquals, []string{"PutMetricAlarm"})
	c.Assert(req.Form["AlarmName"], DeepEquals, []string{"TestAlarm"})
	c.Assert(req.Form["ComparisonOperator"], DeepEquals, []string{"LessThanThreshold"})
	c.Assert(req.Form["EvaluationPeriods"], DeepEquals, []string{"5"})
	c.Assert(req.Form["Threshold"], DeepEquals, []string{"1.0000000000E+00"})
	c.Assert(req.Form["Period"], DeepEquals, []string{"60"})
	c.Assert(req.Form["Statistic"], DeepEquals, []string{"Sum"})
}

func (s *S) TestPutAlarmWithAction(c *C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	alarm.AlarmActions = []cloudwatch.AlarmAction{
		cloudwatch.AlarmAction{
			ARN: "123",
		},
	}

	alarm.OkActions = []cloudwatch.AlarmAction{
		cloudwatch.AlarmAction{
			ARN: "456",
		},
	}

	alarm.InsufficientDataActions = []cloudwatch.AlarmAction{
		cloudwatch.AlarmAction{
			ARN: "789",
		},
	}

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, Equals, "POST")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Form["Action"], DeepEquals, []string{"PutMetricAlarm"})
	c.Assert(req.Form["AlarmActions.member.1"], DeepEquals, []string{"123"})
	c.Assert(req.Form["OKActions.member.1"], DeepEquals, []string{"456"})
	c.Assert(req.Form["InsufficientDataActions.member.1"], DeepEquals, []string{"789"})
	c.Assert(req.Form["AlarmName"], DeepEquals, []string{"TestAlarm"})
	c.Assert(req.Form["ComparisonOperator"], DeepEquals, []string{"LessThanThreshold"})
	c.Assert(req.Form["EvaluationPeriods"], DeepEquals, []string{"5"})
	c.Assert(req.Form["Threshold"], DeepEquals, []string{"1.0000000000E+00"})
	c.Assert(req.Form["Period"], DeepEquals, []string{"60"})
	c.Assert(req.Form["Statistic"], DeepEquals, []string{"Sum"})
}

func (s *S) TestPutAlarmInvalidComapirsonOperator(c *C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	alarm.ComparisonOperator = "LessThan"

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, NotNil)
	c.Assert(err.Error(), Equals, "ComparisonOperator is not valid")
}

func (s *S) TestPutAlarmInvalidStatistic(c *C) {
	testServer.Response(200, nil, "<RequestId>123</RequestId>")

	alarm := getTestAlarm()

	alarm.Statistic = "Count"

	_, err := s.cw.PutMetricAlarm(alarm)
	c.Assert(err, NotNil)
	c.Assert(err.Error(), Equals, "Invalid statistic value supplied")
}
