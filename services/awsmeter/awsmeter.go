// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package awsmeter

import (
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/marketplacemetering"
	"github.com/aws/aws-sdk-go/service/marketplacemetering/marketplacemeteringiface"
)

type AwsMeter struct {
	store   store.Store
	service *AWSMeterService
	config  *model.Config
}

type AWSMeterService struct {
	AwsDryRun      bool
	AwsProductCode string
	AwsMeteringSvc marketplacemeteringiface.MarketplaceMeteringAPI
}

func New(store store.Store, config *model.Config) *AwsMeter {
	svc := &AWSMeterService{
		AwsDryRun:      false,
		AwsProductCode: "12345", //TODO
	}

	service, err := newAWSMarketplaceMeteringService()
	if err != nil {
		mlog.Error("newAWSMeterService", mlog.String("error", err.Error()))
		return nil
	}

	svc.AwsMeteringSvc = service
	return &AwsMeter{
		store:   store,
		service: svc,
		config:  config,
	}
}

func newAWSMarketplaceMeteringService() (*marketplacemetering.MarketplaceMetering, error) {
	region := os.Getenv("AWS_REGION")
	s := session.Must(session.NewSession(&aws.Config{Region: &region}))

	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&ec2rolecreds.EC2RoleProvider{
				Client: ec2metadata.New(s),
			},
		})

	_, err := creds.Get()
	if err != nil {
		mlog.Error("session is invalid", mlog.String("error", err.Error()))
		return nil, errors.New("cannot obtain credentials")
	}

	return marketplacemetering.New(session.Must(session.NewSession(&aws.Config{
		Credentials: creds,
	}))), nil
}

// a report entry is for all metrics
func (awsm *AwsMeter) GetUserCategoryUsage(dimensions []string, startTime time.Time, endTime time.Time) []*model.AWSMeterReport {
	reports := make([]*model.AWSMeterReport, 0)

	for _, dimension := range dimensions {
		var userCount int64
		var err error

		switch dimension {
		case model.AWS_METERING_DIMENSION_USAGE_HRS:
			userCount, err = awsm.store.User().AnalyticsActiveCountForPeriod(model.GetMillisForTime(startTime), model.GetMillisForTime(endTime), model.UserCountOptions{})
			mlog.Info("GetUserCategoryUsage", mlog.Int64("usercount", userCount), mlog.Err(err), mlog.Bool("bool", err != nil))
			if err != nil {
				mlog.Error("Failed to obtain usage data", mlog.String("dimension", dimension), mlog.String("start", startTime.String()), mlog.Int64("count", userCount), mlog.Err(err))
			}
		default:
			mlog.Error("Dimension does not exist!", mlog.String("dimension", dimension))
			err = errors.New("Dimension does not exist")
		}

		if err != nil {
			mlog.Error("Failed to obtain usage.", mlog.String("dimension", dimension), mlog.Err(err))
			return reports
		}

		report := &model.AWSMeterReport{
			Dimension: dimension,
			Value:     userCount,
			Timestamp: startTime,
		}

		reports = append(reports, report)
	}

	return reports
}

func (awsm *AwsMeter) ReportUserCategoryUsage(reports []*model.AWSMeterReport) *model.AppError {
	for _, report := range reports {
		err := sendReportToMeteringService(awsm.service, report)
		if err != nil {
			return err
		}
	}
	return nil
}

func sendReportToMeteringService(ams *AWSMeterService, report *model.AWSMeterReport) *model.AppError {
	params := &marketplacemetering.MeterUsageInput{
		DryRun:         aws.Bool(ams.AwsDryRun),
		ProductCode:    aws.String(ams.AwsProductCode),
		UsageDimension: aws.String(report.Dimension),
		UsageQuantity:  aws.Int64(report.Value),
		Timestamp:      aws.Time(report.Timestamp),
	}

	resp, err := ams.AwsMeteringSvc.MeterUsage(params)
	if err != nil {
		return model.NewAppError("sendReportToMeteringService", "app.system.aws_metering_service.error", nil, err.Error(), http.StatusNotFound)
	}
	if resp.MeteringRecordId == nil {
		return model.NewAppError("sendReportToMeteringService", "app.system.aws_metering_service.error", nil, "", http.StatusNotFound)
	}

	mlog.Debug("Sent record to AWS metering service", mlog.String("dimension", report.Dimension), mlog.Int64("value", report.Value), mlog.String("timestamp", report.Timestamp.String()))

	return nil
}
