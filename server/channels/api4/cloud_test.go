// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/channels/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
)

func Test_getCloudLimits(t *testing.T) {
	t.Run("no license returns not implemented", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().RemoveLicense()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusForbidden, r.StatusCode, "Expected 403 forbidden")
	})

	t.Run("non cloud license returns not implemented", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense())

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusForbidden, r.StatusCode, "Expected 403 forbidden")
	})

	t.Run("error fetching limits returns internal server error", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(nil, errors.New("Unable to get limits"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusInternalServerError, r.StatusCode, "Expected 500 Internal Server Error")
	})

	t.Run("unauthenticated users can not access", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Logout()

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusUnauthorized, r.StatusCode, "Expected 401 Unauthorized")
	})

	t.Run("good request with cloud server", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		ten := 10
		mockLimits := &model.ProductLimits{
			Messages: &model.MessagesLimits{
				History: &ten,
			},
		}
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(mockLimits, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Expected 200 OK")
		require.Equal(t, mockLimits, limits)
		require.Equal(t, *mockLimits.Messages.History, *limits.Messages.History)
	})
}

func Test_GetSubscription(t *testing.T) {
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
		EndAt:           0,
		CreateAt:        0,
		Seats:           0,
		IsFreeTrial:     "true",
		DNS:             "",
		TrialEndAt:      2000000000,
		LastInvoice:     &model.Invoice{},
		DelinquentSince: &deliquencySince,
	}

	t.Run("NON Admin users receive the user facing subscription", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionReturned, r, err := th.Client.GetSubscription()

		require.NoError(t, err)
		require.Equal(t, subscriptionReturned, userFacingSubscription)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
	})

	t.Run("Admin users receive the full subscription information", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionReturned, r, err := th.SystemAdminClient.GetSubscription()

		require.NoError(t, err)
		require.Equal(t, subscriptionReturned, subscription)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
	})
}

func Test_requestTrial(t *testing.T) {
	subscription := &model.Subscription{
		ID:         "MySubscriptionID",
		CustomerID: "MyCustomer",
		ProductID:  "SomeProductId",
		AddOns:     []string{},
		StartAt:    1000000000,
		EndAt:      2000000000,
		CreateAt:   1000000000,
		Seats:      10,
		DNS:        "some.dns.server",
	}

	newValidBusinessEmail := model.StartCloudTrialRequest{Email: ""}

	t.Run("NON Admin users are UNABLE to request the trial", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)
		cloud.Mock.On("RequestCloudTrial", mock.Anything, mock.Anything, "").Return(subscription, nil)
		cloud.Mock.On("InvalidateCaches").Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionChanged, r, err := th.Client.RequestCloudTrial(&newValidBusinessEmail)
		require.Error(t, err)
		require.Nil(t, subscriptionChanged)
		require.Equal(t, http.StatusForbidden, r.StatusCode, "403 Forbidden")
	})

	t.Run("ADMIN user are ABLE to request the trial", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)
		cloud.Mock.On("RequestCloudTrial", mock.Anything, mock.Anything, "").Return(subscription, nil)
		cloud.Mock.On("InvalidateCaches").Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionChanged, r, err := th.SystemAdminClient.RequestCloudTrial(&newValidBusinessEmail)

		require.NoError(t, err)
		require.Equal(t, subscriptionChanged, subscription)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
	})

	t.Run("ADMIN user are ABLE to request the trial with valid business email", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// patch the customer with the additional contact updated with the valid business email
		newValidBusinessEmail.Email = *model.NewString("valid.email@mattermost.com")

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSubscription", mock.Anything).Return(subscription, nil)
		cloud.Mock.On("RequestCloudTrial", mock.Anything, mock.Anything, "valid.email@mattermost.com").Return(subscription, nil)
		cloud.Mock.On("InvalidateCaches").Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionChanged, r, err := th.SystemAdminClient.RequestCloudTrial(&newValidBusinessEmail)

		require.NoError(t, err)
		require.Equal(t, subscriptionChanged, subscription)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
	})

	t.Run("Empty body returns bad request", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		r, err := th.SystemAdminClient.DoAPIPutBytes("/cloud/request-trial", nil)
		require.Error(t, err)
		closeBody(r)
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "Status Bad Request")
	})
}

func Test_validateBusinessEmail(t *testing.T) {
	t.Run("Returns forbidden for non admin executors", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		invalidEmail := model.ValidateBusinessEmailRequest{Email: "invalid@gmail.com"}

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, invalidEmail.Email).Return(errors.New("invalid email"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		res, err := th.Client.ValidateBusinessEmail(&invalidEmail)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, res.StatusCode, "403")
	})

	t.Run("Returns forbidden for invalid business email", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		validBusinessEmail := model.ValidateBusinessEmailRequest{Email: "invalid@slacker.com"}

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, validBusinessEmail.Email).Return(errors.New("invalid email"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		res, err := th.SystemAdminClient.ValidateBusinessEmail(&validBusinessEmail)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, res.StatusCode, "403")
	})

	t.Run("Validate business email for admin", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		validBusinessEmail := model.ValidateBusinessEmailRequest{Email: "valid@mattermost.com"}

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("ValidateBusinessEmail", th.SystemAdminUser.Id, validBusinessEmail.Email).Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		res, err := th.SystemAdminClient.ValidateBusinessEmail(&validBusinessEmail)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode, "200")
	})

	t.Run("Empty body returns bad request", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		r, err := th.SystemAdminClient.DoAPIPostBytes("/cloud/validate-business-email", nil)
		require.Error(t, err)
		closeBody(r)
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "Status Bad Request")
	})
}

func Test_validateWorkspaceBusinessEmail(t *testing.T) {
	t.Run("validate the Cloud Customer has used a valid email to create the workspace", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

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

		_, err := th.SystemAdminClient.ValidateWorkspaceBusinessEmail()
		require.NoError(t, err)
	})

	t.Run("validate the Cloud Customer has used a invalid email to create the workspace and must validate admin email", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

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

		_, err := th.SystemAdminClient.ValidateWorkspaceBusinessEmail()
		require.NoError(t, err)
	})

	t.Run("Error while grabbing the cloud customer returns bad request", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

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

		r, err := th.SystemAdminClient.DoAPIPostBytes("/cloud/validate-workspace-business-email", nil)
		require.Error(t, err)
		closeBody(r)
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "Status Bad Request")
	})
}

func TestGetCloudProducts(t *testing.T) {
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
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.SystemAdminUser.Email, th.SystemAdminUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}
		cloud.Mock.On("GetCloudProducts", mock.Anything, mock.Anything).Return(cloudProducts, nil)
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		returnedProducts, r, err := th.Client.GetCloudProducts()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
		require.Equal(t, returnedProducts, cloudProducts)
	})

	t.Run("get products for non admins", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetCloudProducts", mock.Anything, mock.Anything).Return(cloudProducts, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		returnedProducts, r, err := th.Client.GetCloudProducts()
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

func Test_GetExpandStatsForSubscription(t *testing.T) {
	isExpandable := &model.SubscriptionExpandStatus{
		IsExpandable: true,
	}

	licenseId := "licenseID"

	t.Run("NON Admin users are UNABLE to request expand stats for the subscription", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetLicenseExpandStatus", mock.Anything).Return(isExpandable, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionExpandable, r, err := th.Client.GetExpandStats(licenseId)
		require.Error(t, err)
		require.Nil(t, subscriptionExpandable)
		require.Equal(t, http.StatusForbidden, r.StatusCode, "403 Forbidden")
	})

	t.Run("Admin users are UNABLE to request licenses is expendable due missing the id", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.SystemAdminUser.Email, th.SystemAdminUser.Password)

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetLicenseExpandStatus", mock.Anything).Return(isExpandable, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		subscriptionExpandable, r, err := th.Client.GetExpandStats("")
		require.Error(t, err)
		require.Nil(t, subscriptionExpandable)
		require.Equal(t, http.StatusBadRequest, r.StatusCode, "400 Bad Request")
	})
}

func TestGetSelfHostedProducts(t *testing.T) {
	products := []*model.Product{
		{
			ID:                "prod_test",
			Name:              "Self-Hosted Professional",
			Description:       "Ideal for small companies and departments with data security requirements",
			PricePerSeat:      10,
			SKU:               "professional",
			PriceID:           "price_1JPXbNI67GP2qpb4VuFdFbwQ",
			Family:            "on-prem",
			RecurringInterval: model.RecurringIntervalYearly,
		},
		{
			ID:                "prod_test2",
			Name:              "Self-Hosted Enterprise",
			Description:       "Built to scale for high-trust organizations and companies in regulated industries.",
			PricePerSeat:      30,
			SKU:               "enterprise",
			PriceID:           "price_1JPXaVI67GP2qpb4l40bXyRu",
			Family:            "on-prem",
			RecurringInterval: model.RecurringIntervalYearly,
		},
	}

	sanitizedProducts := []*model.Product{
		{
			ID:                "prod_test",
			Name:              "Self-Hosted Professional",
			PricePerSeat:      10,
			SKU:               "professional",
			RecurringInterval: model.RecurringIntervalYearly,
		},
		{
			ID:                "prod_test2",
			Name:              "Self-Hosted Enterprise",
			PricePerSeat:      30,
			SKU:               "enterprise",
			RecurringInterval: model.RecurringIntervalYearly,
		},
	}

	t.Run("get products for admins", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.SystemAdminUser.Email, th.SystemAdminUser.Password)

		cloud := mocks.CloudInterface{}
		cloud.Mock.On("GetSelfHostedProducts", mock.Anything, mock.Anything).Return(products, nil)
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		returnedProducts, r, err := th.Client.GetSelfHostedProducts()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
		require.Equal(t, returnedProducts, products)
	})

	t.Run("get products for non admins", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		cloud := mocks.CloudInterface{}

		cloud.Mock.On("GetSelfHostedProducts", mock.Anything, mock.Anything).Return(products, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		returnedProducts, r, err := th.Client.GetSelfHostedProducts()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Status OK")
		require.Equal(t, returnedProducts, sanitizedProducts)

		// make a more explicit check
		require.Equal(t, returnedProducts[0].ID, "prod_test")
		require.Equal(t, returnedProducts[0].Name, "Self-Hosted Professional")
		require.Equal(t, returnedProducts[0].SKU, "professional")
		require.Equal(t, returnedProducts[0].PricePerSeat, float64(10))
		require.Equal(t, returnedProducts[0].Description, "")
		require.Equal(t, returnedProducts[0].PriceID, "")
		require.Equal(t, returnedProducts[0].Family, model.SubscriptionFamily(""))
		require.Equal(t, returnedProducts[0].RecurringInterval, model.RecurringInterval("year"))
		require.Equal(t, returnedProducts[0].BillingScheme, model.BillingScheme(""))
		require.Equal(t, returnedProducts[0].CrossSellsTo, "")

		require.Equal(t, returnedProducts[1].ID, "prod_test2")
		require.Equal(t, returnedProducts[1].Name, "Self-Hosted Enterprise")
		require.Equal(t, returnedProducts[1].SKU, "enterprise")
		require.Equal(t, returnedProducts[1].PricePerSeat, float64(30))
		require.Equal(t, returnedProducts[1].Description, "")
		require.Equal(t, returnedProducts[1].PriceID, "")
		require.Equal(t, returnedProducts[1].Family, model.SubscriptionFamily(""))
		require.Equal(t, returnedProducts[1].RecurringInterval, model.RecurringInterval("year"))
		require.Equal(t, returnedProducts[1].BillingScheme, model.BillingScheme(""))
		require.Equal(t, returnedProducts[1].CrossSellsTo, "")
	})
}
