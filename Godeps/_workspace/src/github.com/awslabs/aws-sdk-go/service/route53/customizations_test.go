package route53_test

import (
	"testing"

	"github.com/awslabs/aws-sdk-go/aws"
	"github.com/awslabs/aws-sdk-go/internal/util/utilassert"
	"github.com/awslabs/aws-sdk-go/service/route53"
)

func TestBuildCorrectURI(t *testing.T) {
	svc := route53.New(nil)
	req, _ := svc.GetHostedZoneRequest(&route53.GetHostedZoneInput{
		ID: aws.String("/hostedzone/ABCDEFG"),
	})

	req.Build()

	utilassert.Match(t, `\/hostedzone\/ABCDEFG$`, req.HTTPRequest.URL.String())
}
