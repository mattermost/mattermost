package route53_test

import (
	"github.com/AdRoll/goamz/route53"
	. "gopkg.in/check.v1"
	"testing"
)

// Hook up gocheck into the "go test" runner.
func Test(t *testing.T) { TestingT(t) }

// This is a fixure used by a suite of tests
type Route53Suite struct{}

var _ = Suite(&Route53Suite{})

// validate AliasTarget behaviour
func (s *Route53Suite) TestChangeAliasTargetBehavior(c *C) {
	record := route53.ResourceRecordValue{Value: "127.0.0.1"}
	records := []route53.ResourceRecordValue{record}
	change := route53.Change{}
	change.Action = "CREATE"
	change.Name = "test.localdomain"
	change.Type = "A"
	change.TTL = 300
	change.Values = records
	alias_target := route53.AliasTarget{HostedZoneId: "WIOJWAOFIEFAJ", DNSName: "test.localdomain"}
	// AliasTarget should be a nil pointer by default
	c.Assert(change.AliasTarget, IsNil)
	// AliasTarget pass by ref
	change.AliasTarget = &alias_target
	c.Assert(change.AliasTarget.HostedZoneId, Equals, "WIOJWAOFIEFAJ")
	c.Assert(change.AliasTarget.DNSName, Equals, "test.localdomain")
	c.Assert(change.AliasTarget.EvaluateTargetHealth, Equals, false)
}
