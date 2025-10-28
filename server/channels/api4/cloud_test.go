// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestGetSubscription(t *testing.T) {
	mainHelper.Parallel(t)
	deliquencySince := int64(2000000000)

	subscription := &model.Subscription{
		ID:              "MySubscriptionID",
		CustomerID:      "MyCustomer",
		ProductID:       "SomeProductId",
		AddOns:          []string{},
		StartAt:         1000000000,
		EndAt:           2000000000,
		CreateAt:        1000000000,
		Seats:           10,
		IsFreeTrial:     "true",
		DNS:             "some.dns.server",
		TrialEndAt:      2000000000,
		LastInvoice:     &model.Invoice{},
		DelinquentSince: &deliquencySince,
	}

	userFacingSubscription := &model.Subscription{
		ID:              "MySubscriptionID",
		CustomerID:      "",
		ProductID:       "SomeProductId",
		AddOns:          []string{},
		StartAt:         0,
		EndAt:           2000000000,
		CreateAt:        0,
		Seats:           0,
		IsFreeTrial:     "true",
		DNS:             "",
		TrialEndAt:      2000000000,
		LastInvoice:     &model.Invoice{},
		DelinquentSince: &deliquencySince,
	}

	t.Run("NON Admin users receive the user facing subscription", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionReturned, r, err := th.Client.GetSubscription(context.Background())

		require.NoError(t, err)
		require.Equal(t, subscriptionReturned, userFacingSubscription)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
	})

	t.Run("Admin users receive the full subscription information", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionReturned, r, err := th.SystemAdminClient.GetSubscription(context.Background())

		require.NoError(t, err)
		require.Equal(t, subscriptionReturned, subscription)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
	})
}

func TestValidateBusinessEmail(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("Returns forbidden for invalid business email", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		validBusinessEmail := model.ValidateBusinessEmailRequest{Email: "invalid@slacker.com"}

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, validBusinessEmail.Email).Return(errors.New("invalid email"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		res, err := th.SystemAdminClient.ValidateBusinessEmail(context.Background(), &validBusinessEmail)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, res.StatusCode, "403")
	})

	t.Run("Validate business email for admin", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		validBusinessEmail := model.ValidateBusinessEmailRequest{Email: "valid@mattermost.com"}

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, validBusinessEmail.Email).Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		res, err := th.SystemAdminClient.ValidateBusinessEmail(context.Background(), &validBusinessEmail)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode, "200")
	})

	t.Run("Empty body returns bad request", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		r, err := th.SystemAdminClient.DoAPIPost(context.Background(), "/cloud/validate-business-email", "")
		require.Error(t, err)
		closeBody(r)
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "Status Bad Request")
	})
}

func TestValidateWorkspaceBusinessEmail(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("validate the Cloud Customer has used a valid email to create the workspace", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloudCustomerInfo := model.CloudCustomerInfo{
			Email: "valid@mattermost.com",
		}

		cloudCustomer := &model.CloudCustomer{
			CloudCustomerInfo: cloudCustomerInfo,
		}

		cloud.Mock.On("GetCloudCustomer", th.SystemAdminUser.Id).Return(cloudCustomer, nil)
		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, cloudCustomerInfo.Email).Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		_, err = th.SystemAdminClient.ValidateWorkspaceBusinessEmail(context.Background())
		require.NoError(t, err)
	})

	t.Run("validate the Cloud Customer has used a invalid email to create the workspace and must validate admin email", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloudCustomerInfo := model.CloudCustomerInfo{
			Email: "invalid@gmail.com",
		}

		cloudCustomer := &model.CloudCustomer{
			CloudCustomerInfo: cloudCustomerInfo,
		}

		cloud.Mock.On("GetCloudCustomer", th.SystemAdminUser.Id).Return(cloudCustomer, nil)

		// first call to validate the cloud customer email
		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, cloudCustomerInfo.Email).Return(errors.New("invalid email"))

		// second call to validate the user admin email
		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, th.SystemAdminUser.Email).Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		_, err = th.SystemAdminClient.ValidateWorkspaceBusinessEmail(context.Background())
		require.NoError(t, err)
	})

	t.Run("Error while grabbing the cloud customer returns bad request", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloudCustomerInfo := model.CloudCustomerInfo{
			Email: "badrequest@gmail.com",
		}

		// return an error while getting the cloud customer so we validate the forbidden error return
		cloud.Mock.On("GetCloudCustomer", th.SystemAdminUser.Id).Return(nil, errors.New("error while gettings the cloud customer"))

		// required cloud mocks so the request doesn't fail
		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, cloudCustomerInfo.Email).Return(errors.New("invalid email"))
		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, th.SystemAdminUser.Email).Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		r, err := th.SystemAdminClient.DoAPIPost(context.Background(), "/cloud/validate-workspace-business-email", "")
		require.Error(t, err)
		closeBody(r)
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "Status Bad Request")
	})
}

func TestGetCloudProducts(t *testing.T) {
	mainHelper.Parallel(t)
	cloudProducts := []*model.Product{
		{
			ID:                "prod_test1",
			Name:              "name",
			Description:       "description",
			PricePerSeat:      10,
			SKU:               "sku",
			PriceID:           "price_id",
			Family:            "family",
			RecurringInterval: "monthly",
			BillingScheme:     "billing_scheme",
			CrossSellsTo:      "",
		},
		{
			ID:                "prod_test2",
			Name:              "name2",
			Description:       "description2",
			PricePerSeat:      100,
			SKU:               "sku2",
			PriceID:           "price_id2",
			Family:            "family2",
			RecurringInterval: "monthly",
			BillingScheme:     "billing_scheme2",
			CrossSellsTo:      "prod_test3",
		},
		{
			ID:                "prod_test3",
			Name:              "name3",
			Description:       "description3",
			PricePerSeat:      1000,
			SKU:               "sku3",
			PriceID:           "price_id3",
			Family:            "family3",
			RecurringInterval: "yearly",
			BillingScheme:     "billing_scheme3",
			CrossSellsTo:      "prod_test2",
		},
	}

	sanitizedProducts := []*model.Product{
		{
			ID:                "prod_test1",
			Name:              "name",
			PricePerSeat:      10,
			SKU:               "sku",
			RecurringInterval: "monthly",
			CrossSellsTo:      "",
		},
		{
			ID:                "prod_test2",
			Name:              "name2",
			PricePerSeat:      100,
			SKU:               "sku2",
			RecurringInterval: "monthly",
			CrossSellsTo:      "prod_test3",
		},
		{
			ID:                "prod_test3",
			Name:              "name3",
			PricePerSeat:      1000,
			SKU:               "sku3",
			RecurringInterval: "yearly",
			CrossSellsTo:      "prod_test2",
		},
	}
	t.Run("get products for admins", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}
		cloud.Mock.On("GetCloudProducts", mock.Anything, mock.Anything).Return(cloudProducts, nil)
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		returnedProducts, r, err := th.Client.GetCloudProducts(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
		require.Equal(t, returnedProducts, cloudProducts)
	})

	t.Run("get products for non admins", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetCloudProducts", mock.Anything, mock.Anything).Return(cloudProducts, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		returnedProducts, r, err := th.Client.GetCloudProducts(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
		require.Equal(t, returnedProducts, sanitizedProducts)

		// make a more explicit check
		require.Equal(t, returnedProducts[0].ID, "prod_test1")
		require.Equal(t, returnedProducts[0].Name, "name")
		require.Equal(t, returnedProducts[0].SKU, "sku")
		require.Equal(t, returnedProducts[0].PricePerSeat, float64(10))
		require.Equal(t, returnedProducts[0].Description, "")
		require.Equal(t, returnedProducts[0].PriceID, "")
		require.Equal(t, returnedProducts[0].Family, model.SubscriptionFamily(""))
		require.Equal(t, returnedProducts[0].RecurringInterval, model.RecurringInterval("monthly"))
		require.Equal(t, returnedProducts[0].BillingScheme, model.BillingScheme(""))
		require.Equal(t, returnedProducts[0].CrossSellsTo, "")

		require.Equal(t, returnedProducts[1].ID, "prod_test2")
		require.Equal(t, returnedProducts[1].Name, "name2")
		require.Equal(t, returnedProducts[1].SKU, "sku2")
		require.Equal(t, returnedProducts[1].PricePerSeat, float64(100))
		require.Equal(t, returnedProducts[1].Description, "")
		require.Equal(t, returnedProducts[1].PriceID, "")
		require.Equal(t, returnedProducts[1].Family, model.SubscriptionFamily(""))
		require.Equal(t, returnedProducts[1].RecurringInterval, model.RecurringInterval("monthly"))
		require.Equal(t, returnedProducts[1].BillingScheme, model.BillingScheme(""))
		require.Equal(t, returnedProducts[1].CrossSellsTo, "prod_test3")

		require.Equal(t, returnedProducts[2].ID, "prod_test3")
		require.Equal(t, returnedProducts[2].Name, "name3")
		require.Equal(t, returnedProducts[2].SKU, "sku3")
		require.Equal(t, returnedProducts[2].PricePerSeat, float64(1000))
		require.Equal(t, returnedProducts[2].Description, "")
		require.Equal(t, returnedProducts[2].PriceID, "")
		require.Equal(t, returnedProducts[2].Family, model.SubscriptionFamily(""))
		require.Equal(t, returnedProducts[2].RecurringInterval, model.RecurringInterval("yearly"))
		require.Equal(t, returnedProducts[2].BillingScheme, model.BillingScheme(""))
		require.Equal(t, returnedProducts[2].CrossSellsTo, "prod_test2")
	})
}
