package gomail

import (
	"bytes"
	"encoding/base64"
	"io"
	"io/ioutil"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func init() {
	now = func() time.Time {
		return time.Date(2014, 06, 25, 17, 46, 0, 0, time.UTC)
	}
}

type message struct {
	from    string
	to      []string
	content string
}

func TestMessage(t *testing.T) {
	m := NewMessage()
	m.SetAddressHeader("From", "from@example.com", "Señor From")
	m.SetHeader("To", m.FormatAddress("to@example.com", "Señor To"), "tobis@example.com")
	m.SetAddressHeader("Cc", "cc@example.com", "A, B")
	m.SetAddressHeader("X-To", "ccbis@example.com", "à, b")
	m.SetDateHeader("X-Date", now())
	m.SetHeader("X-Date-2", m.FormatDate(now()))
	m.SetHeader("Subject", "¡Hola, señor!")
	m.SetHeaders(map[string][]string{
		"X-Headers": {"Test", "Café"},
	})
	m.SetBody("text/plain", "¡Hola, señor!")

	want := &message{
		from: "from@example.com",
		to: []string{
			"to@example.com",
			"tobis@example.com",
			"cc@example.com",
		},
		content: "From: =?UTF-8?q?Se=C3=B1or_From?= <from@example.com>\r\n" +
			"To: =?UTF-8?q?Se=C3=B1or_To?= <to@example.com>, tobis@example.com\r\n" +
			"Cc: \"A, B\" <cc@example.com>\r\n" +
			"X-To: =?UTF-8?b?w6AsIGI=?= <ccbis@example.com>\r\n" +
			"X-Date: Wed, 25 Jun 2014 17:46:00 +0000\r\n" +
			"X-Date-2: Wed, 25 Jun 2014 17:46:00 +0000\r\n" +
			"X-Headers: Test, =?UTF-8?q?Caf=C3=A9?=\r\n" +
			"Subject: =?UTF-8?q?=C2=A1Hola,_se=C3=B1or!?=\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"=C2=A1Hola, se=C3=B1or!",
	}

	testMessage(t, m, 0, want)
}

func TestCustomMessage(t *testing.T) {
	m := NewMessage(SetCharset("ISO-8859-1"), SetEncoding(Base64))
	m.SetHeaders(map[string][]string{
		"From":    {"from@example.com"},
		"To":      {"to@example.com"},
		"Subject": {"Café"},
	})
	m.SetBody("text/html", "¡Hola, señor!")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Subject: =?ISO-8859-1?b?Q2Fmw6k=?=\r\n" +
			"Content-Type: text/html; charset=ISO-8859-1\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			"wqFIb2xhLCBzZcOxb3Ih",
	}

	testMessage(t, m, 0, want)
}

func TestUnencodedMessage(t *testing.T) {
	m := NewMessage(SetEncoding(Unencoded))
	m.SetHeaders(map[string][]string{
		"From":    {"from@example.com"},
		"To":      {"to@example.com"},
		"Subject": {"Café"},
	})
	m.SetBody("text/html", "¡Hola, señor!")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Subject: =?UTF-8?q?Caf=C3=A9?=\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: 8bit\r\n" +
			"\r\n" +
			"¡Hola, señor!",
	}

	testMessage(t, m, 0, want)
}

func TestRecipients(t *testing.T) {
	m := NewMessage()
	m.SetHeaders(map[string][]string{
		"From":    {"from@example.com"},
		"To":      {"to@example.com"},
		"Cc":      {"cc@example.com"},
		"Bcc":     {"bcc1@example.com", "bcc2@example.com"},
		"Subject": {"Hello!"},
	})
	m.SetBody("text/plain", "Test message")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com", "cc@example.com", "bcc1@example.com", "bcc2@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Cc: cc@example.com\r\n" +
			"Subject: Hello!\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test message",
	}

	testMessage(t, m, 0, want)
}

func TestAlternative(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "¡Hola, señor!")
	m.AddAlternative("text/html", "¡<b>Hola</b>, <i>señor</i>!</h1>")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/alternative;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"=C2=A1Hola, se=C3=B1or!\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"=C2=A1<b>Hola</b>, <i>se=C3=B1or</i>!</h1>\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestPartSetting(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain; format=flowed", "¡Hola, señor!", SetPartEncoding(Unencoded))
	m.AddAlternative("text/html", "¡<b>Hola</b>, <i>señor</i>!</h1>")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/alternative;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; format=flowed; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: 8bit\r\n" +
			"\r\n" +
			"¡Hola, señor!\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"=C2=A1<b>Hola</b>, <i>se=C3=B1or</i>!</h1>\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestBodyWriter(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.AddAlternativeWriter("text/plain", func(w io.Writer) error {
		_, err := w.Write([]byte("Test message"))
		return err
	})
	m.AddAlternativeWriter("text/html", func(w io.Writer) error {
		_, err := w.Write([]byte("Test HTML"))
		return err
	})

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/alternative;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test message\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test HTML\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestAttachmentOnly(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.Attach(mockCopyFile("/tmp/test.pdf"))

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: application/pdf; name=\"test.pdf\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.pdf\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.pdf")),
	}

	testMessage(t, m, 0, want)
}

func TestAttachment(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "Test")
	m.Attach(mockCopyFile("/tmp/test.pdf"))

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/mixed;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/pdf; name=\"test.pdf\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.pdf\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.pdf")) + "\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestRename(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "Test")
	name, copy := mockCopyFile("/tmp/test.pdf")
	rename := Rename("another.pdf")
	m.Attach(name, copy, rename)

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/mixed;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/pdf; name=\"another.pdf\"\r\n" +
			"Content-Disposition: attachment; filename=\"another.pdf\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.pdf")) + "\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestAttachmentsOnly(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.Attach(mockCopyFile("/tmp/test.pdf"))
	m.Attach(mockCopyFile("/tmp/test.zip"))

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/mixed;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/pdf; name=\"test.pdf\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.pdf\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.pdf")) + "\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/zip; name=\"test.zip\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.zip\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.zip")) + "\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestAttachments(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "Test")
	m.Attach(mockCopyFile("/tmp/test.pdf"))
	m.Attach(mockCopyFile("/tmp/test.zip"))

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/mixed;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/pdf; name=\"test.pdf\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.pdf\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.pdf")) + "\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/zip; name=\"test.zip\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.zip\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.zip")) + "\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestEmbedded(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.Embed(mockCopyFileWithHeader(m, "image1.jpg", map[string][]string{"Content-ID": {"<test-content-id>"}}))
	m.Embed(mockCopyFile("image2.jpg"))
	m.SetBody("text/plain", "Test")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/related;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: image/jpeg; name=\"image1.jpg\"\r\n" +
			"Content-Disposition: inline; filename=\"image1.jpg\"\r\n" +
			"Content-ID: <test-content-id>\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of image1.jpg")) + "\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: image/jpeg; name=\"image2.jpg\"\r\n" +
			"Content-Disposition: inline; filename=\"image2.jpg\"\r\n" +
			"Content-ID: <image2.jpg>\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of image2.jpg")) + "\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 1, want)
}

func TestFullMessage(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "¡Hola, señor!")
	m.AddAlternative("text/html", "¡<b>Hola</b>, <i>señor</i>!</h1>")
	m.Attach(mockCopyFile("test.pdf"))
	m.Embed(mockCopyFile("image.jpg"))

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: multipart/mixed;\r\n" +
			" boundary=_BOUNDARY_1_\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: multipart/related;\r\n" +
			" boundary=_BOUNDARY_2_\r\n" +
			"\r\n" +
			"--_BOUNDARY_2_\r\n" +
			"Content-Type: multipart/alternative;\r\n" +
			" boundary=_BOUNDARY_3_\r\n" +
			"\r\n" +
			"--_BOUNDARY_3_\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"=C2=A1Hola, se=C3=B1or!\r\n" +
			"--_BOUNDARY_3_\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"=C2=A1<b>Hola</b>, <i>se=C3=B1or</i>!</h1>\r\n" +
			"--_BOUNDARY_3_--\r\n" +
			"\r\n" +
			"--_BOUNDARY_2_\r\n" +
			"Content-Type: image/jpeg; name=\"image.jpg\"\r\n" +
			"Content-Disposition: inline; filename=\"image.jpg\"\r\n" +
			"Content-ID: <image.jpg>\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of image.jpg")) + "\r\n" +
			"--_BOUNDARY_2_--\r\n" +
			"\r\n" +
			"--_BOUNDARY_1_\r\n" +
			"Content-Type: application/pdf; name=\"test.pdf\"\r\n" +
			"Content-Disposition: attachment; filename=\"test.pdf\"\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			base64.StdEncoding.EncodeToString([]byte("Content of test.pdf")) + "\r\n" +
			"--_BOUNDARY_1_--\r\n",
	}

	testMessage(t, m, 3, want)

	want = &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			"Test reset",
	}
	m.Reset()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "Test reset")
	testMessage(t, m, 0, want)
}

func TestQpLineLength(t *testing.T) {
	m := NewMessage()
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain",
		strings.Repeat("0", 76)+"\r\n"+
			strings.Repeat("0", 75)+"à\r\n"+
			strings.Repeat("0", 74)+"à\r\n"+
			strings.Repeat("0", 73)+"à\r\n"+
			strings.Repeat("0", 72)+"à\r\n"+
			strings.Repeat("0", 75)+"\r\n"+
			strings.Repeat("0", 76)+"\n")

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: quoted-printable\r\n" +
			"\r\n" +
			strings.Repeat("0", 75) + "=\r\n0\r\n" +
			strings.Repeat("0", 75) + "=\r\n=C3=A0\r\n" +
			strings.Repeat("0", 74) + "=\r\n=C3=A0\r\n" +
			strings.Repeat("0", 73) + "=\r\n=C3=A0\r\n" +
			strings.Repeat("0", 72) + "=C3=\r\n=A0\r\n" +
			strings.Repeat("0", 75) + "\r\n" +
			strings.Repeat("0", 75) + "=\r\n0\r\n",
	}

	testMessage(t, m, 0, want)
}

func TestBase64LineLength(t *testing.T) {
	m := NewMessage(SetCharset("UTF-8"), SetEncoding(Base64))
	m.SetHeader("From", "from@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", strings.Repeat("0", 58))

	want := &message{
		from: "from@example.com",
		to:   []string{"to@example.com"},
		content: "From: from@example.com\r\n" +
			"To: to@example.com\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: base64\r\n" +
			"\r\n" +
			strings.Repeat("MDAw", 19) + "\r\nMA==",
	}

	testMessage(t, m, 0, want)
}

func TestEmptyName(t *testing.T) {
	m := NewMessage()
	m.SetAddressHeader("From", "from@example.com", "")

	want := &message{
		from:    "from@example.com",
		content: "From: from@example.com\r\n",
	}

	testMessage(t, m, 0, want)
}

func TestEmptyHeader(t *testing.T) {
	m := NewMessage()
	m.SetHeaders(map[string][]string{
		"From":    {"from@example.com"},
		"X-Empty": nil,
	})

	want := &message{
		from: "from@example.com",
		content: "From: from@example.com\r\n" +
			"X-Empty:\r\n",
	}

	testMessage(t, m, 0, want)
}

func testMessage(t *testing.T, m *Message, bCount int, want *message) {
	err := Send(stubSendMail(t, bCount, want), m)
	if err != nil {
		t.Error(err)
	}
}

func stubSendMail(t *testing.T, bCount int, want *message) SendFunc {
	return func(from string, to []string, m io.WriterTo) error {
		if from != want.from {
			t.Fatalf("Invalid from, got %q, want %q", from, want.from)
		}

		if len(to) != len(want.to) {
			t.Fatalf("Invalid recipient count, \ngot %d: %q\nwant %d: %q",
				len(to), to,
				len(want.to), want.to,
			)
		}
		for i := range want.to {
			if to[i] != want.to[i] {
				t.Fatalf("Invalid recipient, got %q, want %q",
					to[i], want.to[i],
				)
			}
		}

		buf := new(bytes.Buffer)
		_, err := m.WriteTo(buf)
		if err != nil {
			t.Error(err)
		}
		got := buf.String()
		wantMsg := string("Mime-Version: 1.0\r\n" +
			"Date: Wed, 25 Jun 2014 17:46:00 +0000\r\n" +
			want.content)
		if bCount > 0 {
			boundaries := getBoundaries(t, bCount, got)
			for i, b := range boundaries {
				wantMsg = strings.Replace(wantMsg, "_BOUNDARY_"+strconv.Itoa(i+1)+"_", b, -1)
			}
		}

		compareBodies(t, got, wantMsg)

		return nil
	}
}

func compareBodies(t *testing.T, got, want string) {
	// We cannot do a simple comparison since the ordering of headers' fields
	// is random.
	gotLines := strings.Split(got, "\r\n")
	wantLines := strings.Split(want, "\r\n")

	// We only test for too many lines, missing lines are tested after
	if len(gotLines) > len(wantLines) {
		t.Fatalf("Message has too many lines, \ngot %d:\n%s\nwant %d:\n%s", len(gotLines), got, len(wantLines), want)
	}

	isInHeader := true
	headerStart := 0
	for i, line := range wantLines {
		if line == gotLines[i] {
			if line == "" {
				isInHeader = false
			} else if !isInHeader && len(line) > 2 && line[:2] == "--" {
				isInHeader = true
				headerStart = i + 1
			}
			continue
		}

		if !isInHeader {
			missingLine(t, line, got, want)
		}

		isMissing := true
		for j := headerStart; j < len(gotLines); j++ {
			if gotLines[j] == "" {
				break
			}
			if gotLines[j] == line {
				isMissing = false
				break
			}
		}
		if isMissing {
			missingLine(t, line, got, want)
		}
	}
}

func missingLine(t *testing.T, line, got, want string) {
	t.Fatalf("Missing line %q\ngot:\n%s\nwant:\n%s", line, got, want)
}

func getBoundaries(t *testing.T, count int, m string) []string {
	if matches := boundaryRegExp.FindAllStringSubmatch(m, count); matches != nil {
		boundaries := make([]string, count)
		for i, match := range matches {
			boundaries[i] = match[1]
		}
		return boundaries
	}

	t.Fatal("Boundary not found in body")
	return []string{""}
}

var boundaryRegExp = regexp.MustCompile("boundary=(\\w+)")

func mockCopyFile(name string) (string, FileSetting) {
	return name, SetCopyFunc(func(w io.Writer) error {
		_, err := w.Write([]byte("Content of " + filepath.Base(name)))
		return err
	})
}

func mockCopyFileWithHeader(m *Message, name string, h map[string][]string) (string, FileSetting, FileSetting) {
	name, f := mockCopyFile(name)
	return name, f, SetHeader(h)
}

func BenchmarkFull(b *testing.B) {
	discardFunc := SendFunc(func(from string, to []string, m io.WriterTo) error {
		_, err := m.WriteTo(ioutil.Discard)
		return err
	})

	m := NewMessage()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		m.SetAddressHeader("From", "from@example.com", "Señor From")
		m.SetHeaders(map[string][]string{
			"To":      {"to@example.com"},
			"Cc":      {"cc@example.com"},
			"Bcc":     {"bcc1@example.com", "bcc2@example.com"},
			"Subject": {"¡Hola, señor!"},
		})
		m.SetBody("text/plain", "¡Hola, señor!")
		m.AddAlternative("text/html", "<p>¡Hola, señor!</p>")
		m.Attach(mockCopyFile("benchmark.txt"))
		m.Embed(mockCopyFile("benchmark.jpg"))

		if err := Send(discardFunc, m); err != nil {
			panic(err)
		}
		m.Reset()
	}
}
