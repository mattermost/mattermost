package maker

import (
	"github.com/mkraft/ifacemaker/maker/footest"
)

type TestImpl struct{}

func (s *TestImpl) GetUser(userID string) *footest.User {
	return &footest.User{}
}

func (s *TestImpl) CreateUser(user *footest.User) (*footest.User, error) {
	return &footest.User{}, nil
}

func (s *TestImpl) fooHelper() string {
	return ""
}
