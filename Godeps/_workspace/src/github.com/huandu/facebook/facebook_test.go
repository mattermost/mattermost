// A facebook graph api client in go.
// https://github.com/huandu/facebook/
//
// Copyright 2012 - 2015, Huan Du
// Licensed under the MIT license
// https://github.com/huandu/facebook/blob/master/LICENSE

package facebook

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

const (
	FB_TEST_APP_ID     = "169186383097898"
	FB_TEST_APP_SECRET = "b2e4262c306caa3c7f5215d2d099b319"

	// remeber to change it to a valid token to run test
	//FB_TEST_VALID_ACCESS_TOKEN = "CAACZA38ZAD8CoBAFCaVgLBNdz0RrH45yUBUA95exI1FY5i4mZBY5iULfM3YEpS53nP6eSF4cf3nmoiePHvMkdSZApkxu1heAupW7OE8tmiySRZAYkZBZBvhveCZCgPaJlFovlI0ZAhWdWTLxxmJaZCKDG0B8n9VGEvcN3zoS1AHjokSz4aNos39xthp7XtAz9X3NRvp1qU4UTOlxK8IJOC1ApAMmvcEE0kWvgZD"
	FB_TEST_VALID_ACCESS_TOKEN = ""

	// remember to change it to a valid signed request to run test
	//FB_TEST_VALID_SIGNED_REQUEST = "ZAxP-ILRQBOwKKxCBMNlGmVraiowV7WFNg761OYBNGc.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImV4cGlyZXMiOjEzNDM0OTg0MDAsImlzc3VlZF9hdCI6MTM0MzQ5MzI2NSwib2F1dGhfdG9rZW4iOiJBQUFDWkEzOFpBRDhDb0JBRFpCcmZ5TFpDanBNUVczdThVTWZmRldSWkNpZGw5Tkx4a1BsY2tTcXZaQnpzTW9OWkF2bVk2RUd2NG1hUUFaQ0t2VlpBWkJ5VXA5a0FCU2x6THFJejlvZTdOdHBzdzhyQVpEWkQiLCJ1c2VyIjp7ImNvdW50cnkiOiJ1cyIsImxvY2FsZSI6ImVuX1VTIiwiYWdlIjp7Im1pbiI6MjF9fSwidXNlcl9pZCI6IjUzODc0NDQ2OCJ9"
	FB_TEST_VALID_SIGNED_REQUEST = ""

	// test binary file base64 value
	FB_TEST_BINARY_JPG_FILE = "/9j/4AAQSkZJRgABAQEASABIAAD/4gv4SUNDX1BST0ZJTEUAAQEAAAvoAAAAAAIAAABtbnRy" +
		"UkdCIFhZWiAH2QADABsAFQAkAB9hY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAA" +
		"9tYAAQAAAADTLQAAAAAp+D3er/JVrnhC+uTKgzkNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
		"AAAAAAAAABBkZXNjAAABRAAAAHliWFlaAAABwAAAABRiVFJDAAAB1AAACAxkbWRkAAAJ4AAA" +
		"AIhnWFlaAAAKaAAAABRnVFJDAAAB1AAACAxsdW1pAAAKfAAAABRtZWFzAAAKkAAAACRia3B0" +
		"AAAKtAAAABRyWFlaAAAKyAAAABRyVFJDAAAB1AAACAx0ZWNoAAAK3AAAAAx2dWVkAAAK6AAA" +
		"AId3dHB0AAALcAAAABRjcHJ0AAALhAAAADdjaGFkAAALvAAAACxkZXNjAAAAAAAAAB9zUkdC" +
		"IElFQzYxOTY2LTItMSBibGFjayBzY2FsZWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
		"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
		"WFlaIAAAAAAAACSgAAAPhAAAts9jdXJ2AAAAAAAABAAAAAAFAAoADwAUABkAHgAjACgALQAy" +
		"ADcAOwBAAEUASgBPAFQAWQBeAGMAaABtAHIAdwB8AIEAhgCLAJAAlQCaAJ8ApACpAK4AsgC3" +
		"ALwAwQDGAMsA0ADVANsA4ADlAOsA8AD2APsBAQEHAQ0BEwEZAR8BJQErATIBOAE+AUUBTAFS" +
		"AVkBYAFnAW4BdQF8AYMBiwGSAZoBoQGpAbEBuQHBAckB0QHZAeEB6QHyAfoCAwIMAhQCHQIm" +
		"Ai8COAJBAksCVAJdAmcCcQJ6AoQCjgKYAqICrAK2AsECywLVAuAC6wL1AwADCwMWAyEDLQM4" +
		"A0MDTwNaA2YDcgN+A4oDlgOiA64DugPHA9MD4APsA/kEBgQTBCAELQQ7BEgEVQRjBHEEfgSM" +
		"BJoEqAS2BMQE0wThBPAE/gUNBRwFKwU6BUkFWAVnBXcFhgWWBaYFtQXFBdUF5QX2BgYGFgYn" +
		"BjcGSAZZBmoGewaMBp0GrwbABtEG4wb1BwcHGQcrBz0HTwdhB3QHhgeZB6wHvwfSB+UH+AgL" +
		"CB8IMghGCFoIbgiCCJYIqgi+CNII5wj7CRAJJQk6CU8JZAl5CY8JpAm6Cc8J5Qn7ChEKJwo9" +
		"ClQKagqBCpgKrgrFCtwK8wsLCyILOQtRC2kLgAuYC7ALyAvhC/kMEgwqDEMMXAx1DI4MpwzA" +
		"DNkM8w0NDSYNQA1aDXQNjg2pDcMN3g34DhMOLg5JDmQOfw6bDrYO0g7uDwkPJQ9BD14Peg+W" +
		"D7MPzw/sEAkQJhBDEGEQfhCbELkQ1xD1ERMRMRFPEW0RjBGqEckR6BIHEiYSRRJkEoQSoxLD" +
		"EuMTAxMjE0MTYxODE6QTxRPlFAYUJxRJFGoUixStFM4U8BUSFTQVVhV4FZsVvRXgFgMWJhZJ" +
		"FmwWjxayFtYW+hcdF0EXZReJF64X0hf3GBsYQBhlGIoYrxjVGPoZIBlFGWsZkRm3Gd0aBBoq" +
		"GlEadxqeGsUa7BsUGzsbYxuKG7Ib2hwCHCocUhx7HKMczBz1HR4dRx1wHZkdwx3sHhYeQB5q" +
		"HpQevh7pHxMfPh9pH5Qfvx/qIBUgQSBsIJggxCDwIRwhSCF1IaEhziH7IiciVSKCIq8i3SMK" +
		"IzgjZiOUI8Ij8CQfJE0kfCSrJNolCSU4JWgllyXHJfcmJyZXJocmtyboJxgnSSd6J6sn3CgN" +
		"KD8ocSiiKNQpBik4KWspnSnQKgIqNSpoKpsqzysCKzYraSudK9EsBSw5LG4soizXLQwtQS12" +
		"Last4S4WLkwugi63Lu4vJC9aL5Evxy/+MDUwbDCkMNsxEjFKMYIxujHyMioyYzKbMtQzDTNG" +
		"M38zuDPxNCs0ZTSeNNg1EzVNNYc1wjX9Njc2cjauNuk3JDdgN5w31zgUOFA4jDjIOQU5Qjl/" +
		"Obw5+To2OnQ6sjrvOy07azuqO+g8JzxlPKQ84z0iPWE9oT3gPiA+YD6gPuA/IT9hP6I/4kAj" +
		"QGRApkDnQSlBakGsQe5CMEJyQrVC90M6Q31DwEQDREdEikTORRJFVUWaRd5GIkZnRqtG8Ec1" +
		"R3tHwEgFSEtIkUjXSR1JY0mpSfBKN0p9SsRLDEtTS5pL4kwqTHJMuk0CTUpNk03cTiVObk63" +
		"TwBPSU+TT91QJ1BxULtRBlFQUZtR5lIxUnxSx1MTU19TqlP2VEJUj1TbVShVdVXCVg9WXFap" +
		"VvdXRFeSV+BYL1h9WMtZGllpWbhaB1pWWqZa9VtFW5Vb5Vw1XIZc1l0nXXhdyV4aXmxevV8P" +
		"X2Ffs2AFYFdgqmD8YU9homH1YklinGLwY0Njl2PrZEBklGTpZT1lkmXnZj1mkmboZz1nk2fp" +
		"aD9olmjsaUNpmmnxakhqn2r3a09rp2v/bFdsr20IbWBtuW4SbmtuxG8eb3hv0XArcIZw4HE6" +
		"cZVx8HJLcqZzAXNdc7h0FHRwdMx1KHWFdeF2Pnabdvh3VnezeBF4bnjMeSp5iXnnekZ6pXsE" +
		"e2N7wnwhfIF84X1BfaF+AX5ifsJ/I3+Ef+WAR4CogQqBa4HNgjCCkoL0g1eDuoQdhICE44VH" +
		"hauGDoZyhteHO4efiASIaYjOiTOJmYn+imSKyoswi5aL/IxjjMqNMY2Yjf+OZo7OjzaPnpAG" +
		"kG6Q1pE/kaiSEZJ6kuOTTZO2lCCUipT0lV+VyZY0lp+XCpd1l+CYTJi4mSSZkJn8mmia1ZtC" +
		"m6+cHJyJnPedZJ3SnkCerp8dn4uf+qBpoNihR6G2oiailqMGo3aj5qRWpMelOKWpphqmi6b9" +
		"p26n4KhSqMSpN6mpqhyqj6sCq3Wr6axcrNCtRK24ri2uoa8Wr4uwALB1sOqxYLHWskuywrM4" +
		"s660JbSctRO1irYBtnm28Ldot+C4WbjRuUq5wro7urW7LrunvCG8m70VvY++Cr6Evv+/er/1" +
		"wHDA7MFnwePCX8Lbw1jD1MRRxM7FS8XIxkbGw8dBx7/IPci8yTrJuco4yrfLNsu2zDXMtc01" +
		"zbXONs62zzfPuNA50LrRPNG+0j/SwdNE08bUSdTL1U7V0dZV1tjXXNfg2GTY6Nls2fHadtr7" +
		"24DcBdyK3RDdlt4c3qLfKd+v4DbgveFE4cziU+Lb42Pj6+Rz5PzlhOYN5pbnH+ep6DLovOlG" +
		"6dDqW+rl63Dr++yG7RHtnO4o7rTvQO/M8Fjw5fFy8f/yjPMZ86f0NPTC9VD13vZt9vv3ivgZ" +
		"+Kj5OPnH+lf65/t3/Af8mP0p/br+S/7c/23//2Rlc2MAAAAAAAAALklFQyA2MTk2Ni0yLTEg" +
		"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"
)

var (
	testGlobalApp = New(FB_TEST_APP_ID, FB_TEST_APP_SECRET)
)

type AllTypes struct {
	Int          int
	Int8         int8
	Int16        int16
	Int32        int32
	Int64        int64
	Uint         uint
	Uint8        uint8
	Uint16       uint16
	Uint32       uint32
	Uint64       uint64
	Float32      float32
	Float64      float64
	String       string
	ArrayOfInt   []int
	MapOfString  map[string]string
	NestedStruct *NestedStruct
}

type NestedStruct struct {
	Int           int
	String        string
	ArrayOfString []string
}

type ParamsStruct struct {
	Foo string
	Bar *ParamsNestedStruct
}

type ParamsNestedStruct struct {
	AAA int
	BBB string
	CCC bool
}

type FieldTagStruct struct {
	Field1    string `facebook:"field2"`
	Required  string `facebook:",required"`
	Foo       string `facebook:"bar,required"`
	CanAbsent string
}

type MessageTag struct {
	Id   string
	Name string
	Type string
}

type MessageTags map[string][]*MessageTag

type NullStruct struct {
	Null *int
}

func TestApiGetUserInfoV2(t *testing.T) {
	Version = "v2.2"
	defer func() {
		Version = ""
	}()

	// It's not allowed to get user info by name. So I get "me" with access token instead.
	if FB_TEST_VALID_ACCESS_TOKEN != "" {
		me, err := Api("me", GET, Params{
			"access_token": FB_TEST_VALID_ACCESS_TOKEN,
		})

		if err != nil {
			t.Fatalf("cannot get my info. [e:%v]", err)
		}

		if e := me.Err(); e != nil {
			t.Fatalf("facebook returns error. [e:%v]", e)
		}

		t.Logf("my info. %v", me)
	}
}

func TestBatchApiGetInfo(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("cannot call batch api without access token. skip this test.")
	}

	verifyBatchResult := func(t *testing.T, index int, res Result) {
		batch, err := res.Batch()

		if err != nil {
			t.Fatalf("cannot parse batch api results[%v]. [e:%v] [result:%v]", index, err, res)
		}

		if batch.StatusCode != 200 {
			t.Fatalf("facebook returns unexpected http status code in results[%v]. [code:%v] [result:%v]", index, batch.StatusCode, res)
		}

		contentType := batch.Header.Get("Content-Type")

		if contentType == "" {
			t.Fatalf("facebook returns unexpected http header in results[%v]. [header:%v]", index, batch.Header)
		}

		if batch.Body == "" {
			t.Fatalf("facebook returns unexpected http body in results[%v]. [body:%v]", index, batch.Body)
		}

		var id string
		err = batch.Result.DecodeField("id", &id)

		if err != nil {
			t.Fatalf("cannot get 'id' field in results[%v]. [result:%v]", index, res)
		}

		if id == "" {
			t.Fatalf("facebook should return account id in results[%v].", index)
		}
	}

	test := func(t *testing.T) {
		params1 := Params{
			"method":       GET,
			"relative_url": "me",
		}
		params2 := Params{
			"method":       GET,
			"relative_url": uint64(100002828925788), // id of my another facebook account
		}

		results, err := BatchApi(FB_TEST_VALID_ACCESS_TOKEN, params1, params2)

		if err != nil {
			t.Fatalf("cannot get batch result. [e:%v]", err)
		}

		if len(results) != 2 {
			t.Fatalf("batch api should return results in an array with 2 entries. [len:%v]", len(results))
		}

		if Version == "" {
			t.Log("use default facebook version.")
		} else {
			t.Logf("global facebook version: %v", Version)
		}

		for index, result := range results {
			verifyBatchResult(t, index, result)
		}
	}

	// Use default Version.
	Version = ""
	test(t)

	// User "v2.2".
	Version = "v2.2"
	defer func() {
		Version = ""
	}()
	test(t)

	// when providing an invalid access token, BatchApi should return a facebook error.
	_, err := BatchApi("an_invalid_access_token", Params{
		"method":       GET,
		"relative_url": "me",
	})

	if err == nil {
		t.Fatalf("expect an error when providing an invalid access token to BatchApi.")
	}

	if _, ok := err.(*Error); !ok {
		t.Fatalf("batch result error must be an *Error. [e:%v]", err)
	}
}

func TestApiParseSignedRequest(t *testing.T) {
	if FB_TEST_VALID_SIGNED_REQUEST == "" {
		t.Logf("skip this case as we don't have a valid signed request.")
		return
	}

	app := New(FB_TEST_APP_ID, FB_TEST_APP_SECRET)
	res, err := app.ParseSignedRequest(FB_TEST_VALID_SIGNED_REQUEST)

	if err != nil {
		t.Fatalf("cannot parse signed request. [e:%v]", err)
	}

	t.Logf("signed request is '%v'.", res)
}

func TestSession(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("skip this case as we don't have a valid access token.")
	}

	session := &Session{}
	session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)

	test := func(t *testing.T, session *Session) {
		id, err := session.User()

		if err != nil {
			t.Fatalf("cannot get current user id. [e:%v]", err)
		}

		t.Logf("current user id is %v", id)

		result, e := session.Api("/me", GET, Params{
			"fields": "id,email,website",
		})

		if e != nil {
			t.Fatalf("cannot get my extended info. [e:%v]", e)
		}

		if Version == "" {
			t.Log("use default facebook version.")
		} else {
			t.Logf("global facebook version: %v", Version)
		}

		if session.Version == "" {
			t.Log("use default session facebook version.")
		} else {
			t.Logf("session facebook version: %v", session.Version)
		}

		t.Logf("my extended info is: %v", result)
	}

	// Default version.
	test(t, session)

	// Global version overwrite default session version.
	func() {
		Version = "v2.2"
		defer func() {
			Version = ""
		}()

		test(t, session)
	}()

	// Session version overwrite default version.
	func() {
		Version = "vx.y" // an invalid version.
		session.Version = "v2.2"
		defer func() {
			Version = ""
		}()

		test(t, session)
	}()

	// Session with appsecret proof enabled.
	if FB_TEST_VALID_ACCESS_TOKEN != "" {
		app := New(FB_TEST_APP_ID, FB_TEST_APP_SECRET)
		app.EnableAppsecretProof = true
		session := app.Session(FB_TEST_VALID_ACCESS_TOKEN)

		_, e := session.Api("/me", GET, Params{
			"fields": "id",
		})

		if e != nil {
			t.Fatalf("cannot get my info with proof. [e:%v]", e)
		}
	}
}

func TestUploadingBinary(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("skip this case as we don't have a valid access token.")
	}

	buf := bytes.NewBufferString(FB_TEST_BINARY_JPG_FILE)
	reader := base64.NewDecoder(base64.StdEncoding, buf)

	session := &Session{}
	session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)

	result, e := session.Api("/me/photos", POST, Params{
		"message": "Test photo from https://github.com/huandu/facebook",
		"source":  Data("my_profile.jpg", reader),
	})

	if e != nil {
		t.Fatalf("cannot create photo on my timeline. [e:%v]", e)
	}

	var id string
	e = result.DecodeField("id", &id)

	if e != nil {
		t.Fatalf("facebook should return photo id on success. [e:%v]", e)
	}

	t.Logf("newly created photo id is %v", id)
}

func TestUploadBinaryWithBatch(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("skip this case as we don't have a valid access token.")
	}

	buf1 := bytes.NewBufferString(FB_TEST_BINARY_JPG_FILE)
	reader1 := base64.NewDecoder(base64.StdEncoding, buf1)
	buf2 := bytes.NewBufferString(FB_TEST_BINARY_JPG_FILE)
	reader2 := base64.NewDecoder(base64.StdEncoding, buf2)

	session := &Session{}
	session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)

	// sample comes from facebook batch api sample.
	// https://developers.facebook.com/docs/reference/api/batch/
	//
	// curl
	//     -F 'access_token=…' \
	//     -F 'batch=[{"method":"POST","relative_url":"me/photos","body":"message=My cat photo","attached_files":"file1"},{"method":"POST","relative_url":"me/photos","body":"message=My dog photo","attached_files":"file2"},]' \
	//     -F 'file1=@cat.gif' \
	//     -F 'file2=@dog.jpg' \
	//         https://graph.facebook.com
	result, e := session.Batch(Params{
		"file1": Data("cat.jpg", reader1),
		"file2": Data("dog.jpg", reader2),
	}, Params{
		"method":         POST,
		"relative_url":   "me/photos",
		"body":           "message=My cat photo",
		"attached_files": "file1",
	}, Params{
		"method":         POST,
		"relative_url":   "me/photos",
		"body":           "message=My dog photo",
		"attached_files": "file2",
	})

	if e != nil {
		t.Fatalf("cannot create photo on my timeline. [e:%v]", e)
	}

	t.Logf("batch call result. [result:%v]", result)
}

func TestSimpleFQL(t *testing.T) {
	defer func() {
		Version = ""
	}()

	test := func(t *testing.T, session *Session) {
		me, err := session.FQL("SELECT name FROM user WHERE uid = 538744468")

		if err != nil {
			t.Fatalf("cannot get my info. [e:%v]", err)
		}

		if len(me) != 1 {
			t.Fatalf("expect to get only 1 result. [len:%v]", len(me))
		}

		t.Logf("my name. %v", me[0]["name"])
	}

	// v2.2 api doesn't allow me to query user without access token.
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		return
	}

	Version = "v2.2"
	session := &Session{}
	session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)
	test(t, session)
}

func TestMultiFQL(t *testing.T) {
	defer func() {
		Version = ""
	}()

	test := func(t *testing.T, session *Session) {
		res, err := session.MultiFQL(Params{
			"query1": "SELECT username FROM page WHERE page_id = 20531316728",
			"query2": "SELECT uid FROM user WHERE uid = 538744468",
		})

		if err != nil {
			t.Fatalf("cannot get my info. [e:%v]", err)
		}

		if err = res.Err(); err != nil {
			t.Fatalf("fail to parse facebook api error. [e:%v]", err)
		}

		var query1, query2 []Result

		err = res.DecodeField("query1", &query1)

		if err != nil {
			t.Fatalf("cannot get result of query1. [e:%v]", err)
		}

		if len(query1) != 1 {
			t.Fatalf("expect to get only 1 result in query1. [len:%v]", len(query1))
		}

		err = res.DecodeField("query2", &query2)

		if err != nil {
			t.Fatalf("cannot get result of query2. [e:%v]", err)
		}

		if len(query2) != 1 {
			t.Fatalf("expect to get only 1 result in query2. [len:%v]", len(query2))
		}

		var username string
		var uid string

		err = query1[0].DecodeField("username", &username)

		if err != nil {
			t.Fatalf("cannot decode username from query1. [e:%v]", err)
		}

		if username != "facebook" {
			t.Fatalf("username is expected to be 'facebook'. [username:%v]", username)
		}

		err = query2[0].DecodeField("uid", &uid)

		if err != nil {
			t.Fatalf("cannot decode username from query2. [e:%v] [query2:%v]", err, query2)
		}

		if uid != "538744468" {
			t.Fatalf("username is expected to be 'facebook'. [username:%v]", username)
		}
	}

	// v2.2 api doesn't allow me to query user without access token.
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		return
	}

	Version = "v2.2"
	session := &Session{}
	session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)
	test(t, session)
}

func TestGraphDebuggingAPI(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("cannot call batch api without access token. skip this test.")
	}

	test := func(t *testing.T, session *Session) {
		session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)
		defer session.SetAccessToken("")

		// test app must not grant "read_friendlists" permission.
		// otherwise there is no way to get a warning from facebook.
		res, _ := session.Get("/me/friendlists", nil)

		if res == nil {
			t.Fatalf("res must not be nil.")
		}

		debugInfo := res.DebugInfo()

		if debugInfo == nil {
			t.Fatalf("debug info must exist.")
		}

		t.Logf("facebook response is: %v", res)
		t.Logf("debug info is: %v", *debugInfo)

		if debugInfo.Messages == nil && len(debugInfo.Messages) > 0 {
			t.Fatalf("facebook must warn me for the permission issue.")
		}

		msg := debugInfo.Messages[0]

		if msg.Type == "" || msg.Message == "" {
			t.Fatalf("facebook must say something. [msg:%v]", msg)
		}

		if debugInfo.FacebookApiVersion == "" {
			t.Fatalf("facebook must tell me api version.")
		}

		if debugInfo.FacebookDebug == "" {
			t.Fatalf("facebook must tell me X-FB-Debug.")
		}

		if debugInfo.FacebookRev == "" {
			t.Fatalf("facebook must tell me x-fb-rev.")
		}
	}

	defer func() {
		Debug = DEBUG_OFF
		Version = ""
	}()

	Version = "v2.2"
	Debug = DEBUG_ALL
	test(t, defaultSession)
	session := &Session{}
	session.SetDebug(DEBUG_ALL)
	test(t, session)

	// test changing debug mode.
	old := session.SetDebug(DEBUG_OFF)

	if old != DEBUG_ALL {
		t.Fatalf("debug mode must be DEBUG_ALL. [debug:%v]", old)
	}

	if session.Debug() != DEBUG_ALL {
		t.Fatalf("debug mode must be DEBUG_ALL [debug:%v]", session.Debug())
	}

	Debug = DEBUG_OFF

	if session.Debug() != DEBUG_OFF {
		t.Fatalf("debug mode must be DEBUG_OFF. [debug:%v]", session.Debug())
	}
}

func TestResultDecode(t *testing.T) {
	strNormal := `{
        "int": 1234,
        "int8": 23,
        "int16": 12345,
        "int32": -127372843,
        "int64": 192438483489298,
        "uint": 1283829,
        "uint8": 233,
        "uint16": 62121,
        "uint32": 3083747392,
        "uint64": 2034857382993849,
        "float32": 9382.38429,
        "float64": 3984.293848292,
        "map_of_string": {"a": "1", "b": "2"},
        "array_of_int": [12, 34, 56],
        "string": "abcd",
        "notused": 1234,
        "nested_struct": {
            "string": "hello",
            "int": 123,
            "array_of_string": ["a", "b", "c"]
        }
    }`
	strOverflow := `{
        "int": 1234,
        "int8": 23,
        "int16": 12345,
        "int32": -127372843,
        "int64": 192438483489298,
        "uint": 1283829,
        "uint8": 233,
        "uint16": 62121,
        "uint32": 383083747392,
        "uint64": 2034857382993849,
        "float32": 9382.38429,
        "float64": 3984.293848292,
        "string": "abcd",
        "map_of_string": {"a": "1", "b": "2"},
        "array_of_int": [12, 34, 56],
        "string": "abcd",
        "notused": 1234,
        "nested_struct": {
            "string": "hello",
            "int": 123,
            "array_of_string": ["a", "b", "c"]
        }
    }`
	strMissAField := `{
        "int": 1234,
        "int8": 23,
        "int16": 12345,
        "int32": -127372843,

        "missed": "int64",

        "uint": 1283829,
        "uint8": 233,
        "uint16": 62121,
        "uint32": 383083747392,
        "uint64": 2034857382993849,
        "float32": 9382.38429,
        "float64": 3984.293848292,
        "string": "abcd",
        "map_of_string": {"a": "1", "b": "2"},
        "array_of_int": [12, 34, 56],
        "string": "abcd",
        "notused": 1234,
        "nested_struct": {
            "string": "hello",
            "int": 123,
            "array_of_string": ["a", "b", "c"]
        }
    }`
	var result Result
	var err error
	var normal, withError AllTypes
	var anInt int

	err = json.Unmarshal([]byte(strNormal), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&normal)

	if err != nil {
		t.Fatalf("cannot decode normal struct. [e:%v]", err)
	}

	err = json.Unmarshal([]byte(strOverflow), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&withError)

	if err == nil {
		t.Fatalf("struct should be overflow")
	}

	t.Logf("overflow struct. e:%v", err)

	err = json.Unmarshal([]byte(strMissAField), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&withError)

	if err == nil {
		t.Fatalf("a field in struct should absent in json map.")
	}

	t.Logf("miss-a-field struct. e:%v", err)

	err = result.DecodeField("array_of_int.2", &anInt)

	if err != nil {
		t.Fatalf("cannot decode array item. [e:%v]", err)
	}

	if anInt != 56 {
		t.Fatalf("invalid array value. expected 56, actual %v", anInt)
	}

	err = result.DecodeField("nested_struct.int", &anInt)

	if err != nil {
		t.Fatalf("cannot decode nested struct item. [e:%v]", err)
	}

	if anInt != 123 {
		t.Fatalf("invalid array value. expected 123, actual %v", anInt)
	}
}

func TestParamsEncode(t *testing.T) {
	var params Params
	buf := &bytes.Buffer{}

	if mime, err := params.Encode(buf); err != nil || mime != _MIME_FORM_URLENCODED || buf.Len() != 0 {
		t.Fatalf("empty params must encode to an empty string. actual is [e:%v] [str:%v] [mime:%v]", err, buf.String(), mime)
	}

	buf.Reset()
	params = Params{}
	params["need_escape"] = "&=+"
	expectedEncoding := "need_escape=%26%3D%2B"

	if mime, err := params.Encode(buf); err != nil || mime != _MIME_FORM_URLENCODED || buf.String() != expectedEncoding {
		t.Fatalf("wrong params encode result. expected is '%v'. actual is '%v'. [e:%v] [mime:%v]", expectedEncoding, buf.String(), err, mime)
	}

	buf.Reset()
	data := ParamsStruct{
		Foo: "hello, world!",
		Bar: &ParamsNestedStruct{
			AAA: 1234,
			BBB: "bbb",
			CCC: true,
		},
	}
	params = MakeParams(data)
	/* there is no easy way to compare two encoded maps. so i just write expect map here, not test it.
	   expectedParams := Params{
	       "foo": "hello, world!",
	       "bar": map[string]interface{}{
	           "aaa": 1234,
	           "bbb": "bbb",
	           "ccc": true,
	       },
	   }
	*/

	if params == nil {
		t.Fatalf("make params error.")
	}

	mime, err := params.Encode(buf)
	t.Logf("complex encode result is '%v'. [e:%v] [mime:%v]", buf.String(), err, mime)
}

func TestStructFieldTag(t *testing.T) {
	strNormalField := `{
        "field2": "hey",
        "required": "my",
        "bar": "dear"
    }`
	strMissingField2Field := `{
        "field1": "hey",
        "required": "my",
        "bar": "dear"
    }`
	strMissingRequiredField := `{
        "field1": "hey",
        "bar": "dear",
        "can_absent": "babe"
    }`
	strMissingBarField := `{
        "field1": "hey",
        "required": "my"
    }`

	var result Result
	var value FieldTagStruct
	var err error

	err = json.Unmarshal([]byte(strNormalField), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&value)

	if err != nil {
		t.Fatalf("cannot decode struct. [e:%v]", err)
	}

	result = Result{}
	value = FieldTagStruct{}
	err = json.Unmarshal([]byte(strMissingField2Field), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&value)

	if err != nil {
		t.Fatalf("cannot decode struct. [e:%v]", err)
	}

	if value.Field1 != "" {
		t.Fatalf("value field1 should be kept unchanged. [field1:%v]", value.Field1)
	}

	result = Result{}
	value = FieldTagStruct{}
	err = json.Unmarshal([]byte(strMissingRequiredField), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&value)

	if err == nil {
		t.Fatalf("should fail to decode struct.")
	}

	t.Logf("expected decode error. [e:%v]", err)

	result = Result{}
	value = FieldTagStruct{}
	err = json.Unmarshal([]byte(strMissingBarField), &result)

	if err != nil {
		t.Fatalf("cannot unmarshal json string. [e:%v]", err)
	}

	err = result.Decode(&value)

	if err == nil {
		t.Fatalf("should fail to decode struct.")
	}

	t.Logf("expected decode error. [e:%v]", err)
}

type myTime time.Time

func TestDecodeField(t *testing.T) {
	jsonStr := `{
        "int": 1234,
        "array": ["abcd", "efgh"],
        "map": {
            "key1": 5678,
            "nested_map": {
                "key2": "ijkl",
                "key3": [{
                    "key4": "mnop"
                }, {
                    "key5": 9012
                }]
            }
        },
        "message_tags": {
            "2": [
                {
                    "id": "4838901",
                    "name": "Foo Bar",
                    "type": "page"
                },
                {
                    "id": "293450302",
                    "name": "Player Rocks",
                    "type": "page"
                }
            ]
        },
        "nullStruct": {
        	"null": null
        },
        "timestamp": "2015-01-03T11:15:01+0000",
        "custom_timestamp": "2014-03-04T11:15:01+0000"
    }`

	var result Result
	var err error
	var anInt int
	var aString string
	var aSlice []string
	var subResults []Result
	var aNull NullStruct = NullStruct{
		Null: &anInt,
	}
	var aTimestamp time.Time
	var aCustomTimestamp myTime

	err = json.Unmarshal([]byte(jsonStr), &result)

	if err != nil {
		t.Fatalf("invalid json string. [e:%v]", err)
	}

	err = result.DecodeField("int", &anInt)

	if err != nil {
		t.Fatalf("cannot decode int field. [e:%v]", err)
	}

	if anInt != 1234 {
		t.Fatalf("expected int value is 1234. [int:%v]", anInt)
	}

	err = result.DecodeField("array.0", &aString)

	if err != nil {
		t.Fatalf("cannot decode array.0 field. [e:%v]", err)
	}

	if aString != "abcd" {
		t.Fatalf("expected array.0 value is 'abcd'. [string:%v]", aString)
	}

	err = result.DecodeField("array.1", &aString)

	if err != nil {
		t.Fatalf("cannot decode array.1 field. [e:%v]", err)
	}

	if aString != "efgh" {
		t.Fatalf("expected array.1 value is 'abcd'. [string:%v]", aString)
	}

	err = result.DecodeField("array.2", &aString)

	if err == nil {
		t.Fatalf("array.2 doesn't exist. expect an error.")
	}

	err = result.DecodeField("map.key1", &anInt)

	if err != nil {
		t.Fatalf("cannot decode map.key1 field. [e:%v]", err)
	}

	if anInt != 5678 {
		t.Fatalf("expected map.key1 value is 5678. [int:%v]", anInt)
	}

	err = result.DecodeField("map.nested_map.key2", &aString)

	if err != nil {
		t.Fatalf("cannot decode map.nested_map.key2 field. [e:%v]", err)
	}

	if aString != "ijkl" {
		t.Fatalf("expected map.nested_map.key2 value is 'ijkl'. [string:%v]", aString)
	}

	err = result.DecodeField("array", &aSlice)

	if err != nil {
		t.Fatalf("cannot decode array field. [e:%v]", err)
	}

	if len(aSlice) != 2 || aSlice[0] != "abcd" || aSlice[1] != "efgh" {
		t.Fatalf("expected array value is ['abcd', 'efgh']. [slice:%v]", aSlice)
	}

	err = result.DecodeField("map.nested_map.key3", &subResults)

	if err != nil {
		t.Fatalf("cannot decode map.nested_map.key3 field. [e:%v]", err)
	}

	if len(subResults) != 2 {
		t.Fatalf("expected sub results len is 2. [len:%v] [results:%v]", subResults)
	}

	err = subResults[0].DecodeField("key4", &aString)

	if err != nil {
		t.Fatalf("cannot decode key4 field in sub result. [e:%v]", err)
	}

	if aString != "mnop" {
		t.Fatalf("expected map.nested_map.key2 value is 'mnop'. [string:%v]", aString)
	}

	err = subResults[1].DecodeField("key5", &anInt)

	if err != nil {
		t.Fatalf("cannot decode key5 field. [e:%v]", err)
	}

	if anInt != 9012 {
		t.Fatalf("expected key5 value is 9012. [int:%v]", anInt)
	}

	err = result.DecodeField("message_tags.2.0.id", &aString)

	if err != nil {
		t.Fatalf("cannot decode message_tags.2.0.id field. [e:%v]", err)
	}

	if aString != "4838901" {
		t.Fatalf("expected message_tags.2.0.id value is '4838901'. [string:%v]", aString)
	}

	var messageTags MessageTags
	err = result.DecodeField("message_tags", &messageTags)

	if err != nil {
		t.Fatalf("cannot decode message_tags field. [e:%v]", err)
	}

	if len(messageTags) != 1 {
		t.Fatalf("expect messageTags have only 1 element. [len:%v]", len(messageTags))
	}

	aString = messageTags["2"][1].Id

	if aString != "293450302" {
		t.Fatalf("expect messageTags.2.1.id value is '293450302'. [value:%v]", aString)
	}

	err = result.DecodeField("nullStruct", &aNull)

	if err != nil {
		t.Fatalf("cannot decode nullStruct field. [e:%v]", err)
	}

	if aNull.Null != nil {
		t.Fatalf("expect aNull.Null is reset to nil.")
	}

	err = result.DecodeField("timestamp", &aTimestamp)

	if err != nil {
		t.Fatalf("cannot decode timestamp field. [e:%v]", err)
	}

	if !aTimestamp.Equal(time.Date(2015, time.January, 3, 11, 15, 1, 0, time.FixedZone("no-offset", 0))) {
		t.Fatalf("expect aTimestamp date to be 2015-01-03 11:15:01 +0000 [value:%v]", aTimestamp.String())
	}

	err = result.DecodeField("custom_timestamp", &aCustomTimestamp)

	if err != nil {
		t.Fatalf("cannot decode custom_timestamp field. [e:%v]", err)
	}

	if !time.Time(aCustomTimestamp).Equal(time.Date(2014, time.March, 4, 11, 15, 1, 0, time.FixedZone("no-offset", 0))) {
		t.Fatalf("expect aCustomTimestamp date to be 2014-03-04 11:15:01 +0000 [value:%v]", time.Time(aCustomTimestamp).String())
	}
}

func TestGraphError(t *testing.T) {
	res, err := Get("/me", Params{
		"access_token": "fake",
	})

	if err == nil {
		t.Fatalf("facebook should return error for bad access token. [res:%v]", res)
	}

	fbErr, ok := err.(*Error)

	if !ok {
		t.Fatalf("error must be a *Error. [e:%v]", err)
	}

	t.Logf("facebook error. [e:%v] [message:%v] [type:%v] [code:%v] [subcode:%v]", err, fbErr.Message, fbErr.Type, fbErr.Code, fbErr.ErrorSubcode)
}

type FacebookFriend struct {
	Id   string `facebook:",required"`
	Name string `facebook:",required"`
}

type FacebookFriends struct {
	Friends []FacebookFriend `facebook:"data,required"`
}

func TestPagingResultDecode(t *testing.T) {
	res := Result{
		"data": []interface{}{
			map[string]interface{}{
				"name": "friend 1",
				"id":   "1",
			},
			map[string]interface{}{
				"name": "friend 2",
				"id":   "2",
			},
		},
		"paging": map[string]interface{}{
			"next": "https://graph.facebook.com/...",
		},
	}
	paging, err := newPagingResult(nil, res)
	if err != nil {
		t.Fatalf("cannot create paging result. [e:%v]", err)
	}
	var friends FacebookFriends
	if err := paging.Decode(&friends); err != nil {
		t.Fatalf("cannot decode paging result. [e:%v]", err)
	}
	if len(friends.Friends) != 2 {
		t.Fatalf("expect to have 2 friends. [len:%v]", len(friends.Friends))
	}
	if friends.Friends[0].Name != "friend 1" {
		t.Fatalf("expect name to be 'friend 1'. [name:%v]", friends.Friends[0].Name)
	}
	if friends.Friends[0].Id != "1" {
		t.Fatalf("expect id to be '1'. [id:%v]", friends.Friends[0].Id)
	}
	if friends.Friends[1].Name != "friend 2" {
		t.Fatalf("expect name to be 'friend 2'. [name:%v]", friends.Friends[1].Name)
	}
	if friends.Friends[1].Id != "2" {
		t.Fatalf("expect id to be '2'. [id:%v]", friends.Friends[1].Id)
	}
}

func TestPagingResult(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("skip this case as we don't have a valid access token.")
	}

	session := &Session{}
	session.SetAccessToken(FB_TEST_VALID_ACCESS_TOKEN)
	res, err := session.Get("/me/home", Params{
		"limit": 2,
	})

	if err != nil {
		t.Fatalf("cannot get my home post. [e:%v]", err)
	}

	paging, err := res.Paging(session)

	if err != nil {
		t.Fatalf("cannot get paging information. [e:%v]", err)
	}

	data := paging.Data()

	if len(data) != 2 {
		t.Fatalf("expect to have only 2 post. [len:%v]", len(data))
	}

	t.Logf("result: %v", res)
	t.Logf("previous: %v", paging.previous)

	noMore, err := paging.Previous()

	if err != nil {
		t.Fatalf("cannot get paging information. [e:%v]", err)
	}

	if !noMore {
		t.Fatalf("should have no more post. %v", *paging.paging.Paging)
	}

	noMore, err = paging.Next()

	if err != nil {
		t.Fatalf("cannot get paging information. [e:%v]", err)
	}

	data = paging.Data()

	if len(data) != 2 {
		t.Fatalf("expect to have only 2 post. [len:%v]", len(data))
	}

	noMore, err = paging.Next()

	if err != nil {
		t.Fatalf("cannot get paging information. [e:%v]", err)
	}

	if len(paging.Data()) != 2 {
		t.Fatalf("expect to have only 2 post. [len:%v]", len(paging.Data()))
	}
}

func TestDecodeLargeInteger(t *testing.T) {
	bigIntegers := []int64{
		1<<53 - 2,
		1<<53 - 1,
		1 << 53,
		1<<53 + 1,
		1<<53 + 2,

		1<<54 - 2,
		1<<54 - 1,
		1 << 54,
		1<<54 + 1,
		1<<54 + 2,

		1<<60 - 2,
		1<<60 - 1,
		1 << 60,
		1<<60 + 1,
		1<<60 + 2,

		1<<63 - 2,
		1<<63 - 1,

		-(1<<53 - 2),
		-(1<<53 - 1),
		-(1 << 53),
		-(1<<53 + 1),
		-(1<<53 + 2),

		-(1<<54 - 2),
		-(1<<54 - 1),
		-(1 << 54),
		-(1<<54 + 1),
		-(1<<54 + 2),

		-(1<<60 - 2),
		-(1<<60 - 1),
		-(1 << 60),
		-(1<<60 + 1),
		-(1<<60 + 2),

		-(1<<53 - 2),
		-(1<<63 - 1),
		-(1 << 63),
	}
	jsonStr := `{
		"integers": [%v]
	}`

	buf := &bytes.Buffer{}

	for _, v := range bigIntegers {
		buf.WriteString(fmt.Sprintf("%v", v))
		buf.WriteRune(',')
	}

	buf.WriteRune('0')
	json := fmt.Sprintf(jsonStr, buf.String())

	res, err := MakeResult([]byte(json))

	if err != nil {
		t.Fatalf("cannot make result on test json string. [e:%v]", err)
	}

	var actualIntegers []int64
	err = res.DecodeField("integers", &actualIntegers)

	if err != nil {
		t.Fatalf("cannot decode integers from json. [e:%v]", err)
	}

	if len(actualIntegers) != len(bigIntegers)+1 {
		t.Fatalf("count of decoded integers is not correct. [expected:%v] [actual:%v]", len(bigIntegers)+1, len(actualIntegers))
	}

	for k, _ := range bigIntegers {
		if bigIntegers[k] != actualIntegers[k] {
			t.Logf("expected integers: %v", bigIntegers)
			t.Logf("actual integers:   %v", actualIntegers)
			t.Fatalf("a decoded integer is not expected. [expected:%v] [actual:%v]", bigIntegers[k], actualIntegers[k])
		}
	}
}

func TestInspectValidToken(t *testing.T) {
	if FB_TEST_VALID_ACCESS_TOKEN == "" {
		t.Skipf("skip this case as we don't have a valid access token.")
	}

	session := testGlobalApp.Session(FB_TEST_VALID_ACCESS_TOKEN)
	result, err := session.Inspect()

	if err != nil {
		t.Fatalf("cannot inspect a valid access token. [e:%v]", err)
	}

	var isValid bool
	err = result.DecodeField("is_valid", &isValid)

	if err != nil {
		t.Fatalf("cannot get 'is_valid' in inspect result. [e:%v]", err)
	}

	if !isValid {
		t.Fatalf("inspect result shows access token is invalid. why? [result:%v]", result)
	}
}

func TestInspectInvalidToken(t *testing.T) {
	invalidToken := "CAACZA38ZAD8CoBAe2bDC6EdThnni3b56scyshKINjZARoC9ZAuEUTgYUkYnKdimqfA2ZAXcd2wLd7Rr8jLmMXTY9vqAhQGqObZBIUz1WwbqVoCsB3AAvLtwoWNhsxM76mK0eiJSLXHZCdPVpyhmtojvzXA7f69Bm6b5WZBBXia8iOpPZAUHTGp1UQLFMt47c7RqJTrYIl3VfAR0deN82GMFL2"
	session := testGlobalApp.Session(invalidToken)
	result, err := session.Inspect()

	if err == nil {
		t.Fatalf("facebook should indicate it's an invalid token. why not? [result:%v]", result)
	}

	if _, ok := err.(*Error); !ok {
		t.Fatalf("inspect error should be a standard facebook error. why not? [e:%v]", err)
	}

	isValid := true
	err = result.DecodeField("is_valid", &isValid)

	if err != nil {
		t.Fatalf("cannot get 'is_valid' in inspect result. [e:%v]", err)
	}

	if isValid {
		t.Fatalf("inspect result shows access token is valid. why? [result:%v]", result)
	}
}

func TestCamelCaseToUnderScore(t *testing.T) {
	cases := map[string]string{
		"TestCase":           "test_case",
		"HTTPServer":         "http_server",
		"NoHTTPS":            "no_https",
		"Wi_thF":             "wi_th_f",
		"_AnotherTES_TCaseP": "_another_tes_t_case_p",
		"ALL":                "all",
		"UserID":             "user_id",
	}

	for k, v := range cases {
		str := camelCaseToUnderScore(k)

		if str != v {
			t.Fatalf("wrong underscore string. [expect:%v] [actual:%v]", v, str)
		}
	}
}

func TestMakeSliceResult(t *testing.T) {
	jsonStr := `{
		"error": {
			"message": "Invalid OAuth access token.", 
			"type": "OAuthException", 
			"code": 190
		}
	}`
	var res []Result
	err := makeResult([]byte(jsonStr), &res)

	if err == nil {
		t.Fatalf("makeResult must fail")
	}

	fbErr, ok := err.(*Error)

	if !ok {
		t.Fatalf("error must be a facebook error. [e:%v]", err)
	}

	if fbErr.Code != 190 {
		t.Fatalf("invalid facebook error. [e:%v]", fbErr.Error())
	}
}

func TestMakeSliceResultWithNilElements(t *testing.T) {
	jsonStr := `[
		null,
		{
			"foo": "bar"
		},
		null
	]`
	var res []Result
	err := makeResult([]byte(jsonStr), &res)

	if err != nil {
		t.Fatalf("fail to decode results. [e:%v]", err)
	}

	if len(res) != 3 {
		t.Fatalf("expect 3 elements in res. [res:%v]", res)
	}

	if res[0] != nil || res[1] == nil || res[2] != nil {
		t.Fatalf("decoded res is not expected. [res:%v]", res)
	}

	if res[1]["foo"].(string) != "bar" {
		t.Fatalf("decode res is not expected. [res:%v]", res)
	}
}
