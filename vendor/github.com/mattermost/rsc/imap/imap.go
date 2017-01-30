package imap

import (
	"bufio"
	"bytes"
	"crypto/md5"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

var Debug = false

const tag = "#"

// A Mode specifies the IMAP connection mode.
type Mode int

const (
	Unencrypted Mode = iota // unencrypted TCP connection
	StartTLS                // use IMAP STARTTLS command - unimplemented!
	TLS                     // direct TLS connection
	Command                 // exec shell command (server name)
)

type lock struct {
	locked bool
	mu     sync.Mutex
}

func (l *lock) lock() {
	l.mu.Lock()
	l.locked = true
}

func (l *lock) unlock() {
	l.mustBeLocked()
	l.locked = false
	l.mu.Unlock()
}

func (l *lock) mustBeLocked() {
	if !l.locked {
		panic("not locked")
	}
}

type Client struct {
	server string
	user   string
	passwd string
	mode   Mode
	root   string

	io            lock
	rw            io.ReadWriteCloser // i/o to server
	b             *bufio.Reader      // buffered rw
	autoReconnect bool               // reconnect on failure
	connected     bool               // rw is active

	data       lock
	capability map[string]bool
	flags      Flags
	boxByName  map[string]*Box // all known boxes
	allBox     []*Box          // all known boxes (do we need this?)
	rootBox    *Box            // root of box tree
	inbox      *Box            // inbox (special, not in tree)
	box        *Box            // selected (current) box
	nextBox    *Box            // next box to select (do we need this?)
}

func NewClient(mode Mode, server, user, passwd string, root string) (*Client, error) {
	c := &Client{
		server:    server,
		user:      user,
		passwd:    passwd,
		mode:      mode,
		root:      root,
		boxByName: map[string]*Box{},
	}
	c.io.lock()
	if err := c.reconnect(); err != nil {
		return nil, err
	}
	c.autoReconnect = true
	c.io.unlock()

	return c, nil
}

func (c *Client) Close() error {
	c.io.lock()
	c.autoReconnect = false
	c.connected = false
	if c.rw != nil {
		c.rw.Close()
		c.rw = nil
	}
	c.io.unlock()
	return nil
}

func (c *Client) reconnect() error {
	c.io.mustBeLocked()
	c.autoReconnect = false
	if c.rw != nil {
		c.rw.Close()
		c.rw = nil
	}

	if Debug {
		log.Printf("dial %s...", c.server)
	}
	rw, err := dial(c.server, c.mode)
	if err != nil {
		return err
	}

	c.rw = rw
	c.connected = true
	c.capability = nil
	c.box = nil
	if Debug {
		c.b = bufio.NewReader(&tee{rw, os.Stderr})
	} else {
		c.b = bufio.NewReader(rw)
	}
	x, err := c.rdsx()
	if x == nil {
		err = fmt.Errorf("no greeting from %s: %v", c.server, err)
		goto Error
	}
	if len(x.sx) < 2 || !x.sx[0].isAtom("*") || !x.sx[1].isAtom("PREAUTH") {
		if !x.ok() {
			err = fmt.Errorf("bad greeting - %s", x)
			goto Error
		}
		if err = c.login(); err != nil {
			goto Error
		}
	}
	if c.capability == nil {
		if err = c.cmd(nil, "CAPABILITY"); err != nil {
			goto Error
		}
		if c.capability == nil {
			err = fmt.Errorf("CAPABILITY command did not return capability list")
			goto Error
		}
	}
	if err := c.getBoxes(); err != nil {
		goto Error
	}
	c.autoReconnect = true
	return nil

Error:
	if c.rw != nil {
		c.rw.Close()
		c.rw = nil
	}
	c.autoReconnect = true
	c.connected = false
	return err
}

var testDial func(string, Mode) (io.ReadWriteCloser, error)

func dial(server string, mode Mode) (io.ReadWriteCloser, error) {
	if testDial != nil {
		return testDial(server, mode)
	}
	switch mode {
	default:
		// also case Unencrypted
		return net.Dial("tcp", server+":143")
	case StartTLS:
		return nil, fmt.Errorf("StartTLS not supported")
	case TLS:
		return tls.Dial("tcp", server+":993", nil)
	case Command:
		cmd := exec.Command("sh", "-c", server)
		cmd.Stderr = os.Stderr
		r, err := cmd.StdoutPipe()
		if err != nil {
			return nil, err
		}
		w, err := cmd.StdinPipe()
		if err != nil {
			r.Close()
			return nil, err
		}
		if err := cmd.Start(); err != nil {
			r.Close()
			w.Close()
			return nil, err
		}
		return &pipe2{r, w}, nil
	}
	panic("not reached")
}

type pipe2 struct {
	io.ReadCloser
	io.WriteCloser
}

func (p *pipe2) Close() error {
	p.ReadCloser.Close()
	p.WriteCloser.Close()
	return nil
}

type tee struct {
	r io.Reader
	w io.Writer
}

func (t tee) Read(p []byte) (n int, err error) {
	n, err = t.r.Read(p)
	if n > 0 {
		t.w.Write(p[0:n])
	}
	return
}

func (c *Client) rdsx() (*sx, error) {
	c.io.mustBeLocked()
	return rdsx(c.b)
}

type sxError struct {
	x *sx
}

func (e *sxError) Error() string { return e.x.String() }

func (c *Client) cmd(b *Box, format string, args ...interface{}) error {
	x, err := c.cmdsx(b, format, args...)
	if err != nil {
		return err
	}
	if !x.ok() {
		return &sxError{x}
	}
	return nil
}

// cmdsx0 runs a single command and return the sx.  Does not redial.
func (c *Client) cmdsx0(format string, args ...interface{}) (*sx, error) {
	c.io.mustBeLocked()
	if c.rw == nil || !c.connected {
		return nil, fmt.Errorf("not connected")
	}

	cmd := fmt.Sprintf(format, args...)
	if Debug {
		fmt.Fprintf(os.Stderr, ">>> %s %s\n", tag, cmd)
	}
	if _, err := fmt.Fprintf(c.rw, "%s %s\r\n", tag, cmd); err != nil {
		c.connected = false
		return nil, err
	}
	return c.waitsx()
}

// cmdsx runs a command on box b.  It does redial.
func (c *Client) cmdsx(b *Box, format string, args ...interface{}) (*sx, error) {
	c.io.mustBeLocked()
	c.nextBox = b

Trying:
	for tries := 0; ; tries++ {
		if c.rw == nil || !c.connected {
			if !c.autoReconnect {
				return nil, fmt.Errorf("not connected")
			}
			if err := c.reconnect(); err != nil {
				return nil, err
			}
			if b != nil && c.nextBox == nil {
				// box disappeared on reconnect
				return nil, fmt.Errorf("box is gone")
			}
		}

		if b != nil && b != c.box {
			if c.box != nil {
				// TODO c.box.init = false
			}
			c.box = b
			if _, err := c.cmdsx0("SELECT %s", iquote(b.Name)); err != nil {
				c.box = nil
				if tries++; tries == 1 && (c.rw == nil || !c.connected) {
					continue Trying
				}
				return nil, err
			}
		}

		x, err := c.cmdsx0(format, args...)
		if err != nil {
			if tries++; tries == 1 && (c.rw == nil || !c.connected) {
				continue Trying
			}
			return nil, err
		}
		return x, nil
	}
	panic("not reached")
}

func (c *Client) waitsx() (*sx, error) {
	c.io.mustBeLocked()
	for {
		x, err := c.rdsx()
		if err != nil {
			c.connected = false
			return nil, err
		}
		if len(x.sx) >= 1 && x.sx[0].kind == sxAtom {
			if x.sx[0].isAtom(tag) {
				return x, nil
			}
			if x.sx[0].isAtom("*") {
				c.unexpected(x)
			}
		}
		if x.kind == sxList && len(x.sx) == 0 {
			c.connected = false
			return nil, fmt.Errorf("empty response")
		}
	}
	panic("not reached")
}

func iquote(s string) string {
	if s == "" {
		return `""`
	}

	for i := 0; i < len(s); i++ {
		if s[i] >= 0x80 || s[i] <= ' ' || s[i] == '\\' || s[i] == '"' {
			goto Quote
		}
	}
	return s

Quote:
	var b bytes.Buffer
	b.WriteByte('"')
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' || s[i] == '"' {
			b.WriteByte('\\')
		}
		b.WriteByte(s[i])
	}
	b.WriteByte('"')
	return b.String()
}

func (c *Client) login() error {
	c.io.mustBeLocked()
	x, err := c.cmdsx(nil, "LOGIN %s %s", iquote(c.user), iquote(c.passwd))
	if err != nil {
		return err
	}
	if !x.ok() {
		return fmt.Errorf("login rejected: %s", x)
	}
	return nil
}

func (c *Client) getBoxes() error {
	c.io.mustBeLocked()
	for _, b := range c.allBox {
		b.dead = true
		//	b.exists = 0
		//	b.maxSeen = 0
	}
	list := "LIST"
	if c.capability["XLIST"] { // Gmail extension
		list = "XLIST"
	}
	if err := c.cmd(nil, "%s %s *", list, iquote(c.root)); err != nil {
		return err
	}
	if err := c.cmd(nil, "%s %s INBOX", list, iquote(c.root)); err != nil {
		return err
	}
	if c.nextBox != nil && c.nextBox.dead {
		c.nextBox = nil
	}
	for _, b := range c.allBox {
		if b.dead {
			delete(c.boxByName, b.Name)
		}
		b.firstNum = 0
	}
	c.allBox = boxTrim(c.allBox)
	for _, b := range c.allBox {
		b.child = boxTrim(b.child)
	}
	return nil
}

func boxTrim(list []*Box) []*Box {
	w := 0
	for _, b := range list {
		if !b.dead {
			list[w] = b
			w++
		}
	}
	return list[:w]
}

const maxFetch = 1000

func (c *Client) setAutoReconnect(b bool) {
	c.autoReconnect = b
}

func (c *Client) check(b *Box) error {
	c.io.mustBeLocked()
	if b.dead {
		return fmt.Errorf("box is gone")
	}

	b.load = true

	// Update exists count.
	if err := c.cmd(b, "NOOP"); err != nil {
		return err
	}

	// Have to get through this in one session.
	// Caller can call again if we get disconnected
	// and return an error.
	c.autoReconnect = false
	defer c.setAutoReconnect(true)

	// First load after reconnect: figure out what changed.
	if b.firstNum == 0 && len(b.msgByUID) > 0 {
		var lo, hi uint32 = 1<<32 - 1, 0
		for _, m := range b.msgByUID {
			m.dead = true
			uid := uint32(m.UID)
			if lo > uid {
				lo = uid
			}
			if hi < uid {
				hi = uid
			}
			m.num = 0
		}
		if err := c.cmd(b, "UID FETCH %d:%d FLAGS", lo, hi); err != nil {
			return err
		}
		for _, m := range b.msgByUID {
			if m.dead {
				delete(b.msgByUID, m.UID)
			}
		}
	}

	// First-ever load.
	if b.firstNum == 0 {
		if b.exists <= maxFetch {
			b.firstNum = 1
		} else {
			b.firstNum = b.exists - maxFetch + 1
		}
		n := b.exists - b.firstNum + 1
		b.msgByNum = make([]*Msg, n)
		return c.fetchBox(b, b.firstNum, 0)
	}

	if b.exists <= b.maxSeen {
		return nil
	}
	return c.fetchBox(b, b.maxSeen, 0)
}

func (c *Client) fetchBox(b *Box, lo int, hi int) error {
	c.io.mustBeLocked()
	if b != c.box {
		if err := c.cmd(b, "NOOP"); err != nil {
			return err
		}
	}
	extra := ""
	if c.IsGmail() {
		extra = " X-GM-MSGID X-GM-THRID X-GM-LABELS"
	}
	slo := fmt.Sprint(lo)
	shi := "*"
	if hi > 0 {
		shi = fmt.Sprint(hi)
	}
	return c.cmd(b, "FETCH %s:%s (FLAGS UID INTERNALDATE RFC822.SIZE ENVELOPE BODY%s)", slo, shi, extra)
}

func (c *Client) IsGmail() bool {
	return c.capability["X-GM-EXT-1"]
}

// Table-driven IMAP "unexpected response" parser.
// All the interesting data is in the unexpected responses.

var unextab = []struct {
	num  int
	name string
	fmt  string
	fn   func(*Client, *sx)
}{
	{0, "BYE", "", xbye},
	{0, "CAPABILITY", "", xcapability},
	{0, "FLAGS", "AAL", xflags},
	{0, "LIST", "AALSS", xlist},
	{0, "XLIST", "AALSS", xlist},
	{0, "OK", "", xok},
	//	{0, "SEARCH", "AAN*", xsearch},
	{1, "EXISTS", "ANA", xexists},
	{1, "EXPUNGE", "ANA", xexpunge},
	{1, "FETCH", "ANAL", xfetch},
	//	{1, "RECENT", "ANA", xrecent},  // why do we care?
}

func (c *Client) unexpected(x *sx) {
	c.io.mustBeLocked()
	var num int
	var name string

	if len(x.sx) >= 3 && x.sx[1].kind == sxNumber && x.sx[2].kind == sxAtom {
		num = 1
		name = string(x.sx[2].data)
	} else if len(x.sx) >= 2 && x.sx[1].kind == sxAtom {
		num = 0
		name = string(x.sx[1].data)
	} else {
		return
	}

	c.data.lock()
	for _, t := range unextab {
		if t.num == num && strings.EqualFold(t.name, name) {
			if t.fmt != "" && !x.match(t.fmt) {
				log.Printf("malformd %s: %s", name, x)
				continue
			}
			t.fn(c, x)
		}
	}
	c.data.unlock()
}

func xbye(c *Client, x *sx) {
	c.io.mustBeLocked()
	c.rw.Close()
	c.rw = nil
	c.connected = false
}

func xflags(c *Client, x *sx) {
	c.data.mustBeLocked()
	// This response contains in x.sx[2] the list of flags
	// that can be validly attached to messages in c.box.
	if b := c.box; b != nil {
		c.flags = x.sx[2].parseFlags()
	}
}

func xcapability(c *Client, x *sx) {
	c.data.mustBeLocked()
	c.capability = make(map[string]bool)
	for _, xx := range x.sx[2:] {
		if xx.kind == sxAtom {
			c.capability[string(xx.data)] = true
		}
	}
}

func xlist(c *Client, x *sx) {
	c.data.mustBeLocked()
	s := string(x.sx[4].data)
	t := string(x.sx[3].data)

	// INBOX is the special name for the main mailbox.
	// All the other mailbox names have the root prefix removed, if applicable.
	inbox := strings.EqualFold(s, "inbox")
	if inbox {
		s = "inbox"
	}

	b := c.newBox(s, t, inbox)
	if b == nil {
		return
	}
	if inbox {
		c.inbox = b
	}
	if s == c.root {
		c.rootBox = b
	}
	b.dead = false
	b.flags = x.sx[2].parseFlags()
}

func xexists(c *Client, x *sx) {
	c.data.mustBeLocked()
	if b := c.box; b != nil {
		b.exists = int(x.sx[1].number)
		if b.exists < b.maxSeen {
			b.maxSeen = b.exists
		}
	}
}

func xexpunge(c *Client, x *sx) {
	c.data.mustBeLocked()
	if b := c.box; b != nil {
		n := int(x.sx[1].number)
		bynum := b.msgByNum
		if bynum != nil {
			if n < b.firstNum {
				b.firstNum--
			} else if n < b.firstNum+len(bynum) {
				copy(bynum[n-b.firstNum:], bynum[n-b.firstNum+1:])
				b.msgByNum = bynum[:len(bynum)-1]
			} else {
				log.Printf("expunge unexpected message %d %d %d", b.firstNum, b.exists, b.firstNum+len(bynum))
			}
		}
		if n <= b.exists {
			b.exists--
		}
	}
}

// Table-driven OK info parser.

var oktab = []struct {
	name string
	kind sxKind
	fn   func(*Client, *Box, *sx)
}{
	{"UIDVALIDITY", sxNumber, xokuidvalidity},
	{"PERMANENTFLAGS", sxList, xokpermflags},
	{"UNSEEN", sxNumber, xokunseen},
	{"READ-WRITE", 0, xokreadwrite},
	{"READ-ONLY", 0, xokreadonly},
}

func xok(c *Client, x *sx) {
	c.data.mustBeLocked()
	b := c.box
	if b == nil {
		return
	}
	if len(x.sx) >= 4 && x.sx[2].kind == sxAtom && x.sx[2].data[0] == '[' {
		var arg *sx
		if x.sx[3].kind == sxAtom && x.sx[3].data[0] == ']' {
			arg = nil
		} else if x.sx[4].kind == sxAtom && x.sx[4].data[0] == ']' {
			arg = x.sx[3]
		} else {
			log.Printf("cannot parse OK: %s", x)
			return
		}
		x.sx[2].data = x.sx[2].data[1:]
		for _, t := range oktab {
			if x.sx[2].isAtom(t.name) {
				if t.kind != 0 && (arg == nil || arg.kind != t.kind) {
					log.Printf("malformed %s: %s", t.name, arg)
					continue
				}
				t.fn(c, b, arg)
			}
		}
	}
}

func xokuidvalidity(c *Client, b *Box, x *sx) {
	c.data.mustBeLocked()
	n := uint32(x.number)
	if b.validity != n {
		if b.msgByUID != nil {
			log.Printf("imap: UID validity reset for %s", b.Name)
		}
		b.validity = n
		b.maxSeen = 0
		b.firstNum = 0
		b.msgByNum = nil
		b.msgByUID = nil
	}
}

func xokpermflags(c *Client, b *Box, x *sx) {
	c.data.mustBeLocked()
	b.permFlags = x.parseFlags()
}

func xokunseen(c *Client, b *Box, x *sx) {
	c.data.mustBeLocked()
	b.unseen = int(x.number)
}

func xokreadwrite(c *Client, b *Box, x *sx) {
	c.data.mustBeLocked()
	b.readOnly = false
}

func xokreadonly(c *Client, b *Box, x *sx) {
	c.data.mustBeLocked()
	b.readOnly = true
}

// Table-driven FETCH message info parser.

var msgtab = []struct {
	name string
	fn   func(*Msg, *sx, *sx)
}{
	{"FLAGS", xmsgflags},
	{"INTERNALDATE", xmsgdate},
	{"RFC822.SIZE", xmsgrfc822size},
	{"ENVELOPE", xmsgenvelope},
	{"X-GM-MSGID", xmsggmmsgid},
	{"X-GM-THRID", xmsggmthrid},
	{"BODY", xmsgbody},
	{"BODY[", xmsgbodydata},
}

func xfetch(c *Client, x *sx) {
	c.data.mustBeLocked()
	if c.box == nil {
		log.Printf("FETCH but no open box: %s", x)
		return
	}

	// * 152 FETCH (UID 185 FLAGS() ...)
	n := x.sx[1].number
	xx := x.sx[3]
	if len(xx.sx)%2 != 0 {
		log.Printf("malformed FETCH: %s", x)
		return
	}
	var uid uint64
	for i := 0; i < len(xx.sx); i += 2 {
		if xx.sx[i].isAtom("UID") {
			if xx.sx[i+1].kind == sxNumber {
				uid = uint64(xx.sx[i+1].number) | uint64(c.box.validity)<<32
				goto HaveUID
			}
		}
	}
	// This happens; too bad.
	// log.Printf("FETCH without UID: %s", x)
	return

HaveUID:
	if m := c.box.msgByUID[uid]; m != nil && m.dead {
		// FETCH during box garbage collection.
		m.dead = false
		m.num = int(n)
		return
	}
	m := c.box.newMsg(uid, int(n))
	for i := 0; i < len(xx.sx); i += 2 {
		k, v := xx.sx[i], xx.sx[i+1]
		for _, t := range msgtab {
			if k.isAtom(t.name) {
				t.fn(m, k, v)
			}
		}
	}
}

func xmsggmmsgid(m *Msg, k, v *sx) {
	m.GmailID = uint64(v.number)
}

func xmsggmthrid(m *Msg, k, v *sx) {
	m.GmailThread = uint64(v.number)
}

func xmsgflags(m *Msg, k, v *sx) {
	m.Flags = v.parseFlags()
}

func xmsgrfc822size(m *Msg, k, v *sx) {
	m.Bytes = v.number
}

func xmsgdate(m *Msg, k, v *sx) {
	m.Date = v.parseDate()
}

func xmsgenvelope(m *Msg, k, v *sx) {
	m.Hdr = parseEnvelope(v)
}

func parseEnvelope(v *sx) *MsgHdr {
	if v.kind != sxList || !v.match("SSLLLLLLSS") {
		log.Printf("bad envelope: %s", v)
		return nil
	}

	hdr := &MsgHdr{
		Date:      v.sx[0].nstring(),
		Subject:   unrfc2047(v.sx[1].nstring()),
		From:      parseAddrs(v.sx[2]),
		Sender:    parseAddrs(v.sx[3]),
		ReplyTo:   parseAddrs(v.sx[4]),
		To:        parseAddrs(v.sx[5]),
		CC:        parseAddrs(v.sx[6]),
		BCC:       parseAddrs(v.sx[7]),
		InReplyTo: unrfc2047(v.sx[8].nstring()),
		MessageID: unrfc2047(v.sx[9].nstring()),
	}

	h := md5.New()
	fmt.Fprintf(h, "date: %s\n", hdr.Date)
	fmt.Fprintf(h, "subject: %s\n", hdr.Subject)
	fmt.Fprintf(h, "from: %s\n", hdr.From)
	fmt.Fprintf(h, "sender: %s\n", hdr.Sender)
	fmt.Fprintf(h, "replyto: %s\n", hdr.ReplyTo)
	fmt.Fprintf(h, "to: %s\n", hdr.To)
	fmt.Fprintf(h, "cc: %s\n", hdr.CC)
	fmt.Fprintf(h, "bcc: %s\n", hdr.BCC)
	fmt.Fprintf(h, "inreplyto: %s\n", hdr.InReplyTo)
	fmt.Fprintf(h, "messageid: %s\n", hdr.MessageID)
	hdr.Digest = fmt.Sprintf("%x", h.Sum(nil))

	return hdr
}

func parseAddrs(x *sx) []Addr {
	var addr []Addr
	for _, xx := range x.sx {
		if !xx.match("SSSS") {
			log.Printf("bad address: %s", x)
			continue
		}
		name := unrfc2047(xx.sx[0].nstring())
		// sx[1] is route
		local := unrfc2047(xx.sx[2].nstring())
		host := unrfc2047(xx.sx[3].nstring())
		if local == "" || host == "" {
			// rfc822 group syntax
			addr = append(addr, Addr{name, ""})
			continue
		}
		addr = append(addr, Addr{name, local + "@" + host})
	}
	return addr
}

func xmsgbody(m *Msg, k, v *sx) {
	if v.isNil() {
		return
	}
	if v.kind != sxList {
		log.Printf("bad body: %s", v)
	}

	// To follow the structure exactly we should be doing this
	// to m.NewPart(m.Part[0]) with type message/rfc822,
	// but the extra layer is redundant - what else would be in
	// a mailbox?
	parseStructure(&m.Root, v)
	n := m.num
	if m.Box.maxSeen < n {
		m.Box.maxSeen = n
	}
}

func parseStructure(p *MsgPart, x *sx) {
	if x.isNil() {
		return
	}
	if x.kind != sxList {
		log.Printf("bad structure: %s", x)
		return
	}
	if x.sx[0].isList() {
		// multipart
		var i int
		for i = 0; i < len(x.sx) && x.sx[i].isList(); i++ {
			parseStructure(p.newPart(), x.sx[i])
		}
		if i != len(x.sx)-1 || !x.sx[i].isString() {
			log.Printf("bad multipart structure: %s", x)
			p.Type = "multipart/mixed"
			return
		}
		s := strlwr(x.sx[i].nstring())
		p.Type = "multipart/" + s
		return
	}

	// single type
	if len(x.sx) < 2 || !x.sx[0].isString() {
		log.Printf("bad type structure: %s", x)
		return
	}
	s := strlwr(x.sx[0].nstring())
	t := strlwr(x.sx[1].nstring())
	p.Type = s + "/" + t
	if len(x.sx) < 7 || !x.sx[2].isList() || !x.sx[3].isString() || !x.sx[4].isString() || !x.sx[5].isString() || !x.sx[6].isNumber() {
		log.Printf("bad part structure: %s", x)
		return
	}
	parseParams(p, x.sx[2])
	p.ContentID = x.sx[3].nstring()
	p.Desc = x.sx[4].nstring()
	p.Encoding = x.sx[5].nstring()
	p.Bytes = x.sx[6].number
	if p.Type == "message/rfc822" {
		if len(x.sx) < 10 || !x.sx[7].isList() || !x.sx[8].isList() || !x.sx[9].isNumber() {
			log.Printf("bad rfc822 structure: %s", x)
			return
		}
		p.Hdr = parseEnvelope(x.sx[7])
		parseStructure(p.newPart(), x.sx[8])
		p.Lines = x.sx[9].number
	}
	if s == "text" {
		if len(x.sx) < 8 || !x.sx[7].isNumber() {
			log.Printf("bad text structure: %s", x)
			return
		}
		p.Lines = x.sx[7].number
	}
}

func parseParams(p *MsgPart, x *sx) {
	if x.isNil() {
		return
	}
	if len(x.sx)%2 != 0 {
		log.Printf("bad message params: %s", x)
		return
	}

	for i := 0; i < len(x.sx); i += 2 {
		k, v := x.sx[i].nstring(), x.sx[i+1].nstring()
		k = strlwr(k)
		switch strlwr(k) {
		case "charset":
			p.Charset = strlwr(v)
		case "name":
			p.Name = v
		}
	}
}

func (c *Client) fetch(p *MsgPart, what string) {
	c.io.mustBeLocked()
	id := p.ID
	if what != "" {
		if id != "" {
			id += "."
		}
		id += what
	}
	c.cmd(p.Msg.Box, "UID FETCH %d BODY[%s]", p.Msg.UID&(1<<32-1), id)
}

func xmsgbodydata(m *Msg, k, v *sx) {
	// k.data is []byte("BODY[...")
	name := string(k.data[5:])
	if i := strings.Index(name, "]"); i >= 0 {
		name = name[:i]
	}

	p := &m.Root
	for name != "" && '1' <= name[0] && name[0] <= '9' {
		var num int
		num, name = parseNum(name)
		if num == 0 {
			log.Printf("unexpected body name: %s", k.data)
			return
		}
		num--
		if num >= len(p.Child) {
			log.Printf("invalid body name: %s", k.data)
			return
		}
		p = p.Child[num]
	}

	switch strlwr(name) {
	case "":
		p.raw = v.nbytes()
	case "mime":
		p.mimeHeader = nocr(v.nbytes())
	case "header":
		p.rawHeader = nocr(v.nbytes())
	case "text":
		p.rawBody = nocr(v.nbytes())
	}
}

func parseNum(name string) (int, string) {
	rest := ""
	i := strings.Index(name, ".")
	if i >= 0 {
		name, rest = name[:i], name[i+1:]
	}
	n, _ := strconv.Atoi(name)
	return n, rest
}

func nocr(b []byte) []byte {
	w := 0
	for _, c := range b {
		if c != '\r' {
			b[w] = c
			w++
		}
	}
	return b[:w]
}

type uidList []*Msg

func (l uidList) String() string {
	var b bytes.Buffer
	for i, m := range l {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, "%d", m.UID&(1<<32-1))
	}
	return b.String()
}

func (c *Client) deleteList(msgs []*Msg) error {
	if len(msgs) == 0 {
		return nil
	}
	c.io.mustBeLocked()

	b := msgs[0].Box
	for _, m := range msgs {
		if m.Box != b {
			return fmt.Errorf("messages span boxes: %q and %q", b.Name, m.Box.Name)
		}
		if uint32(m.UID>>32) != b.validity {
			return fmt.Errorf("stale message")
		}
	}

	err := c.cmd(b, "UID STORE %s +FLAGS (\\Deleted)", uidList(msgs))
	if err == nil && c.box == b {
		err = c.cmd(b, "EXPUNGE")
	}
	return err
}

func (c *Client) copyList(dst, src *Box, msgs []*Msg) error {
	if len(msgs) == 0 {
		return nil
	}
	c.io.mustBeLocked()

	for _, m := range msgs {
		if m.Box != src {
			return fmt.Errorf("messages span boxes: %q and %q", src.Name, m.Box.Name)
		}
		if uint32(m.UID>>32) != src.validity {
			return fmt.Errorf("stale message")
		}
	}

	var name string
	if dst == c.inbox {
		name = "INBOX"
	} else {
		name = iquote(dst.Name)
	}
	return c.cmd(src, "UID COPY %s %s", uidList(msgs), name)
}

func (c *Client) muteList(src *Box, msgs []*Msg) error {
	if len(msgs) == 0 {
		return nil
	}
	c.io.mustBeLocked()

	for _, m := range msgs {
		if m.Box != src {
			return fmt.Errorf("messages span boxes: %q and %q", src.Name, m.Box.Name)
		}
		if uint32(m.UID>>32) != src.validity {
			return fmt.Errorf("stale message")
		}
	}

	return c.cmd(src, "UID STORE %s +X-GM-LABELS (\\Muted)", uidList(msgs))
}
