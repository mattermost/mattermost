package ecommerce

import (
	"net/http"

	"github.com/AdRoll/goamz/aws"
)

// ProductAdvertising provides methods for querying the product advertising API
type ProductAdvertising struct {
	service      aws.Service
	associateTag string
}

// New creates a new ProductAdvertising client
func New(auth aws.Auth, associateTag string) (p *ProductAdvertising, err error) {
	serviceInfo := aws.ServiceInfo{Endpoint: "https://webservices.amazon.com", Signer: aws.V2Signature}
	if service, err := aws.NewService(auth, serviceInfo); err == nil {
		p = &ProductAdvertising{*service, associateTag}
	}
	return
}

// PerformOperation is the main method used for interacting with the product advertising API
func (p *ProductAdvertising) PerformOperation(operation string, params map[string]string) (resp *http.Response, err error) {
	params["Operation"] = operation
	return p.query(params)
}

func (p *ProductAdvertising) query(params map[string]string) (resp *http.Response, err error) {
	params["Service"] = "AWSECommerceService"
	params["AssociateTag"] = p.associateTag
	return p.service.Query("GET", "/onca/xml", params)
}
