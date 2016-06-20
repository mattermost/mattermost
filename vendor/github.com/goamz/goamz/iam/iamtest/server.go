// Package iamtest implements a fake IAM provider with the capability of
// inducing errors on any given operation, and retrospectively determining what
// operations have been carried out.
package iamtest

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"github.com/goamz/goamz/iam"
	"net"
	"net/http"
	"strings"
	"sync"
)

type action struct {
	srv   *Server
	w     http.ResponseWriter
	req   *http.Request
	reqId string
}

// Server implements an IAM simulator for use in tests.
type Server struct {
	reqId        int
	url          string
	listener     net.Listener
	users        []iam.User
	groups       []iam.Group
	accessKeys   []iam.AccessKey
	userPolicies []iam.UserPolicy
	mutex        sync.Mutex
}

func NewServer() (*Server, error) {
	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return nil, fmt.Errorf("cannot listen on localhost: %v", err)
	}
	srv := &Server{
		listener: l,
		url:      "http://" + l.Addr().String(),
	}
	go http.Serve(l, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		srv.serveHTTP(w, req)
	}))
	return srv, nil
}

// Quit closes down the server.
func (srv *Server) Quit() error {
	return srv.listener.Close()
}

// URL returns a URL for the server.
func (srv *Server) URL() string {
	return srv.url
}

type xmlErrors struct {
	XMLName string `xml:"ErrorResponse"`
	Error   iam.Error
}

func (srv *Server) error(w http.ResponseWriter, err *iam.Error) {
	w.WriteHeader(err.StatusCode)
	xmlErr := xmlErrors{Error: *err}
	if e := xml.NewEncoder(w).Encode(xmlErr); e != nil {
		panic(e)
	}
}

func (srv *Server) serveHTTP(w http.ResponseWriter, req *http.Request) {
	req.ParseForm()
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	action := req.FormValue("Action")
	if action == "" {
		srv.error(w, &iam.Error{
			StatusCode: 400,
			Code:       "MissingAction",
			Message:    "Missing action",
		})
	}
	if a, ok := actions[action]; ok {
		reqId := fmt.Sprintf("req%0X", srv.reqId)
		srv.reqId++
		if resp, err := a(srv, w, req, reqId); err == nil {
			if err := xml.NewEncoder(w).Encode(resp); err != nil {
				panic(err)
			}
		} else {
			switch err.(type) {
			case *iam.Error:
				srv.error(w, err.(*iam.Error))
			default:
				panic(err)
			}
		}
	} else {
		srv.error(w, &iam.Error{
			StatusCode: 400,
			Code:       "InvalidAction",
			Message:    "Invalid action: " + action,
		})
	}
}

func (srv *Server) createUser(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName"}); err != nil {
		return nil, err
	}
	path := req.FormValue("Path")
	if path == "" {
		path = "/"
	}
	name := req.FormValue("UserName")
	for _, user := range srv.users {
		if user.Name == name {
			return nil, &iam.Error{
				StatusCode: 409,
				Code:       "EntityAlreadyExists",
				Message:    fmt.Sprintf("User with name %s already exists.", name),
			}
		}
	}
	user := iam.User{
		Id:   "USER" + reqId + "EXAMPLE",
		Arn:  fmt.Sprintf("arn:aws:iam:::123456789012:user%s%s", path, name),
		Name: name,
		Path: path,
	}
	srv.users = append(srv.users, user)
	return iam.CreateUserResp{
		RequestId: reqId,
		User:      user,
	}, nil
}

func (srv *Server) getUser(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName"}); err != nil {
		return nil, err
	}
	name := req.FormValue("UserName")
	index, err := srv.findUser(name)
	if err != nil {
		return nil, err
	}
	return iam.GetUserResp{RequestId: reqId, User: srv.users[index]}, nil
}

func (srv *Server) deleteUser(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName"}); err != nil {
		return nil, err
	}
	name := req.FormValue("UserName")
	index, err := srv.findUser(name)
	if err != nil {
		return nil, err
	}
	copy(srv.users[index:], srv.users[index+1:])
	srv.users = srv.users[:len(srv.users)-1]
	return iam.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) createAccessKey(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName"}); err != nil {
		return nil, err
	}
	userName := req.FormValue("UserName")
	if _, err := srv.findUser(userName); err != nil {
		return nil, err
	}
	key := iam.AccessKey{
		Id:       fmt.Sprintf("%s%d", userName, len(srv.accessKeys)),
		Secret:   "",
		UserName: userName,
		Status:   "Active",
	}
	srv.accessKeys = append(srv.accessKeys, key)
	return iam.CreateAccessKeyResp{RequestId: reqId, AccessKey: key}, nil
}

func (srv *Server) deleteAccessKey(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"AccessKeyId", "UserName"}); err != nil {
		return nil, err
	}
	key := req.FormValue("AccessKeyId")
	index := -1
	for i, ak := range srv.accessKeys {
		if ak.Id == key {
			index = i
			break
		}
	}
	if index < 0 {
		return nil, &iam.Error{
			StatusCode: 404,
			Code:       "NoSuchEntity",
			Message:    "No such key.",
		}
	}
	copy(srv.accessKeys[index:], srv.accessKeys[index+1:])
	srv.accessKeys = srv.accessKeys[:len(srv.accessKeys)-1]
	return iam.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) listAccessKeys(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName"}); err != nil {
		return nil, err
	}
	userName := req.FormValue("UserName")
	if _, err := srv.findUser(userName); err != nil {
		return nil, err
	}
	var keys []iam.AccessKey
	for _, k := range srv.accessKeys {
		if k.UserName == userName {
			keys = append(keys, k)
		}
	}
	return iam.AccessKeysResp{
		RequestId:  reqId,
		AccessKeys: keys,
	}, nil
}

func (srv *Server) createGroup(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"GroupName"}); err != nil {
		return nil, err
	}
	name := req.FormValue("GroupName")
	path := req.FormValue("Path")
	for _, group := range srv.groups {
		if group.Name == name {
			return nil, &iam.Error{
				StatusCode: 409,
				Code:       "EntityAlreadyExists",
				Message:    fmt.Sprintf("Group with name %s already exists.", name),
			}
		}
	}
	group := iam.Group{
		Id:   "GROUP " + reqId + "EXAMPLE",
		Arn:  fmt.Sprintf("arn:aws:iam:::123456789012:group%s%s", path, name),
		Name: name,
		Path: path,
	}
	srv.groups = append(srv.groups, group)
	return iam.CreateGroupResp{
		RequestId: reqId,
		Group:     group,
	}, nil
}

func (srv *Server) listGroups(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	pathPrefix := req.FormValue("PathPrefix")
	if pathPrefix == "" {
		return iam.GroupsResp{
			RequestId: reqId,
			Groups:    srv.groups,
		}, nil
	}
	var groups []iam.Group
	for _, group := range srv.groups {
		if strings.HasPrefix(group.Path, pathPrefix) {
			groups = append(groups, group)
		}
	}
	return iam.GroupsResp{
		RequestId: reqId,
		Groups:    groups,
	}, nil
}

func (srv *Server) deleteGroup(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"GroupName"}); err != nil {
		return nil, err
	}
	name := req.FormValue("GroupName")
	index := -1
	for i, group := range srv.groups {
		if group.Name == name {
			index = i
			break
		}
	}
	if index == -1 {
		return nil, &iam.Error{
			StatusCode: 404,
			Code:       "NoSuchEntity",
			Message:    fmt.Sprintf("The group with name %s cannot be found.", name),
		}
	}
	copy(srv.groups[index:], srv.groups[index+1:])
	srv.groups = srv.groups[:len(srv.groups)-1]
	return iam.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) putUserPolicy(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName", "PolicyDocument", "PolicyName"}); err != nil {
		return nil, err
	}
	var exists bool
	policyName := req.FormValue("PolicyName")
	userName := req.FormValue("UserName")
	for _, policy := range srv.userPolicies {
		if policyName == policy.Name && userName == policy.UserName {
			exists = true
			break
		}
	}
	if !exists {
		policy := iam.UserPolicy{
			Name:     policyName,
			UserName: userName,
			Document: req.FormValue("PolicyDocument"),
		}
		var dumb interface{}
		if err := json.Unmarshal([]byte(policy.Document), &dumb); err != nil {
			return nil, &iam.Error{
				StatusCode: 400,
				Code:       "MalformedPolicyDocument",
				Message:    "Malformed policy document",
			}
		}
		srv.userPolicies = append(srv.userPolicies, policy)
	}
	return iam.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) deleteUserPolicy(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName", "PolicyName"}); err != nil {
		return nil, err
	}
	policyName := req.FormValue("PolicyName")
	userName := req.FormValue("UserName")
	index := -1
	for i, policy := range srv.userPolicies {
		if policyName == policy.Name && userName == policy.UserName {
			index = i
			break
		}
	}
	if index < 0 {
		return nil, &iam.Error{
			StatusCode: 404,
			Code:       "NoSuchEntity",
			Message:    "No such user policy",
		}
	}
	copy(srv.userPolicies[index:], srv.userPolicies[index+1:])
	srv.userPolicies = srv.userPolicies[:len(srv.userPolicies)-1]
	return iam.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) getUserPolicy(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"UserName", "PolicyName"}); err != nil {
		return nil, err
	}
	policyName := req.FormValue("PolicyName")
	userName := req.FormValue("UserName")
	index := -1
	for i, policy := range srv.userPolicies {
		if policyName == policy.Name && userName == policy.UserName {
			index = i
			break
		}
	}
	if index < 0 {
		return nil, &iam.Error{
			StatusCode: 404,
			Code:       "NoSuchEntity",
			Message:    "No such user policy",
		}
	}
	return iam.GetUserPolicyResp{
		Policy:    srv.userPolicies[index],
		RequestId: reqId,
	}, nil
}

func (srv *Server) findUser(userName string) (int, error) {
	var (
		err   error
		index = -1
	)
	for i, user := range srv.users {
		if user.Name == userName {
			index = i
			break
		}
	}
	if index < 0 {
		err = &iam.Error{
			StatusCode: 404,
			Code:       "NoSuchEntity",
			Message:    fmt.Sprintf("The user with name %s cannot be found.", userName),
		}
	}
	return index, err
}

// Validates the presence of required request parameters.
func (srv *Server) validate(req *http.Request, required []string) error {
	for _, r := range required {
		if req.FormValue(r) == "" {
			return &iam.Error{
				StatusCode: 400,
				Code:       "InvalidParameterCombination",
				Message:    fmt.Sprintf("%s is required.", r),
			}
		}
	}
	return nil
}

var actions = map[string]func(*Server, http.ResponseWriter, *http.Request, string) (interface{}, error){
	"CreateUser":       (*Server).createUser,
	"DeleteUser":       (*Server).deleteUser,
	"GetUser":          (*Server).getUser,
	"CreateAccessKey":  (*Server).createAccessKey,
	"DeleteAccessKey":  (*Server).deleteAccessKey,
	"ListAccessKeys":   (*Server).listAccessKeys,
	"PutUserPolicy":    (*Server).putUserPolicy,
	"DeleteUserPolicy": (*Server).deleteUserPolicy,
	"GetUserPolicy":    (*Server).getUserPolicy,
	"CreateGroup":      (*Server).createGroup,
	"DeleteGroup":      (*Server).deleteGroup,
	"ListGroups":       (*Server).listGroups,
}
