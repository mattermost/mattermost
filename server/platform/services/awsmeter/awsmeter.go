// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package awsmeter

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	"github.com/aws/aws-sdk-go-v2/service/marketplacemetering"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type AwsMeter struct {
	store   store.Store
	service *AWSMeterService
	config  *model.Config
}

type MeteringService interface {
	MeterUsage(ctx context.Context, input *marketplacemetering.MeterUsageInput, optFns ...func(*marketplacemetering.Options)) (*marketplacemetering.MeterUsageOutput, error)
}

type AWSMeterService struct {
	AwsDryRun      bool
	AwsProductCode string
	AwsMeteringSvc MeteringService
}

type AWSMeterReport struct {
	Dimension string    `json:"dimension"`
	Value     int32     `json:"value"`
	Timestamp time.Time `json:"timestamp"`
}

func (o *AWSMeterReport) ToJSON() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func New(ctx context.Context, store store.Store, config *model.Config) *AwsMeter {
	svc := &AWSMeterService{
		AwsDryRun:      false,
		AwsProductCode: "12345", //TODO
	}

	service, err := newAWSMarketplaceMeteringService(ctx)
	if err != nil {
		mlog.Debug("Could not create AWS metering service", mlog.String("error", err.Error()))
		return nil
	}

	svc.AwsMeteringSvc = service
	return &AwsMeter{
		store:   store,
		service: svc,
		config:  config,
	}
}

func newAWSMarketplaceMeteringService(ctx context.Context) (*marketplacemetering.Client, error) {
	region := os.Getenv("AWS_REGION")
	imdsClient := imds.New(imds.Options{})
	credsProvider := ec2rolecreds.New(func(o *ec2rolecreds.Options) { o.Client = imdsClient })

	creds := aws.NewCredentialsCache(credsProvider)

	_, err := creds.Retrieve(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "cannot obtain credentials")
	}

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(creds),
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load default config with EC2 credentials provider")
	}

	return marketplacemetering.NewFromConfig(cfg), nil
}

// a report entry is for all metrics
func (awsm *AwsMeter) GetUserCategoryUsage(dimensions []string, startTime time.Time, endTime time.Time) []*AWSMeterReport {
	reports := make([]*AWSMeterReport, 0)

	for _, dimension := range dimensions {
		var userCount int32
		var err error

		switch dimension {
		case model.AwsMeteringDimensionUsageHrs:
			userCount, err = awsm.store.User().AnalyticsActiveCountForPeriod(model.GetMillisForTime(startTime), model.GetMillisForTime(endTime), model.UserCountOptions{})
			if err != nil {
				mlog.Warn("Failed to obtain usage data", mlog.String("dimension", dimension), mlog.Time("start", startTime), mlog.Int("count", userCount), mlog.Err(err))
				continue
			}
		default:
			mlog.Debug("Dimension does not exist!", mlog.String("dimension", dimension))
			continue
		}

		report := &AWSMeterReport{
			Dimension: dimension,
			Value:     userCount,
			Timestamp: startTime,
		}

		reports = append(reports, report)
	}

	return reports
}

func (awsm *AwsMeter) ReportUserCategoryUsage(ctx context.Context, reports []*AWSMeterReport) error {
	for _, report := range reports {
		err := sendReportToMeteringService(ctx, awsm.service, report)
		if err != nil {
			return err
		}
	}
	return nil
}

func sendReportToMeteringService(ctx context.Context, ams *AWSMeterService, report *AWSMeterReport) error {
	params := &marketplacemetering.MeterUsageInput{
		DryRun:         aws.Bool(ams.AwsDryRun),
		ProductCode:    aws.String(ams.AwsProductCode),
		UsageDimension: aws.String(report.Dimension),
		UsageQuantity:  aws.Int32(report.Value),
		Timestamp:      aws.Time(report.Timestamp),
	}

	resp, err := ams.AwsMeteringSvc.MeterUsage(ctx, params)
	if err != nil {
		return errors.Wrap(err, "Invalid metering service id.")
	}
	if resp.MeteringRecordId == nil {
		return errors.Wrap(err, "Invalid metering service id.")
	}

	mlog.Debug("Sent record to AWS metering service", mlog.String("dimension", report.Dimension), mlog.Int("value", report.Value), mlog.String("timestamp", report.Timestamp.String()))

	return nil
}
