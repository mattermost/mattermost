package endpoints

import "testing"

func TestGlobalEndpoints(t *testing.T) {
	region := "mock-region-1"
	svcs := []string{"cloudfront", "iam", "importexport", "route53", "sts"}

	for _, name := range svcs {
		if EndpointForRegion(name, region) != name+".amazonaws.com" {
			t.Errorf("expected endpoint for %s to equal %s.amazonaws.com", name, name)
		}
	}
}

func TestServicesInCN(t *testing.T) {
	region := "cn-north-1"
	svcs := []string{"cloudfront", "iam", "importexport", "route53", "sts", "s3"}

	for _, name := range svcs {
		if EndpointForRegion(name, region) != name+"."+region+".amazonaws.com.cn" {
			t.Errorf("expected endpoint for %s to equal %s.%s.amazonaws.com.cn", name, name, region)
		}
	}
}
