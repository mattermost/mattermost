// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

/*
func createSubDomain(subDomain string, target string) {

	if utils.Cfg.AWSSettings.Route53AccessKeyId == "" {
		return
	}

	creds := aws.Creds(utils.Cfg.AWSSettings.Route53AccessKeyId, utils.Cfg.AWSSettings.Route53SecretAccessKey, "")
	r53 := route53.New(aws.DefaultConfig.Merge(&aws.Config{Credentials: creds, Region: utils.Cfg.AWSSettings.Route53Region}))

	rr := route53.ResourceRecord{
		Value: aws.String(target),
	}

	rrs := make([]*route53.ResourceRecord, 1)
	rrs[0] = &rr

	change := route53.Change{
		Action: aws.String("CREATE"),
		ResourceRecordSet: &route53.ResourceRecordSet{
			Name:            aws.String(fmt.Sprintf("%v.%v", subDomain, utils.Cfg.ServiceSettings.Domain)),
			TTL:             aws.Long(300),
			Type:            aws.String("CNAME"),
			ResourceRecords: rrs,
		},
	}

	changes := make([]*route53.Change, 1)
	changes[0] = &change

	r53req := &route53.ChangeResourceRecordSetsInput{
		HostedZoneID: aws.String(utils.Cfg.AWSSettings.Route53ZoneId),
		ChangeBatch: &route53.ChangeBatch{
			Changes: changes,
		},
	}

	if _, err := r53.ChangeResourceRecordSets(r53req); err != nil {
		l4g.Error("erro in createSubDomain domain=%v err=%v", subDomain, err)
		return
	}
}

func doesSubDomainExist(subDomain string) bool {

	// if it's configured for testing then skip this step
	if utils.Cfg.AWSSettings.Route53AccessKeyId == "" {
		return false
	}

	creds := aws.Creds(utils.Cfg.AWSSettings.Route53AccessKeyId, utils.Cfg.AWSSettings.Route53SecretAccessKey, "")
	r53 := route53.New(aws.DefaultConfig.Merge(&aws.Config{Credentials: creds, Region: utils.Cfg.AWSSettings.Route53Region}))

	r53req := &route53.ListResourceRecordSetsInput{
		HostedZoneID:    aws.String(utils.Cfg.AWSSettings.Route53ZoneId),
		MaxItems:        aws.String("1"),
		StartRecordName: aws.String(fmt.Sprintf("%v.%v.", subDomain, utils.Cfg.ServiceSettings.Domain)),
	}

	if result, err := r53.ListResourceRecordSets(r53req); err != nil {
		l4g.Error("error in doesSubDomainExist domain=%v err=%v", subDomain, err)
		return true
	} else {

		for _, v := range result.ResourceRecordSets {
			if v.Name != nil && *v.Name == fmt.Sprintf("%v.%v.", subDomain, utils.Cfg.ServiceSettings.Domain) {
				return true
			}
		}
	}

	return false
}
*/
