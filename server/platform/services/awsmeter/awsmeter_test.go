// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package awsmeter

import (
	"errors"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/service/marketplacemetering"
	"github.com/aws/aws-sdk-go/service/marketplacemetering/marketplacemeteringiface"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/plugin/plugintest/mock"
)

type mockMarketplaceMeteringClient struct {
	marketplacemeteringiface.MarketplaceMeteringAPI
}

func (m *mockMarketplaceMeteringClient) MeterUsage(input *marketplacemetering.MeterUsageInput) (*marketplacemetering.MeterUsageOutput, error) {
	return &marketplacemetering.MeterUsageOutput{
		MeteringRecordId: String("1"),
	}, nil
}

type mockMarketplaceMeteringClientWithError struct {
	marketplacemeteringiface.MarketplaceMeteringAPI
}

func (m *mockMarketplaceMeteringClientWithError) MeterUsage(input *marketplacemetering.MeterUsageInput) (*marketplacemetering.MeterUsageOutput, error) {
	return nil, errors.New("error")
}

func String(i string) *string {
	return &i
}
func TestAwsMeterUsage(t *testing.T) {
	startTime := time.Now()
	endTime := time.Now()
	dimensions := []string{model.AwsMeteringDimensionUsageHrs}

	userStoreMock := mocks.UserStore{}
	userStoreMock.On("AnalyticsActiveCountForPeriod", model.GetMillisForTime(startTime), model.GetMillisForTime(endTime), mock.AnythingOfType("model.UserCountOptions")).Return(int64(2), nil)

	storeMock := mocks.Store{}
	storeMock.On("User").Return(&userStoreMock)

	reports := make([]*AWSMeterReport, 1)
	reports[0] = &AWSMeterReport{
		Dimension: model.AwsMeteringDimensionUsageHrs,
		Value:     2,
		Timestamp: startTime,
	}

	// Define a mock struct to be used in your unit tests of myFunc.
	svc := &AWSMeterService{
		AwsDryRun:      false,
		AwsProductCode: "12345",
		AwsMeteringSvc: &mockMarketplaceMeteringClient{},
	}

	config := &model.Config{}
	config.SetDefaults()

	awsmeter := &AwsMeter{
		store:   &storeMock,
		service: svc,
		config:  config,
	}

	t.Run("Send report for one usage category", func(t *testing.T) {
		resultReports := awsmeter.GetUserCategoryUsage(dimensions, startTime, endTime)
		require.NotNil(t, resultReports)
		assert.Equal(t, 1, len(resultReports))
		assert.Equal(t, reports[0].Dimension, resultReports[0].Dimension)
		assert.Equal(t, reports[0].Value, resultReports[0].Value)
		assert.Equal(t, reports[0].Timestamp, resultReports[0].Timestamp)

		err := awsmeter.ReportUserCategoryUsage(resultReports)
		require.NoError(t, err)
	})

	t.Run("Error in AWS service call", func(t *testing.T) {
		awsmeter.service.AwsMeteringSvc = &mockMarketplaceMeteringClientWithError{}
		resultReports := awsmeter.GetUserCategoryUsage(dimensions, startTime, endTime)
		require.NotNil(t, resultReports)
		assert.Equal(t, 1, len(resultReports))
		err := awsmeter.ReportUserCategoryUsage(resultReports)
		require.Error(t, err)
	})

	t.Run("Invalid dimension", func(t *testing.T) {
		awsmeter.service.AwsMeteringSvc = &mockMarketplaceMeteringClient{}
		dimensions = []string{"invalid dimension"}
		resultReports := awsmeter.GetUserCategoryUsage(dimensions, startTime, endTime)
		require.NotNil(t, resultReports)
		assert.Equal(t, 0, len(resultReports))
		err := awsmeter.ReportUserCategoryUsage(resultReports)
		require.NoError(t, err)
	})
}

func TestAwsMeterUsageWithDBError(t *testing.T) {
	startTime := time.Now()
	endTime := time.Now()
	dimensions := []string{model.AwsMeteringDimensionUsageHrs}

	userStoreMock := mocks.UserStore{}
	userStoreMock.On("AnalyticsActiveCountForPeriod", model.GetMillisForTime(startTime), model.GetMillisForTime(endTime), mock.AnythingOfType("model.UserCountOptions")).Return(int64(0), errors.New("error"))

	storeMock := mocks.Store{}
	storeMock.On("User").Return(&userStoreMock)

	reports := make([]*AWSMeterReport, 1)
	reports[0] = &AWSMeterReport{
		Dimension: model.AwsMeteringDimensionUsageHrs,
		Value:     2,
		Timestamp: startTime,
	}

	// Define a mock struct to be used in your unit tests of myFunc.
	svc := &AWSMeterService{
		AwsDryRun:      false,
		AwsProductCode: "12345",
		AwsMeteringSvc: &mockMarketplaceMeteringClient{},
	}

	config := &model.Config{}
	config.SetDefaults()

	awsmeter := &AwsMeter{
		store:   &storeMock,
		service: svc,
		config:  config,
	}

	t.Run("Error in DB query", func(t *testing.T) {
		resultReports := awsmeter.GetUserCategoryUsage(dimensions, startTime, endTime)
		require.NotNil(t, resultReports)
		assert.Equal(t, 0, len(resultReports))
		err := awsmeter.ReportUserCategoryUsage(resultReports)
		require.NoError(t, err)
	})
}
