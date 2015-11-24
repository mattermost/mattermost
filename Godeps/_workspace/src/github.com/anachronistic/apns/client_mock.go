package apns

import "github.com/stretchr/testify/mock"

type MockClient struct {
	mock.Mock
}

func (m *MockClient) ConnectAndWrite(resp *PushNotificationResponse, payload []byte) (err error) {
	return m.Called(resp, payload).Error(0)
}

func (m *MockClient) Send(pn *PushNotification) (resp *PushNotificationResponse) {
	r := m.Called(pn).Get(0)
	if r != nil {
		if r, ok := r.(*PushNotificationResponse); ok {
			return r
		}
	}
	return nil
}
