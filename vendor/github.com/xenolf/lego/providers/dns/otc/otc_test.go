package otc

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"os"
	"testing"
)

type OTCDNSTestSuite struct {
	suite.Suite
	Mock *DNSMock
}

func (s *OTCDNSTestSuite) TearDownSuite() {
	s.Mock.ShutdownServer()
}

func (s *OTCDNSTestSuite) SetupTest() {
	s.Mock = NewDNSMock(s.T())
	s.Mock.Setup()
	s.Mock.HandleAuthSuccessfully()

}

func TestOTCDNSTestSuite(t *testing.T) {
	suite.Run(t, new(OTCDNSTestSuite))
}

func (s *OTCDNSTestSuite) createDNSProvider() (*DNSProvider, error) {
	url := fmt.Sprintf("%s/v3/auth/token", s.Mock.Server.URL)
	return NewDNSProviderCredentials(fakeOTCUserName, fakeOTCPassword, fakeOTCDomainName, fakeOTCProjectName, url)
}

func (s *OTCDNSTestSuite) TestOTCDNSLoginEnv() {
	os.Setenv("OTC_DOMAIN_NAME", "unittest1")
	os.Setenv("OTC_USER_NAME", "unittest2")
	os.Setenv("OTC_PASSWORD", "unittest3")
	os.Setenv("OTC_PROJECT_NAME", "unittest4")
	os.Setenv("OTC_IDENTITY_ENDPOINT", "unittest5")

	provider, err := NewDNSProvider()
	assert.Nil(s.T(), err)
	assert.Equal(s.T(), provider.domainName, "unittest1")
	assert.Equal(s.T(), provider.userName, "unittest2")
	assert.Equal(s.T(), provider.password, "unittest3")
	assert.Equal(s.T(), provider.projectName, "unittest4")
	assert.Equal(s.T(), provider.identityEndpoint, "unittest5")

	os.Setenv("OTC_IDENTITY_ENDPOINT", "")

	provider, err = NewDNSProvider()
	assert.Nil(s.T(), err)
	assert.Equal(s.T(), provider.identityEndpoint, "https://iam.eu-de.otc.t-systems.com:443/v3/auth/tokens")

	os.Clearenv()
}

func (s *OTCDNSTestSuite) TestOTCDNSLoginEnvEmpty() {
	_, err := NewDNSProvider()
	assert.Equal(s.T(), "OTC credentials missing", err.Error())

	os.Clearenv()
}

func (s *OTCDNSTestSuite) TestOTCDNSLogin() {
	otcProvider, err := s.createDNSProvider()

	assert.Nil(s.T(), err)
	err = otcProvider.loginRequest()
	assert.Nil(s.T(), err)
	assert.Equal(s.T(), otcProvider.otcBaseURL, fmt.Sprintf("%s/v2", s.Mock.Server.URL))
	assert.Equal(s.T(), fakeOTCToken, otcProvider.token)
}

func (s *OTCDNSTestSuite) TestOTCDNSEmptyZone() {
	s.Mock.HandleListZonesEmpty()
	s.Mock.HandleListRecordsetsSuccessfully()

	otcProvider, _ := s.createDNSProvider()
	err := otcProvider.Present("example.com", "", "foobar")
	assert.NotNil(s.T(), err)
}

func (s *OTCDNSTestSuite) TestOTCDNSEmptyRecordset() {
	s.Mock.HandleListZonesSuccessfully()
	s.Mock.HandleListRecordsetsEmpty()

	otcProvider, _ := s.createDNSProvider()
	err := otcProvider.CleanUp("example.com", "", "foobar")
	assert.NotNil(s.T(), err)
}

func (s *OTCDNSTestSuite) TestOTCDNSPresent() {
	s.Mock.HandleListZonesSuccessfully()
	s.Mock.HandleListRecordsetsSuccessfully()

	otcProvider, _ := s.createDNSProvider()
	err := otcProvider.Present("example.com", "", "foobar")
	assert.Nil(s.T(), err)
}

func (s *OTCDNSTestSuite) TestOTCDNSCleanup() {
	s.Mock.HandleListZonesSuccessfully()
	s.Mock.HandleListRecordsetsSuccessfully()
	s.Mock.HandleDeleteRecordsetsSuccessfully()

	otcProvider, _ := s.createDNSProvider()
	err := otcProvider.CleanUp("example.com", "", "foobar")
	assert.Nil(s.T(), err)
}
