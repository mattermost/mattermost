package main

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"flag"
	"fmt"
	"io"
	"net/smtp"
	"os"
	"regexp"
	"strings"

	"github.com/mattermost/rsc/google"
)

func enc(s string) string {
	// TODO =? .. ?=
	return s
}

type Addr struct {
	Name  string
	Email string
}

func (a Addr) enc() string {
	if a.Name == "" {
		return "<" + a.Email + ">"
	}
	if a.Email == "" {
		return enc(a.Name) + ":;"
	}
	return enc(a.Name) + " <" + a.Email + ">"
}

type Addrs []Addr

func (a *Addrs) String() string {
	return "[addrlist]"
}

func (a Addrs) has(s string) bool {
	for _, aa := range a {
		if aa.Email == s {
			return true
		}
	}
	return false
}

func (a *Addrs) Set(s string) bool {
	s = strings.TrimSpace(s)
	if strings.HasSuffix(s, ">") {
		j := strings.LastIndex(s, "<")
		if j >= 0 {
			*a = append(*a, Addr{strings.TrimSpace(s[:j]), s[j+1 : len(s)-1]})
			return true
		}
	}

	if strings.Contains(s, " ") {
		fmt.Fprintf(os.Stderr, "invalid address: %s", s)
		os.Exit(2)
	}
	*a = append(*a, Addr{"", s})
	return true
}

func (a *Addrs) parseLine(s string) {
	for _, f := range strings.Split(s, ",") {
		f = strings.TrimSpace(f)
		if f != "" {
			a.Set(f)
		}
	}
}

func (a Addrs) fixDomain() {
	i := strings.Index(acct.Email, "@")
	if i < 0 {
		return
	}
	dom := acct.Email[i:]
	for i := range a {
		if a[i].Email != "" && !strings.Contains(a[i].Email, "@") {
			a[i].Email += dom
		}
	}
}

var from, to, cc, bcc, replyTo Addrs
var inReplyTo, subject string
var appendFile = flag.String("append", "", "file to append to end of body")

var acct google.Account
var acctName = flag.String("a", "", "account to use")
var inputHeader = flag.Bool("i", false, "read additional header lines from stdin")

func holdmode() {
	if os.Getenv("TERM") == "9term" {
		// forgive me
		os.Stdout.WriteString("\x1B];*9term-hold+\x07")
	}
}

func match(line, prefix string, arg *string) bool {
	if len(line) < len(prefix) || !strings.EqualFold(line[:len(prefix)], prefix) {
		return false
	}
	*arg = strings.TrimSpace(line[len(prefix):])
	return true
}

func main() {
	flag.StringVar(&inReplyTo, "in-reply-to", "", "In-Reply-To")
	flag.StringVar(&subject, "s", "", "Subject")
	flag.Var(&from, "from", "From (can repeat)")
	flag.Var(&to, "to", "To (can repeat)")
	flag.Var(&cc, "cc", "CC (can repeat)")
	flag.Var(&bcc, "bcc", "BCC (can repeat)")
	flag.Var(&replyTo, "replyTo", "Reply-To (can repeat)")

	flag.Parse()
	if flag.NArg() != 0 && !*inputHeader {
		flag.Usage()
	}

	var body bytes.Buffer
	input := bufio.NewReader(os.Stdin)
	if *inputHeader {
		holdmode()
	Loop:
		for {
			s, err := input.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					break Loop
				}
				fmt.Fprintf(os.Stderr, "reading stdin: %s\n", err)
				os.Exit(2)
			}
			var arg string
			switch {
			default:
				if ok, _ := regexp.MatchString(`^\S+:`, s); ok {
					fmt.Fprintf(os.Stderr, "unknown header line: %s", s)
					os.Exit(2)
				}
				body.WriteString(s)
				break Loop
			case match(s, "from:", &arg):
				from.parseLine(arg)
			case match(s, "to:", &arg):
				to.parseLine(arg)
			case match(s, "cc:", &arg):
				cc.parseLine(arg)
			case match(s, "bcc:", &arg):
				bcc.parseLine(arg)
			case match(s, "reply-to:", &arg):
				replyTo.parseLine(arg)
			case match(s, "subject:", &arg):
				subject = arg
			case match(s, "in-reply-to:", &arg):
				inReplyTo = arg
			}
		}
	}

	acct = google.Acct(*acctName)
	from.fixDomain()
	to.fixDomain()
	cc.fixDomain()
	bcc.fixDomain()
	replyTo.fixDomain()

	smtpTo := append(append(to, cc...), bcc...)

	if len(from) == 0 {
		// TODO: Much better
		name := ""
		email := acct.Email
		if email == "rsc@swtch.com" || email == "rsc@google.com" {
			name = "Russ Cox"
		}
		if email == "rsc@google.com" && (smtpTo.has("go@googlecode.com") || smtpTo.has("golang-dev@googlegroups.com") || smtpTo.has("golang-nuts@googlegroups.com")) {
			from = append(from, Addr{name, "rsc@golang.org"})
		} else {
			from = append(from, Addr{name, email})
		}
	}

	if len(from) > 1 {
		fmt.Fprintf(os.Stderr, "missing -from\n")
		os.Exit(2)
	}

	if len(to)+len(cc)+len(bcc) == 0 {
		fmt.Fprintf(os.Stderr, "missing destinations\n")
		os.Exit(2)
	}

	if !*inputHeader {
		holdmode()
	}
	_, err := io.Copy(&body, input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "reading stdin: %s\n", err)
		os.Exit(2)
	}

	if *appendFile != "" {
		f, err := os.Open(*appendFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "append: %s\n", err)
			os.Exit(2)
		}
		_, err = io.Copy(&body, f)
		f.Close()
		if err != nil {
			fmt.Fprintf(os.Stderr, "append: %s\n", err)
			os.Exit(2)
		}
	}

	var msg bytes.Buffer
	fmt.Fprintf(&msg, "MIME-Version: 1.0\n")
	if len(from) > 0 {
		fmt.Fprintf(&msg, "From: ")
		for i, a := range from {
			if i > 0 {
				fmt.Fprintf(&msg, ", ")
			}
			fmt.Fprintf(&msg, "%s", a.enc())
		}
		fmt.Fprintf(&msg, "\n")
	}
	if len(to) > 0 {
		fmt.Fprintf(&msg, "To: ")
		for i, a := range to {
			if i > 0 {
				fmt.Fprintf(&msg, ", ")
			}
			fmt.Fprintf(&msg, "%s", a.enc())
		}
		fmt.Fprintf(&msg, "\n")
	}
	if len(cc) > 0 {
		fmt.Fprintf(&msg, "CC: ")
		for i, a := range cc {
			if i > 0 {
				fmt.Fprintf(&msg, ", ")
			}
			fmt.Fprintf(&msg, "%s", a.enc())
		}
		fmt.Fprintf(&msg, "\n")
	}
	if len(replyTo) > 0 {
		fmt.Fprintf(&msg, "Reply-To: ")
		for i, a := range replyTo {
			if i > 0 {
				fmt.Fprintf(&msg, ", ")
			}
			fmt.Fprintf(&msg, "%s", a.enc())
		}
		fmt.Fprintf(&msg, "\n")
	}
	if inReplyTo != "" {
		fmt.Fprintf(&msg, "In-Reply-To: %s\n", inReplyTo)
	}
	if subject != "" {
		fmt.Fprintf(&msg, "Subject: %s\n", enc(subject))
	}
	fmt.Fprintf(&msg, "Date: xxx\n")
	fmt.Fprintf(&msg, "Content-Type: text/plain; charset=\"utf-8\"\n")
	fmt.Fprintf(&msg, "Content-Transfer-Encoding: base64\n")
	fmt.Fprintf(&msg, "\n")
	enc64 := base64.StdEncoding.EncodeToString(body.Bytes())
	for len(enc64) > 72 {
		fmt.Fprintf(&msg, "%s\n", enc64[:72])
		enc64 = enc64[72:]
	}
	fmt.Fprintf(&msg, "%s\n\n", enc64)

	auth := smtp.PlainAuth(
		"",
		acct.Email,
		acct.Password,
		"smtp.gmail.com",
	)
	var smtpToEmail []string
	for _, a := range smtpTo {
		if a.Email != "" {
			smtpToEmail = append(smtpToEmail, a.Email)
		}
	}

	if err := sendMail("smtp.gmail.com:587", auth, from[0].Email, smtpToEmail, msg.Bytes()); err != nil {
		fmt.Fprintf(os.Stderr, "sending mail: %s\n", err)
		os.Exit(2)
	}
}

/*
                                                                                                                                                                                                                                                    MIME-Version: 1.0
Subject: commit/plan9port: rsc: 9term: hold mode back door
From: Bitbucket <commits-noreply@bitbucket.org>
To: plan9port-dev@googlegroups.com
Date: Tue, 11 Oct 2011 13:34:30 -0000
Message-ID: <20111011133430.31146.55070@bitbucket13.managed.contegix.com>
Reply-To: commits-noreply@bitbucket.org
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

1 new changeset in plan9port:

http://bitbucket.org/rsc/plan9port/changeset/8735d7708a1b/
changeset:   8735d7708a1b
user:        rsc
date:        2011-10-11 15:34:25
summary:     9term: hold mode back door

R=3Drsc
http://codereview.appspot.com/5248056
affected #:  2 files (-1 bytes)

Repository URL: https://bitbucket.org/rsc/plan9port/

--

This is a commit notification from bitbucket.org. You are receiving
this because you have the service enabled, addressing the recipient of
this email.

*/

func sendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error {
	c, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	if err = c.StartTLS(nil); err != nil {
		return err
	}
	if err = c.Auth(a); err != nil {
		return err
	}
	if err = c.Mail(from); err != nil {
		return err
	}
	for _, addr := range to {
		if err = c.Rcpt(addr); err != nil {
			return err
		}
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	_, err = w.Write(msg)
	if err != nil {
		return err
	}
	err = w.Close()
	if err != nil {
		return err
	}
	return c.Quit()
}
