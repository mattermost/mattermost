package route53_test

import (
	"bytes"
	"fmt"
	"time"

	"github.com/awslabs/aws-sdk-go/aws"
	"github.com/awslabs/aws-sdk-go/aws/awsutil"
	"github.com/awslabs/aws-sdk-go/service/route53"
)

var _ time.Duration
var _ bytes.Buffer

func ExampleRoute53_AssociateVPCWithHostedZone() {
	svc := route53.New(nil)

	params := &route53.AssociateVPCWithHostedZoneInput{
		HostedZoneID: aws.String("ResourceId"), // Required
		VPC: &route53.VPC{ // Required
			VPCID:     aws.String("VPCId"),
			VPCRegion: aws.String("VPCRegion"),
		},
		Comment: aws.String("AssociateVPCComment"),
	}
	resp, err := svc.AssociateVPCWithHostedZone(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ChangeResourceRecordSets() {
	svc := route53.New(nil)

	params := &route53.ChangeResourceRecordSetsInput{
		ChangeBatch: &route53.ChangeBatch{ // Required
			Changes: []*route53.Change{ // Required
				&route53.Change{ // Required
					Action: aws.String("ChangeAction"), // Required
					ResourceRecordSet: &route53.ResourceRecordSet{ // Required
						Name: aws.String("DNSName"), // Required
						Type: aws.String("RRType"),  // Required
						AliasTarget: &route53.AliasTarget{
							DNSName:              aws.String("DNSName"),    // Required
							EvaluateTargetHealth: aws.Boolean(true),        // Required
							HostedZoneID:         aws.String("ResourceId"), // Required
						},
						Failover: aws.String("ResourceRecordSetFailover"),
						GeoLocation: &route53.GeoLocation{
							ContinentCode:   aws.String("GeoLocationContinentCode"),
							CountryCode:     aws.String("GeoLocationCountryCode"),
							SubdivisionCode: aws.String("GeoLocationSubdivisionCode"),
						},
						HealthCheckID: aws.String("HealthCheckId"),
						Region:        aws.String("ResourceRecordSetRegion"),
						ResourceRecords: []*route53.ResourceRecord{
							&route53.ResourceRecord{ // Required
								Value: aws.String("RData"), // Required
							},
							// More values...
						},
						SetIdentifier: aws.String("ResourceRecordSetIdentifier"),
						TTL:           aws.Long(1),
						Weight:        aws.Long(1),
					},
				},
				// More values...
			},
			Comment: aws.String("ResourceDescription"),
		},
		HostedZoneID: aws.String("ResourceId"), // Required
	}
	resp, err := svc.ChangeResourceRecordSets(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ChangeTagsForResource() {
	svc := route53.New(nil)

	params := &route53.ChangeTagsForResourceInput{
		ResourceID:   aws.String("TagResourceId"),   // Required
		ResourceType: aws.String("TagResourceType"), // Required
		AddTags: []*route53.Tag{
			&route53.Tag{ // Required
				Key:   aws.String("TagKey"),
				Value: aws.String("TagValue"),
			},
			// More values...
		},
		RemoveTagKeys: []*string{
			aws.String("TagKey"), // Required
			// More values...
		},
	}
	resp, err := svc.ChangeTagsForResource(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_CreateHealthCheck() {
	svc := route53.New(nil)

	params := &route53.CreateHealthCheckInput{
		CallerReference: aws.String("HealthCheckNonce"), // Required
		HealthCheckConfig: &route53.HealthCheckConfig{ // Required
			Type:                     aws.String("HealthCheckType"), // Required
			FailureThreshold:         aws.Long(1),
			FullyQualifiedDomainName: aws.String("FullyQualifiedDomainName"),
			IPAddress:                aws.String("IPAddress"),
			Port:                     aws.Long(1),
			RequestInterval:          aws.Long(1),
			ResourcePath:             aws.String("ResourcePath"),
			SearchString:             aws.String("SearchString"),
		},
	}
	resp, err := svc.CreateHealthCheck(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_CreateHostedZone() {
	svc := route53.New(nil)

	params := &route53.CreateHostedZoneInput{
		CallerReference: aws.String("Nonce"),   // Required
		Name:            aws.String("DNSName"), // Required
		DelegationSetID: aws.String("ResourceId"),
		HostedZoneConfig: &route53.HostedZoneConfig{
			Comment:     aws.String("ResourceDescription"),
			PrivateZone: aws.Boolean(true),
		},
		VPC: &route53.VPC{
			VPCID:     aws.String("VPCId"),
			VPCRegion: aws.String("VPCRegion"),
		},
	}
	resp, err := svc.CreateHostedZone(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_CreateReusableDelegationSet() {
	svc := route53.New(nil)

	params := &route53.CreateReusableDelegationSetInput{
		CallerReference: aws.String("Nonce"), // Required
		HostedZoneID:    aws.String("ResourceId"),
	}
	resp, err := svc.CreateReusableDelegationSet(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_DeleteHealthCheck() {
	svc := route53.New(nil)

	params := &route53.DeleteHealthCheckInput{
		HealthCheckID: aws.String("HealthCheckId"), // Required
	}
	resp, err := svc.DeleteHealthCheck(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_DeleteHostedZone() {
	svc := route53.New(nil)

	params := &route53.DeleteHostedZoneInput{
		ID: aws.String("ResourceId"), // Required
	}
	resp, err := svc.DeleteHostedZone(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_DeleteReusableDelegationSet() {
	svc := route53.New(nil)

	params := &route53.DeleteReusableDelegationSetInput{
		ID: aws.String("ResourceId"), // Required
	}
	resp, err := svc.DeleteReusableDelegationSet(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_DisassociateVPCFromHostedZone() {
	svc := route53.New(nil)

	params := &route53.DisassociateVPCFromHostedZoneInput{
		HostedZoneID: aws.String("ResourceId"), // Required
		VPC: &route53.VPC{ // Required
			VPCID:     aws.String("VPCId"),
			VPCRegion: aws.String("VPCRegion"),
		},
		Comment: aws.String("DisassociateVPCComment"),
	}
	resp, err := svc.DisassociateVPCFromHostedZone(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetChange() {
	svc := route53.New(nil)

	params := &route53.GetChangeInput{
		ID: aws.String("ResourceId"), // Required
	}
	resp, err := svc.GetChange(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetCheckerIPRanges() {
	svc := route53.New(nil)

	var params *route53.GetCheckerIPRangesInput
	resp, err := svc.GetCheckerIPRanges(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetGeoLocation() {
	svc := route53.New(nil)

	params := &route53.GetGeoLocationInput{
		ContinentCode:   aws.String("GeoLocationContinentCode"),
		CountryCode:     aws.String("GeoLocationCountryCode"),
		SubdivisionCode: aws.String("GeoLocationSubdivisionCode"),
	}
	resp, err := svc.GetGeoLocation(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetHealthCheck() {
	svc := route53.New(nil)

	params := &route53.GetHealthCheckInput{
		HealthCheckID: aws.String("HealthCheckId"), // Required
	}
	resp, err := svc.GetHealthCheck(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetHealthCheckCount() {
	svc := route53.New(nil)

	var params *route53.GetHealthCheckCountInput
	resp, err := svc.GetHealthCheckCount(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetHealthCheckLastFailureReason() {
	svc := route53.New(nil)

	params := &route53.GetHealthCheckLastFailureReasonInput{
		HealthCheckID: aws.String("HealthCheckId"), // Required
	}
	resp, err := svc.GetHealthCheckLastFailureReason(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetHealthCheckStatus() {
	svc := route53.New(nil)

	params := &route53.GetHealthCheckStatusInput{
		HealthCheckID: aws.String("HealthCheckId"), // Required
	}
	resp, err := svc.GetHealthCheckStatus(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetHostedZone() {
	svc := route53.New(nil)

	params := &route53.GetHostedZoneInput{
		ID: aws.String("ResourceId"), // Required
	}
	resp, err := svc.GetHostedZone(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetHostedZoneCount() {
	svc := route53.New(nil)

	var params *route53.GetHostedZoneCountInput
	resp, err := svc.GetHostedZoneCount(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_GetReusableDelegationSet() {
	svc := route53.New(nil)

	params := &route53.GetReusableDelegationSetInput{
		ID: aws.String("ResourceId"), // Required
	}
	resp, err := svc.GetReusableDelegationSet(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListGeoLocations() {
	svc := route53.New(nil)

	params := &route53.ListGeoLocationsInput{
		MaxItems:             aws.String("PageMaxItems"),
		StartContinentCode:   aws.String("GeoLocationContinentCode"),
		StartCountryCode:     aws.String("GeoLocationCountryCode"),
		StartSubdivisionCode: aws.String("GeoLocationSubdivisionCode"),
	}
	resp, err := svc.ListGeoLocations(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListHealthChecks() {
	svc := route53.New(nil)

	params := &route53.ListHealthChecksInput{
		Marker:   aws.String("PageMarker"),
		MaxItems: aws.String("PageMaxItems"),
	}
	resp, err := svc.ListHealthChecks(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListHostedZones() {
	svc := route53.New(nil)

	params := &route53.ListHostedZonesInput{
		DelegationSetID: aws.String("ResourceId"),
		Marker:          aws.String("PageMarker"),
		MaxItems:        aws.String("PageMaxItems"),
	}
	resp, err := svc.ListHostedZones(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListHostedZonesByName() {
	svc := route53.New(nil)

	params := &route53.ListHostedZonesByNameInput{
		DNSName:      aws.String("DNSName"),
		HostedZoneID: aws.String("ResourceId"),
		MaxItems:     aws.String("PageMaxItems"),
	}
	resp, err := svc.ListHostedZonesByName(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListResourceRecordSets() {
	svc := route53.New(nil)

	params := &route53.ListResourceRecordSetsInput{
		HostedZoneID:          aws.String("ResourceId"), // Required
		MaxItems:              aws.String("PageMaxItems"),
		StartRecordIdentifier: aws.String("ResourceRecordSetIdentifier"),
		StartRecordName:       aws.String("DNSName"),
		StartRecordType:       aws.String("RRType"),
	}
	resp, err := svc.ListResourceRecordSets(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListReusableDelegationSets() {
	svc := route53.New(nil)

	params := &route53.ListReusableDelegationSetsInput{
		Marker:   aws.String("PageMarker"),
		MaxItems: aws.String("PageMaxItems"),
	}
	resp, err := svc.ListReusableDelegationSets(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListTagsForResource() {
	svc := route53.New(nil)

	params := &route53.ListTagsForResourceInput{
		ResourceID:   aws.String("TagResourceId"),   // Required
		ResourceType: aws.String("TagResourceType"), // Required
	}
	resp, err := svc.ListTagsForResource(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_ListTagsForResources() {
	svc := route53.New(nil)

	params := &route53.ListTagsForResourcesInput{
		ResourceIDs: []*string{ // Required
			aws.String("TagResourceId"), // Required
			// More values...
		},
		ResourceType: aws.String("TagResourceType"), // Required
	}
	resp, err := svc.ListTagsForResources(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_UpdateHealthCheck() {
	svc := route53.New(nil)

	params := &route53.UpdateHealthCheckInput{
		HealthCheckID:            aws.String("HealthCheckId"), // Required
		FailureThreshold:         aws.Long(1),
		FullyQualifiedDomainName: aws.String("FullyQualifiedDomainName"),
		HealthCheckVersion:       aws.Long(1),
		IPAddress:                aws.String("IPAddress"),
		Port:                     aws.Long(1),
		ResourcePath:             aws.String("ResourcePath"),
		SearchString:             aws.String("SearchString"),
	}
	resp, err := svc.UpdateHealthCheck(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}

func ExampleRoute53_UpdateHostedZoneComment() {
	svc := route53.New(nil)

	params := &route53.UpdateHostedZoneCommentInput{
		ID:      aws.String("ResourceId"), // Required
		Comment: aws.String("ResourceDescription"),
	}
	resp, err := svc.UpdateHostedZoneComment(params)

	if awserr := aws.Error(err); awserr != nil {
		// A service error occurred.
		fmt.Println("Error:", awserr.Code, awserr.Message)
	} else if err != nil {
		// A non-service error occurred.
		panic(err)
	}

	// Pretty-print the response data.
	fmt.Println(awsutil.StringValue(resp))
}
