package apns

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMockClientConnectAndWrite(t *testing.T) {
	m := &MockClient{}
	m.On("ConnectAndWrite", (*PushNotificationResponse)(nil), []byte(nil)).Return(nil)
	assert.Nil(t, m.ConnectAndWrite(nil, nil))
	m.On("ConnectAndWrite", &PushNotificationResponse{}, []byte{}).Return(errors.New("test"))
	assert.Equal(t, errors.New("test"), m.ConnectAndWrite(&PushNotificationResponse{}, []byte{}))
}

func TestMockClientSend(t *testing.T) {
	m := &MockClient{}
	m.On("Send", (*PushNotification)(nil)).Return(nil)
	assert.Nil(t, m.Send(nil))
	m.On("Send", &PushNotification{}).Return(&PushNotificationResponse{})
	assert.Equal(t, &PushNotificationResponse{}, m.Send(&PushNotification{}))
}
