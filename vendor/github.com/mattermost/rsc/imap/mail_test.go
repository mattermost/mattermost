package imap

import "testing"

var shortTextTests = []struct {
	in, out string
}{
	{
		in: `From: Brad Fitzpatrick <bradfitz@golang.org>
Date: Tue Oct 18 18:23:11 EDT 2011
To: r@golang.org, golang-dev@googlegroups.com, reply@codereview.appspotmail.com
Subject: Re: [golang-dev] code review 5307043: rpc: don't panic on write error. (issue 5307043)

Here's a test:

bradfitz@gopher:~/go/src/pkg/rpc$ hg diff
diff -r b7f9a5e9b87f src/pkg/rpc/server_test.go
--- a/src/pkg/rpc/server_test.go        Tue Oct 18 17:01:42 2011 -0500
+++ b/src/pkg/rpc/server_test.go        Tue Oct 18 15:22:19 2011 -0700
@@ -467,6 +467,27 @@
        fmt.Printf("mallocs per HTTP rpc round trip: %d\n",
countMallocs(dialHTTP, t))
 }

+type writeCrasher struct{}
+
+func (writeCrasher) Close() os.Error {
+       return nil
+}
+
+func (writeCrasher) Read(p []byte) (int, os.Error) {
+       return 0, os.EOF
+}
+
+func (writeCrasher) Write(p []byte) (int, os.Error) {
+       return 0, os.NewError("fake write failure")
+}
+
+func TestClientWriteError(t *testing.T) {
+       c := NewClient(writeCrasher{})
+       res := false
+       c.Call("foo", 1, &res)
+}
+
 func benchmarkEndToEnd(dial func() (*Client, os.Error), b *testing.B) {
        b.StopTimer()
        once.Do(startServer)


On Tue, Oct 18, 2011 at 3:12 PM, <r@golang.org> wrote:

> Reviewers: golang-dev_googlegroups.com,
>
> Message:
> Hello golang-dev@googlegroups.com,
>
> I'd like you to review this change to
> https://go.googlecode.com/hg/
>
>
> Description:
> rpc: don't panic on write error.
> The mechanism to record the error in the call is already in place.
> Fixes issue 2382.
>
> Please review this at http://codereview.appspot.com/**5307043/<http://codereview.appspot.com/5307043/>
>
> Affected files:
>  M src/pkg/rpc/client.go
>
>
> Index: src/pkg/rpc/client.go
> ==============================**==============================**=======
> --- a/src/pkg/rpc/client.go
> +++ b/src/pkg/rpc/client.go
> @@ -85,7 +85,8 @@
>        client.request.Seq = c.seq
>        client.request.ServiceMethod = c.ServiceMethod
>        if err := client.codec.WriteRequest(&**client.request, c.Args); err
> != nil {
> -               panic("rpc: client encode error: " + err.String())
> +               c.Error = err
> +               c.done()
>        }
>  }
>
> @@ -251,10 +252,10 @@
>  // the same Call object.  If done is nil, Go will allocate a new channel.
>  // If non-nil, done must be buffered or Go will deliberately crash.
>  func (client *Client) Go(serviceMethod string, args interface{}, reply
> interface{}, done chan *Call) *Call {
> -       c := new(Call)
> -       c.ServiceMethod = serviceMethod
> -       c.Args = args
> -       c.Reply = reply
> +       call := new(Call)
> +       call.ServiceMethod = serviceMethod
> +       call.Args = args
> +       call.Reply = reply
>        if done == nil {
>                done = make(chan *Call, 10) // buffered.
>        } else {
> @@ -266,14 +267,14 @@
>                        log.Panic("rpc: done channel is unbuffered")
>                }
>        }
> -       c.Done = done
> +       call.Done = done
>        if client.shutdown {
> -               c.Error = ErrShutdown
> -               c.done()
> -               return c
> +               call.Error = ErrShutdown
> +               call.done()
> +               return call
>        }
> -       client.send(c)
> -       return c
> +       client.send(call)
> +       return call
>  }
>
>  // Call invokes the named function, waits for it to complete, and returns
> its error status.
>
>
>

`,
		out: `From: Brad Fitzpatrick <bradfitz@golang.org>
Date: Tue Oct 18 18:23:11 EDT 2011
To: r@golang.org, golang-dev@googlegroups.com, reply@codereview.appspotmail.com
Subject: Re: [golang-dev] code review 5307043: rpc: don't panic on write error. (issue 5307043)

Here's a test:

bradfitz@gopher:~/go/src/pkg/rpc$ hg diff
diff -r b7f9a5e9b87f src/pkg/rpc/server_test.go
--- a/src/pkg/rpc/server_test.go        Tue Oct 18 17:01:42 2011 -0500
+++ b/src/pkg/rpc/server_test.go        Tue Oct 18 15:22:19 2011 -0700
@@ -467,6 +467,27 @@
        fmt.Printf("mallocs per HTTP rpc round trip: %d\n",
countMallocs(dialHTTP, t))
 }

+type writeCrasher struct{}
+
+func (writeCrasher) Close() os.Error {
+       return nil
+}
+
+func (writeCrasher) Read(p []byte) (int, os.Error) {
+       return 0, os.EOF
+}
+
+func (writeCrasher) Write(p []byte) (int, os.Error) {
+       return 0, os.NewError("fake write failure")
+}
+
+func TestClientWriteError(t *testing.T) {
+       c := NewClient(writeCrasher{})
+       res := false
+       c.Call("foo", 1, &res)
+}
+
 func benchmarkEndToEnd(dial func() (*Client, os.Error), b *testing.B) {
        b.StopTimer()
        once.Do(startServer)
`,
	},
	{
		in: `From: David Symonds <dsymonds@golang.org>
Date: Tue Oct 18 18:17:52 EDT 2011
To: reply@codereview.appspotmail.com, r@golang.org, golang-dev@googlegroups.com
Subject: Re: [golang-dev] code review 5307043: rpc: don't panic on write error. (issue 5307043)

LGTM
On Oct 19, 2011 9:12 AM, <r@golang.org> wrote:

> Reviewers: golang-dev_googlegroups.com,
>
> Message:
> Hello golang-dev@googlegroups.com,
>
> I'd like you to review this change to
> https://go.googlecode.com/hg/
>
>
> Description:
> rpc: don't panic on write error.
> The mechanism to record the error in the call is already in place.
> Fixes issue 2382.
>
> Please review this at http://codereview.appspot.com/**5307043/<http://codereview.appspot.com/5307043/>
>
> Affected files:
>  M src/pkg/rpc/client.go
>
>
> Index: src/pkg/rpc/client.go
> ==============================**==============================**=======
> --- a/src/pkg/rpc/client.go
> +++ b/src/pkg/rpc/client.go
> @@ -85,7 +85,8 @@
>        client.request.Seq = c.seq
>        client.request.ServiceMethod = c.ServiceMethod
>        if err := client.codec.WriteRequest(&**client.request, c.Args); err
> != nil {
> -               panic("rpc: client encode error: " + err.String())
> +               c.Error = err
> +               c.done()
>        }
>  }
>
> @@ -251,10 +252,10 @@
>  // the same Call object.  If done is nil, Go will allocate a new channel.
>  // If non-nil, done must be buffered or Go will deliberately crash.
>  func (client *Client) Go(serviceMethod string, args interface{}, reply
> interface{}, done chan *Call) *Call {
> -       c := new(Call)
> -       c.ServiceMethod = serviceMethod
> -       c.Args = args
> -       c.Reply = reply
> +       call := new(Call)
> +       call.ServiceMethod = serviceMethod
> +       call.Args = args
> +       call.Reply = reply
>        if done == nil {
>                done = make(chan *Call, 10) // buffered.
>        } else {
> @@ -266,14 +267,14 @@
>                        log.Panic("rpc: done channel is unbuffered")
>                }
>        }
> -       c.Done = done
> +       call.Done = done
>        if client.shutdown {
> -               c.Error = ErrShutdown
> -               c.done()
> -               return c
> +               call.Error = ErrShutdown
> +               call.done()
> +               return call
>        }
> -       client.send(c)
> -       return c
> +       client.send(call)
> +       return call
>  }
>
>  // Call invokes the named function, waits for it to complete, and returns
> its error status.
>
>
>

`,
		out: `From: David Symonds <dsymonds@golang.org>
Date: Tue Oct 18 18:17:52 EDT 2011
To: reply@codereview.appspotmail.com, r@golang.org, golang-dev@googlegroups.com
Subject: Re: [golang-dev] code review 5307043: rpc: don't panic on write error. (issue 5307043)

LGTM
`,
	},
	{
		in: `From: Brad Fitzpatrick <bradfitz@golang.org>
Date: Tue Oct 18 23:26:07 EDT 2011
To: rsc@golang.org, golang-dev@googlegroups.com, reply@codereview.appspotmail.com
Subject: Re: [golang-dev] code review 5297044: gotest: use $GCFLAGS like make does (issue 5297044)

LGTM

On Tue, Oct 18, 2011 at 7:52 PM, <rsc@golang.org> wrote:

> Reviewers: golang-dev_googlegroups.com,
>
> Message:
> Hello golang-dev@googlegroups.com,
>
> I'd like you to review this change to
> https://go.googlecode.com/hg/
>
>
> Description:
> gotest: use $GCFLAGS like make does
>
> Please review this at http://codereview.appspot.com/**5297044/<http://codereview.appspot.com/5297044/>
>
> Affected files:
>  M src/cmd/gotest/gotest.go
>
>
> Index: src/cmd/gotest/gotest.go
> ==============================**==============================**=======
> --- a/src/cmd/gotest/gotest.go
> +++ b/src/cmd/gotest/gotest.go
> @@ -153,8 +153,12 @@
>        if gc == "" {
>                gc = O + "g"
>        }
> -       XGC = []string{gc, "-I", "_test", "-o", "_xtest_." + O}
> -       GC = []string{gc, "-I", "_test", "_testmain.go"}
> +       var gcflags []string
> +       if gf := strings.TrimSpace(os.Getenv("**GCFLAGS")); gf != "" {
> +               gcflags = strings.Fields(gf)
> +       }
> +       XGC = append([]string{gc, "-I", "_test", "-o", "_xtest_." + O},
> gcflags...)
> +       GC = append(append([]string{gc, "-I", "_test"}, gcflags...),
> "_testmain.go")
>        gl := os.Getenv("GL")
>        if gl == "" {
>                gl = O + "l"
>
>
>
`,
		out: `From: Brad Fitzpatrick <bradfitz@golang.org>
Date: Tue Oct 18 23:26:07 EDT 2011
To: rsc@golang.org, golang-dev@googlegroups.com, reply@codereview.appspotmail.com
Subject: Re: [golang-dev] code review 5297044: gotest: use $GCFLAGS like make does (issue 5297044)

LGTM
`,
	},
}

func TestShortText(t *testing.T) {
	for i, tt := range shortTextTests {
		if out := string(shortText([]byte(tt.in))); out != tt.out {
			t.Errorf("#%d: = %q, want %q\n", i, out, tt.out)
		}
	}
}
