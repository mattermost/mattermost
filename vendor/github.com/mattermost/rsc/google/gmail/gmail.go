package main

import (
	"bufio"
	"bytes"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/rsc/google"
	"github.com/mattermost/rsc/imap"
)

var cmdtab = []struct {
	Name string
	Args int
	F    func(*Cmd, *imap.MsgPart) *imap.MsgPart
	TF   func(*Cmd, []*imap.Msg) *imap.MsgPart
	Help string
}{
	{"+", 0, pluscmd, tpluscmd, "+        print the next message"},
	{"a", 1, rcmd, nil, "a        reply to sender and recipients"},
	{"b", 0, bcmd, nil, "b        print the next 10 headers"},
	{"d", 0, dcmd, tdcmd, "d        mark for deletion"},
	{"f", 1, fcmd, tfcmd, "f        forward message"},
	{"h", 0, hcmd, nil, "h        print elided message summary (,h for all)"},
	{"help", 0, nil, nil, "help     print this info"},
	{"i", 0, icmd, nil, "i        incorporate new mail"},
	{"m", 0, mcmd, tmcmd, "m        mute and delete thread (gmail only)"},
	{"mime", 0, mimecmd, nil, "mime     print message's MIME structure "},
	{"p", 0, pcmd, nil, "p        print the processed message"},
	//	{ "p+",	0,	pcmd, nil,	"p        print the processed message, showing all quoted text" },
	{"P", 0, Pcmd, nil, "P        print the raw message"},
	{`"`, 0, quotecmd, nil, `"        print a quoted version of msg`},
	{"q", 0, qcmd, nil, "q        exit and remove all deleted mail"},
	{"r", 1, rcmd, nil, "r [addr] reply to sender plus any addrs specified"},
	{"s", 1, scmd, tscmd, "s name   copy message to named mailbox (label for gmail)"},
	{"u", 0, ucmd, nil, "u        remove deletion mark"},
	//	{ "w",	1,	wcmd, nil,	"w file   store message contents as file" },
	{"W", 0, Wcmd, nil, "W	open in web browser"},
	{"x", 0, xcmd, nil, "x        exit without flushing deleted messages"},
	{"y", 0, ycmd, nil, "y        synchronize with mail box"},
	{"=", 1, eqcmd, nil, "=        print current message number"},
	{"|", 1, pipecmd, nil, "|cmd     pipe message body to a command"},
	//	{ "||",	1,	rpipecmd, nil, "||cmd     pipe raw message to a command" },
	{"!", 1, bangcmd, nil, "!cmd     run a command"},
}

func init() {
	// Have to insert helpcmd by hand because it refers to cmdtab,
	// so it would cause an init loop above.
	for i := range cmdtab {
		if cmdtab[i].Name == "help" {
			cmdtab[i].F = helpcmd
		}
	}
}

type Cmd struct {
	Name    string
	Args    []string
	Line    string // Args[0:] original text
	ArgLine string // Args[1:] original text
	F       func(*Cmd, *imap.MsgPart) *imap.MsgPart
	TF      func(*Cmd, []*imap.Msg) *imap.MsgPart
	Delete  bool
	Thread  bool
	Targ    *imap.MsgPart
	Targs   []*imap.Msg
	A1, A2  int
}

var (
	bin  = bufio.NewReader(os.Stdin)
	bout = bufio.NewWriter(os.Stdout)

	acctName = flag.String("a", "", "account to use")

	dot *imap.MsgPart // Selected messages

	inbox       *imap.Box
	msgs        []*imap.Msg
	msgNum      = make(map[*imap.Msg]int)
	deleted     = make(map[*imap.Msg]bool)
	isGmail     = false
	acct        google.Account
	threaded    bool
	interrupted bool

	maxfrom int
	subjlen int
)

func nextMsg(m *imap.Msg) *imap.Msg {
	i := msgNum[m]
	i++
	if i >= len(msgs) {
		return nil
	}
	return msgs[i]
}

func main() {
	flag.BoolVar(&imap.Debug, "imapdebug", false, "imap debugging trace")
	flag.Parse()

	acct = google.Acct(*acctName)

	if args := flag.Args(); len(args) > 0 {
		for i := range args {
			args[i] = "-to=" + args[i]
		}
		cmd := exec.Command("gmailsend", append([]string{"-a", acct.Email, "-i"}, args...)...)
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "!%s\n", err)
			os.Exit(1)
		}
		return
	}

	c, err := imap.NewClient(imap.TLS, "imap.gmail.com", acct.Email, acct.Password, "")
	if err != nil {
		log.Fatal(err)
	}
	isGmail = c.IsGmail()
	threaded = isGmail

	inbox = c.Inbox()
	if err := inbox.Check(); err != nil {
		log.Fatal(err)
	}

	msgs = inbox.Msgs()
	maxfrom = 12
	for i, m := range msgs {
		msgNum[m] = i
		if n := len(from(m.Hdr)); n > maxfrom {
			maxfrom = n
		}
	}
	if maxfrom > 20 {
		maxfrom = 20
	}
	subjlen = 80 - maxfrom

	rethread()

	go func() {
		for sig := range signal.Incoming {
			if sig == os.SIGINT {
				fmt.Fprintf(os.Stderr, "!interrupt\n")
				interrupted = true
				continue
			}
			if sig == os.SIGCHLD || sig == os.SIGWINCH {
				continue
			}
			fmt.Fprintf(os.Stderr, "!%s\n", sig)
		}
	}()

	for {
		if dot != nil {
			fmt.Fprintf(bout, "%d", msgNum[dot.Msg]+1)
			if dot != &dot.Msg.Root {
				fmt.Fprintf(bout, ".%s", dot.ID)
			}
		}
		fmt.Fprintf(bout, ": ")
		bout.Flush()

		line, err := bin.ReadString('\n')
		if err != nil {
			break
		}

		cmd, err := parsecmd(line)
		if err != nil {
			fmt.Fprintf(bout, "!%s\n", err)
			continue
		}

		if cmd.Targ != nil || cmd.Targs == nil && cmd.A2 == 0 {
			x := cmd.F(cmd, cmd.Targ)
			if x != nil {
				dot = x
			}
		} else {
			targs := cmd.Targs
			if targs == nil {
				delta := +1
				if cmd.A1 > cmd.A2 {
					delta = -1
				}
				for i := cmd.A1; i <= cmd.A2; i += delta {
					if i < 1 || i > len(msgs) {
						continue
					}
					targs = append(targs, msgs[i-1])
				}
			}
			if cmd.Thread {
				if !isGmail {
					fmt.Fprintf(bout, "!need gmail for threaded command\n")
					continue
				}
				byThread := make(map[uint64][]*imap.Msg)
				for _, m := range msgs {
					t := m.GmailThread
					byThread[t] = append(byThread[t], m)
				}
				for _, m := range targs {
					t := m.GmailThread
					if byThread[t] != nil {
						if cmd.TF != nil {
							if x := cmd.TF(cmd, byThread[t]); x != nil {
								dot = x
							}
						} else {
							for _, mm := range byThread[t] {
								x := cmd.F(cmd, &mm.Root)
								if x != nil {
									dot = x
								}
							}
						}
					}
					delete(byThread, t)
				}
				continue
			}
			for _, m := range targs {
				if cmd.Delete {
					dcmd(cmd, &m.Root)
					if cmd.Name == "p" {
						// dp is a special case: it advances to the next message before the p.
						next := nextMsg(m)
						if next == nil {
							fmt.Fprintf(bout, "!address\n")
							dot = &m.Root
							break
						}
						m = next
					}
				}
				x := cmd.F(cmd, &m.Root)
				if x != nil {
					dot = x
				}
				// TODO: Break loop on interrupt.
			}
		}
	}
	qcmd(nil, nil)
}

func parsecmd(line string) (cmd *Cmd, err error) {
	cmd = &Cmd{}
	line = strings.TrimSpace(line)
	if line == "" {
		// Empty command is a special case: advance and print.
		cmd.F = pcmd
		if dot == nil {
			cmd.A1 = 1
			cmd.A2 = 1
		} else {
			n := msgNum[dot.Msg] + 2
			if n > len(msgs) {
				return nil, fmt.Errorf("out of messages")
			}
			cmd.A1 = n
			cmd.A2 = n
		}
		return cmd, nil
	}

	// Global search?
	if line[0] == 'g' {
		line = line[1:]
		if line == "" || line[0] != '/' {
			// No search string means all messages.
			cmd.A1 = 1
			cmd.A2 = len(msgs)
		} else if line[0] == '/' {
			re, rest, err := parsere(line)
			if err != nil {
				return nil, err
			}
			line = rest
			// Find all messages matching this search string.
			var targ []*imap.Msg
			for _, m := range msgs {
				if re.MatchString(header(m)) {
					targ = append(targ, m)
				}
			}
			if len(targ) == 0 {
				return nil, fmt.Errorf("no matches")
			}
			cmd.Targs = targ
		}
	} else {
		// Parse an address.
		a1, targ, rest, err := parseaddr(line, 1)
		if err != nil {
			return nil, err
		}
		if targ != nil {
			cmd.Targ = targ
			line = rest
		} else {
			if a1 < 1 || a1 > len(msgs) {
				return nil, fmt.Errorf("message number %d out of range", a1)
			}
			cmd.A1 = a1
			cmd.A2 = a1
			a2 := a1
			if rest != "" && rest[0] == ',' {
				// This is an address range.
				a2, targ, rest, err = parseaddr(rest[1:], len(msgs))
				if err != nil {
					return nil, err
				}
				if a2 < 1 || a2 > len(msgs) {
					return nil, fmt.Errorf("message number %d out of range", a2)
				}
				cmd.A2 = a2
			} else if rest == line {
				// There was no address.
				if dot == nil {
					cmd.A1 = 1
					cmd.A2 = 0
				} else {
					if dot != nil {
						if dot == &dot.Msg.Root {
							// If dot is a plain msg, use a range so that dp works.
							cmd.A1 = msgNum[dot.Msg] + 1
							cmd.A2 = cmd.A1
						} else {
							cmd.Targ = dot
						}
					}
				}
			}
			line = rest
		}
	}

	cmd.Line = strings.TrimSpace(line)

	// Insert space after ! or | for tokenization.
	switch {
	case strings.HasPrefix(cmd.Line, "||"):
		cmd.Line = cmd.Line[:2] + " " + cmd.Line[2:]
	case strings.HasPrefix(cmd.Line, "!"), strings.HasPrefix(cmd.Line, "|"):
		cmd.Line = cmd.Line[:1] + " " + cmd.Line[1:]
	}

	av := strings.Fields(cmd.Line)
	cmd.Args = av
	if len(av) == 0 || av[0] == "" {
		// Default is to print.
		cmd.F = pcmd
		return cmd, nil
	}

	name := av[0]
	cmd.ArgLine = strings.TrimSpace(cmd.Line[len(av[0]):])

	// Hack to allow t prefix on all commands.
	if len(name) >= 2 && name[0] == 't' {
		cmd.Thread = true
		name = name[1:]
	}

	// Hack to allow d prefix on all commands.
	if len(name) >= 2 && name[0] == 'd' {
		cmd.Delete = true
		name = name[1:]
	}
	cmd.Name = name

	// Search command table.
	for _, ct := range cmdtab {
		if ct.Name == name {
			if ct.Args == 0 && len(av) > 1 {
				return nil, fmt.Errorf("%s doesn't take an argument", name)
			}
			cmd.F = ct.F
			cmd.TF = ct.TF
			if name == "m" {
				// mute applies to all thread no matter what
				cmd.Thread = true
			}
			return cmd, nil
		}
	}
	return nil, fmt.Errorf("unknown command %s", name)
}

func parseaddr(addr string, deflt int) (n int, targ *imap.MsgPart, rest string, err error) {
	dot := dot
	n = deflt
	for {
		old := addr
		n, targ, rest, err = parseaddr1(addr, n, dot)
		if targ != nil || rest == old || err != nil {
			break
		}
		if n < 1 || n > len(msgs) {
			return 0, nil, "", fmt.Errorf("message number %d out of range", n)
		}
		dot = &msgs[n-1].Root
		addr = rest
	}
	return
}

func parseaddr1(addr string, deflt int, dot *imap.MsgPart) (n int, targ *imap.MsgPart, rest string, err error) {
	base := 0
	if dot != nil {
		base = msgNum[dot.Msg] + 1
	}
	if addr == "" {
		return deflt, nil, addr, nil
	}
	var i int
	sign := 0
	switch c := addr[0]; c {
	case '+':
		sign = +1
		addr = addr[1:]
	case '-':
		sign = -1
		addr = addr[1:]
	case '.':
		if base == 0 {
			return 0, nil, "", fmt.Errorf("no message selected")
		}
		n = base
		i = 1
		goto HaveNumber
	case '$':
		if len(msgs) == 0 {
			return 0, nil, "", fmt.Errorf("no messages")
		}
		n = len(msgs)
		i = 1
		goto HaveNumber
	case '/', '?':
		var re *regexp.Regexp
		re, addr, err = parsere(addr)
		if err != nil {
			return
		}
		var delta int
		if c == '/' {
			delta = +1
		} else {
			delta = -1
		}
		for j := base + delta; 1 <= j && j <= len(msgs); j += delta {
			if re.MatchString(header(msgs[j-1])) {
				n = j
				i = 0 // already cut addr
				goto HaveNumber
			}
		}
		err = fmt.Errorf("search")
		return
		// TODO case '%'
	}
	for i = 0; i < len(addr) && '0' <= addr[i] && addr[i] <= '9'; i++ {
		n = 10*n + int(addr[i]) - '0'
	}
	if sign != 0 {
		if n == 0 {
			n = 1
		}
		n = base + n*sign
		goto HaveNumber
	}
	if i == 0 {
		return deflt, nil, addr, nil
	}
HaveNumber:
	rest = addr[i:]
	if i < len(addr) && addr[i] == '.' {
		if n < 1 || n > len(msgs) {
			err = fmt.Errorf("message number %d out of range", n)
			return
		}
		targ = &msgs[n-1].Root
		for i < len(addr) && addr[i] == '.' {
			i++
			var j int
			n = 0
			for j = i; j < len(addr) && '0' <= addr[j] && addr[j] <= '9'; j++ {
				n = 10*n + int(addr[j]) - '0'
			}
			if j == i {
				err = fmt.Errorf("malformed message number %s", addr[:j])
				return
			}
			if n < 1 || n > len(targ.Child) {
				err = fmt.Errorf("message number %s out of range", addr[:j])
				return
			}
			targ = targ.Child[n-1]
			i = j
		}
		n = 0
		rest = addr[i:]
		return
	}
	return
}

func parsere(addr string) (re *regexp.Regexp, rest string, err error) {
	prog, rest, err := parseprog(addr)
	if err != nil {
		return
	}
	re, err = regexp.Compile(prog)
	return
}

var lastProg string

func parseprog(addr string) (prog string, rest string, err error) {
	if len(addr) == 1 {
		if lastProg != "" {
			return lastProg, "", nil
		}
		err = fmt.Errorf("no search")
		return
	}
	i := strings.Index(addr[1:], addr[:1])
	if i < 0 {
		prog = addr[1:]
		rest = ""
	} else {
		i += 1 // adjust for slice in IndexByte arg
		prog, rest = addr[1:i], addr[i+1:]
	}
	lastProg = prog
	return
}

func bcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	var m *imap.Msg
	if dot == nil {
		if len(msgs) == 0 {
			return nil
		}
		m = msgs[0]
	} else {
		m = dot.Msg
	}
	for i := 0; i < 10; i++ {
		hcmd(c, &m.Root)
		next := nextMsg(m)
		if next == nil {
			break
		}
		m = next
	}
	return &m.Root
}

func dcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		fmt.Fprintf(bout, "!address\n")
		return nil
	}
	deleted[dot.Msg] = true
	return &dot.Msg.Root
}

func tdcmd(c *Cmd, msgs []*imap.Msg) *imap.MsgPart {
	if len(msgs) == 0 {
		fmt.Fprintf(bout, "!address\n")
		return nil
	}
	for _, m := range msgs {
		deleted[m] = true
	}
	return &msgs[len(msgs)-1].Root
}

func ucmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		fmt.Fprintf(bout, "!address\n")
		return nil
	}
	delete(deleted, dot.Msg)
	return &dot.Msg.Root
}

func eqcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		fmt.Fprintf(bout, "0")
	} else {
		fmt.Fprintf(bout, "%d", msgNum[dot.Msg]+1)
		if dot != &dot.Msg.Root {
			fmt.Fprintf(bout, ".%s", dot.ID)
		}
	}
	fmt.Fprintf(bout, "\n")
	return nil
}

func from(h *imap.MsgHdr) string {
	if len(h.From) < 1 {
		return "?"
	}
	if name := h.From[0].Name; name != "" {
		return name
	}
	return h.From[0].Email
}

func header(m *imap.Msg) string {
	var t string
	if time.Now().Sub(m.Date) > 365*24*time.Hour {
		t = m.Date.Format("01/02 15:04")
	} else {
		t = m.Date.Format("01/02 2006 ")
	}
	ch := ' '
	if len(m.Root.Child) > 1 || len(m.Root.Child) == 1 && len(m.Root.Child[0].Child) > 0 {
		ch = 'H'
	}
	del := ' '
	if deleted[m] {
		del = 'd'
	}
	return fmt.Sprintf("%-3d %c%c %s %-*.*s %.*s",
		msgNum[m]+1, ch, del, t,
		maxfrom, maxfrom, from(m.Hdr),
		subjlen, m.Hdr.Subject)
}

func hcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot != nil {
		fmt.Fprintf(bout, "%s\n", header(dot.Msg))
	}
	return nil
}

func helpcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	fmt.Fprint(bout, "Commands are of the form [<range>] <command> [args]\n")
	fmt.Fprint(bout, "<range> := <addr> | <addr>','<addr>| 'g'<search>\n")
	fmt.Fprint(bout, "<addr> := '.' | '$' | '^' | <number> | <search> | <addr>'+'<addr> | <addr>'-'<addr>\n")
	fmt.Fprint(bout, "<search> := '/'<gmail search>'/' | '?'<gmail search>'?'\n")
	fmt.Fprint(bout, "<command> :=\n")
	for _, ct := range cmdtab {
		fmt.Fprintf(bout, "%s\n", ct.Help)
	}
	return dot
}

func mimecmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot != nil {
		mimeH(fmt.Sprint(msgNum[dot.Msg]+1), dot)
	}
	return nil
}

func mimeH(id string, p *imap.MsgPart) {
	if p.ID != "" {
		id = id + "." + p.ID
	}
	fmt.Fprintf(bout, "%s %s %s %#q %d\n", id, p.Type, p.Encoding+"/"+p.Charset, p.Name, p.Bytes)
	for _, child := range p.Child {
		mimeH(id, child)
	}
}

func icmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	sync(false)
	return nil
}

func ycmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	sync(true)
	return nil
}

func tpluscmd(c *Cmd, msgs []*imap.Msg) *imap.MsgPart {
	if len(msgs) == 0 {
		return nil
	}
	m := nextMsg(msgs[len(msgs)-1])
	if m == nil {
		fmt.Fprintf(bout, "!no more messages\n")
		return nil
	}
	return pcmd(c, &m.Root)
}

func pluscmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		return nil
	}
	m := nextMsg(dot.Msg)
	if m == nil {
		fmt.Fprintf(bout, "!no more messages\n")
		return nil
	}
	return pcmd(c, &m.Root)
}

func addrlist(x []imap.Addr) string {
	var b bytes.Buffer
	for i, a := range x {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(a.String())
	}
	return b.String()
}

func wpcmd(w io.Writer, c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		return nil
	}
	if dot == &dot.Msg.Root {
		h := dot.Msg.Hdr
		if len(h.From) > 0 {
			fmt.Fprintf(w, "From: %s\n", addrlist(h.From))
		}
		fmt.Fprintf(w, "Date: %s\n", dot.Msg.Date)
		if len(h.From) > 0 {
			fmt.Fprintf(w, "To: %s\n", addrlist(h.To))
		}
		if len(h.CC) > 0 {
			fmt.Fprintf(w, "CC: %s\n", addrlist(h.CC))
		}
		if len(h.BCC) > 0 {
			fmt.Fprintf(w, "BCC: %s\n", addrlist(h.BCC))
		}
		if len(h.Subject) > 0 {
			fmt.Fprintf(w, "Subject: %s\n", h.Subject)
		}
		fmt.Fprintf(w, "\n")
	}
	printMIME(w, dot, true)
	fmt.Fprintf(w, "\n")
	return dot
}

func pcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	defer bout.Flush()
	return wpcmd(bout, c, dot)
}

func pipecmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	args := c.Args[1:]
	if len(args) == 0 {
		fmt.Fprintf(bout, "!no command\n")
		return dot
	}
	bout.Flush()
	cmd := exec.Command(args[0], args[1:]...)
	w, err := cmd.StdinPipe()
	if err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
		return dot
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
		return dot
	}
	wpcmd(w, c, dot)
	w.Close()
	if err := cmd.Wait(); err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
	}
	return dot
}

func bangcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	args := c.Args[1:]
	if len(args) == 0 {
		fmt.Fprintf(bout, "!no command\n")
		return dot
	}
	bout.Flush()
	cmd := exec.Command(args[0], args[1:]...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
	}
	return nil
}

func unixfrom(h *imap.MsgHdr) string {
	if len(h.From) == 0 {
		return ""
	}
	return h.From[0].Email
}

func unixtime(m *imap.Msg) string {
	return dot.Msg.Date.Format("Mon Jan _2 15:04:05 MST 2006")
}

func Pcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		return nil
	}
	if dot == &dot.Msg.Root {
		fmt.Fprintf(bout, "From %s %s\n",
			unixfrom(dot.Msg.Hdr),
			unixtime(dot.Msg))
	}
	bout.Write(dot.Raw())
	return dot
}

func printMIME(w io.Writer, p *imap.MsgPart, top bool) {
	switch {
	case top && strings.HasPrefix(p.Type, "text/"):
		text := p.ShortText()
		if p.Type == "text/html" {
			cmd := exec.Command("htmlfmt")
			cmd.Stdin = bytes.NewBuffer(text)
			if w == bout {
				bout.Flush()
				cmd.Stdout = os.Stdout
			} else {
				cmd.Stdout = w
			}
			if err := cmd.Run(); err != nil {
				fmt.Fprintf(w, "%d.%s !%s\n", msgNum[p.Msg]+1, p.ID, err)
			}
			return
		}
		w.Write(text)
	case p.Type == "text/plain":
		if top {
			panic("printMIME loop")
		}
		printMIME(w, p, true)
	case p.Type == "multipart/alternative":
		for _, pp := range p.Child {
			if pp.Type == "text/plain" {
				printMIME(w, pp, false)
				return
			}
		}
		if len(p.Child) > 0 {
			printMIME(w, p.Child[0], false)
		}
	case strings.HasPrefix(p.Type, "multipart/"):
		for _, pp := range p.Child {
			printMIME(w, pp, false)
		}
	default:
		fmt.Fprintf(w, "%d.%s !%s %s %s\n", msgNum[p.Msg]+1, p.ID, p.Type, p.Desc, p.Name)
	}
}

func qcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	flushDeleted()
	xcmd(c, dot)
	panic("not reached")
}

type quoter struct {
	bol bool
	w   io.Writer
}

func (q *quoter) Write(b []byte) (n int, err error) {
	n = len(b)
	err = nil
	for len(b) > 0 {
		if q.bol {
			q.w.Write([]byte("> "))
			q.bol = false
		}
		i := bytes.IndexByte(b, '\n')
		if i < 0 {
			i = len(b)
		} else {
			q.bol = true
			i++
		}
		q.w.Write(b[:i])
		b = b[i:]
	}
	return
}

func quotecmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		return nil
	}
	m := dot.Msg
	if len(m.Hdr.From) != 0 {
		a := m.Hdr.From[0]
		name := a.Name
		if name == "" {
			name = a.Email
		}
		date := m.Date.Format("Jan 2, 2006 at 15:04")
		fmt.Fprintf(bout, "On %s, %s wrote:\n", date, name)
	}
	printMIME(&quoter{true, bout}, dot, true)
	return dot
}

func addre(s string) string {
	if len(s) < 4 || !strings.EqualFold(s[:4], "re: ") {
		return "Re: " + s
	}
	return s
}

func rcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil || dot.Msg.Hdr == nil {
		fmt.Fprintf(bout, "!nothing to reply to\n")
		return nil
	}

	h := dot.Msg.Hdr
	replyTo := h.ReplyTo
	have := make(map[string]bool)
	if len(replyTo) == 0 {
		replyTo = h.From
	}
	if c.Name[0] == 'a' {
		for _, a := range replyTo {
			have[a.Email] = true
		}
		for _, a := range append(append(append([]imap.Addr(nil), h.From...), h.To...), h.CC...) {
			if !have[a.Email] {
				have[a.Email] = true
				replyTo = append(replyTo, a)
			}
		}
	}
	if len(replyTo) == 0 {
		fmt.Fprintf(bout, "!no one to reply to\n")
		return dot
	}

	args := []string{"-a", acct.Email, "-s", addre(h.Subject), "-in-reply-to", h.MessageID}
	fmt.Fprintf(bout, "replying to:")
	for _, a := range replyTo {
		fmt.Fprintf(bout, " %s", a.Email)
		args = append(args, "-to", a.String())
	}
	for _, arg := range c.Args[1:] {
		fmt.Fprintf(bout, " %s", arg)
		args = append(args, "-to", arg)
	}
	fmt.Fprintf(bout, "\n")
	bout.Flush()
	cmd := exec.Command("gmailsend", args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
	}
	return dot
}

func fcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		fmt.Fprintf(bout, "!nothing to forward\n")
		return nil
	}

	return fwd(c, dot, nil)
}

func tfcmd(c *Cmd, msgs []*imap.Msg) *imap.MsgPart {
	if len(msgs) == 0 {
		fmt.Fprintf(bout, "!nothing to forward\n")
		return nil
	}

	return fwd(c, &msgs[len(msgs)-1].Root, msgs)
}

func fwd(c *Cmd, dot *imap.MsgPart, msgs []*imap.Msg) *imap.MsgPart {
	addrs := c.Args[1:]
	if len(addrs) == 0 {
		fmt.Fprintf(bout, "!f command requires address to forward to\n")
		return dot
	}

	h := dot.Msg.Hdr
	args := []string{"-a", acct.Email, "-s", "Fwd: " + h.Subject, "-append", "/dev/fd/3"}
	fmt.Fprintf(bout, "forwarding to:")
	for _, arg := range addrs {
		fmt.Fprintf(bout, " %s", arg)
		args = append(args, "-to", arg)
	}
	fmt.Fprintf(bout, "\n")
	bout.Flush()

	cmd := exec.Command("gmailsend", args...)
	r, w, err := os.Pipe()
	if err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
		return dot
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.ExtraFiles = []*os.File{r}
	if err := cmd.Start(); err != nil {
		r.Close()
		fmt.Fprintf(bout, "!%s\n", err)
		return dot
	}
	r.Close()
	what := "message"
	if len(msgs) > 1 {
		what = "conversation"
	}
	fmt.Fprintf(w, "\n\n--- Forwarded %s ---\n", what)
	if msgs == nil {
		wpcmd(w, c, dot)
	} else {
		for _, m := range msgs {
			wpcmd(w, c, &m.Root)
			fmt.Fprintf(w, "\n\n")
		}
	}
	w.Close()
	if err := cmd.Wait(); err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
	}
	return dot
}

func rethread() {
	if !threaded {
		sort.Sort(byUIDRev(msgs))
	} else {
		byThread := make(map[uint64][]*imap.Msg)
		for _, m := range msgs {
			t := m.GmailThread
			byThread[t] = append(byThread[t], m)
		}

		var threadList [][]*imap.Msg
		for _, t := range byThread {
			sort.Sort(byUID(t))
			threadList = append(threadList, t)
		}
		sort.Sort(byUIDList(threadList))

		msgs = msgs[:0]
		for _, t := range threadList {
			msgs = append(msgs, t...)
		}
	}
	for i, m := range msgs {
		msgNum[m] = i
	}
}

type byUID []*imap.Msg

func (l byUID) Less(i, j int) bool { return l[i].UID < l[j].UID }
func (l byUID) Len() int           { return len(l) }
func (l byUID) Swap(i, j int)      { l[i], l[j] = l[j], l[i] }

type byUIDRev []*imap.Msg

func (l byUIDRev) Less(i, j int) bool { return l[i].UID > l[j].UID }
func (l byUIDRev) Len() int           { return len(l) }
func (l byUIDRev) Swap(i, j int)      { l[i], l[j] = l[j], l[i] }

type byUIDList [][]*imap.Msg

func (l byUIDList) Less(i, j int) bool { return l[i][len(l[i])-1].UID > l[j][len(l[j])-1].UID }
func (l byUIDList) Len() int           { return len(l) }
func (l byUIDList) Swap(i, j int)      { l[i], l[j] = l[j], l[i] }

func subj(m *imap.Msg) string {
	s := m.Hdr.Subject
	for strings.HasPrefix(s, "Re: ") || strings.HasPrefix(s, "RE: ") {
		s = s[4:]
	}
	return s
}

func mcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	c.ArgLine = "Muted"
	scmd(c, dot)
	return dcmd(c, dot)
}

func tmcmd(c *Cmd, msgs []*imap.Msg) *imap.MsgPart {
	c.ArgLine = "Muted"
	tscmd(c, msgs)
	return tdcmd(c, msgs)
}

func scmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		return nil
	}
	return tscmd(c, []*imap.Msg{dot.Msg})
}

func tscmd(c *Cmd, msgs []*imap.Msg) *imap.MsgPart {
	if len(msgs) == 0 {
		return nil
	}
	arg := c.ArgLine
	dot := &msgs[len(msgs)-1].Root
	if arg == "" {
		fmt.Fprintf(bout, "!s needs mailbox (label) name as argument\n")
		return dot
	}
	if strings.EqualFold(arg, "Muted") {
		if err := dot.Msg.Box.Mute(msgs); err != nil {
			fmt.Fprintf(bout, "!mute: %s\n", err)
		}
	} else {
		dst := dot.Msg.Box.Client.Box(arg)
		if dst == nil {
			fmt.Fprintf(bout, "!unknown mailbox %#q", arg)
			return dot
		}
		if err := dst.Copy(msgs); err != nil {
			fmt.Fprintf(bout, "!s %#q: %s\n", arg, err)
		}
	}
	return dot
}

func Wcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	if dot == nil {
		return nil
	}
	if !isGmail {
		fmt.Fprintf(bout, "!cmd W requires gmail\n")
		return dot
	}
	url := fmt.Sprintf("https://mail.google.com/mail/b/%s/?shva=1#inbox/%x", acct.Email, dot.Msg.GmailThread)
	if err := exec.Command("open", url).Run(); err != nil {
		fmt.Fprintf(bout, "!%s\n", err)
	}
	return dot
}

func xcmd(c *Cmd, dot *imap.MsgPart) *imap.MsgPart {
	// TODO: remove saved attachments?
	os.Exit(0)
	panic("not reached")
}

func flushDeleted() {
	var toDelete []*imap.Msg
	for m := range deleted {
		toDelete = append(toDelete, m)
	}
	if len(toDelete) == 0 {
		return
	}
	fmt.Fprintf(os.Stderr, "!deleting %d\n", len(toDelete))
	err := inbox.Delete(toDelete)
	if err != nil {
		fmt.Fprintf(os.Stderr, "!deleting: %s\n", err)
	}
}

func loadNew() {
	if err := inbox.Check(); err != nil {
		fmt.Fprintf(os.Stderr, "!inbox: %s\n", err)
	}

	old := make(map[*imap.Msg]bool)
	for _, m := range msgs {
		old[m] = true
	}

	nnew := 0
	new := inbox.Msgs()
	for _, m := range new {
		if old[m] {
			delete(old, m)
		} else {
			msgs = append(msgs, m)
			nnew++
		}
	}
	if nnew > 0 {
		fmt.Fprintf(os.Stderr, "!%d new messages\n", nnew)
	}
	for m := range old {
		// Deleted
		m.Flags |= imap.FlagDeleted
		delete(deleted, m)
	}
}

func sync(delete bool) {
	if delete {
		flushDeleted()
	}
	loadNew()
	if delete {
		w := 0
		for _, m := range msgs {
			if !m.Deleted() {
				msgs[w] = m
				w++
			}
		}
		msgs = msgs[:w]
	}
	rethread()
}
