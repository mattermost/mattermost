package imap

import (
	"bufio"
	"fmt"
	"io"
	"io/ioutil"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/rsc/google"
)

// NOTE: web address is https://mail.google.com/mail/b/rsc@swtch.com/?shva=1#inbox/132e5fd3a6a3c17b
// where the last is the hex for the thread id.
// have to have the #inbox part right too.  #label/Hello+World/...
// or #all as a fallback

// TODO: ID command support (RFC 2971)

const mock = true

var user = "rsc@swtch.com"
var pw, _ = ioutil.ReadFile("/Users/rsc/.swtchpass")

func TestImap(t *testing.T) {
	var user, pw string
	if mock {
		testDial = fakeDial
		user = "gre@host.com"
		pw = "password"
	} else {
		acct := google.Acct("rsc@swtch.com")
		user = acct.Email
		pw = acct.Password
	}
	c, err := NewClient(TLS, "imap.gmail.com", user, pw, "")
	if err != nil {
		t.Fatal(err)
	}

	inbox := c.Inbox()
	msgs := inbox.Msgs()

	for _, m := range msgs {
		if m.UID == 611764547<<32|57046 {
			//			c.io.lock()
			//			c.cmd(c.boxByName[`[Gmail]/All Mail`], `UID SEARCH X-GM-RAW "label:russcox@gmail.com in:inbox in:unread -in:muted"`)
			//			c.cmd(c.inbox, `UID SEARCH X-GM-RAW "label:russcox@gmail.com in:inbox in:unread -in:muted"`)
			//			c.cmd(c.boxByName[`To Read`], `UID SEARCH X-GM-RAW "label:russcox@gmail.com in:inbox in:unread -in:muted"`)
			//			c.cmd(c.boxByName[`[Gmail]/All Mail`], `UID SEARCH X-GM-RAW "label:russcox@gmail.com in:inbox in:unread -in:muted"`)
			//			c.fetch(m.Root.Child[0], "")
			//			c.io.unlock()
			fmt.Println("--")
			fmt.Println("From:", m.Hdr.From)
			fmt.Println("To:", m.Hdr.To)
			fmt.Println("Subject:", m.Hdr.Subject)
			fmt.Println("M-Date:", time.Unix(m.Date, 0))
			fmt.Println("Date:", m.Hdr.Date)
			fmt.Println()
			fmt.Println(string(m.Root.Child[0].Text()))
			fmt.Println("--")
		}
	}
	c.Close()
}

func fakeDial(server string, mode Mode) (io.ReadWriteCloser, error) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()
	go fakeServer(&pipe2{r1, w2})
	return &pipe2{r2, w1}, nil
}

func fakeServer(rw io.ReadWriteCloser) {
	b := bufio.NewReader(rw)
	rw.Write([]byte(fakeReply[""]))
	for {
		line, err := b.ReadString('\n')
		if err != nil {
			break
		}
		reply := fakeReply[strings.TrimSpace(line)]
		if reply == "" {
			rw.Write([]byte("* BYE\r\n"))
			break
		}
		rw.Write([]byte(reply))
	}
	rw.Close()
}

var fakeReply = map[string]string{
	``: "* OK Gimap ready for requests from 71.232.17.63 k7if4537693qcx.66\r\n",
	`# LOGIN gre@host.com password`: "* CAPABILITY IMAP4rev1 UNSELECT IDLE NAMESPACE QUOTA ID XLIST CHILDREN X-GM-EXT-1 UIDPLUS COMPRESS=DEFLATE\r\n" +
		"# OK gre@host.com Grace Emlin authenticated (Success)\r\n",
	`# XLIST "" INBOX`: `* XLIST (\HasNoChildren \Inbox) "/" "Inbox"` + "\r\n" +
		"# OK Success\r\n",
	`# XLIST "" *`: `* XLIST (\HasNoChildren \Inbox) "/" "Inbox"` + "\r\n" +
		`* XLIST (\HasNoChildren) "/" "Someday"` + "\r\n" +
		`* XLIST (\HasNoChildren) "/" "To Read"` + "\r\n" +
		`* XLIST (\HasNoChildren) "/" "Waiting"` + "\r\n" +
		`* XLIST (\Noselect \HasChildren) "/" "[Gmail]"` + "\r\n" +
		`* XLIST (\HasNoChildren \AllMail) "/" "[Gmail]/All Mail"` + "\r\n" +
		`* XLIST (\HasNoChildren \Drafts) "/" "[Gmail]/Drafts"` + "\r\n" +
		`* XLIST (\HasNoChildren \Important) "/" "[Gmail]/Important"` + "\r\n" +
		`* XLIST (\HasNoChildren \Sent) "/" "[Gmail]/Sent Mail"` + "\r\n" +
		`* XLIST (\HasNoChildren \Spam) "/" "[Gmail]/Spam"` + "\r\n" +
		`* XLIST (\HasNoChildren \Starred) "/" "[Gmail]/Starred"` + "\r\n" +
		`* XLIST (\HasNoChildren \Trash) "/" "[Gmail]/Trash"` + "\r\n" +
		`* XLIST (\HasNoChildren) "/" "russcox@gmail.com"` + "\r\n" +
		"# OK Success\r\n",
	`# LIST "" INBOX`: `* LIST (\HasNoChildren) "/" "INBOX"` + "\r\n" +
		"# OK Success\r\n",
	`# LIST "" *`: `* LIST (\HasNoChildren) "/" "INBOX"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "Someday"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "To Read"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "Waiting"` + "\r\n" +
		`* LIST (\Noselect \HasChildren) "/" "[Gmail]"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/All Mail"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/Drafts"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/Important"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/Sent Mail"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/Spam"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/Starred"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "[Gmail]/Trash"` + "\r\n" +
		`* LIST (\HasNoChildren) "/" "russcox@gmail.com"` + "\r\n" +
		"# OK Success\r\n",
	`# SELECT inbox`: `* FLAGS (\Answered \Flagged \Draft \Deleted \Seen)` + "\r\n" +
		`* OK [PERMANENTFLAGS (\Answered \Flagged \Draft \Deleted \Seen \*)] Flags permitted.` + "\r\n" +
		`* OK [UIDVALIDITY 611764547] UIDs valid.` + "\r\n" +
		`* 9 EXISTS` + "\r\n" +
		`* 0 RECENT` + "\r\n" +
		`* OK [UIDNEXT 57027] Predicted next UID.` + "\r\n" +
		"# OK [READ-WRITE] inbox selected. (Success)\r\n",
	`# UID FETCH 1:* (FLAGS)`: `* 1 FETCH (UID 46074 FLAGS (\Seen))` + "\r\n" +
		`* 2 FETCH (UID 49094 FLAGS (\Seen))` + "\r\n" +
		`* 3 FETCH (UID 49317 FLAGS (\Seen))` + "\r\n" +
		`* 4 FETCH (UID 49424 FLAGS (\Flagged \Seen))` + "\r\n" +
		`* 5 FETCH (UID 49595 FLAGS (\Seen))` + "\r\n" +
		`* 6 FETCH (UID 49810 FLAGS (\Seen))` + "\r\n" +
		`* 7 FETCH (UID 50579 FLAGS (\Seen))` + "\r\n" +
		`* 8 FETCH (UID 50597 FLAGS (\Seen))` + "\r\n" +
		`* 9 FETCH (UID 50598 FLAGS (\Seen))` + "\r\n" +
		"# OK Success\r\n",
	`# FETCH 1:* (UID FLAGS)`: `* 1 FETCH (UID 46074 FLAGS (\Seen))` + "\r\n" +
		`* 2 FETCH (UID 49094 FLAGS (\Seen))` + "\r\n" +
		`* 3 FETCH (UID 49317 FLAGS (\Seen))` + "\r\n" +
		`* 4 FETCH (UID 49424 FLAGS (\Flagged \Seen))` + "\r\n" +
		`* 5 FETCH (UID 49595 FLAGS (\Seen))` + "\r\n" +
		`* 6 FETCH (UID 49810 FLAGS (\Seen))` + "\r\n" +
		`* 7 FETCH (UID 50579 FLAGS (\Seen))` + "\r\n" +
		`* 8 FETCH (UID 50597 FLAGS (\Seen))` + "\r\n" +
		`* 9 FETCH (UID 50598 FLAGS (\Seen))` + "\r\n" +
		"# OK Success\r\n",
	`# NOOP`: "# OK Success\r\n",
	`# UID FETCH 1:* (FLAGS X-GM-MSGID X-GM-THRID)`: `* 1 FETCH (X-GM-THRID 1371690017835349492 X-GM-MSGID 1371690017835349492 UID 46074 FLAGS (\Seen))` + "\r\n" +
		`* 2 FETCH (X-GM-THRID 1370053443095117076 X-GM-MSGID 1374032778063810116 UID 49094 FLAGS (\Seen))` + "\r\n" +
		`* 3 FETCH (X-GM-THRID 1370053443095117076 X-GM-MSGID 1374171123044094435 UID 49317 FLAGS (\Seen))` + "\r\n" +
		`* 4 FETCH (X-GM-THRID 1374260005724669308 X-GM-MSGID 1374260005724669308 UID 49424 FLAGS (\Flagged \Seen))` + "\r\n" +
		`* 5 FETCH (X-GM-THRID 1374399840419707240 X-GM-MSGID 1374399840419707240 UID 49595 FLAGS (\Seen))` + "\r\n" +
		`* 6 FETCH (X-GM-THRID 1374564698687599195 X-GM-MSGID 1374564698687599195 UID 49810 FLAGS (\Seen))` + "\r\n" +
		`* 7 FETCH (X-GM-THRID 1353701773219222407 X-GM-MSGID 1375207927094695931 UID 50579 FLAGS (\Seen))` + "\r\n" +
		`* 8 FETCH (X-GM-THRID 1375017086705541883 X-GM-MSGID 1375220323861690146 UID 50597 FLAGS (\Seen))` + "\r\n" +
		`* 9 FETCH (X-GM-THRID 1353701773219222407 X-GM-MSGID 1375220551142026521 UID 50598 FLAGS (\Seen))` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 1:* (FLAGS INTERNALDATE RFC822.SIZE ENVELOPE X-GM-MSGID X-GM-THRID)`: `* 1 FETCH (X-GM-THRID 1371690017835349492 X-GM-MSGID 1371690017835349492 UID 46074 RFC822.SIZE 5700 INTERNALDATE "15-Jun-2011 13:45:39 +0000" FLAGS (\Seen) ENVELOPE ("Wed, 15 Jun 2011 13:45:35 +0000" "[re2-dev] Issue 40 in re2: Please make RE2::Rewrite public" ((NIL NIL "re2" "googlecode.com")) ((NIL NIL "re2-dev" "googlegroups.com")) ((NIL NIL "codesite-noreply" "google.com")) ((NIL NIL "re2-dev" "googlegroups.com")) NIL NIL NIL "<0-13244084390050003171-8842966241254494762-re2=googlecode.com@googlecode.com>"))` + "\r\n" +
		`* 2 FETCH (X-GM-THRID 1370053443095117076 X-GM-MSGID 1374032778063810116 UID 49094 RFC822.SIZE 3558 INTERNALDATE "11-Jul-2011 10:22:49 +0000" FLAGS (\Seen) ENVELOPE ("Mon, 11 Jul 2011 12:22:46 +0200" "Re: [re2-dev] Re: Issue 39 in re2: Eiffel wrapper for RE2" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Russ Cox" NIL "rsc" "swtch.com")) NIL NIL "<CADSkJJWthFb61R1tqJxZP1SxTPuwY_BBW5ToLuzX2UpHSvsy9w@mail.gmail.com>" "<4E1ACEF6.4060609@gmail.com>"))` + "\r\n" +
		`* 3 FETCH (X-GM-THRID 1370053443095117076 X-GM-MSGID 1374171123044094435 UID 49317 RFC822.SIZE 3323 INTERNALDATE "12-Jul-2011 23:01:46 +0000" FLAGS (\Seen) ENVELOPE ("Wed, 13 Jul 2011 01:01:41 +0200" "Re: [re2-dev] Re: Issue 39 in re2: Eiffel wrapper for RE2" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Russ Cox" NIL "rsc" "swtch.com")) NIL NIL "<CADSkJJV+E-0Xtm=dpiSHLbwkZjZ=zDDoE1t1w0CiGYa+pVz66g@mail.gmail.com>" "<4E1CD255.6060807@gmail.com>"))` + "\r\n" +
		`* 4 FETCH (X-GM-THRID 1374260005724669308 X-GM-MSGID 1374260005724669308 UID 49424 RFC822.SIZE 2681 INTERNALDATE "13-Jul-2011 22:34:31 +0000" FLAGS (\Flagged \Seen) ENVELOPE ("Wed, 13 Jul 2011 16:33:43 -0600" "Minor correction for venti(8) user manual for running plan9port on Linux" (("Xing" NIL "xinglin" "cs.utah.edu")) (("Xing" NIL "xinglin" "cs.utah.edu")) (("Xing" NIL "xinglin" "cs.utah.edu")) ((NIL NIL "rsc" "swtch.com")) (("Xing Lin" NIL "xinglin" "cs.utah.edu") ("Raghuveer Pullakandam" NIL "rgv" "cs.utah.edu") ("Robert Ricci" NIL "ricci" "cs.utah.edu") ("Eric Eide" NIL "eeide" "cs.utah.edu")) NIL NIL "<1310596423.3866.11.camel@xing-utah-cs>"))` + "\r\n" +
		`* 5 FETCH (X-GM-THRID 1374399840419707240 X-GM-MSGID 1374399840419707240 UID 49595 RFC822.SIZE 6496 INTERNALDATE "15-Jul-2011 11:37:07 +0000" FLAGS (\Seen) ENVELOPE ("Fri, 15 Jul 2011 13:36:54 +0200" "[re2-dev] MSVC not exporting VariadicFunction2<.. FullMatchN>::operator()(..) but VariadicFunction2<.. PartialMatchN>::operator()(..)" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) NIL NIL NIL "<4E202656.7010408@gmail.com>"))` + "\r\n" +
		`* 6 FETCH (X-GM-THRID 1374564698687599195 X-GM-MSGID 1374564698687599195 UID 49810 RFC822.SIZE 5485 INTERNALDATE "17-Jul-2011 07:17:29 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 17 Jul 2011 00:17:28 -0700" "Acme IRC client patch" (("Ethan Burns" NIL "burns.ethan" "gmail.com")) (("Ethan Burns" NIL "burns.ethan" "gmail.com")) (("Ethan Burns" NIL "burns.ethan" "gmail.com")) ((NIL NIL "rsc" "swtch.com")) NIL NIL NIL "<CAGE=Ei0bmAjsYYDxCgtDObuxX_tCU18RcWTe6siwemXAuKqDfg@mail.gmail.com>"))` + "\r\n" +
		`* 7 FETCH (X-GM-THRID 1353701773219222407 X-GM-MSGID 1375207927094695931 UID 50579 RFC822.SIZE 4049 INTERNALDATE "24-Jul-2011 09:41:19 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 24 Jul 2011 02:41:14 -0700 (PDT)" "Re: [re2-dev] Re: MSVC build" ((NIL NIL "talgil" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) ((NIL NIL "re2-dev" "googlegroups.com")) ((NIL NIL "re2-dev" "googlegroups.com")) (("ioannis" NIL "ioannis.e" "gmail.com")) NIL "<AANLkTin8_-yDr8tcb9SosfQ_iAM6RmfzpLQB0gX0vv6w@mail.gmail.com>" "<24718992.6777.1311500475040.JavaMail.geo-discussion-forums@yqyy3>"))` + "\r\n" +
		`* 8 FETCH (X-GM-THRID 1375017086705541883 X-GM-MSGID 1375220323861690146 UID 50597 RFC822.SIZE 3070 INTERNALDATE "24-Jul-2011 12:58:22 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 24 Jul 2011 14:58:15 +0200" "Re: [re2-dev] Rearranging platform dependant features" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Russ Cox" NIL "rsc" "swtch.com")) NIL NIL "<CADSkJJV+eCPkkhsepo5k0w+dqVo0fQOana2bWp4BexGOrCSSUQ@mail.gmail.com>" "<4E2C16E7.3060500@gmail.com>"))` + "\r\n" +
		`* 9 FETCH (X-GM-THRID 1353701773219222407 X-GM-MSGID 1375220551142026521 UID 50598 RFC822.SIZE 5744 INTERNALDATE "24-Jul-2011 13:01:59 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 24 Jul 2011 15:01:49 +0200" "Re: [re2-dev] Re: MSVC build" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) NIL NIL "<24718992.6777.1311500475040.JavaMail.geo-discussion-forums@yqyy3>" "<4E2C17BD.6000702@gmail.com>"))` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57047:* (FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODY X-GM-MSGID X-GM-THRID X-GM-LABELS)`: `* 9 FETCH (X-GM-THRID 1382192619814696847 X-GM-MSGID 1382192619814696847 X-GM-LABELS ("\\Important" russcox@gmail.com) UID 57046 RFC822.SIZE 4170 INTERNALDATE "09-Oct-2011 12:00:02 +0000" FLAGS () ENVELOPE ("Sun, 09 Oct 2011 12:00:02 +0000" "You have no events scheduled today." (("Google Calendar" NIL "calendar-notification" "google.com")) (("Google Calendar" NIL "calendar-notification" "google.com")) (("Russ Cox" NIL "russcox" "gmail.com")) (("Russ Cox" NIL "russcox" "gmail.com")) NIL NIL NIL "<bcaec501c5be15fc7204aedc6af6@google.com>") BODY (("TEXT" "PLAIN" ("CHARSET" "ISO-8859-1" "DELSP" "yes" "FORMAT" "flowed") NIL NIL "7BIT" 465 11)("TEXT" "HTML" ("CHARSET" "ISO-8859-1") NIL NIL "QUOTED-PRINTABLE" 914 12) "ALTERNATIVE"))` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 1:* (FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODY X-GM-MSGID X-GM-THRID X-GM-LABELS)`: `* 1 FETCH (X-GM-THRID 1371690017835349492 X-GM-MSGID 1371690017835349492 X-GM-LABELS () UID 46074 RFC822.SIZE 5700 INTERNALDATE "15-Jun-2011 13:45:39 +0000" FLAGS (\Seen) ENVELOPE ("Wed, 15 Jun 2011 13:45:35 +0000" "[re2-dev] Issue 40 in re2: Please make RE2::Rewrite public" ((NIL NIL "re2" "googlecode.com")) ((NIL NIL "re2-dev" "googlegroups.com")) ((NIL NIL "codesite-noreply" "google.com")) ((NIL NIL "re2-dev" "googlegroups.com")) NIL NIL NIL "<0-13244084390050003171-8842966241254494762-re2=googlecode.com@googlecode.com>") BODY ("TEXT" "PLAIN" ("CHARSET" "ISO-8859-1" "DELSP" "yes" "FORMAT" "flowed") NIL NIL "7BIT" 389 11))` + "\r\n" +
		`* 2 FETCH (X-GM-THRID 1370053443095117076 X-GM-MSGID 1374032778063810116 X-GM-LABELS ("\\Important") UID 49094 RFC822.SIZE 3558 INTERNALDATE "11-Jul-2011 10:22:49 +0000" FLAGS (\Seen) ENVELOPE ("Mon, 11 Jul 2011 12:22:46 +0200" "Re: [re2-dev] Re: Issue 39 in re2: Eiffel wrapper for RE2" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Russ Cox" NIL "rsc" "swtch.com")) NIL NIL "<CADSkJJWthFb61R1tqJxZP1SxTPuwY_BBW5ToLuzX2UpHSvsy9w@mail.gmail.com>" "<4E1ACEF6.4060609@gmail.com>") BODY ("TEXT" "PLAIN" ("CHARSET" "UTF-8" "FORMAT" "flowed") NIL NIL "7BIT" 766 24))` + "\r\n" +
		`* 3 FETCH (X-GM-THRID 1370053443095117076 X-GM-MSGID 1374171123044094435 X-GM-LABELS ("\\Important") UID 49317 RFC822.SIZE 3323 INTERNALDATE "12-Jul-2011 23:01:46 +0000" FLAGS (\Seen) ENVELOPE ("Wed, 13 Jul 2011 01:01:41 +0200" "Re: [re2-dev] Re: Issue 39 in re2: Eiffel wrapper for RE2" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Russ Cox" NIL "rsc" "swtch.com")) NIL NIL "<CADSkJJV+E-0Xtm=dpiSHLbwkZjZ=zDDoE1t1w0CiGYa+pVz66g@mail.gmail.com>" "<4E1CD255.6060807@gmail.com>") BODY ("TEXT" "PLAIN" ("CHARSET" "UTF-8" "FORMAT" "flowed") NIL NIL "7BIT" 435 12))` + "\r\n" +
		`* 4 FETCH (X-GM-THRID 1374260005724669308 X-GM-MSGID 1374260005724669308 X-GM-LABELS ("\\Important" "\\Starred") UID 49424 RFC822.SIZE 2681 INTERNALDATE "13-Jul-2011 22:34:31 +0000" FLAGS (\Flagged \Seen) ENVELOPE ("Wed, 13 Jul 2011 16:33:43 -0600" "Minor correction for venti(8) user manual for running plan9port on Linux" (("Xing" NIL "xinglin" "cs.utah.edu")) (("Xing" NIL "xinglin" "cs.utah.edu")) (("Xing" NIL "xinglin" "cs.utah.edu")) ((NIL NIL "rsc" "swtch.com")) (("Xing Lin" NIL "xinglin" "cs.utah.edu") ("Raghuveer Pullakandam" NIL "rgv" "cs.utah.edu") ("Robert Ricci" NIL "ricci" "cs.utah.edu") ("Eric Eide" NIL "eeide" "cs.utah.edu")) NIL NIL "<1310596423.3866.11.camel@xing-utah-cs>") BODY ("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "8BIT" 789 25))` + "\r\n" +
		`* 5 FETCH (X-GM-THRID 1374399840419707240 X-GM-MSGID 1374399840419707240 X-GM-LABELS ("\\Important") UID 49595 RFC822.SIZE 6496 INTERNALDATE "15-Jul-2011 11:37:07 +0000" FLAGS (\Seen) ENVELOPE ("Fri, 15 Jul 2011 13:36:54 +0200" "[re2-dev] MSVC not exporting VariadicFunction2<.. FullMatchN>::operator()(..) but VariadicFunction2<.. PartialMatchN>::operator()(..)" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) NIL NIL NIL "<4E202656.7010408@gmail.com>") BODY ("TEXT" "PLAIN" ("CHARSET" "ISO-8859-1" "FORMAT" "flowed") NIL NIL "7BIT" 1660 34))` + "\r\n" +
		`* 6 FETCH (X-GM-THRID 1374564698687599195 X-GM-MSGID 1374564698687599195 X-GM-LABELS ("\\Important") UID 49810 RFC822.SIZE 5485 INTERNALDATE "17-Jul-2011 07:17:29 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 17 Jul 2011 00:17:28 -0700" "Acme IRC client patch" (("Ethan Burns" NIL "burns.ethan" "gmail.com")) (("Ethan Burns" NIL "burns.ethan" "gmail.com")) (("Ethan Burns" NIL "burns.ethan" "gmail.com")) ((NIL NIL "rsc" "swtch.com")) NIL NIL NIL "<CAGE=Ei0bmAjsYYDxCgtDObuxX_tCU18RcWTe6siwemXAuKqDfg@mail.gmail.com>") BODY (("TEXT" "PLAIN" ("CHARSET" "ISO-8859-1") NIL NIL "7BIT" 443 13)("TEXT" "X-PATCH" ("CHARSET" "US-ASCII" "NAME" "emote.patch") NIL NIL "BASE64" 2774 35) "MIXED"))` + "\r\n" +
		`* 7 FETCH (X-GM-THRID 1353701773219222407 X-GM-MSGID 1375207927094695931 X-GM-LABELS ("\\Important") UID 50579 RFC822.SIZE 4049 INTERNALDATE "24-Jul-2011 09:41:19 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 24 Jul 2011 02:41:14 -0700 (PDT)" "Re: [re2-dev] Re: MSVC build" ((NIL NIL "talgil" "gmail.com")) ((NIL NIL "re2-dev" "googlegroups.com")) ((NIL NIL "re2-dev" "googlegroups.com")) ((NIL NIL "re2-dev" "googlegroups.com")) (("ioannis" NIL "ioannis.e" "gmail.com")) NIL "<AANLkTin8_-yDr8tcb9SosfQ_iAM6RmfzpLQB0gX0vv6w@mail.gmail.com>" "<24718992.6777.1311500475040.JavaMail.geo-discussion-forums@yqyy3>") BODY (("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" 133 8)("TEXT" "HTML" ("CHARSET" "UTF-8") NIL NIL "7BIT" 211 0) "ALTERNATIVE"))` + "\r\n" +
		`* 8 FETCH (X-GM-THRID 1375017086705541883 X-GM-MSGID 1375220323861690146 X-GM-LABELS ("\\Important") UID 50597 RFC822.SIZE 3070 INTERNALDATE "24-Jul-2011 12:58:22 +0000" FLAGS (\Seen) ENVELOPE ("Sun, 24 Jul 2011 14:58:15 +0200" "Re: [re2-dev] Rearranging platform dependant features" (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Pontus Carlsson" NIL "pontusjoncarlsson" "gmail.com")) (("Russ Cox" NIL "rsc" "swtch.com")) NIL NIL "<CADSkJJV+eCPkkhsepo5k0w+dqVo0fQOana2bWp4BexGOrCSSUQ@mail.gmail.com>" "<4E2C16E7.3060500@gmail.com>") BODY ("TEXT" "PLAIN" ("CHARSET" "UTF-8" "FORMAT" "flowed") NIL NIL "7BIT" 450 10))` + "\r\n" +
		`* 9 FETCH (X-GM-THRID 1382192619814696847 X-GM-MSGID 1382192619814696847 X-GM-LABELS ("\\Important" russcox@gmail.com) UID 57046 RFC822.SIZE 4170 INTERNALDATE "09-Oct-2011 12:00:02 +0000" FLAGS () ENVELOPE ("Sun, 09 Oct 2011 12:00:02 +0000" "You have no events scheduled today." (("Google Calendar" NIL "calendar-notification" "google.com")) (("Google Calendar" NIL "calendar-notification" "google.com")) (("Russ Cox" NIL "russcox" "gmail.com")) (("Russ Cox" NIL "russcox" "gmail.com")) NIL NIL NIL "<bcaec501c5be15fc7204aedc6af6@google.com>") BODY (("TEXT" "PLAIN" ("CHARSET" "ISO-8859-1" "DELSP" "yes" "FORMAT" "flowed") NIL NIL "7BIT" 465 11)("TEXT" "HTML" ("CHARSET" "ISO-8859-1") NIL NIL "QUOTED-PRINTABLE" 914 12) "ALTERNATIVE"))` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[1]`: `* 9 FETCH (UID 57046 BODY[1] {465}` + "\r\n" +
		`russcox@gmail.com, you have no events scheduled today Sun Oct 9, 2011.` + "\r\n" +
		`` + "\r\n" +
		`View your calendar at https://www.google.com/calendar/` + "\r\n" +
		`` + "\r\n" +
		`You are receiving this email at the account russcox@gmail.com because you  ` + "\r\n" +
		`are subscribed to receive daily agendas for the following calendars: Russ  ` + "\r\n" +
		`Cox.` + "\r\n" +
		`` + "\r\n" +
		`To change which calendars you receive daily agendas for, please log in to  ` + "\r\n" +
		`https://www.google.com/calendar/ and change your notification settings for  ` + "\r\n" +
		`each calendar.` + "\r\n" +
		`)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[1.TEXT]`: `* 9 FETCH (UID 57046 BODY[1.TEXT] NIL)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[1.HEADER]`: `* 9 FETCH (UID 57046 BODY[1.HEADER] NIL)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[1.MIME]`: `* 146 FETCH (UID 57046 BODY[1.MIME] {74}` + "\r\n" +
		`Content-Type: text/plain; charset=ISO-8859-1; format=flowed; delsp=yes` + "\r\n" +
		`` + "\r\n" +
		`)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[2]`: `* 146 FETCH (UID 57046 BODY[2] {914}` + "\r\n" +
		`<div style=3D"padding:10px 7px;font-size:14px;line-height:1.4;font-family:A=` + "\r\n" +
		`rial,Sans-serif;text-align:left;bgcolor=3D#ffffff"><a href=3D"https://www.g=` + "\r\n" +
		`oogle.com/calendar/"><img style=3D"border-width:0" src=3D"https://www.googl=` + "\r\n" +
		`e.com/calendar/images/calendar_logo_sm_en.gif" alt=3D"Google Calendar"></a>` + "\r\n" +
		`<p style=3D"margin:0;color:#0">russcox@gmail.com,&nbsp;you have no events s=` + "\r\n" +
		`cheduled today <b>Sun Oct 9, 2011</b></p>` + "\r\n" +
		`<p style=3D"font-family:Arial,Sans-serif;color:#666;font-size:11px">You are=` + "\r\n" +
		` receiving this email at the account russcox@gmail.com because you are subs=` + "\r\n" +
		`cribed to receive daily agendas for the following calendars: Russ Cox.</p>` + "\r\n" +
		`<p style=3D"font-family:Arial,Sans-serif;color:#666;font-size:11px">To chan=` + "\r\n" +
		`ge which calendars you receive daily agendas for, please log in to https://=` + "\r\n" +
		`www.google.com/calendar/ and change your notification settings for each cal=` + "\r\n" +
		`endar.</p></div>)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[2.TEXT]`: `* 9 FETCH (UID 57046 BODY[2.TEXT] NIL)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[2.HEADER]`: `* 9 FETCH (UID 57046 BODY[2.HEADER] NIL)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[2.MIME]`: `* 146 FETCH (UID 57046 BODY[2.MIME] {92}` + "\r\n" +
		`Content-Type: text/html; charset=ISO-8859-1` + "\r\n" +
		`Content-Transfer-Encoding: quoted-printable` + "\r\n" +
		`` + "\r\n" +
		`)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[]`: `* 146 FETCH (UID 57046 BODY[] {4170}` + "\r\n" +
		`Delivered-To: rsc@swtch.com` + "\r\n" +
		`Received: by 10.216.54.148 with SMTP id i20cs32329wec;` + "\r\n" +
		`        Sun, 9 Oct 2011 05:00:30 -0700 (PDT)` + "\r\n" +
		`Received: by 10.227.11.2 with SMTP id r2mr4751812wbr.43.1318161630585;` + "\r\n" +
		`        Sun, 09 Oct 2011 05:00:30 -0700 (PDT)` + "\r\n" +
		`DomainKey-Status: good` + "\r\n" +
		`Received-SPF: softfail (google.com: best guess record for domain of transitioning 3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com does not designate <unknown> as permitted sender)` + "\r\n" +
		`Received: by 10.241.227.90 with POP3 id 26mf2646912wyj.48;` + "\r\n" +
		`        Sun, 09 Oct 2011 05:00:29 -0700 (PDT)` + "\r\n" +
		`X-Gmail-Fetch-Info: russcox@gmail.com 1 smtp.gmail.com 995 russcox` + "\r\n" +
		`Delivered-To: russcox@gmail.com` + "\r\n" +
		`Received: by 10.142.76.10 with SMTP id y10cs75487wfa;` + "\r\n" +
		`        Sun, 9 Oct 2011 05:00:08 -0700 (PDT)` + "\r\n" +
		`Return-Path: <3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com>` + "\r\n" +
		`Received-SPF: pass (google.com: domain of 3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com designates 10.52.73.100 as permitted sender) client-ip=10.52.73.100;` + "\r\n" +
		`Authentication-Results: mr.google.com; spf=pass (google.com: domain of 3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com designates 10.52.73.100 as permitted sender) smtp.mail=3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com; dkim=pass header.i=3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com` + "\r\n" +
		`Received: from mr.google.com ([10.52.73.100])` + "\r\n" +
		`        by 10.52.73.100 with SMTP id k4mr8053242vdv.5.1318161606360 (num_hops = 1);` + "\r\n" +
		`        Sun, 09 Oct 2011 05:00:06 -0700 (PDT)` + "\r\n" +
		`DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;` + "\r\n" +
		`        d=google.com; s=beta;` + "\r\n" +
		`        h=mime-version:reply-to:auto-submitted:message-id:date:subject:from` + "\r\n" +
		`         :to:content-type;` + "\r\n" +
		`        bh=SGjz0F4q+eFVkoC4yzLKQKvlxTKiUsYbO/KPI+3KOE8=;` + "\r\n" +
		`        b=LRBkWBW7ZZ4UJYa7b92zfHa0ZM1K1d0wP/jbgmDw2OZTWtgDICZb30dzhFUfNVdxeN` + "\r\n" +
		`         kdMFbRhTLP5NpSXWhbDw==` + "\r\n" +
		`MIME-Version: 1.0` + "\r\n" +
		`Received: by 10.52.73.100 with SMTP id k4mr5244039vdv.5.1318161602706; Sun, 09` + "\r\n" +
		` Oct 2011 05:00:02 -0700 (PDT)` + "\r\n" +
		`Reply-To: Russ Cox <russcox@gmail.com>` + "\r\n" +
		`Auto-Submitted: auto-generated` + "\r\n" +
		`Message-ID: <bcaec501c5be15fc7204aedc6af6@google.com>` + "\r\n" +
		`Date: Sun, 09 Oct 2011 12:00:02 +0000` + "\r\n" +
		`Subject: You have no events scheduled today.` + "\r\n" +
		`From: Google Calendar <calendar-notification@google.com>` + "\r\n" +
		`To: Russ Cox <russcox@gmail.com>` + "\r\n" +
		`Content-Type: multipart/alternative; boundary=bcaec501c5be15fc6504aedc6af3` + "\r\n" +
		`` + "\r\n" +
		`--bcaec501c5be15fc6504aedc6af3` + "\r\n" +
		`Content-Type: text/plain; charset=ISO-8859-1; format=flowed; delsp=yes` + "\r\n" +
		`` + "\r\n" +
		`russcox@gmail.com, you have no events scheduled today Sun Oct 9, 2011.` + "\r\n" +
		`` + "\r\n" +
		`View your calendar at https://www.google.com/calendar/` + "\r\n" +
		`` + "\r\n" +
		`You are receiving this email at the account russcox@gmail.com because you  ` + "\r\n" +
		`are subscribed to receive daily agendas for the following calendars: Russ  ` + "\r\n" +
		`Cox.` + "\r\n" +
		`` + "\r\n" +
		`To change which calendars you receive daily agendas for, please log in to  ` + "\r\n" +
		`https://www.google.com/calendar/ and change your notification settings for  ` + "\r\n" +
		`each calendar.` + "\r\n" +
		`` + "\r\n" +
		`--bcaec501c5be15fc6504aedc6af3` + "\r\n" +
		`Content-Type: text/html; charset=ISO-8859-1` + "\r\n" +
		`Content-Transfer-Encoding: quoted-printable` + "\r\n" +
		`` + "\r\n" +
		`<div style=3D"padding:10px 7px;font-size:14px;line-height:1.4;font-family:A=` + "\r\n" +
		`rial,Sans-serif;text-align:left;bgcolor=3D#ffffff"><a href=3D"https://www.g=` + "\r\n" +
		`oogle.com/calendar/"><img style=3D"border-width:0" src=3D"https://www.googl=` + "\r\n" +
		`e.com/calendar/images/calendar_logo_sm_en.gif" alt=3D"Google Calendar"></a>` + "\r\n" +
		`<p style=3D"margin:0;color:#0">russcox@gmail.com,&nbsp;you have no events s=` + "\r\n" +
		`cheduled today <b>Sun Oct 9, 2011</b></p>` + "\r\n" +
		`<p style=3D"font-family:Arial,Sans-serif;color:#666;font-size:11px">You are=` + "\r\n" +
		` receiving this email at the account russcox@gmail.com because you are subs=` + "\r\n" +
		`cribed to receive daily agendas for the following calendars: Russ Cox.</p>` + "\r\n" +
		`<p style=3D"font-family:Arial,Sans-serif;color:#666;font-size:11px">To chan=` + "\r\n" +
		`ge which calendars you receive daily agendas for, please log in to https://=` + "\r\n" +
		`www.google.com/calendar/ and change your notification settings for each cal=` + "\r\n" +
		`endar.</p></div>` + "\r\n" +
		`--bcaec501c5be15fc6504aedc6af3--` + "\r\n" +
		`)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[TEXT]`: `* 146 FETCH (UID 57046 BODY[TEXT] {1647}` + "\r\n" +
		`--bcaec501c5be15fc6504aedc6af3` + "\r\n" +
		`Content-Type: text/plain; charset=ISO-8859-1; format=flowed; delsp=yes` + "\r\n" +
		`` + "\r\n" +
		`russcox@gmail.com, you have no events scheduled today Sun Oct 9, 2011.` + "\r\n" +
		`` + "\r\n" +
		`View your calendar at https://www.google.com/calendar/` + "\r\n" +
		`` + "\r\n" +
		`You are receiving this email at the account russcox@gmail.com because you  ` + "\r\n" +
		`are subscribed to receive daily agendas for the following calendars: Russ  ` + "\r\n" +
		`Cox.` + "\r\n" +
		`` + "\r\n" +
		`To change which calendars you receive daily agendas for, please log in to  ` + "\r\n" +
		`https://www.google.com/calendar/ and change your notification settings for  ` + "\r\n" +
		`each calendar.` + "\r\n" +
		`` + "\r\n" +
		`--bcaec501c5be15fc6504aedc6af3` + "\r\n" +
		`Content-Type: text/html; charset=ISO-8859-1` + "\r\n" +
		`Content-Transfer-Encoding: quoted-printable` + "\r\n" +
		`` + "\r\n" +
		`<div style=3D"padding:10px 7px;font-size:14px;line-height:1.4;font-family:A=` + "\r\n" +
		`rial,Sans-serif;text-align:left;bgcolor=3D#ffffff"><a href=3D"https://www.g=` + "\r\n" +
		`oogle.com/calendar/"><img style=3D"border-width:0" src=3D"https://www.googl=` + "\r\n" +
		`e.com/calendar/images/calendar_logo_sm_en.gif" alt=3D"Google Calendar"></a>` + "\r\n" +
		`<p style=3D"margin:0;color:#0">russcox@gmail.com,&nbsp;you have no events s=` + "\r\n" +
		`cheduled today <b>Sun Oct 9, 2011</b></p>` + "\r\n" +
		`<p style=3D"font-family:Arial,Sans-serif;color:#666;font-size:11px">You are=` + "\r\n" +
		` receiving this email at the account russcox@gmail.com because you are subs=` + "\r\n" +
		`cribed to receive daily agendas for the following calendars: Russ Cox.</p>` + "\r\n" +
		`<p style=3D"font-family:Arial,Sans-serif;color:#666;font-size:11px">To chan=` + "\r\n" +
		`ge which calendars you receive daily agendas for, please log in to https://=` + "\r\n" +
		`www.google.com/calendar/ and change your notification settings for each cal=` + "\r\n" +
		`endar.</p></div>` + "\r\n" +
		`--bcaec501c5be15fc6504aedc6af3--` + "\r\n" +
		`)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[HEADER]`: `* 146 FETCH (UID 57046 BODY[HEADER] {2453}` + "\r\n" +
		`Delivered-To: rsc@swtch.com` + "\r\n" +
		`Received: by 10.216.54.148 with SMTP id i20cs32329wec; Sun, 9 Oct 2011` + "\r\n" +
		` 05:00:30 -0700 (PDT)` + "\r\n" +
		`Received: by 10.227.11.2 with SMTP id r2mr4751812wbr.43.1318161630585; Sun, 09` + "\r\n" +
		` Oct 2011 05:00:30 -0700 (PDT)` + "\r\n" +
		`DomainKey-Status: good` + "\r\n" +
		`Received-SPF: softfail (google.com: best guess record for domain of` + "\r\n" +
		` transitioning` + "\r\n" +
		` 3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com` + "\r\n" +
		` does not designate <unknown> as permitted sender)` + "\r\n" +
		`Received: by 10.241.227.90 with POP3 id 26mf2646912wyj.48; Sun, 09 Oct 2011` + "\r\n" +
		` 05:00:29 -0700 (PDT)` + "\r\n" +
		`X-Gmail-Fetch-Info: russcox@gmail.com 1 smtp.gmail.com 995 russcox` + "\r\n" +
		`Delivered-To: russcox@gmail.com` + "\r\n" +
		`Received: by 10.142.76.10 with SMTP id y10cs75487wfa; Sun, 9 Oct 2011 05:00:08` + "\r\n" +
		` -0700 (PDT)` + "\r\n" +
		`Return-Path: <3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com>` + "\r\n" +
		`Received-SPF: pass (google.com: domain of` + "\r\n" +
		` 3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com` + "\r\n" +
		` designates 10.52.73.100 as permitted sender) client-ip=10.52.73.100;` + "\r\n" +
		`Authentication-Results: mr.google.com; spf=pass (google.com: domain of` + "\r\n" +
		` 3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com` + "\r\n" +
		` designates 10.52.73.100 as permitted sender)` + "\r\n" +
		` smtp.mail=3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com;` + "\r\n" +
		` dkim=pass` + "\r\n" +
		` header.i=3woyRTgcJB5sMPNN7JSBH5DG.7JHMPNN7JSBH5DG.7JH@calendar-server.bounces.google.com` + "\r\n" +
		`Received: from mr.google.com ([10.52.73.100]) by 10.52.73.100 with SMTP id` + "\r\n" +
		` k4mr8053242vdv.5.1318161606360 (num_hops = 1); Sun, 09 Oct 2011 05:00:06` + "\r\n" +
		` -0700 (PDT)` + "\r\n" +
		`DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=beta;` + "\r\n" +
		` h=mime-version:reply-to:auto-submitted:message-id:date:subject:from` + "\r\n" +
		` :to:content-type; bh=SGjz0F4q+eFVkoC4yzLKQKvlxTKiUsYbO/KPI+3KOE8=;` + "\r\n" +
		` b=LRBkWBW7ZZ4UJYa7b92zfHa0ZM1K1d0wP/jbgmDw2OZTWtgDICZb30dzhFUfNVdxeN` + "\r\n" +
		` kdMFbRhTLP5NpSXWhbDw==` + "\r\n" +
		`MIME-Version: 1.0` + "\r\n" +
		`Received: by 10.52.73.100 with SMTP id k4mr5244039vdv.5.1318161602706; Sun, 09` + "\r\n" +
		` Oct 2011 05:00:02 -0700 (PDT)` + "\r\n" +
		`Reply-To: Russ Cox <russcox@gmail.com>` + "\r\n" +
		`Auto-Submitted: auto-generated` + "\r\n" +
		`Message-ID: <bcaec501c5be15fc7204aedc6af6@google.com>` + "\r\n" +
		`Date: Sun, 09 Oct 2011 12:00:02 +0000` + "\r\n" +
		`Subject: You have no events scheduled today.` + "\r\n" +
		`From: Google Calendar <calendar-notification@google.com>` + "\r\n" +
		`To: Russ Cox <russcox@gmail.com>` + "\r\n" +
		`Content-Type: multipart/alternative; boundary=bcaec501c5be15fc6504aedc6af3` + "\r\n" +
		`` + "\r\n" +
		`)` + "\r\n" +
		"# OK Success\r\n",
	`# UID FETCH 57046 BODY[MIME]`: "# BAD Could not parse command\r\n",
}

/*
 mail sending

package main

import (
	"log"
	"io/ioutil"
	"smtp"
	"time"
)
var pw, _ = ioutil.ReadFile("/Users/rsc/.swtchpass")
var msg = `From: "Russ Cox" <rsc@golang.org>
To: "Russ Cox" <rsc@google.com>
Subject: test from Go

This is a message sent from Go
`

BUG: Does not *REQUIRE* auth.  Should.

func main() {
	auth := smtp.PlainAuth(
		"",
		"rsc@swtch.com",
		string(pw),
		"smtp.gmail.com",
	)
	if err := smtp.SendMail("smtp.gmail.com:587", auth, "rsc@swtch.com", []string{"rsc@google.com"}, []byte(msg+time.LocalTime().String())); err != nil {
		log.Fatal(err)
	}
	println("SENT")
}
*/
