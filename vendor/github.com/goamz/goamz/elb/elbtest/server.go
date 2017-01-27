// Package elbtest implements a fake ELB provider with the capability of
// inducing errors on any given operation, and retrospectively determining what
// operations have been carried out.
package elbtest

import (
	"encoding/xml"
	"fmt"
	"github.com/goamz/goamz/elb"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

// Server implements an ELB simulator for use in testing.
type Server struct {
	url            string
	listener       net.Listener
	mutex          sync.Mutex
	reqId          int
	lbs            map[string]*elb.LoadBalancerDescription
	lbsReqs        map[string]url.Values
	instances      []string
	instanceStates map[string][]*elb.InstanceState
	instCount      int
}

// Starts and returns a new server
func NewServer() (*Server, error) {
	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return nil, fmt.Errorf("cannot listen on localhost: %v", err)
	}
	srv := &Server{
		listener:       l,
		url:            "http://" + l.Addr().String(),
		lbs:            make(map[string]*elb.LoadBalancerDescription),
		instanceStates: make(map[string][]*elb.InstanceState),
	}
	go http.Serve(l, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		srv.serveHTTP(w, req)
	}))
	return srv, nil
}

// Quit closes down the server.
func (srv *Server) Quit() {
	srv.listener.Close()
}

// URL returns the URL of the server.
func (srv *Server) URL() string {
	return srv.url
}

type xmlErrors struct {
	XMLName string `xml:"ErrorResponse"`
	Error   elb.Error
}

func (srv *Server) error(w http.ResponseWriter, err *elb.Error) {
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
	f := actions[req.Form.Get("Action")]
	if f == nil {
		srv.error(w, &elb.Error{
			StatusCode: 400,
			Code:       "InvalidParameterValue",
			Message:    "Unrecognized Action",
		})
	}
	reqId := fmt.Sprintf("req%0X", srv.reqId)
	srv.reqId++
	if resp, err := f(srv, w, req, reqId); err == nil {
		if err := xml.NewEncoder(w).Encode(resp); err != nil {
			panic(err)
		}
	} else {
		switch err.(type) {
		case *elb.Error:
			srv.error(w, err.(*elb.Error))
		default:
			panic(err)
		}
	}
}

func (srv *Server) createLoadBalancer(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	composition := map[string]string{
		"AvailabilityZones.member.1": "Subnets.member.1",
	}
	if err := srv.validateComposition(req, composition); err != nil {
		return nil, err
	}
	required := []string{
		"Listeners.member.1.InstancePort",
		"Listeners.member.1.InstanceProtocol",
		"Listeners.member.1.Protocol",
		"Listeners.member.1.LoadBalancerPort",
		"LoadBalancerName",
	}
	if err := srv.validate(req, required); err != nil {
		return nil, err
	}
	path := req.FormValue("Path")
	if path == "" {
		path = "/"
	}
	lbName := req.FormValue("LoadBalancerName")
	srv.lbs[lbName] = srv.makeLoadBalancerDescription(req.Form)
	srv.lbs[lbName].DNSName = fmt.Sprintf("%s-some-aws-stuff.us-east-1.elb.amazonaws.com", lbName)
	return elb.CreateLoadBalancerResp{
		DNSName: srv.lbs[lbName].DNSName,
	}, nil
}

func (srv *Server) deleteLoadBalancer(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.validate(req, []string{"LoadBalancerName"}); err != nil {
		return nil, err
	}
	srv.RemoveLoadBalancer(req.FormValue("LoadBalancerName"))
	return elb.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) registerInstancesWithLoadBalancer(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	required := []string{"LoadBalancerName", "Instances.member.1.InstanceId"}
	if err := srv.validate(req, required); err != nil {
		return nil, err
	}
	lbName := req.FormValue("LoadBalancerName")
	if err := srv.lbExists(lbName); err != nil {
		return nil, err
	}
	instIds := []string{}
	instances := []elb.Instance{}
	i := 1
	instId := req.FormValue(fmt.Sprintf("Instances.member.%d.InstanceId", i))
	for instId != "" {
		if err := srv.instanceExists(instId); err != nil {
			return nil, err
		}
		instIds = append(instIds, instId)
		instances = append(instances, elb.Instance{InstanceId: instId})
		i++
		instId = req.FormValue(fmt.Sprintf("Instances.member.%d.InstanceId", i))
	}
	srv.instanceStates[lbName] = append(srv.instanceStates[lbName], srv.makeInstanceState(instId))
	srv.lbs[lbName].Instances = append(srv.lbs[lbName].Instances, instances...)
	return elb.RegisterInstancesResp{InstanceIds: instIds}, nil
}

func (srv *Server) deregisterInstancesFromLoadBalancer(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	required := []string{"LoadBalancerName"}
	if err := srv.validate(req, required); err != nil {
		return nil, err
	}
	lbName := req.FormValue("LoadBalancerName")
	if err := srv.lbExists(lbName); err != nil {
		return nil, err
	}
	i := 1
	lb := srv.lbs[lbName]
	instId := req.FormValue(fmt.Sprintf("Instances.member.%d.InstanceId", i))
	for instId != "" {
		if err := srv.instanceExists(instId); err != nil {
			return nil, err
		}
		i++
		removeInstanceFromLB(lb, instId)
		instId = req.FormValue(fmt.Sprintf("Instances.member.%d.InstanceId", i))
	}
	srv.lbs[lbName] = lb
	srv.removeInstanceStatesFromLoadBalancer(lbName, instId)
	return elb.SimpleResp{RequestId: reqId}, nil
}

func (srv *Server) describeLoadBalancers(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	i := 1
	lbName := req.FormValue(fmt.Sprintf("LoadBalancerNames.member.%d", i))
	for lbName != "" {
		key := fmt.Sprintf("LoadBalancerNames.member.%d", i)
		if req.FormValue(key) != "" {
			if err := srv.lbExists(req.FormValue(key)); err != nil {
				return nil, err
			}
		}
		i++
		lbName = req.FormValue(fmt.Sprintf("LoadBalancerNames.member.%d", i))
	}
	lbsDesc := make([]elb.LoadBalancerDescription, len(srv.lbs))
	i = 0
	for _, lb := range srv.lbs {
		lbsDesc[i] = *lb
		i++
	}
	resp := elb.DescribeLoadBalancerResp{
		LoadBalancerDescriptions: lbsDesc,
	}
	return resp, nil
}

// getParameters returns the value all parameters from a request that matches a
// prefix.
//
// For example, for the prefix "Subnets.member.", it will return a slice
// containing the value of keys "Subnets.member.1", "Subnets.member.2" ...
// "Subnets.member.N". The prefix must include the trailing dot.
func (srv *Server) getParameters(prefix string, values url.Values) []string {
	i, key := 1, ""
	var k = func(n int) string {
		return fmt.Sprintf(prefix+"%d", n)
	}
	var result []string
	for i, key = 2, k(i); values.Get(key) != ""; i, key = i+1, k(i) {
		result = append(result, values.Get(key))
	}
	return result
}

func (srv *Server) makeInstanceState(id string) *elb.InstanceState {
	return &elb.InstanceState{
		Description: "Instance is in pending state.",
		InstanceId:  id,
		State:       "OutOfService",
		ReasonCode:  "Instance",
	}
}

func removeInstanceFromLB(lb *elb.LoadBalancerDescription, id string) {
	index := -1
	for i, instance := range lb.Instances {
		if instance.InstanceId == id {
			index = i
			break
		}
	}
	if index > -1 {
		copy(lb.Instances[index:], lb.Instances[index+1:])
		lb.Instances = lb.Instances[:len(lb.Instances)-1]
	}
}

func (srv *Server) removeInstanceStatesFromLoadBalancer(lb, id string) {
	for i, state := range srv.instanceStates[lb] {
		if state.InstanceId == id {
			a := srv.instanceStates[lb]
			a[i], a = a[len(a)-1], a[:len(a)-1]
			srv.instanceStates[lb] = a
			return
		}
	}
}

func (srv *Server) makeLoadBalancerDescription(value url.Values) *elb.LoadBalancerDescription {
	lds := []elb.ListenerDescription{}
	i := 1
	protocol := value.Get(fmt.Sprintf("Listeners.member.%d.Protocol", i))
	for protocol != "" {
		key := fmt.Sprintf("Listeners.member.%d.", i)
		lInstPort, _ := strconv.Atoi(value.Get(key + "InstancePort"))
		lLBPort, _ := strconv.Atoi(value.Get(key + "LoadBalancerPort"))
		lDescription := elb.ListenerDescription{
			Listener: elb.Listener{
				Protocol:         strings.ToUpper(protocol),
				InstanceProtocol: strings.ToUpper(value.Get(key + "InstanceProtocol")),
				LoadBalancerPort: lLBPort,
				InstancePort:     lInstPort,
			},
		}
		i++
		protocol = value.Get(fmt.Sprintf("Listeners.member.%d.Protocol", i))
		lds = append(lds, lDescription)
	}
	sourceSecGroup := srv.makeSourceSecGroup(value)
	lbDesc := elb.LoadBalancerDescription{
		AvailabilityZones:    srv.getParameters("AvailabilityZones.member.", value),
		Subnets:              srv.getParameters("Subnets.member.", value),
		SecurityGroups:       srv.getParameters("SecurityGroups.member.", value),
		HealthCheck:          srv.makeHealthCheck(value),
		ListenerDescriptions: lds,
		Scheme:               value.Get("Scheme"),
		SourceSecurityGroup:  sourceSecGroup,
		LoadBalancerName:     value.Get("LoadBalancerName"),
	}
	if lbDesc.Scheme == "" {
		lbDesc.Scheme = "internet-facing"
	}
	return &lbDesc
}

func (srv *Server) makeHealthCheck(value url.Values) elb.HealthCheck {
	ht := 10
	timeout := 5
	ut := 2
	interval := 30
	target := "TCP:80"
	if v := value.Get("HealthCheck.HealthyThreshold"); v != "" {
		ht, _ = strconv.Atoi(v)
	}
	if v := value.Get("HealthCheck.Timeout"); v != "" {
		timeout, _ = strconv.Atoi(v)
	}
	if v := value.Get("HealthCheck.UnhealthyThreshold"); v != "" {
		ut, _ = strconv.Atoi(v)
	}
	if v := value.Get("HealthCheck.Interval"); v != "" {
		interval, _ = strconv.Atoi(v)
	}
	if v := value.Get("HealthCheck.Target"); v != "" {
		target = v
	}
	return elb.HealthCheck{
		HealthyThreshold:   ht,
		Interval:           interval,
		Target:             target,
		Timeout:            timeout,
		UnhealthyThreshold: ut,
	}
}

func (srv *Server) makeSourceSecGroup(value url.Values) elb.SourceSecurityGroup {
	name := "amazon-elb-sg"
	alias := "amazon-elb"
	if v := value.Get("SourceSecurityGroup.GroupName"); v != "" {
		name = v
	}
	if v := value.Get("SourceSecurityGroup.OwnerAlias"); v != "" {
		alias = v
	}
	return elb.SourceSecurityGroup{
		GroupName:  name,
		OwnerAlias: alias,
	}
}

func (srv *Server) describeInstanceHealth(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	if err := srv.lbExists(req.FormValue("LoadBalancerName")); err != nil {
		return nil, err
	}
	resp := elb.DescribeInstanceHealthResp{
		InstanceStates: []elb.InstanceState{},
	}
	for _, state := range srv.instanceStates[req.FormValue("LoadBalancerName")] {
		resp.InstanceStates = append(resp.InstanceStates, *state)
	}
	i := 1
	instanceId := req.FormValue("Instances.member.1.InstanceId")
	for instanceId != "" {
		if err := srv.instanceExists(instanceId); err != nil {
			return nil, err
		}
		is := elb.InstanceState{
			Description: "Instance is in pending state.",
			InstanceId:  instanceId,
			State:       "OutOfService",
			ReasonCode:  "Instance",
		}
		resp.InstanceStates = append(resp.InstanceStates, is)
		i++
		instanceId = req.FormValue(fmt.Sprintf("Instances.member.%d.InstanceId", i))
	}
	return resp, nil
}

func (srv *Server) configureHealthCheck(w http.ResponseWriter, req *http.Request, reqId string) (interface{}, error) {
	required := []string{
		"LoadBalancerName",
		"HealthCheck.HealthyThreshold",
		"HealthCheck.Interval",
		"HealthCheck.Target",
		"HealthCheck.Timeout",
		"HealthCheck.UnhealthyThreshold",
	}
	if err := srv.validate(req, required); err != nil {
		return nil, err
	}
	target := req.FormValue("HealthCheck.Target")
	r, err := regexp.Compile(`[\w]+:[\d]+\/+`)
	if err != nil {
		panic(err)
	}
	if m := r.FindStringSubmatch(target); m == nil {
		return nil, &elb.Error{
			StatusCode: 400,
			Code:       "ValidationError",
			Message:    "HealthCheck HTTP Target must specify a port followed by a path that begins with a slash. e.g. HTTP:80/ping/this/path",
		}
	}
	ht, _ := strconv.Atoi(req.FormValue("HealthCheck.HealthyThreshold"))
	interval, _ := strconv.Atoi(req.FormValue("HealthCheck.Interval"))
	timeout, _ := strconv.Atoi(req.FormValue("HealthCheck.Timeout"))
	ut, _ := strconv.Atoi(req.FormValue("HealthCheck.UnhealthyThreshold"))
	return elb.HealthCheckResp{
		HealthCheck: &elb.HealthCheck{
			HealthyThreshold:   ht,
			Interval:           interval,
			Target:             target,
			Timeout:            timeout,
			UnhealthyThreshold: ut,
		},
	}, nil
}

func (srv *Server) instanceExists(id string) error {
	for _, instId := range srv.instances {
		if instId == id {
			return nil
		}
	}
	return &elb.Error{
		StatusCode: 400,
		Code:       "InvalidInstance",
		Message:    fmt.Sprintf("InvalidInstance found in [%s]. Invalid id: \"%s\"", id, id),
	}
}

func (srv *Server) lbExists(name string) error {
	if _, ok := srv.lbs[name]; !ok {
		return &elb.Error{
			StatusCode: 400,
			Code:       "LoadBalancerNotFound",
			Message:    fmt.Sprintf("There is no ACTIVE Load Balancer named '%s'", name),
		}
	}
	return nil
}

func (srv *Server) validate(req *http.Request, required []string) error {
	for _, field := range required {
		if req.FormValue(field) == "" {
			return &elb.Error{
				StatusCode: 400,
				Code:       "ValidationError",
				Message:    fmt.Sprintf("%s is required.", field),
			}
		}
	}
	return nil
}

// Validates the composition of the fields.
//
// Some fields cannot be together in the same request, such as AvailabilityZones and Subnets.
// A sample map with the above requirement would be
//    c := map[string]string{
//        "AvailabilityZones.member.1": "Subnets.member.1",
//    }
//
// The server also requires that at least one of those fields are specified.
func (srv *Server) validateComposition(req *http.Request, composition map[string]string) error {
	for k, v := range composition {
		if req.FormValue(k) != "" && req.FormValue(v) != "" {
			return &elb.Error{
				StatusCode: 400,
				Code:       "ValidationError",
				Message:    fmt.Sprintf("Only one of %s or %s may be specified", k, v),
			}
		}
		if req.FormValue(k) == "" && req.FormValue(v) == "" {
			return &elb.Error{
				StatusCode: 400,
				Code:       "ValidationError",
				Message:    fmt.Sprintf("Either %s or %s must be specified", k, v),
			}
		}
	}
	return nil
}

// Creates a fake instance in the server
func (srv *Server) NewInstance() string {
	srv.instCount++
	instId := fmt.Sprintf("i-%d", srv.instCount)
	srv.instances = append(srv.instances, instId)
	return instId
}

// Removes a fake instance from the server
//
// If no instance is found it does nothing
func (srv *Server) RemoveInstance(instId string) {
	for i, id := range srv.instances {
		if id == instId {
			srv.instances[i], srv.instances = srv.instances[len(srv.instances)-1], srv.instances[:len(srv.instances)-1]
		}
	}
}

// Creates a fake load balancer in the fake server
func (srv *Server) NewLoadBalancer(name string) {
	srv.lbs[name] = &elb.LoadBalancerDescription{
		LoadBalancerName: name,
		DNSName:          fmt.Sprintf("%s-some-aws-stuff.sa-east-1.amazonaws.com", name),
	}
}

// Removes a fake load balancer from the fake server
func (srv *Server) RemoveLoadBalancer(name string) {
	delete(srv.lbs, name)
}

// Register a fake instance with a fake Load Balancer
//
// If the Load Balancer does not exists it does nothing
func (srv *Server) RegisterInstance(instId, lbName string) {
	lb, ok := srv.lbs[lbName]
	if !ok {
		fmt.Println("lb not found :/")
		return
	}
	lb.Instances = append(lb.Instances, elb.Instance{InstanceId: instId})
	srv.instanceStates[lbName] = append(srv.instanceStates[lbName], srv.makeInstanceState(instId))
}

func (srv *Server) DeregisterInstance(instId, lbName string) {
	removeInstanceFromLB(srv.lbs[lbName], instId)
	srv.removeInstanceStatesFromLoadBalancer(lbName, instId)
}

func (srv *Server) ChangeInstanceState(lb string, state elb.InstanceState) {
	states := srv.instanceStates[lb]
	for i, s := range states {
		if s.InstanceId == state.InstanceId {
			srv.instanceStates[lb][i] = &state
			return
		}
	}
}

var actions = map[string]func(*Server, http.ResponseWriter, *http.Request, string) (interface{}, error){
	"CreateLoadBalancer":                  (*Server).createLoadBalancer,
	"DeleteLoadBalancer":                  (*Server).deleteLoadBalancer,
	"RegisterInstancesWithLoadBalancer":   (*Server).registerInstancesWithLoadBalancer,
	"DeregisterInstancesFromLoadBalancer": (*Server).deregisterInstancesFromLoadBalancer,
	"DescribeLoadBalancers":               (*Server).describeLoadBalancers,
	"DescribeInstanceHealth":              (*Server).describeInstanceHealth,
	"ConfigureHealthCheck":                (*Server).configureHealthCheck,
}
