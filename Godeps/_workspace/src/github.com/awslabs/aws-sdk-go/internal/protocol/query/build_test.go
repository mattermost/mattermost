package query_test

import (
	"github.com/awslabs/aws-sdk-go/aws"
	"github.com/awslabs/aws-sdk-go/internal/protocol/query"
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService1ProtocolTest{service}
}

// InputService1TestCaseOperation1Request generates a request for the InputService1TestCaseOperation1 operation.
func (c *InputService1ProtocolTest) InputService1TestCaseOperation1Request(input *InputService1TestShapeInputShape) (req *aws.Request, output *InputService1TestShapeInputService1TestCaseOperation1Output) {
	if opInputService1TestCaseOperation1 == nil {
		opInputService1TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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

type InputService1TestShapeInputService1TestCaseOperation1Output struct {
	metadataInputService1TestShapeInputService1TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService1TestShapeInputService1TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService1TestShapeInputShape struct {
	Bar *string `type:"string"`

	Foo *string `type:"string"`

	metadataInputService1TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService1TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService2ProtocolTest{service}
}

// InputService2TestCaseOperation1Request generates a request for the InputService2TestCaseOperation1 operation.
func (c *InputService2ProtocolTest) InputService2TestCaseOperation1Request(input *InputService2TestShapeInputShape) (req *aws.Request, output *InputService2TestShapeInputService2TestCaseOperation1Output) {
	if opInputService2TestCaseOperation1 == nil {
		opInputService2TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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
	StructArg *InputService2TestShapeStructType `type:"structure"`

	metadataInputService2TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService2TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService2TestShapeStructType struct {
	ScalarArg *string `type:"string"`

	metadataInputService2TestShapeStructType `json:"-", xml:"-"`
}

type metadataInputService2TestShapeStructType struct {
	SDKShapeTraits bool `type:"structure"`
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService3ProtocolTest{service}
}

// InputService3TestCaseOperation1Request generates a request for the InputService3TestCaseOperation1 operation.
func (c *InputService3ProtocolTest) InputService3TestCaseOperation1Request(input *InputService3TestShapeInputShape) (req *aws.Request, output *InputService3TestShapeInputService3TestCaseOperation1Output) {
	if opInputService3TestCaseOperation1 == nil {
		opInputService3TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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
	ListArg []*string `type:"list"`

	metadataInputService3TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService3TestShapeInputShape struct {
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService4ProtocolTest{service}
}

// InputService4TestCaseOperation1Request generates a request for the InputService4TestCaseOperation1 operation.
func (c *InputService4ProtocolTest) InputService4TestCaseOperation1Request(input *InputService4TestShapeInputShape) (req *aws.Request, output *InputService4TestShapeInputService4TestCaseOperation1Output) {
	if opInputService4TestCaseOperation1 == nil {
		opInputService4TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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
	ListArg []*string `type:"list" flattened:"true"`

	ScalarArg *string `type:"string"`

	metadataInputService4TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService4TestShapeInputShape struct {
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService5ProtocolTest{service}
}

// InputService5TestCaseOperation1Request generates a request for the InputService5TestCaseOperation1 operation.
func (c *InputService5ProtocolTest) InputService5TestCaseOperation1Request(input *InputService5TestShapeInputShape) (req *aws.Request, output *InputService5TestShapeInputService5TestCaseOperation1Output) {
	if opInputService5TestCaseOperation1 == nil {
		opInputService5TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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
	MapArg *map[string]*string `type:"map"`

	metadataInputService5TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService5TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService6ProtocolTest{service}
}

// InputService6TestCaseOperation1Request generates a request for the InputService6TestCaseOperation1 operation.
func (c *InputService6ProtocolTest) InputService6TestCaseOperation1Request(input *InputService6TestShapeInputShape) (req *aws.Request, output *InputService6TestShapeInputService6TestCaseOperation1Output) {
	if opInputService6TestCaseOperation1 == nil {
		opInputService6TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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
	BlobArg []byte `type:"blob"`

	metadataInputService6TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService6TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService7ProtocolTest{service}
}

// InputService7TestCaseOperation1Request generates a request for the InputService7TestCaseOperation1 operation.
func (c *InputService7ProtocolTest) InputService7TestCaseOperation1Request(input *InputService7TestShapeInputShape) (req *aws.Request, output *InputService7TestShapeInputService7TestCaseOperation1Output) {
	if opInputService7TestCaseOperation1 == nil {
		opInputService7TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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
	TimeArg *time.Time `type:"timestamp" timestampFormat:"iso8601"`

	metadataInputService7TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService7TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
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
	service.Handlers.Build.PushBack(query.Build)
	service.Handlers.Unmarshal.PushBack(query.Unmarshal)
	service.Handlers.UnmarshalMeta.PushBack(query.UnmarshalMeta)
	service.Handlers.UnmarshalError.PushBack(query.UnmarshalError)

	return &InputService8ProtocolTest{service}
}

// InputService8TestCaseOperation1Request generates a request for the InputService8TestCaseOperation1 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation1Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestCaseOperation1Output) {
	if opInputService8TestCaseOperation1 == nil {
		opInputService8TestCaseOperation1 = &aws.Operation{
			Name: "OperationName",
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

// InputService8TestCaseOperation2Request generates a request for the InputService8TestCaseOperation2 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation2Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestCaseOperation2Output) {
	if opInputService8TestCaseOperation2 == nil {
		opInputService8TestCaseOperation2 = &aws.Operation{
			Name: "OperationName",
		}
	}

	req = aws.NewRequest(c.Service, opInputService8TestCaseOperation2, input, output)
	output = &InputService8TestShapeInputService8TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation2(input *InputService8TestShapeInputShape) (output *InputService8TestShapeInputService8TestCaseOperation2Output, err error) {
	req, out := c.InputService8TestCaseOperation2Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService8TestCaseOperation2 *aws.Operation

// InputService8TestCaseOperation3Request generates a request for the InputService8TestCaseOperation3 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation3Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation3Output) {
	if opInputService8TestCaseOperation3 == nil {
		opInputService8TestCaseOperation3 = &aws.Operation{
			Name: "OperationName",
		}
	}

	req = aws.NewRequest(c.Service, opInputService8TestCaseOperation3, input, output)
	output = &InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation3Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation3(input *InputService8TestShapeInputShape) (output *InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation3Output, err error) {
	req, out := c.InputService8TestCaseOperation3Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService8TestCaseOperation3 *aws.Operation

// InputService8TestCaseOperation4Request generates a request for the InputService8TestCaseOperation4 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation4Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestCaseOperation4Output) {
	if opInputService8TestCaseOperation4 == nil {
		opInputService8TestCaseOperation4 = &aws.Operation{
			Name: "OperationName",
		}
	}

	req = aws.NewRequest(c.Service, opInputService8TestCaseOperation4, input, output)
	output = &InputService8TestShapeInputService8TestCaseOperation4Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation4(input *InputService8TestShapeInputShape) (output *InputService8TestShapeInputService8TestCaseOperation4Output, err error) {
	req, out := c.InputService8TestCaseOperation4Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService8TestCaseOperation4 *aws.Operation

// InputService8TestCaseOperation5Request generates a request for the InputService8TestCaseOperation5 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation5Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation5Output) {
	if opInputService8TestCaseOperation5 == nil {
		opInputService8TestCaseOperation5 = &aws.Operation{
			Name: "OperationName",
		}
	}

	req = aws.NewRequest(c.Service, opInputService8TestCaseOperation5, input, output)
	output = &InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation5Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation5(input *InputService8TestShapeInputShape) (output *InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation5Output, err error) {
	req, out := c.InputService8TestCaseOperation5Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService8TestCaseOperation5 *aws.Operation

// InputService8TestCaseOperation6Request generates a request for the InputService8TestCaseOperation6 operation.
func (c *InputService8ProtocolTest) InputService8TestCaseOperation6Request(input *InputService8TestShapeInputShape) (req *aws.Request, output *InputService8TestShapeInputService8TestCaseOperation6Output) {
	if opInputService8TestCaseOperation6 == nil {
		opInputService8TestCaseOperation6 = &aws.Operation{
			Name: "OperationName",
		}
	}

	req = aws.NewRequest(c.Service, opInputService8TestCaseOperation6, input, output)
	output = &InputService8TestShapeInputService8TestCaseOperation6Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation6(input *InputService8TestShapeInputShape) (output *InputService8TestShapeInputService8TestCaseOperation6Output, err error) {
	req, out := c.InputService8TestCaseOperation6Request(input)
	output = out
	err = req.Send()
	return
}

var opInputService8TestCaseOperation6 *aws.Operation

type InputService8TestShapeInputService8TestCaseOperation1Output struct {
	metadataInputService8TestShapeInputService8TestCaseOperation1Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestCaseOperation1Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputService8TestCaseOperation2Output struct {
	metadataInputService8TestShapeInputService8TestCaseOperation2Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestCaseOperation2Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputService8TestCaseOperation4Output struct {
	metadataInputService8TestShapeInputService8TestCaseOperation4Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestCaseOperation4Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputService8TestCaseOperation6Output struct {
	metadataInputService8TestShapeInputService8TestCaseOperation6Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestCaseOperation6Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation3Output struct {
	metadataInputService8TestShapeInputService8TestShapeInputService8TestCaseOperation3Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestShapeInputService8TestCaseOperation3Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputService8TestShapeInputService8TestCaseOperation5Output struct {
	metadataInputService8TestShapeInputService8TestShapeInputService8TestCaseOperation5Output `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestShapeInputService8TestCaseOperation5Output struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputService8TestShapeRecursiveStructType struct {
	NoRecurse *string `type:"string"`

	RecursiveList []*InputService8TestShapeInputService8TestShapeRecursiveStructType `type:"list"`

	RecursiveMap *map[string]*InputService8TestShapeInputService8TestShapeRecursiveStructType `type:"map"`

	RecursiveStruct *InputService8TestShapeInputService8TestShapeRecursiveStructType `type:"structure"`

	metadataInputService8TestShapeInputService8TestShapeRecursiveStructType `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputService8TestShapeRecursiveStructType struct {
	SDKShapeTraits bool `type:"structure"`
}

type InputService8TestShapeInputShape struct {
	RecursiveStruct *InputService8TestShapeInputService8TestShapeRecursiveStructType `type:"structure"`

	metadataInputService8TestShapeInputShape `json:"-", xml:"-"`
}

type metadataInputService8TestShapeInputShape struct {
	SDKShapeTraits bool `type:"structure"`
}

//
// Tests begin here
//

func TestInputService1ProtocolTestScalarMembersCase1(t *testing.T) {
	svc := NewInputService1ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService1TestShapeInputShape{
		Bar: aws.String("val2"),
		Foo: aws.String("val1"),
	}
	req, _ := svc.InputService1TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&Bar=val2&Foo=val1&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService2ProtocolTestNestedStructureMembersCase1(t *testing.T) {
	svc := NewInputService2ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService2TestShapeInputShape{
		StructArg: &InputService2TestShapeStructType{
			ScalarArg: aws.String("foo"),
		},
	}
	req, _ := svc.InputService2TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&StructArg.ScalarArg=foo&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService3ProtocolTestListTypesCase1(t *testing.T) {
	svc := NewInputService3ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService3TestShapeInputShape{
		ListArg: []*string{
			aws.String("foo"),
			aws.String("bar"),
			aws.String("baz"),
		},
	}
	req, _ := svc.InputService3TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&ListArg.member.1=foo&ListArg.member.2=bar&ListArg.member.3=baz&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService4ProtocolTestFlattenedListCase1(t *testing.T) {
	svc := NewInputService4ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService4TestShapeInputShape{
		ListArg: []*string{
			aws.String("a"),
			aws.String("b"),
			aws.String("c"),
		},
		ScalarArg: aws.String("foo"),
	}
	req, _ := svc.InputService4TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&ListArg.1=a&ListArg.2=b&ListArg.3=c&ScalarArg=foo&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService5ProtocolTestSerializeMapTypeCase1(t *testing.T) {
	svc := NewInputService5ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService5TestShapeInputShape{
		MapArg: &map[string]*string{
			"key1": aws.String("val1"),
			"key2": aws.String("val2"),
		},
	}
	req, _ := svc.InputService5TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&MapArg.entry.1.key=key1&MapArg.entry.1.value=val1&MapArg.entry.2.key=key2&MapArg.entry.2.value=val2&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService6ProtocolTestBase64EncodedBlobsCase1(t *testing.T) {
	svc := NewInputService6ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService6TestShapeInputShape{
		BlobArg: []byte("foo"),
	}
	req, _ := svc.InputService6TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&BlobArg=Zm9v&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService7ProtocolTestTimestampValuesCase1(t *testing.T) {
	svc := NewInputService7ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService7TestShapeInputShape{
		TimeArg: aws.Time(time.Unix(1422172800, 0)),
	}
	req, _ := svc.InputService7TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&TimeArg=2015-01-25T08%3A00%3A00Z&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestRecursiveShapesCase1(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
			NoRecurse: aws.String("foo"),
		},
	}
	req, _ := svc.InputService8TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&RecursiveStruct.NoRecurse=foo&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestRecursiveShapesCase2(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
			RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
				NoRecurse: aws.String("foo"),
			},
		},
	}
	req, _ := svc.InputService8TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&RecursiveStruct.RecursiveStruct.NoRecurse=foo&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestRecursiveShapesCase3(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
			RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
				RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
					RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
						NoRecurse: aws.String("foo"),
					},
				},
			},
		},
	}
	req, _ := svc.InputService8TestCaseOperation3Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&RecursiveStruct.RecursiveStruct.RecursiveStruct.RecursiveStruct.NoRecurse=foo&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestRecursiveShapesCase4(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
			RecursiveList: []*InputService8TestShapeInputService8TestShapeRecursiveStructType{
				&InputService8TestShapeInputService8TestShapeRecursiveStructType{
					NoRecurse: aws.String("foo"),
				},
				&InputService8TestShapeInputService8TestShapeRecursiveStructType{
					NoRecurse: aws.String("bar"),
				},
			},
		},
	}
	req, _ := svc.InputService8TestCaseOperation4Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&RecursiveStruct.RecursiveList.member.1.NoRecurse=foo&RecursiveStruct.RecursiveList.member.2.NoRecurse=bar&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestRecursiveShapesCase5(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
			RecursiveList: []*InputService8TestShapeInputService8TestShapeRecursiveStructType{
				&InputService8TestShapeInputService8TestShapeRecursiveStructType{
					NoRecurse: aws.String("foo"),
				},
				&InputService8TestShapeInputService8TestShapeRecursiveStructType{
					RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
						NoRecurse: aws.String("bar"),
					},
				},
			},
		},
	}
	req, _ := svc.InputService8TestCaseOperation5Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&RecursiveStruct.RecursiveList.member.1.NoRecurse=foo&RecursiveStruct.RecursiveList.member.2.RecursiveStruct.NoRecurse=bar&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestRecursiveShapesCase6(t *testing.T) {
	svc := NewInputService8ProtocolTest(nil)
	svc.Endpoint = "https://test"

	input := &InputService8TestShapeInputShape{
		RecursiveStruct: &InputService8TestShapeInputService8TestShapeRecursiveStructType{
			RecursiveMap: &map[string]*InputService8TestShapeInputService8TestShapeRecursiveStructType{
				"bar": &InputService8TestShapeInputService8TestShapeRecursiveStructType{
					NoRecurse: aws.String("bar"),
				},
				"foo": &InputService8TestShapeInputService8TestShapeRecursiveStructType{
					NoRecurse: aws.String("foo"),
				},
			},
		},
	}
	req, _ := svc.InputService8TestCaseOperation6Request(input)
	r := req.HTTPRequest

	// build request
	query.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body, _ := ioutil.ReadAll(r.Body)
	assert.Equal(t, util.Trim(`Action=OperationName&RecursiveStruct.RecursiveMap.entry.1.key=bar&RecursiveStruct.RecursiveMap.entry.1.value.NoRecurse=bar&RecursiveStruct.RecursiveMap.entry.2.key=foo&RecursiveStruct.RecursiveMap.entry.2.value.NoRecurse=foo&Version=2014-01-01`), util.Trim(string(body)))

	// assert URL
	assert.Equal(t, "https://test/", r.URL.String())

	// assert headers

}

