package restxml_test

import (
	"github.com/awslabs/aws-sdk-go/aws"
	"github.com/awslabs/aws-sdk-go/internal/protocol/restxml"
	"github.com/awslabs/aws-sdk-go/internal/signer/v4"

	"bytes"
	"encoding/json"
	"encoding/xml"
	"github.com/awslabs/aws-sdk-go/internal/protocol/xml/xmlutil"
	"github.com/awslabs/aws-sdk-go/internal/util"
	"github.com/stretchr/testify/assert"
	"io/ioutil"
	"net/http"
	"net/url"
	"testing"
	"time"
)

var _ bytes.Buffer // always import bytes
var _ http.Request
var _ json.Marshaler
var _ time.Time
var _ xmlutil.XMLNode
var _ xml.Attr
var _ = ioutil.Discard
var _ = util.Trim("")
var _ = url.Values{}

// InputService1ProtocolTest is a client for InputService1ProtocolTest.
type InputService1ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService1ProtocolTest client.
func NewInputService1ProtocolTest(config *aws.Config) *InputService1ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice1protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService1ProtocolTest{service}
}

// InputService1TestCaseOperation1Request generates a request for the InputService1TestCaseOperation1 operation.
func (c *InputService1ProtocolTest) InputService1TestCaseOperation1Request(input *InputService1TestShapeInputShape) (req *aws.Request, output *InputService1TestShapeInputService1TestCaseOperation1Output) {
	if opInputService1TestCaseOperation1 == nil {
		opInputService1TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService1TestCaseOperation1, input, output)
	output = &InputService1TestShapeInputService1TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService1ProtocolTest) InputService1TestCaseOperation1(input *InputService1TestShapeInputShape) (output *InputService1TestShapeInputService1TestCaseOperation1Output, err error) {
	req, out := c.InputService1TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService1TestCaseOperation1 *aws.Operation

// InputService1TestCaseOperation2Request generates a request for the InputService1TestCaseOperation2 operation.
func (c *InputService1ProtocolTest) InputService1TestCaseOperation2Request(input *InputService1TestShapeInputShape) (req *aws.Request, output *InputService1TestShapeInputService1TestCaseOperation2Output) {
	if opInputService1TestCaseOperation2 == nil {
		opInputService1TestCaseOperation2 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "PUT",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService1TestCaseOperation2, input, output)
	output = &InputService1TestShapeInputService1TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService1ProtocolTest) InputService1TestCaseOperation2(input *InputService1TestShapeInputShape) (output *InputService1TestShapeInputService1TestCaseOperation2Output, err error) {
	req, out := c.InputService1TestCaseOperation2Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService1TestCaseOperation2 *aws.Operation

type InputService1TestShapeInputService1TestCaseOperation1Output struct {
	metadataInputService1TestShapeInputService1TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService1TestShapeInputService1TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService1TestShapeInputService1TestCaseOperation2Output struct {
	metadataInputService1TestShapeInputService1TestCaseOperation2Output `json:"-", xml:"-"`
}

type metadataInputService1TestShapeInputService1TestCaseOperation2Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService1TestShapeInputShape struct {
	Description *string `type:"string"`

	Name *string `type:"string"`

	metadataInputService1TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService1TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService2ProtocolTest is a client for InputService2ProtocolTest.
type InputService2ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService2ProtocolTest client.
func NewInputService2ProtocolTest(config *aws.Config) *InputService2ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice2protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService2ProtocolTest{service}
}

// InputService2TestCaseOperation1Request generates a request for the InputService2TestCaseOperation1 operation.
func (c *InputService2ProtocolTest) InputService2TestCaseOperation1Request(input *InputService2TestShapeInputShape) (req *aws.Request, output *InputService2TestShapeInputService2TestCaseOperation1Output) {
	if opInputService2TestCaseOperation1 == nil {
		opInputService2TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService2TestCaseOperation1, input, output)
	output = &InputService2TestShapeInputService2TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService2ProtocolTest) InputService2TestCaseOperation1(input *InputService2TestShapeInputShape) (output *InputService2TestShapeInputService2TestCaseOperation1Output, err error) {
	req, out := c.InputService2TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService2TestCaseOperation1 *aws.Operation

type InputService2TestShapeInputService2TestCaseOperation1Output struct {
	metadataInputService2TestShapeInputService2TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService2TestShapeInputService2TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService2TestShapeInputShape struct {
	First *bool `type:"boolean"`

	Fourth *int64 `type:"integer"`

	Second *bool `type:"boolean"`

	Third *float64 `type:"float"`

	metadataInputService2TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService2TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService3ProtocolTest is a client for InputService3ProtocolTest.
type InputService3ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService3ProtocolTest client.
func NewInputService3ProtocolTest(config *aws.Config) *InputService3ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice3protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService3ProtocolTest{service}
}

// InputService3TestCaseOperation1Request generates a request for the InputService3TestCaseOperation1 operation.
func (c *InputService3ProtocolTest) InputService3TestCaseOperation1Request(input *InputService3TestShapeInputShape) (req *aws.Request, output *InputService3TestShapeInputService3TestCaseOperation1Output) {
	if opInputService3TestCaseOperation1 == nil {
		opInputService3TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService3TestCaseOperation1, input, output)
	output = &InputService3TestShapeInputService3TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService3ProtocolTest) InputService3TestCaseOperation1(input *InputService3TestShapeInputShape) (output *InputService3TestShapeInputService3TestCaseOperation1Output, err error) {
	req, out := c.InputService3TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService3TestCaseOperation1 *aws.Operation

type InputService3TestShapeInputService3TestCaseOperation1Output struct {
	metadataInputService3TestShapeInputService3TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService3TestShapeInputService3TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService3TestShapeInputShape struct {
	Description *string `type:"string"`

	SubStructure *InputService3TestShapeSubStructure `type:"structure"`

	metadataInputService3TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService3TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

type InputService3TestShapeSubStructure struct {
	Bar *string `type:"string"`

	Foo *string `type:"string"`

	metadataInputService3TestShapeSubStructure `json:"-", xml:"-"`
}

type metadataInputService3TestShapeSubStructure struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService4ProtocolTest is a client for InputService4ProtocolTest.
type InputService4ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService4ProtocolTest client.
func NewInputService4ProtocolTest(config *aws.Config) *InputService4ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice4protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService4ProtocolTest{service}
}

// InputService4TestCaseOperation1Request generates a request for the InputService4TestCaseOperation1 operation.
func (c *InputService4ProtocolTest) InputService4TestCaseOperation1Request(input *InputService4TestShapeInputShape) (req *aws.Request, output *InputService4TestShapeInputService4TestCaseOperation1Output) {
	if opInputService4TestCaseOperation1 == nil {
		opInputService4TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService4TestCaseOperation1, input, output)
	output = &InputService4TestShapeInputService4TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService4ProtocolTest) InputService4TestCaseOperation1(input *InputService4TestShapeInputShape) (output *InputService4TestShapeInputService4TestCaseOperation1Output, err error) {
	req, out := c.InputService4TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService4TestCaseOperation1 *aws.Operation

type InputService4TestShapeInputService4TestCaseOperation1Output struct {
	metadataInputService4TestShapeInputService4TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService4TestShapeInputService4TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService4TestShapeInputShape struct {
	Description *string `type:"string"`

	SubStructure *InputService4TestShapeSubStructure `type:"structure"`

	metadataInputService4TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService4TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

type InputService4TestShapeSubStructure struct {
	Bar *string `type:"string"`

	Foo *string `type:"string"`

	metadataInputService4TestShapeSubStructure `json:"-", xml:"-"`
}

type metadataInputService4TestShapeSubStructure struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService5ProtocolTest is a client for InputService5ProtocolTest.
type InputService5ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService5ProtocolTest client.
func NewInputService5ProtocolTest(config *aws.Config) *InputService5ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice5protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService5ProtocolTest{service}
}

// InputService5TestCaseOperation1Request generates a request for the InputService5TestCaseOperation1 operation.
func (c *InputService5ProtocolTest) InputService5TestCaseOperation1Request(input *InputService5TestShapeInputShape) (req *aws.Request, output *InputService5TestShapeInputService5TestCaseOperation1Output) {
	if opInputService5TestCaseOperation1 == nil {
		opInputService5TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService5TestCaseOperation1, input, output)
	output = &InputService5TestShapeInputService5TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService5ProtocolTest) InputService5TestCaseOperation1(input *InputService5TestShapeInputShape) (output *InputService5TestShapeInputService5TestCaseOperation1Output, err error) {
	req, out := c.InputService5TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService5TestCaseOperation1 *aws.Operation

type InputService5TestShapeInputService5TestCaseOperation1Output struct {
	metadataInputService5TestShapeInputService5TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService5TestShapeInputService5TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService5TestShapeInputShape struct {
	ListParam []*string `type:"list"`

	metadataInputService5TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService5TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService6ProtocolTest is a client for InputService6ProtocolTest.
type InputService6ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService6ProtocolTest client.
func NewInputService6ProtocolTest(config *aws.Config) *InputService6ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice6protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService6ProtocolTest{service}
}

// InputService6TestCaseOperation1Request generates a request for the InputService6TestCaseOperation1 operation.
func (c *InputService6ProtocolTest) InputService6TestCaseOperation1Request(input *InputService6TestShapeInputShape) (req *aws.Request, output *InputService6TestShapeInputService6TestCaseOperation1Output) {
	if opInputService6TestCaseOperation1 == nil {
		opInputService6TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService6TestCaseOperation1, input, output)
	output = &InputService6TestShapeInputService6TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService6ProtocolTest) InputService6TestCaseOperation1(input *InputService6TestShapeInputShape) (output *InputService6TestShapeInputService6TestCaseOperation1Output, err error) {
	req, out := c.InputService6TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService6TestCaseOperation1 *aws.Operation

type InputService6TestShapeInputService6TestCaseOperation1Output struct {
	metadataInputService6TestShapeInputService6TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService6TestShapeInputService6TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService6TestShapeInputShape struct {
	ListParam []*string `locationName:"AlternateName" locationNameList:"NotMember" type:"list"`

	metadataInputService6TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService6TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService7ProtocolTest is a client for InputService7ProtocolTest.
type InputService7ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService7ProtocolTest client.
func NewInputService7ProtocolTest(config *aws.Config) *InputService7ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice7protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService7ProtocolTest{service}
}

// InputService7TestCaseOperation1Request generates a request for the InputService7TestCaseOperation1 operation.
func (c *InputService7ProtocolTest) InputService7TestCaseOperation1Request(input *InputService7TestShapeInputShape) (req *aws.Request, output *InputService7TestShapeInputService7TestCaseOperation1Output) {
	if opInputService7TestCaseOperation1 == nil {
		opInputService7TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService7TestCaseOperation1, input, output)
	output = &InputService7TestShapeInputService7TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService7ProtocolTest) InputService7TestCaseOperation1(input *InputService7TestShapeInputShape) (output *InputService7TestShapeInputService7TestCaseOperation1Output, err error) {
	req, out := c.InputService7TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService7TestCaseOperation1 *aws.Operation

type InputService7TestShapeInputService7TestCaseOperation1Output struct {
	metadataInputService7TestShapeInputService7TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService7TestShapeInputService7TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService7TestShapeInputShape struct {
	ListParam []*string `type:"list" flattened:"true"`

	metadataInputService7TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService7TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService8ProtocolTest is a client for InputService8ProtocolTest.
type InputService8ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService8ProtocolTest client.
func NewInputService8ProtocolTest(config *aws.Config) *InputService8ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice8protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService8ProtocolTest{service}
}

// InputService8TestCaseOperation1Request generates a request for the InputService8TestCaseOperation1 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation1Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestCaseOperation1Output) {
	if opInputService8TestCaseOperation1 == nil {
		opInputService8TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService8TestCaseOperation1, input, output)
	output = &InputService8TestShapeInputService8TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation1(input *InputService8TestShapeInputShape) (output *InputService8TestShapeInputService8TestCaseOperation1Output, err error) {
	req, out := c.InputService8TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService8TestCaseOperation1 *aws.Operation

type InputService8TestShapeInputService8TestCaseOperation1Output struct {
	metadataInputService8TestShapeInputService8TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputShape struct {
	ListParam []*string `locationName:"item" type:"list" flattened:"true"`

	metadataInputService8TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService9ProtocolTest is a client for InputService9ProtocolTest.
type InputService9ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService9ProtocolTest client.
func NewInputService9ProtocolTest(config *aws.Config) *InputService9ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice9protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService9ProtocolTest{service}
}

// InputService9TestCaseOperation1Request generates a request for the InputService9TestCaseOperation1 operation.
func (c *InputService9ProtocolTest) InputService9TestCaseOperation1Request(input *InputService9TestShapeInputShape) (req *aws.Request, output *InputService9TestShapeInputService9TestCaseOperation1Output) {
	if opInputService9TestCaseOperation1 == nil {
		opInputService9TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService9TestCaseOperation1, input, output)
	output = &InputService9TestShapeInputService9TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService9ProtocolTest) InputService9TestCaseOperation1(input *InputService9TestShapeInputShape) (output *InputService9TestShapeInputService9TestCaseOperation1Output, err error) {
	req, out := c.InputService9TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService9TestCaseOperation1 *aws.Operation

type InputService9TestShapeInputService9TestCaseOperation1Output struct {
	metadataInputService9TestShapeInputService9TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService9TestShapeInputService9TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService9TestShapeInputShape struct {
	ListParam []*InputService9TestShapeSingleFieldStruct `locationName:"item" type:"list" flattened:"true"`

	metadataInputService9TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService9TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

type InputService9TestShapeSingleFieldStruct struct {
	Element *string `locationName:"value" type:"string"`

	metadataInputService9TestShapeSingleFieldStruct `json:"-", xml:"-"`
}

type metadataInputService9TestShapeSingleFieldStruct struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService10ProtocolTest is a client for InputService10ProtocolTest.
type InputService10ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService10ProtocolTest client.
func NewInputService10ProtocolTest(config *aws.Config) *InputService10ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice10protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService10ProtocolTest{service}
}

// InputService10TestCaseOperation1Request generates a request for the InputService10TestCaseOperation1 operation.
func (c *InputService10ProtocolTest) InputService10TestCaseOperation1Request(input *InputService10TestShapeInputShape) (req *aws.Request, output *InputService10TestShapeInputService10TestCaseOperation1Output) {
	if opInputService10TestCaseOperation1 == nil {
		opInputService10TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/2014-01-01/hostedzone",
		}
	}

	req = aws.NewRequest(c.Service, opInputService10TestCaseOperation1, input, output)
	output = &InputService10TestShapeInputService10TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService10ProtocolTest) InputService10TestCaseOperation1(input *InputService10TestShapeInputShape) (output *InputService10TestShapeInputService10TestCaseOperation1Output, err error) {
	req, out := c.InputService10TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService10TestCaseOperation1 *aws.Operation

type InputService10TestShapeInputService10TestCaseOperation1Output struct {
	metadataInputService10TestShapeInputService10TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService10TestShapeInputService10TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService10TestShapeInputShape struct {
	StructureParam *InputService10TestShapeStructureShape `type:"structure"`

	metadataInputService10TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService10TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

type InputService10TestShapeStructureShape struct {
	B []byte `locationName:"b" type:"blob"`

	T *time.Time `locationName:"t" type:"timestamp" timestampFormat:"iso8601"`

	metadataInputService10TestShapeStructureShape `json:"-", xml:"-"`
}

type metadataInputService10TestShapeStructureShape struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService11ProtocolTest is a client for InputService11ProtocolTest.
type InputService11ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService11ProtocolTest client.
func NewInputService11ProtocolTest(config *aws.Config) *InputService11ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice11protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService11ProtocolTest{service}
}

// InputService11TestCaseOperation1Request generates a request for the InputService11TestCaseOperation1 operation.
func (c *InputService11ProtocolTest) InputService11TestCaseOperation1Request(input *InputService11TestShapeInputShape) (req *aws.Request, output *InputService11TestShapeInputService11TestCaseOperation1Output) {
	if opInputService11TestCaseOperation1 == nil {
		opInputService11TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService11TestCaseOperation1, input, output)
	output = &InputService11TestShapeInputService11TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService11ProtocolTest) InputService11TestCaseOperation1(input *InputService11TestShapeInputShape) (output *InputService11TestShapeInputService11TestCaseOperation1Output, err error) {
	req, out := c.InputService11TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService11TestCaseOperation1 *aws.Operation

type InputService11TestShapeInputService11TestCaseOperation1Output struct {
	metadataInputService11TestShapeInputService11TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService11TestShapeInputService11TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService11TestShapeInputShape struct {
	Foo *map[string]*string `location:"headers" locationName:"x-foo-" type:"map"`

	metadataInputService11TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService11TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

// InputService12ProtocolTest is a client for InputService12ProtocolTest.
type InputService12ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService12ProtocolTest client.
func NewInputService12ProtocolTest(config *aws.Config) *InputService12ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice12protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService12ProtocolTest{service}
}

// InputService12TestCaseOperation1Request generates a request for the InputService12TestCaseOperation1 operation.
func (c *InputService12ProtocolTest) InputService12TestCaseOperation1Request(input *InputService12TestShapeInputShape) (req *aws.Request, output *InputService12TestShapeInputService12TestCaseOperation1Output) {
	if opInputService12TestCaseOperation1 == nil {
		opInputService12TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService12TestCaseOperation1, input, output)
	output = &InputService12TestShapeInputService12TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService12ProtocolTest) InputService12TestCaseOperation1(input *InputService12TestShapeInputShape) (output *InputService12TestShapeInputService12TestCaseOperation1Output, err error) {
	req, out := c.InputService12TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService12TestCaseOperation1 *aws.Operation

type InputService12TestShapeInputService12TestCaseOperation1Output struct {
	metadataInputService12TestShapeInputService12TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService12TestShapeInputService12TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService12TestShapeInputShape struct {
	Foo *string `locationName:"foo" type:"string"`

	metadataInputService12TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService12TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure" payload:"Foo"`
}

// InputService13ProtocolTest is a client for InputService13ProtocolTest.
type InputService13ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService13ProtocolTest client.
func NewInputService13ProtocolTest(config *aws.Config) *InputService13ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice13protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService13ProtocolTest{service}
}

// InputService13TestCaseOperation1Request generates a request for the InputService13TestCaseOperation1 operation.
func (c *InputService13ProtocolTest) InputService13TestCaseOperation1Request(input *InputService13TestShapeInputShape) (req *aws.Request, output *InputService13TestShapeInputService13TestCaseOperation1Output) {
	if opInputService13TestCaseOperation1 == nil {
		opInputService13TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService13TestCaseOperation1, input, output)
	output = &InputService13TestShapeInputService13TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService13ProtocolTest) InputService13TestCaseOperation1(input *InputService13TestShapeInputShape) (output *InputService13TestShapeInputService13TestCaseOperation1Output, err error) {
	req, out := c.InputService13TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService13TestCaseOperation1 *aws.Operation

// InputService13TestCaseOperation2Request generates a request for the InputService13TestCaseOperation2 operation.
func (c *InputService13ProtocolTest) InputService13TestCaseOperation2Request(input *InputService13TestShapeInputShape) (req *aws.Request, output *InputService13TestShapeInputService13TestCaseOperation2Output) {
	if opInputService13TestCaseOperation2 == nil {
		opInputService13TestCaseOperation2 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService13TestCaseOperation2, input, output)
	output = &InputService13TestShapeInputService13TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService13ProtocolTest) InputService13TestCaseOperation2(input *InputService13TestShapeInputShape) (output *InputService13TestShapeInputService13TestCaseOperation2Output, err error) {
	req, out := c.InputService13TestCaseOperation2Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService13TestCaseOperation2 *aws.Operation

type InputService13TestShapeInputService13TestCaseOperation1Output struct {
	metadataInputService13TestShapeInputService13TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService13TestShapeInputService13TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService13TestShapeInputService13TestCaseOperation2Output struct {
	metadataInputService13TestShapeInputService13TestCaseOperation2Output `json:"-", xml:"-"`
}

type metadataInputService13TestShapeInputService13TestCaseOperation2Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService13TestShapeInputShape struct {
	Foo []byte `locationName:"foo" type:"blob"`

	metadataInputService13TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService13TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure" payload:"Foo"`
}

// InputService14ProtocolTest is a client for InputService14ProtocolTest.
type InputService14ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService14ProtocolTest client.
func NewInputService14ProtocolTest(config *aws.Config) *InputService14ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice14protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService14ProtocolTest{service}
}

// InputService14TestCaseOperation1Request generates a request for the InputService14TestCaseOperation1 operation.
func (c *InputService14ProtocolTest) InputService14TestCaseOperation1Request(input *InputService14TestShapeInputShape) (req *aws.Request, output *InputService14TestShapeInputService14TestCaseOperation1Output) {
	if opInputService14TestCaseOperation1 == nil {
		opInputService14TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService14TestCaseOperation1, input, output)
	output = &InputService14TestShapeInputService14TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService14ProtocolTest) InputService14TestCaseOperation1(input *InputService14TestShapeInputShape) (output *InputService14TestShapeInputService14TestCaseOperation1Output, err error) {
	req, out := c.InputService14TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService14TestCaseOperation1 *aws.Operation

// InputService14TestCaseOperation2Request generates a request for the InputService14TestCaseOperation2 operation.
func (c *InputService14ProtocolTest) InputService14TestCaseOperation2Request(input *InputService14TestShapeInputShape) (req *aws.Request, output *InputService14TestShapeInputService14TestCaseOperation2Output) {
	if opInputService14TestCaseOperation2 == nil {
		opInputService14TestCaseOperation2 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService14TestCaseOperation2, input, output)
	output = &InputService14TestShapeInputService14TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService14ProtocolTest) InputService14TestCaseOperation2(input *InputService14TestShapeInputShape) (output *InputService14TestShapeInputService14TestCaseOperation2Output, err error) {
	req, out := c.InputService14TestCaseOperation2Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService14TestCaseOperation2 *aws.Operation

type InputService14TestShapeFooShape struct {
	Baz *string `locationName:"baz" type:"string"`

	metadataInputService14TestShapeFooShape `json:"-", xml:"-"`
}

type metadataInputService14TestShapeFooShape struct {
	SDKShapeTraits bool `locationName:"foo" type:"structure"`
}

type InputService14TestShapeInputService14TestCaseOperation1Output struct {
	metadataInputService14TestShapeInputService14TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService14TestShapeInputService14TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService14TestShapeInputService14TestCaseOperation2Output struct {
	metadataInputService14TestShapeInputService14TestCaseOperation2Output `json:"-", xml:"-"`
}

type metadataInputService14TestShapeInputService14TestCaseOperation2Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService14TestShapeInputShape struct {
	Foo *InputService14TestShapeFooShape `locationName:"foo" type:"structure"`

	metadataInputService14TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService14TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure" payload:"Foo"`
}

// InputService15ProtocolTest is a client for InputService15ProtocolTest.
type InputService15ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService15ProtocolTest client.
func NewInputService15ProtocolTest(config *aws.Config) *InputService15ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice15protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService15ProtocolTest{service}
}

// InputService15TestCaseOperation1Request generates a request for the InputService15TestCaseOperation1 operation.
func (c *InputService15ProtocolTest) InputService15TestCaseOperation1Request(input *InputService15TestShapeInputShape) (req *aws.Request, output *InputService15TestShapeInputService15TestCaseOperation1Output) {
	if opInputService15TestCaseOperation1 == nil {
		opInputService15TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/",
		}
	}

	req = aws.NewRequest(c.Service, opInputService15TestCaseOperation1, input, output)
	output = &InputService15TestShapeInputService15TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService15ProtocolTest) InputService15TestCaseOperation1(input *InputService15TestShapeInputShape) (output *InputService15TestShapeInputService15TestCaseOperation1Output, err error) {
	req, out := c.InputService15TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService15TestCaseOperation1 *aws.Operation

type InputService15TestShapeGrant struct {
	Grantee *InputService15TestShapeGrantee `type:"structure"`

	metadataInputService15TestShapeGrant `json:"-", xml:"-"`
}

type metadataInputService15TestShapeGrant struct {
	SDKShapeTraits bool `locationName:"Grant" type:"structure"`
}

type InputService15TestShapeGrantee struct {
	EmailAddress *string `type:"string"`

	Type *string `locationName:"xsi:type" type:"string" xmlAttribute:"true"`

	metadataInputService15TestShapeGrantee `json:"-", xml:"-"`
}

type metadataInputService15TestShapeGrantee struct {
	SDKShapeTraits bool `type:"structure" xmlPrefix:"xsi" xmlURI:"http://www.w3.org/2001/XMLSchema-instance"`
}

type InputService15TestShapeInputService15TestCaseOperation1Output struct {
	metadataInputService15TestShapeInputService15TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService15TestShapeInputService15TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService15TestShapeInputShape struct {
	Grant *InputService15TestShapeGrant `locationName:"Grant" type:"structure"`

	metadataInputService15TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService15TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure" payload:"Grant"`
}

// InputService16ProtocolTest is a client for InputService16ProtocolTest.
type InputService16ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService16ProtocolTest client.
func NewInputService16ProtocolTest(config *aws.Config) *InputService16ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice16protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService16ProtocolTest{service}
}

// InputService16TestCaseOperation1Request generates a request for the InputService16TestCaseOperation1 operation.
func (c *InputService16ProtocolTest) InputService16TestCaseOperation1Request(input *InputService16TestShapeInputShape) (req *aws.Request, output *InputService16TestShapeInputService16TestCaseOperation1Output) {
	if opInputService16TestCaseOperation1 == nil {
		opInputService16TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "GET",
			HTTPPath:   "/{Bucket}/{Key+}",
		}
	}

	req = aws.NewRequest(c.Service, opInputService16TestCaseOperation1, input, output)
	output = &InputService16TestShapeInputService16TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService16ProtocolTest) InputService16TestCaseOperation1(input *InputService16TestShapeInputShape) (output *InputService16TestShapeInputService16TestCaseOperation1Output, err error) {
	req, out := c.InputService16TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService16TestCaseOperation1 *aws.Operation

type InputService16TestShapeInputService16TestCaseOperation1Output struct {
	metadataInputService16TestShapeInputService16TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService16TestShapeInputService16TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService16TestShapeInputShape struct {
	Bucket *string `location:"uri" type:"string"`

	Key *string `location:"uri" type:"string"`

	metadataInputService16TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService16TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService17ProtocolTest is a client for InputService17ProtocolTest.
type InputService17ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService17ProtocolTest client.
func NewInputService17ProtocolTest(config *aws.Config) *InputService17ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice17protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService17ProtocolTest{service}
}

// InputService17TestCaseOperation1Request generates a request for the InputService17TestCaseOperation1 operation.
func (c *InputService17ProtocolTest) InputService17TestCaseOperation1Request(input *InputService17TestShapeInputShape) (req *aws.Request, output *InputService17TestShapeInputService17TestCaseOperation1Output) {
	if opInputService17TestCaseOperation1 == nil {
		opInputService17TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService17TestCaseOperation1, input, output)
	output = &InputService17TestShapeInputService17TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService17ProtocolTest) InputService17TestCaseOperation1(input *InputService17TestShapeInputShape) (output *InputService17TestShapeInputService17TestCaseOperation1Output, err error) {
	req, out := c.InputService17TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService17TestCaseOperation1 *aws.Operation

// InputService17TestCaseOperation2Request generates a request for the InputService17TestCaseOperation2 operation.
func (c *InputService17ProtocolTest) InputService17TestCaseOperation2Request(input *InputService17TestShapeInputShape) (req *aws.Request, output *InputService17TestShapeInputService17TestCaseOperation2Output) {
	if opInputService17TestCaseOperation2 == nil {
		opInputService17TestCaseOperation2 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path?abc=mno",
		}
	}

	req = aws.NewRequest(c.Service, opInputService17TestCaseOperation2, input, output)
	output = &InputService17TestShapeInputService17TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService17ProtocolTest) InputService17TestCaseOperation2(input *InputService17TestShapeInputShape) (output *InputService17TestShapeInputService17TestCaseOperation2Output, err error) {
	req, out := c.InputService17TestCaseOperation2Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService17TestCaseOperation2 *aws.Operation

type InputService17TestShapeInputService17TestCaseOperation1Output struct {
	metadataInputService17TestShapeInputService17TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService17TestShapeInputService17TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService17TestShapeInputService17TestCaseOperation2Output struct {
	metadataInputService17TestShapeInputService17TestCaseOperation2Output `json:"-", xml:"-"`
}

type metadataInputService17TestShapeInputService17TestCaseOperation2Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService17TestShapeInputShape struct {
	Foo *string `location:"querystring" locationName:"param-name" type:"string"`

	metadataInputService17TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService17TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService18ProtocolTest is a client for InputService18ProtocolTest.
type InputService18ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService18ProtocolTest client.
func NewInputService18ProtocolTest(config *aws.Config) *InputService18ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice18protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService18ProtocolTest{service}
}

// InputService18TestCaseOperation1Request generates a request for the InputService18TestCaseOperation1 operation.
func (c *InputService18ProtocolTest) InputService18TestCaseOperation1Request(input *InputService18TestShapeInputShape) (req *aws.Request, output *InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation1Output) {
	if opInputService18TestCaseOperation1 == nil {
		opInputService18TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService18TestCaseOperation1, input, output)
	output = &InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation1(input *InputService18TestShapeInputShape) (output *InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation1Output, err error) {
	req, out := c.InputService18TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService18TestCaseOperation1 *aws.Operation

// InputService18TestCaseOperation2Request generates a request for the InputService18TestCaseOperation2 operation.
func (c *InputService18ProtocolTest) InputService18TestCaseOperation2Request(input *InputService18TestShapeInputShape) (req *aws.Request, output *InputService18TestShapeInputService18TestCaseOperation2Output) {
	if opInputService18TestCaseOperation2 == nil {
		opInputService18TestCaseOperation2 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService18TestCaseOperation2, input, output)
	output = &InputService18TestShapeInputService18TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation2(input *InputService18TestShapeInputShape) (output *InputService18TestShapeInputService18TestCaseOperation2Output, err error) {
	req, out := c.InputService18TestCaseOperation2Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService18TestCaseOperation2 *aws.Operation

// InputService18TestCaseOperation3Request generates a request for the InputService18TestCaseOperation3 operation.
func (c *InputService18ProtocolTest) InputService18TestCaseOperation3Request(input *InputService18TestShapeInputShape) (req *aws.Request, output *InputService18TestShapeInputService18TestCaseOperation3Output) {
	if opInputService18TestCaseOperation3 == nil {
		opInputService18TestCaseOperation3 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService18TestCaseOperation3, input, output)
	output = &InputService18TestShapeInputService18TestCaseOperation3Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation3(input *InputService18TestShapeInputShape) (output *InputService18TestShapeInputService18TestCaseOperation3Output, err error) {
	req, out := c.InputService18TestCaseOperation3Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService18TestCaseOperation3 *aws.Operation

// InputService18TestCaseOperation4Request generates a request for the InputService18TestCaseOperation4 operation.
func (c *InputService18ProtocolTest) InputService18TestCaseOperation4Request(input *InputService18TestShapeInputShape) (req *aws.Request, output *InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation4Output) {
	if opInputService18TestCaseOperation4 == nil {
		opInputService18TestCaseOperation4 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService18TestCaseOperation4, input, output)
	output = &InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation4Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation4(input *InputService18TestShapeInputShape) (output *InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation4Output, err error) {
	req, out := c.InputService18TestCaseOperation4Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService18TestCaseOperation4 *aws.Operation

// InputService18TestCaseOperation5Request generates a request for the InputService18TestCaseOperation5 operation.
func (c *InputService18ProtocolTest) InputService18TestCaseOperation5Request(input *InputService18TestShapeInputShape) (req *aws.Request, output *InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation5Output) {
	if opInputService18TestCaseOperation5 == nil {
		opInputService18TestCaseOperation5 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService18TestCaseOperation5, input, output)
	output = &InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation5Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation5(input *InputService18TestShapeInputShape) (output *InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation5Output, err error) {
	req, out := c.InputService18TestCaseOperation5Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService18TestCaseOperation5 *aws.Operation

// InputService18TestCaseOperation6Request generates a request for the InputService18TestCaseOperation6 operation.
func (c *InputService18ProtocolTest) InputService18TestCaseOperation6Request(input *InputService18TestShapeInputShape) (req *aws.Request, output *InputService18TestShapeInputService18TestCaseOperation6Output) {
	if opInputService18TestCaseOperation6 == nil {
		opInputService18TestCaseOperation6 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService18TestCaseOperation6, input, output)
	output = &InputService18TestShapeInputService18TestCaseOperation6Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation6(input *InputService18TestShapeInputShape) (output *InputService18TestShapeInputService18TestCaseOperation6Output, err error) {
	req, out := c.InputService18TestCaseOperation6Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService18TestCaseOperation6 *aws.Operation

type InputService18TestShapeInputService18TestCaseOperation2Output struct {
	metadataInputService18TestShapeInputService18TestCaseOperation2Output `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputService18TestCaseOperation2Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService18TestShapeInputService18TestCaseOperation3Output struct {
	metadataInputService18TestShapeInputService18TestCaseOperation3Output `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputService18TestCaseOperation3Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService18TestShapeInputService18TestCaseOperation6Output struct {
	metadataInputService18TestShapeInputService18TestCaseOperation6Output `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputService18TestCaseOperation6Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation1Output struct {
	metadataInputService18TestShapeInputService18TestShapeInputService18TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputService18TestShapeInputService18TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation4Output struct {
	metadataInputService18TestShapeInputService18TestShapeInputService18TestCaseOperation4Output `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputService18TestShapeInputService18TestCaseOperation4Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService18TestShapeInputService18TestShapeInputService18TestCaseOperation5Output struct {
	metadataInputService18TestShapeInputService18TestShapeInputService18TestCaseOperation5Output `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputService18TestShapeInputService18TestCaseOperation5Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService18TestShapeInputShape struct {
	RecursiveStruct *InputService18TestShapeRecursiveStructType `type:"structure"`

	metadataInputService18TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService18TestShapeInputShape struct {
	SDKShapeTraits bool `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`
}

type InputService18TestShapeRecursiveStructType struct {
	NoRecurse *string `type:"string"`

	RecursiveList []*InputService18TestShapeRecursiveStructType `type:"list"`

	RecursiveMap *map[string]*InputService18TestShapeRecursiveStructType `type:"map"`

	RecursiveStruct *InputService18TestShapeRecursiveStructType `type:"structure"`

	metadataInputService18TestShapeRecursiveStructType `json:"-", xml:"-"`
}

type metadataInputService18TestShapeRecursiveStructType struct {
	SDKShapeTraits bool `type:"structure"`
}

// InputService19ProtocolTest is a client for InputService19ProtocolTest.
type InputService19ProtocolTest struct {
	*aws.Service
}

// New returns a new InputService19ProtocolTest client.
func NewInputService19ProtocolTest(config *aws.Config) *InputService19ProtocolTest {
	if config == nil {
		config = &aws.Config{}
	}

	service := &aws.Service{
		Config:      aws.DefaultConfig.Merge(config),
		ServiceName: "inputservice19protocoltest",
		APIVersion:  "2014-01-01",
	}
	service.Initialize()

	// Handlers
	service.Handlers.Sign.PushBack(v4.Sign)
	service.Handlers.Build.PushBack(restxml.Build)
	service.Handlers.Unmarshal.PushBack(restxml.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(restxml.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(restxml.UnmarshalError)

	return &InputService19ProtocolTest{service}
}

// InputService19TestCaseOperation1Request generates a request for the InputService19TestCaseOperation1 operation.
func (c *InputService19ProtocolTest) InputService19TestCaseOperation1Request(input *InputService19TestShapeInputShape) (req *aws.Request, output *InputService19TestShapeInputService19TestCaseOperation1Output) {
	if opInputService19TestCaseOperation1 == nil {
		opInputService19TestCaseOperation1 = &aws.Operation{
			Name:       "OperationName",
			HTTPMethod: "POST",
			HTTPPath:   "/path",
		}
	}

	req = aws.NewRequest(c.Service, opInputService19TestCaseOperation1, input, output)
	output = &InputService19TestShapeInputService19TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService19ProtocolTest) InputService19TestCaseOperation1(input *InputService19TestShapeInputShape) (output *InputService19TestShapeInputService19TestCaseOperation1Output, err error) {
	req, out := c.InputService19TestCaseOperation1Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService19TestCaseOperation1 *aws.Operation

type InputService19TestShapeInputService19TestCaseOperation1Output struct {
	metadataInputService19TestShapeInputService19TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService19TestShapeInputService19TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService19TestShapeInputShape struct {
	TimeArgInHeader *time.Time `location:"header" locationName:"x-amz-timearg" type:"timestamp" timestampFormat:"rfc822"`

	metadataInputService19TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService19TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
}

//
// Tests begin here
//

func TestInputService1ProtocolTestBasicXMLSerializationCase1(t *testing.T) {
	svc := NewInputService1ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService1TestShapeInputShape{
		Description: aws.String("bar"),
		Name:        aws.String("foo"),
	}
	req, _ := svc.InputService1TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">bar</Description><Name xmlns="https://foo/">foo</Name></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService1ProtocolTestBasicXMLSerializationCase2(t *testing.T) {
	svc := NewInputService1ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService1TestShapeInputShape{
		Description: aws.String("bar"),
		Name:        aws.String("foo"),
	}
	req, _ := svc.InputService1TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">bar</Description><Name xmlns="https://foo/">foo</Name></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService2ProtocolTestSerializeOtherScalarTypesCase1(t *testing.T) {
	svc := NewInputService2ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService2TestShapeInputShape{
		First:  aws.Boolean(true),
		Fourth: aws.Long(3),
		Second: aws.Boolean(false),
		Third:  aws.Double(1.2),
	}
	req, _ := svc.InputService2TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><First xmlns="https://foo/">true</First><Fourth xmlns="https://foo/">3</Fourth><Second xmlns="https://foo/">false</Second><Third xmlns="https://foo/">1.2</Third></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService3ProtocolTestNestedStructuresCase1(t *testing.T) {
	svc := NewInputService3ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService3TestShapeInputShape{
		Description: aws.String("baz"),
		SubStructure: &InputService3TestShapeSubStructure{
			Bar: aws.String("b"),
			Foo: aws.String("a"),
		},
	}
	req, _ := svc.InputService3TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">baz</Description><SubStructure xmlns="https://foo/"><Bar xmlns="https://foo/">b</Bar><Foo xmlns="https://foo/">a</Foo></SubStructure></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService4ProtocolTestNestedStructuresCase1(t *testing.T) {
	svc := NewInputService4ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService4TestShapeInputShape{
		Description:  aws.String("baz"),
		SubStructure: &InputService4TestShapeSubStructure{},
	}
	req, _ := svc.InputService4TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">baz</Description><SubStructure xmlns="https://foo/"></SubStructure></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService5ProtocolTestNonFlattenedListsCase1(t *testing.T) {
	svc := NewInputService5ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService5TestShapeInputShape{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService5TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><ListParam xmlns="https://foo/"><member xmlns="https://foo/">one</member><member xmlns="https://foo/">two</member><member xmlns="https://foo/">three</member></ListParam></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService6ProtocolTestNonFlattenedListsWithLocationNameCase1(t *testing.T) {
	svc := NewInputService6ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService6TestShapeInputShape{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService6TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><AlternateName xmlns="https://foo/"><NotMember xmlns="https://foo/">one</NotMember><NotMember xmlns="https://foo/">two</NotMember><NotMember xmlns="https://foo/">three</NotMember></AlternateName></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService7ProtocolTestFlattenedListsCase1(t *testing.T) {
	svc := NewInputService7ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService7TestShapeInputShape{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService7TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><ListParam xmlns="https://foo/">one</ListParam><ListParam xmlns="https://foo/">two</ListParam><ListParam xmlns="https://foo/">three</ListParam></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestFlattenedListsWithLocationNameCase1(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService8TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><item xmlns="https://foo/">one</item><item xmlns="https://foo/">two</item><item xmlns="https://foo/">three</item></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService9ProtocolTestListOfStructuresCase1(t *testing.T) {
	svc := NewInputService9ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService9TestShapeInputShape{
		ListParam: []*InputService9TestShapeSingleFieldStruct{
			&InputService9TestShapeSingleFieldStruct{
				Element: aws.String("one"),
			},
			&InputService9TestShapeSingleFieldStruct{
				Element: aws.String("two"),
			},
			&InputService9TestShapeSingleFieldStruct{
				Element: aws.String("three"),
			},
		},
	}
	req, _ := svc.InputService9TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><item xmlns="https://foo/"><value xmlns="https://foo/">one</value></item><item xmlns="https://foo/"><value xmlns="https://foo/">two</value></item><item xmlns="https://foo/"><value xmlns="https://foo/">three</value></item></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService10ProtocolTestBlobAndTimestampShapesCase1(t *testing.T) {
	svc := NewInputService10ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService10TestShapeInputShape{
		StructureParam: &InputService10TestShapeStructureShape{
			B: []byte("foo"),
			T: aws.Time(time.Unix(1422172800, 0)),
		},
	}
	req, _ := svc.InputService10TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><StructureParam xmlns="https://foo/"><b xmlns="https://foo/">Zm9v</b><t xmlns="https://foo/">2015-01-25T08:00:00Z</t></StructureParam></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService11ProtocolTestHeaderMapsCase1(t *testing.T) {
	svc := NewInputService11ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService11TestShapeInputShape{
		Foo: &map[string]*string{
			"a": aws.String("b"),
			"c": aws.String("d"),
		},
	}
	req, _ := svc.InputService11TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers
	assert.Equal(t, "b", r.Header.Get("x-foo-a"))
	assert.Equal(t, "d", r.Header.Get("x-foo-c"))

}

func TestInputService12ProtocolTestStringPayloadCase1(t *testing.T) {
	svc := NewInputService12ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService12TestShapeInputShape{
		Foo: aws.String("bar"),
	}
	req, _ := svc.InputService12TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`bar`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService13ProtocolTestBlobPayloadCase1(t *testing.T) {
	svc := NewInputService13ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService13TestShapeInputShape{
		Foo: []byte("bar"),
	}
	req, _ := svc.InputService13TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`bar`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService13ProtocolTestBlobPayloadCase2(t *testing.T) {
	svc := NewInputService13ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService13TestShapeInputShape{}
	req, _ := svc.InputService13TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService14ProtocolTestStructurePayloadCase1(t *testing.T) {
	svc := NewInputService14ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService14TestShapeInputShape{
		Foo: &InputService14TestShapeFooShape{
			Baz: aws.String("bar"),
		},
	}
	req, _ := svc.InputService14TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<foo><baz>bar</baz></foo>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService14ProtocolTestStructurePayloadCase2(t *testing.T) {
	svc := NewInputService14ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService14TestShapeInputShape{}
	req, _ := svc.InputService14TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService15ProtocolTestXMLAttributeCase1(t *testing.T) {
	svc := NewInputService15ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService15TestShapeInputShape{
		Grant: &InputService15TestShapeGrant{
			Grantee: &InputService15TestShapeGrantee{
				EmailAddress: aws.String("foo@example.com"),
				Type:         aws.String("CanonicalUser"),
			},
		},
	}
	req, _ := svc.InputService15TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<Grant xmlns:_xmlns="xmlns" _xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:XMLSchema-instance="http://www.w3.org/2001/XMLSchema-instance" XMLSchema-instance:type="CanonicalUser"><Grantee><EmailAddress>foo@example.com</EmailAddress></Grantee></Grant>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService16ProtocolTestGreedyKeysCase1(t *testing.T) {
	svc := NewInputService16ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService16TestShapeInputShape{
		Bucket: aws.String("my/bucket"),
		Key:    aws.String("testing /123"),
	}
	req, _ := svc.InputService16TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/my%2Fbucket/testing%20/123", r.URL.String())

	// assert headers

}

func TestInputService17ProtocolTestOmitsNullQueryParamsButSerializesEmptyStringsCase1(t *testing.T) {
	svc := NewInputService17ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService17TestShapeInputShape{}
	req, _ := svc.InputService17TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService17ProtocolTestOmitsNullQueryParamsButSerializesEmptyStringsCase2(t *testing.T) {
	svc := NewInputService17ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService17TestShapeInputShape{
		Foo: aws.String(""),
	}
	req, _ := svc.InputService17TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/path?abc=mno&param-name=", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestRecursiveShapesCase1(t *testing.T) {
	svc := NewInputService18ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService18TestShapeInputShape{
		RecursiveStruct: &InputService18TestShapeRecursiveStructType{
			NoRecurse: aws.String("foo"),
		},
	}
	req, _ := svc.InputService18TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></RecursiveStruct></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestRecursiveShapesCase2(t *testing.T) {
	svc := NewInputService18ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService18TestShapeInputShape{
		RecursiveStruct: &InputService18TestShapeRecursiveStructType{
			RecursiveStruct: &InputService18TestShapeRecursiveStructType{
				NoRecurse: aws.String("foo"),
			},
		},
	}
	req, _ := svc.InputService18TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></RecursiveStruct></RecursiveStruct></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestRecursiveShapesCase3(t *testing.T) {
	svc := NewInputService18ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService18TestShapeInputShape{
		RecursiveStruct: &InputService18TestShapeRecursiveStructType{
			RecursiveStruct: &InputService18TestShapeRecursiveStructType{
				RecursiveStruct: &InputService18TestShapeRecursiveStructType{
					RecursiveStruct: &InputService18TestShapeRecursiveStructType{
						NoRecurse: aws.String("foo"),
					},
				},
			},
		},
	}
	req, _ := svc.InputService18TestCaseOperation3Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></RecursiveStruct></RecursiveStruct></RecursiveStruct></RecursiveStruct></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestRecursiveShapesCase4(t *testing.T) {
	svc := NewInputService18ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService18TestShapeInputShape{
		RecursiveStruct: &InputService18TestShapeRecursiveStructType{
			RecursiveList: []*InputService18TestShapeRecursiveStructType{
				&InputService18TestShapeRecursiveStructType{
					NoRecurse: aws.String("foo"),
				},
				&InputService18TestShapeRecursiveStructType{
					NoRecurse: aws.String("bar"),
				},
			},
		},
	}
	req, _ := svc.InputService18TestCaseOperation4Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveList xmlns="https://foo/"><member xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></member><member xmlns="https://foo/"><NoRecurse xmlns="https://foo/">bar</NoRecurse></member></RecursiveList></RecursiveStruct></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestRecursiveShapesCase5(t *testing.T) {
	svc := NewInputService18ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService18TestShapeInputShape{
		RecursiveStruct: &InputService18TestShapeRecursiveStructType{
			RecursiveList: []*InputService18TestShapeRecursiveStructType{
				&InputService18TestShapeRecursiveStructType{
					NoRecurse: aws.String("foo"),
				},
				&InputService18TestShapeRecursiveStructType{
					RecursiveStruct: &InputService18TestShapeRecursiveStructType{
						NoRecurse: aws.String("bar"),
					},
				},
			},
		},
	}
	req, _ := svc.InputService18TestCaseOperation5Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveList xmlns="https://foo/"><member xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></member><member xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">bar</NoRecurse></RecursiveStruct></member></RecursiveList></RecursiveStruct></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestRecursiveShapesCase6(t *testing.T) {
	svc := NewInputService18ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService18TestShapeInputShape{
		RecursiveStruct: &InputService18TestShapeRecursiveStructType{
			RecursiveMap: &map[string]*InputService18TestShapeRecursiveStructType{
				"bar": &InputService18TestShapeRecursiveStructType{
					NoRecurse: aws.String("bar"),
				},
				"foo": &InputService18TestShapeRecursiveStructType{
					NoRecurse: aws.String("foo"),
				},
			},
		},
	}
	req, _ := svc.InputService18TestCaseOperation6Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, util.Trim(`<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveMap xmlns="https://foo/"><entry xmlns="https://foo/"><key xmlns="https://foo/">bar</key><value xmlns="https://foo/"><NoRecurse xmlns="https://foo/">bar</NoRecurse></value></entry><entry xmlns="https://foo/"><key xmlns="https://foo/">foo</key><value xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></value></entry></RecursiveMap></RecursiveStruct></OperationRequest>`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService19ProtocolTestTimestampInHeaderCase1(t *testing.T) {
	svc := NewInputService19ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService19TestShapeInputShape{
		TimeArgInHeader: aws.Time(time.Unix(1422172800, 0)),
	}
	req, _ := svc.InputService19TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	assert.Equal(t, "https://test/path", r.URL.String())

	// assert headers
	assert.Equal(t, "Sun, 25 Jan 2015 08:00:00 GMT", r.Header.Get("x-amz-timearg"))

}

