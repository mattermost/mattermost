[![Build Status](https://travis-ci.org/francoispqt/gojay.svg?branch=master)](https://travis-ci.org/francoispqt/gojay)
[![codecov](https://codecov.io/gh/francoispqt/gojay/branch/master/graph/badge.svg)](https://codecov.io/gh/francoispqt/gojay)
[![Go Report Card](https://goreportcard.com/badge/github.com/francoispqt/gojay)](https://goreportcard.com/report/github.com/francoispqt/gojay)
[![Go doc](http://img.shields.io/badge/go-documentation-blue.svg?style=flat-square
)](https://godoc.org/github.com/francoispqt/gojay)
![MIT License](https://img.shields.io/badge/license-mit-blue.svg?style=flat-square)
[![Sourcegraph](https://sourcegraph.com/github.com/francoispqt/gojay/-/badge.svg)](https://sourcegraph.com/github.com/francoispqt/gojay)
![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)

# GoJay

<img src="https://github.com/francoispqt/gojay/raw/master/gojay.png" width="200px">

GoJay is a performant JSON encoder/decoder for Golang (currently the most performant, [see benchmarks](#benchmark-results)).

It has a simple API and doesn't use reflection. It relies on small interfaces to decode/encode structures and slices.

Gojay also comes with powerful stream decoding features and an even faster [Unsafe](#unsafe-api) API.

There is also a [code generation tool](https://github.com/francoispqt/gojay/tree/master/gojay) to make usage easier and faster.

# Why another JSON parser?

I looked at other fast decoder/encoder and realised it was mostly hardly readable static code generation or a lot of reflection, poor streaming features, and not so fast in the end.

Also, I wanted to build a decoder that could consume an io.Reader of line or comma delimited JSON, in a JIT way. To consume a flow of JSON objects from a TCP connection for example or from a standard output. Same way I wanted to build an encoder that could encode a flow of data to a io.Writer.

This is how GoJay aims to be a very fast, JIT stream parser with 0 reflection, low allocation with a friendly API.

# Get started

```bash
go get github.com/francoispqt/gojay
```

* [Encoder](#encoding)
* [Decoder](#decoding)
* [Stream API](#stream-api)
* [Code Generation](https://github.com/francoispqt/gojay/tree/master/gojay)

## Decoding

Decoding is done through two different API similar to standard `encoding/json`:
* [Unmarshal](#unmarshal-api)
* [Decode](#decode-api)


Example of basic stucture decoding with Unmarshal:
```go
import "github.com/francoispqt/gojay"

type user struct {
    id int
    name string
    email string
}
// implement gojay.UnmarshalerJSONObject
func (u *user) UnmarshalJSONObject(dec *gojay.Decoder, key string) error {
    switch key {
    case "id":
        return dec.Int(&u.id)
    case "name":
        return dec.String(&u.name)
    case "email":
        return dec.String(&u.email)
    }
    return nil
}
func (u *user) NKeys() int {
    return 3
}

func main() {
    u := &user{}
    d := []byte(`{"id":1,"name":"gojay","email":"gojay@email.com"}`)
    err := gojay.UnmarshalJSONObject(d, u)
    if err != nil {
        log.Fatal(err)
    }
}
```

with Decode:
```go
func main() {
    u := &user{}
    dec := gojay.NewDecoder(bytes.NewReader([]byte(`{"id":1,"name":"gojay","email":"gojay@email.com"}`)))
    err := dec.DecodeObject(d, u)
    if err != nil {
        log.Fatal(err)
    }
}
```

### Unmarshal API

Unmarshal API decodes a `[]byte` to a given pointer with a single function.

Behind the doors, Unmarshal API borrows a `*gojay.Decoder` resets its settings and decodes the data to the given pointer and releases the `*gojay.Decoder` to the pool when it finishes, whether it encounters an error or not.

If it cannot find the right Decoding strategy for the type of the given pointer, it returns an `InvalidUnmarshalError`. You can test the error returned by doing `if ok := err.(InvalidUnmarshalError); ok {}`.

Unmarshal API comes with three functions:
* Unmarshal
```go
func Unmarshal(data []byte, v interface{}) error
```

* UnmarshalJSONObject
```go
func UnmarshalJSONObject(data []byte, v gojay.UnmarshalerJSONObject) error
```

* UnmarshalJSONArray
```go
func UnmarshalJSONArray(data []byte, v gojay.UnmarshalerJSONArray) error
```


### Decode API

Decode API decodes a `[]byte` to a given pointer by creating or borrowing a `*gojay.Decoder` with an `io.Reader` and calling `Decode` methods.

__Getting a *gojay.Decoder or Borrowing__

You can either get a fresh `*gojay.Decoder` calling `dec := gojay.NewDecoder(io.Reader)` or borrow one from the pool by calling `dec := gojay.BorrowDecoder(io.Reader)`.

After using a decoder, you can release it by calling `dec.Release()`. Beware, if you reuse the decoder after releasing it, it will panic with an error of type `InvalidUsagePooledDecoderError`. If you want to fully benefit from the pooling, you must release your decoders after using.

Example getting a fresh an releasing:
```go
str := ""
dec := gojay.NewDecoder(strings.NewReader(`"test"`))
defer dec.Release()
if err := dec.Decode(&str); err != nil {
    log.Fatal(err)
}
```
Example borrowing a decoder and releasing:
```go
str := ""
dec := gojay.BorrowDecoder(strings.NewReader(`"test"`))
defer dec.Release()
if err := dec.Decode(&str); err != nil {
    log.Fatal(err)
}
```

`*gojay.Decoder` has multiple methods to decode to specific types:
* Decode
```go
func (dec *gojay.Decoder) Decode(v interface{}) error
```
* DecodeObject
```go
func (dec *gojay.Decoder) DecodeObject(v gojay.UnmarshalerJSONObject) error
```
* DecodeArray
```go
func (dec *gojay.Decoder) DecodeArray(v gojay.UnmarshalerJSONArray) error
```
* DecodeInt
```go
func (dec *gojay.Decoder) DecodeInt(v *int) error
```
* DecodeBool
```go
func (dec *gojay.Decoder) DecodeBool(v *bool) error
```
* DecodeString
```go
func (dec *gojay.Decoder) DecodeString(v *string) error
```

All DecodeXxx methods are used to decode top level JSON values. If you are decoding keys or items of a JSON object or array, don't use the Decode methods.

Example:
```go
reader := strings.NewReader(`"John Doe"`)
dec := NewDecoder(reader)

var str string
err := dec.DecodeString(&str)
if err != nil {
    log.Fatal(err)
}

fmt.Println(str) // John Doe
```

### Structs and Maps
#### UnmarshalerJSONObject Interface

To unmarshal a JSON object to a structure, the structure must implement the `UnmarshalerJSONObject` interface:
```go
type UnmarshalerJSONObject interface {
	UnmarshalJSONObject(*gojay.Decoder, string) error
	NKeys() int
}
```
`UnmarshalJSONObject` method takes two arguments, the first one is a pointer to the Decoder (*gojay.Decoder) and the second one is the string value of the current key being parsed. If the JSON data is not an object, the UnmarshalJSONObject method will never be called.

`NKeys` method must return the number of keys to Unmarshal in the JSON object or 0. If zero is returned, all keys will be parsed.

Example of implementation for a struct:
```go
type user struct {
    id int
    name string
    email string
}
// implement UnmarshalerJSONObject
func (u *user) UnmarshalJSONObject(dec *gojay.Decoder, key string) error {
    switch key {
    case "id":
        return dec.Int(&u.id)
    case "name":
        return dec.String(&u.name)
    case "email":
        return dec.String(&u.email)
    }
    return nil
}
func (u *user) NKeys() int {
    return 3
}
```

Example of implementation for a `map[string]string`:
```go
// define our custom map type implementing UnmarshalerJSONObject
type message map[string]string

// Implementing Unmarshaler
func (m message) UnmarshalJSONObject(dec *gojay.Decoder, k string) error {
	str := ""
	err := dec.String(&str)
	if err != nil {
		return err
	}
	m[k] = str
	return nil
}

// we return 0, it tells the Decoder to decode all keys
func (m message) NKeys() int {
	return 0
}
```

### Arrays, Slices and Channels

To unmarshal a JSON object to a slice an array or a channel, it must implement the UnmarshalerJSONArray interface:
```go
type UnmarshalerJSONArray interface {
	UnmarshalJSONArray(*gojay.Decoder) error
}
```
UnmarshalJSONArray method takes one argument, a pointer to the Decoder (*gojay.Decoder). If the JSON data is not an array, the Unmarshal method will never be called.

Example of implementation with a slice:
```go
type testSlice []string
// implement UnmarshalerJSONArray
func (t *testSlice) UnmarshalJSONArray(dec *gojay.Decoder) error {
	str := ""
	if err := dec.String(&str); err != nil {
		return err
	}
	*t = append(*t, str)
	return nil
}

func main() {
	dec := gojay.BorrowDecoder(strings.NewReader(`["Tom", "Jim"]`))
	var slice testSlice
	err := dec.DecodeArray(&slice)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(slice) // [Tom Jim]
	dec.Release()
}
```

Example of implementation with a channel:
```go
type testChannel chan string
// implement UnmarshalerJSONArray
func (c testChannel) UnmarshalJSONArray(dec *gojay.Decoder) error {
	str := ""
	if err := dec.String(&str); err != nil {
		return err
	}
	c <- str
	return nil
}

func main() {
	dec := gojay.BorrowDecoder(strings.NewReader(`["Tom", "Jim"]`))
	c := make(testChannel, 2)
	err := dec.DecodeArray(c)
	if err != nil {
		log.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		fmt.Println(<-c)
	}
	close(c)
	dec.Release()
}
```

Example of implementation with an array:
```go
type testArray [3]string
// implement UnmarshalerJSONArray
func (a *testArray) UnmarshalJSONArray(dec *Decoder) error {
	var str string
	if err := dec.String(&str); err != nil {
		return err
	}
	a[dec.Index()] = str
	return nil
}

func main() {
	dec := gojay.BorrowDecoder(strings.NewReader(`["Tom", "Jim", "Bob"]`))
	var a testArray
	err := dec.DecodeArray(&a)
	fmt.Println(a) // [Tom Jim Bob]
	dec.Release()
}
```

### Other types
To decode other types (string, int, int32, int64, uint32, uint64, float, booleans), you don't need to implement any interface.

Example of encoding strings:
```go
func main() {
    json := []byte(`"Jay"`)
    var v string
    err := gojay.Unmarshal(json, &v)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(v) // Jay
}
```

### Decode values methods
When decoding a JSON object of a JSON array using `UnmarshalerJSONObject` or `UnmarshalerJSONArray` interface, the `gojay.Decoder` provides dozens of methods to Decode multiple types.

Non exhaustive list of methods available (to see all methods, check the godoc):
```go
dec.Int
dec.Int8
dec.Int16
dec.Int32
dec.Int64
dec.Uint8
dec.Uint16
dec.Uint32
dec.Uint64
dec.String
dec.Time
dec.Bool
dec.SQLNullString
dec.SQLNullInt64
```


## Encoding

Encoding is done through two different API similar to standard `encoding/json`:
* [Marshal](#marshal-api)
* [Encode](#encode-api)

Example of basic structure encoding with Marshal:
```go
import "github.com/francoispqt/gojay"

type user struct {
	id    int
	name  string
	email string
}

// implement MarshalerJSONObject
func (u *user) MarshalJSONObject(enc *gojay.Encoder) {
	enc.IntKey("id", u.id)
	enc.StringKey("name", u.name)
	enc.StringKey("email", u.email)
}
func (u *user) IsNil() bool {
	return u == nil
}

func main() {
	u := &user{1, "gojay", "gojay@email.com"}
	b, err := gojay.MarshalJSONObject(u)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(b)) // {"id":1,"name":"gojay","email":"gojay@email.com"}
}
```

with Encode:
```go
func main() {
	u := &user{1, "gojay", "gojay@email.com"}
	b := strings.Builder{}
	enc := gojay.NewEncoder(&b)
	if err := enc.Encode(u); err != nil {
		log.Fatal(err)
	}
	fmt.Println(b.String()) // {"id":1,"name":"gojay","email":"gojay@email.com"}
}
```

### Marshal API

Marshal API encodes a value to a JSON `[]byte` with a single function.

Behind the doors, Marshal API borrows a `*gojay.Encoder` resets its settings and encodes the data to an internal byte buffer and releases the `*gojay.Encoder` to the pool when it finishes, whether it encounters an error or not.

If it cannot find the right Encoding strategy for the type of the given value, it returns an `InvalidMarshalError`. You can test the error returned by doing `if ok := err.(InvalidMarshalError); ok {}`.

Marshal API comes with three functions:
* Marshal
```go
func Marshal(v interface{}) ([]byte, error)
```

* MarshalJSONObject
```go
func MarshalJSONObject(v gojay.MarshalerJSONObject) ([]byte, error)
```

* MarshalJSONArray
```go
func MarshalJSONArray(v gojay.MarshalerJSONArray) ([]byte, error)
```

### Encode API

Encode API decodes a value to JSON by creating or borrowing a `*gojay.Encoder` sending it to an `io.Writer` and calling `Encode` methods.

__Getting a *gojay.Encoder or Borrowing__

You can either get a fresh `*gojay.Encoder` calling `enc := gojay.NewEncoder(io.Writer)` or borrow one from the pool by calling `enc := gojay.BorrowEncoder(io.Writer)`.

After using an encoder, you can release it by calling `enc.Release()`. Beware, if you reuse the encoder after releasing it, it will panic with an error of type `InvalidUsagePooledEncoderError`. If you want to fully benefit from the pooling, you must release your encoders after using.

Example getting a fresh encoder an releasing:
```go
str := "test"
b := strings.Builder{}
enc := gojay.NewEncoder(&b)
defer enc.Release()
if err := enc.Encode(str); err != nil {
    log.Fatal(err)
}
```
Example borrowing an encoder and releasing:
```go
str := "test"
b := strings.Builder{}
enc := gojay.BorrowEncoder(b)
defer enc.Release()
if err := enc.Encode(str); err != nil {
    log.Fatal(err)
}
```

`*gojay.Encoder` has multiple methods to encoder specific types to JSON:
* Encode
```go
func (enc *gojay.Encoder) Encode(v interface{}) error
```
* EncodeObject
```go
func (enc *gojay.Encoder) EncodeObject(v gojay.MarshalerJSONObject) error
```
* EncodeArray
```go
func (enc *gojay.Encoder) EncodeArray(v gojay.MarshalerJSONArray) error
```
* EncodeInt
```go
func (enc *gojay.Encoder) EncodeInt(n int) error
```
* EncodeInt64
```go
func (enc *gojay.Encoder) EncodeInt64(n int64) error
```
* EncodeFloat
```go
func (enc *gojay.Encoder) EncodeFloat(n float64) error
```
* EncodeBool
```go
func (enc *gojay.Encoder) EncodeBool(v bool) error
```
* EncodeString
```go
func (enc *gojay.Encoder) EncodeString(s string) error
```

### Structs and Maps

To encode a structure, the structure must implement the MarshalerJSONObject interface:
```go
type MarshalerJSONObject interface {
	MarshalJSONObject(enc *gojay.Encoder)
	IsNil() bool
}
```
`MarshalJSONObject` method takes one argument, a pointer to the Encoder (*gojay.Encoder). The method must add all the keys in the JSON Object by calling Decoder's methods.

IsNil method returns a boolean indicating if the interface underlying value is nil or not. It is used to safely ensure that the underlying value is not nil without using Reflection.

Example of implementation for a struct:
```go
type user struct {
	id    int
	name  string
	email string
}

// implement MarshalerJSONObject
func (u *user) MarshalJSONObject(enc *gojay.Encoder) {
	enc.IntKey("id", u.id)
	enc.StringKey("name", u.name)
	enc.StringKey("email", u.email)
}
func (u *user) IsNil() bool {
	return u == nil
}
```

Example of implementation for a `map[string]string`:
```go
// define our custom map type implementing MarshalerJSONObject
type message map[string]string

// Implementing Marshaler
func (m message) MarshalJSONObject(enc *gojay.Encoder) {
	for k, v := range m {
		enc.StringKey(k, v)
	}
}

func (m message) IsNil() bool {
	return m == nil
}
```

### Arrays and Slices
To encode an array or a slice, the slice/array must implement the MarshalerJSONArray interface:
```go
type MarshalerJSONArray interface {
	MarshalJSONArray(enc *gojay.Encoder)
	IsNil() bool
}
```
`MarshalJSONArray` method takes one argument, a pointer to the Encoder (*gojay.Encoder). The method must add all element in the JSON Array by calling Decoder's methods.

`IsNil` method returns a boolean indicating if the interface underlying value is nil(empty) or not. It is used to safely ensure that the underlying value is not nil without using Reflection and also to in `OmitEmpty` feature.

Example of implementation:
```go
type users []*user
// implement MarshalerJSONArray
func (u *users) MarshalJSONArray(enc *gojay.Encoder) {
	for _, e := range u {
		enc.Object(e)
	}
}
func (u *users) IsNil() bool {
	return len(u) == 0
}
```

### Other types
To encode other types (string, int, float, booleans), you don't need to implement any interface.

Example of encoding strings:
```go
func main() {
	name := "Jay"
	b, err := gojay.Marshal(name)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(b)) // "Jay"
}
```

# Stream API

### Stream Decoding
GoJay ships with a powerful stream decoder.

It allows to read continuously from an io.Reader stream and do JIT decoding writing unmarshalled JSON to a channel to allow async consuming.

When using the Stream API, the Decoder implements context.Context to provide graceful cancellation.

To decode a stream of JSON, you must call `gojay.Stream.DecodeStream` and pass it a `UnmarshalerStream` implementation.

```go
type UnmarshalerStream interface {
	UnmarshalStream(*StreamDecoder) error
}
```

Example of implementation of stream reading from a WebSocket connection:
```go
// implement UnmarshalerStream
type ChannelStream chan *user

func (c ChannelStream) UnmarshalStream(dec *gojay.StreamDecoder) error {
	u := &user{}
	if err := dec.Object(u); err != nil {
		return err
	}
	c <- u
	return nil
}

func main() {
	// get our websocket connection
	origin := "http://localhost/"
	url := "ws://localhost:12345/ws"
	ws, err := websocket.Dial(url, "", origin)
	if err != nil {
		log.Fatal(err)
	}
	// create our channel which will receive our objects
	streamChan := ChannelStream(make(chan *user))
	// borrow a decoder
	dec := gojay.Stream.BorrowDecoder(ws)
	// start decoding, it will block until a JSON message is decoded from the WebSocket
	// or until Done channel is closed
	go dec.DecodeStream(streamChan)
	for {
		select {
		case v := <-streamChan:
			// Got something from my websocket!
			log.Println(v)
		case <-dec.Done():
			log.Println("finished reading from WebSocket")
			os.Exit(0)
		}
	}
}
```

### Stream Encoding
GoJay ships with a powerful stream encoder part of the Stream API.

It allows to write continuously to an io.Writer and do JIT encoding of data fed to a channel to allow async consuming. You can set multiple consumers on the channel to be as performant as possible. Consumers are non blocking and are scheduled individually in their own go routine.

When using the Stream API, the Encoder implements context.Context to provide graceful cancellation.

To encode a stream of data, you must call `EncodeStream` and pass it a `MarshalerStream` implementation.

```go
type MarshalerStream interface {
	MarshalStream(enc *gojay.StreamEncoder)
}
```

Example of implementation of stream writing to a WebSocket:
```go
// Our structure which will be pushed to our stream
type user struct {
	id    int
	name  string
	email string
}

func (u *user) MarshalJSONObject(enc *gojay.Encoder) {
	enc.IntKey("id", u.id)
	enc.StringKey("name", u.name)
	enc.StringKey("email", u.email)
}
func (u *user) IsNil() bool {
	return u == nil
}

// Our MarshalerStream implementation
type StreamChan chan *user

func (s StreamChan) MarshalStream(enc *gojay.StreamEncoder) {
	select {
	case <-enc.Done():
		return
	case o := <-s:
		enc.Object(o)
	}
}

// Our main function
func main() {
	// get our websocket connection
	origin := "http://localhost/"
	url := "ws://localhost:12345/ws"
	ws, err := websocket.Dial(url, "", origin)
	if err != nil {
		log.Fatal(err)
	}
	// we borrow an encoder set stdout as the writer,
	// set the number of consumer to 10
	// and tell the encoder to separate each encoded element
	// added to the channel by a new line character
	enc := gojay.Stream.BorrowEncoder(ws).NConsumer(10).LineDelimited()
	// instantiate our MarshalerStream
	s := StreamChan(make(chan *user))
	// start the stream encoder
	// will block its goroutine until enc.Cancel(error) is called
	// or until something is written to the channel
	go enc.EncodeStream(s)
	// write to our MarshalerStream
	for i := 0; i < 1000; i++ {
		s <- &user{i, "username", "user@email.com"}
	}
	// Wait
	<-enc.Done()
}
```

# Unsafe API

Unsafe API has the same functions than the regular API, it only has `Unmarshal API` for now. It is unsafe because it makes assumptions on the quality of the given JSON.

If you are not sure if your JSON is valid, don't use the Unsafe API.

Also, the `Unsafe` API does not copy the buffer when using Unmarshal API, which, in case of string decoding, can lead to data corruption if a byte buffer is reused. Using the `Decode` API makes `Unsafe` API safer as the io.Reader relies on `copy` builtin method and `Decoder` will have its own internal buffer :)

Access the `Unsafe` API this way:
```go
gojay.Unsafe.Unmarshal(b, v)
```


# Benchmarks

Benchmarks encode and decode three different data based on size (small, medium, large).

To run benchmark for decoder:
```bash
cd $GOPATH/src/github.com/francoispqt/gojay/benchmarks/decoder && make bench
```

To run benchmark for encoder:
```bash
cd $GOPATH/src/github.com/francoispqt/gojay/benchmarks/encoder && make bench
```

# Benchmark Results
## Decode

<img src="https://images2.imgbox.com/78/01/49OExcPh_o.png" width="500px">

### Small Payload
[benchmark code is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/decoder/decoder_bench_small_test.go)

[benchmark data is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/benchmarks_small.go)

|                 | ns/op     | bytes/op     | allocs/op |
|-----------------|-----------|--------------|-----------|
| Std Library     | 2547      | 496          | 4         |
| JsonIter        | 2046      | 312          | 12        |
| JsonParser      | 1408      | 0            | 0         |
| EasyJson        | 929       | 240          | 2         |
| **GoJay**       | **807**   | **256**      | **2**     |
| **GoJay-unsafe**| **712**   | **112**      | **1**     |

### Medium Payload
[benchmark code is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/decoder/decoder_bench_medium_test.go)

[benchmark data is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/benchmarks_medium.go)

|                 | ns/op     | bytes/op | allocs/op |
|-----------------|-----------|----------|-----------|
| Std Library     | 30148     | 2152     | 496       |
| JsonIter        | 16309     | 2976     | 80        |
| JsonParser      | 7793      | 0        | 0         |
| EasyJson        | 7957      | 232      | 6         |
| **GoJay**       | **4984**  | **2448** | **8**     |
| **GoJay-unsafe**| **4809**  | **144**  | **7**     |

### Large Payload
[benchmark code is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/decoder/decoder_bench_large_test.go)

[benchmark data is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/benchmarks_large.go)

|                 | ns/op     | bytes/op    | allocs/op |
|-----------------|-----------|-------------|-----------|
| JsonIter        | 210078    | 41712       | 1136      |
| EasyJson        | 106626    | 160         | 2         |
| JsonParser      | 66813     | 0           | 0         |
| **GoJay**       | **52153** | **31241**   | **77**    |
| **GoJay-unsafe**| **48277** | **2561**    | **76**    |

## Encode

<img src="https://images2.imgbox.com/e9/cc/pnM8c7Gf_o.png" width="500px">

### Small Struct
[benchmark code is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/encoder/encoder_bench_small_test.go)

[benchmark data is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/benchmarks_small.go)

|                | ns/op    | bytes/op     | allocs/op |
|----------------|----------|--------------|-----------|
| Std Library    | 1280     | 464          | 3         |
| EasyJson       | 871      | 944          | 6         |
| JsonIter       | 866      | 272          | 3         |
| **GoJay**      | **543**  | **112**      | **1**     |
| **GoJay-func** | **347**  | **0**        | **0**     |

### Medium Struct
[benchmark code is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/encoder/encoder_bench_medium_test.go)

[benchmark data is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/benchmarks_medium.go)

|             | ns/op    | bytes/op     | allocs/op |
|-------------|----------|--------------|-----------|
| Std Library | 5006     | 1496         | 25        |
| JsonIter    | 2232     | 1544         | 20        |
| EasyJson    | 1997     | 1544         | 19        |
| **GoJay**   | **1522** | **312**      | **14**    |

### Large Struct
[benchmark code is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/encoder/encoder_bench_large_test.go)

[benchmark data is here](https://github.com/francoispqt/gojay/blob/master/benchmarks/benchmarks_large.go)

|             | ns/op     | bytes/op     | allocs/op |
|-------------|-----------|--------------|-----------|
| Std Library | 66441     | 20576        | 332       |
| JsonIter    | 35247     | 20255        | 328       |
| EasyJson    | 32053     | 15474        | 327       |
| **GoJay**   | **27847** | **9802**     | **318**   |

# Contributing

Contributions are welcome :)

If you encounter issues please report it in Github and/or send an email at [francois@parquet.ninja](mailto:francois@parquet.ninja)

