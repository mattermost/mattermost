---
title: Incorporating GolangCI-Lint at Mattermost
heading: "Incorporating GolangCI-Lint at Mattermost"
description: "Although go vet and gofmt work well, there are a lot of other powerful linters out there which we’re potentially missing out on."
slug: incorporating-golangci-lint
date: 2020-01-13
categories:
    - "go"
    - “linting”
author: Agniva De Sarker
github: agnivade
community: agnivade
author_2: Ben Schumacher
github_2: hanzei
community_2: hanzei
---


At Mattermost, we have traditionally relied on the trusty `go vet` and `gofmt` checks for our CI runs. Although it works well, there are a lot of other powerful linters out there which we're potentially missing out on.

Speaking of linters, the first name that inevitably comes up is {{< newtabref href="https://staticcheck.io/" title="staticcheck" >}}. It's a powerful metalinter with a whole slew of checks. But simply running staticcheck is not sufficient, because it misses out on other linters which perform a single task, but nevertheless are very powerful. A few popular ones are {{< newtabref href="https://github.com/gordonklaus/ineffassign" title="ineffassign" >}}, {{< newtabref href="https://github.com/kisielk/errcheck" title="errcheck" >}}, {{< newtabref href="https://github.com/mdempsky/unconvert" title="unconvert" >}}, {{< newtabref href="https://github.com/remyoudompheng/go-misc/tree/master/deadcode" title="deadcode" >}}, and {{< newtabref href="https://gitlab.com/opennota/check/tree/master/cmd/structcheck" title="structcheck" >}} among others.

We needed a way to run all of these linters together and efficiently too. Gometalinter was a pioneer in this field by providing a way to run multiple linters together. Unfortunately, it did this by shelling out to the linters and running them, which made it very inefficient. In its defense, using all the linters as a library was also equally hard, because there wasn’t any standard API that all of them could use.

But the introduction of the `golang.org/x/tools/go/analysis` package during the 1.12 cycle was a game-changer. It introduced a standard API for writing Go static analyzers, which allowed them to be easily shared with the rest of the ecosystem in a plug-and-play model. Finally the One Ring to rule them all!

Unsurprisingly, before too long, GolangCI-Lint came up on the horizon. It used the go/analysis API to load all the linters and ran them concurrently, leading to a drastic reduction in memory and improvement in speed; becoming the successor to Gometalinter which is deprecated now.

The writing was on the wall. GolangCI-Lint was the right choice. Following is an account of how we integrated it into our codebase.


#### Integrating GolangCI-Lint into our CI

Right off the bat, there was a big question mark hanging over our heads. It would be very, _very_ painful to have to fix _all_ the issues in our codebase before enforcing it as a CI check, by which time, new issues would have crept in. It would be a never-ending chase.

Fortunately, GolangCI-Lint provides us with a `--new-from-rev=HEAD~1` option which allows it to check only code added in the latest commit. This gives us breathing room to enable the check in our CI and retroactively fix all the old issues. Granted, it won’t catch issues for PRs with more than one commit, but it’s a start and we planned to lift this restriction anyways.

We also decided to start off with the GitHub {{< newtabref href="https://golangci.com/" title="check" >}} which relieves any CI setup burden on our side. This check helps community members spot linter issues at first glance.

#### Selecting the Initial Set of Linters

So with that taken care of, our next task was to decide on a set of linters to start off with. We couldn't begin with a huge set because first of all, it would take longer to run. Additionally, it would further delay our target of fixing all the existing issues in our codebase. We needed a small but powerful set of linters that would catch effective issues, but wouldn’t take too long to fix.

After some trial and error, we settled down on {{< newtabref href="https://github.com/mattermost/mattermost/blob/e2a2a1a5bce69f153e6e095e07dadf92b64df699/.golangci.yml#L18-L26" title="these" >}}.

We chose not to include `staticcheck` for the first cut because a lot of the functionality was already provided by the other linters. We also did not include `errcheck` because it uncovered _too_ many issues which did not look likely to be fixed within a reasonable time frame.

#### What Issues were Uncovered?

Most of the issues fixed in the process were stylistic. We fixed {{< newtabref href="https://github.com/mattermost/mattermost/pull/12943" title="formatting issues" >}}, {{< newtabref href="https://github.com/mattermost/mattermost/pull/12928" title="removed unnecessary" >}} {{< newtabref href="https://github.com/mattermost/mattermost/pull/12927" title="code" >}}, and {{< newtabref href="https://github.com/mattermost/mattermost/pull/12924" title="removed" >}} {{< newtabref href="https://github.com/mattermost/mattermost/pull/12968" title="a lot of" >}}, {{< newtabref href="https://github.com/mattermost/mattermost/pull/12929" title="unused" >}} {{< newtabref href="https://github.com/mattermost/mattermost/pull/12926" title="code" >}}. These fixes are great to keep the code base clean and consistent but have no impact on the behavior of the software and did not reveal any bugs.

The more interesting issues were found by `ineffassign` and `govet`.

`ineffassign` reports instances where a value was assigned to a variable but not used. We found two instances in test files where we didn’t validate a returned valued. Although it’s a minor improvement, it’s still great to fix these issues.

The most interesting issue where found by `govet`. Take a look at this code sample:
```go
obj, err := us.GetReplica().Get(model.Compliance{}, id)
if err != nil {
	return nil, model.NewAppError("SqlComplianceStore.Get", "store.sql_compliance.get.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
}
if obj == nil {
	return nil, model.NewAppError("SqlComplianceStore.Get", "store.sql_compliance.get.finding.app_error", nil, err.Error(), http.StatusNotFound)
}
```
Looks fine, doesn’t it? Except it contains a null pointer exception. At the second `return` we know that `err == nil` and hence `err.Error()` will panic. `govet` found this issue and {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-c5a8591c69e26808c8171db5d5dddef7L78-R78" title="we fixed it" >}}. 

There were {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-92d8335ab3456e9fd16cb67c739c52e0R163-R165" title="actually" >}}, {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-2c6106afe8477623894c02707bffe06dL622-R622" title="a" >}} {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-0425a0737e8b051835b0978d034d22fcL139-R139" title="couple" >}}, {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-32736de6a4585a5384f7606e57b2792fR269-R290" title="of" >}} {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-2c6106afe8477623894c02707bffe06dL589-R589" title="issues" >}} like this one. Finding these issues alone has been a huge success and proved that linters can help fix bugs before they occur in a production environment.

Another issue found by `govet` lies in this piece of code:
```go
newSecret := &model.SystemPostActionCookieSecret{
	Secret: make([]byte, 32),
}
_, err := rand.Reader.Read(newSecret.Secret)
if err != nil {
	return err
}

system := &model.System{
	Name: model.SYSTEM_POST_ACTION_COOKIE_SECRET,
}
v, err := json.Marshal(newSecret)
if err != nil {
	return err
}
system.Value = string(v)
// If we were able to save the key, use it, otherwise log the error.
if err = a.Srv.Store.System().Save(system); err == nil {
	secret = newSecret
}
```

`a.Srv.Store.System().Save` returns a custom error type `model.AppError`, that is commonly used in the Mattermost code base. But assigning this custom error to the variable `err` of type `error` results in variable that will never be `nil`. Hence, the line `secret = newSecret` will never be reached. This is {{< newtabref href="https://golang.org/doc/faq#nil_error" title="a common gotcha in Go" >}}. Using a dedicated variable for the custom error is the right way to fix this.
We found and fixed {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-76e64b305c25e308c6b9f4c2fa572c51R204-R207" title="two" >}} of these {{< newtabref href="https://github.com/mattermost/mattermost/commit/812c40a30703efd159675a1ff1b26a64f18b14d0#diff-76e64b305c25e308c6b9f4c2fa572c51R142-R144" title="issues" >}}.


#### What Issues were Encountered During the GolangCI-Lint Integration?

The first issue we observed was there was a warning that always showed up in CI, but we could never reproduce it locally.

```
WARN [runner] Can't run linter goanalysis_metalinter: findcall: analysis skipped: errors in package: [/home/agniva/play/go/src/github.com/mattermost/mattermost-server/testlib/resources.go:64:58: cannot use (func(fileInfo os.FileInfo) bool literal) (value of type func(fileInfo os.FileInfo) bool) as func(os.FileInfo) bool value in argument to fileutils.FindPath /home/agniva/play/go/src/github.com/mattermost/mattermost-server/testlib/resources.go:49:57: cannot use (func(fileInfo os.FileInfo) bool literal) (value of type func(fileInfo os.FileInfo) bool) as func(os.FileInfo) bool value in argument to fileutils.FindPath]
```

Further digging showed that it was somehow related to a cold cache. We could reproduce the issue (although not deterministically) with a greater probability if the cache was cleaned. An issue was filed {{< newtabref href="https://github.com/golangci/golangci-lint/issues/885" title="here" >}}. 

We also noticed that syntax errors were displayed very poorly, which did not lead to a good dev experience. And moreover, syntax errors led to a warning, whereas technically it should be an error.

For instance, a single missing parenthesis would lead to a single line containing all the errors found:

```
WARN [runner] Can't run linter unused: buildssa: analysis skipped: errors in package: [/home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1889:64: missing ',' before newline in argument list /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1890:1: expected operand, found '}' /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1897:2: missing ',' in argument list /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1898:1: expected operand, found '}' /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1903:2: missing ',' in argument list /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1904:1: expected operand, found '}' /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1911:2: missing ',' in argument list /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1912:1: expected operand, found '}' /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1915:2: missing ',' in argument list /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1916:3: expected operand, found 'return' /home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1917:2: expected operand, found '}'] 
WARN [runner] Can't run linter goanalysis_metalinter: structcheck: analysis skipped: errors in package: [/home/agniva/play/go/src/github.com/mattermost/mattermost-server/wsapi/api.go:7:2: could not import github.com/mattermost/mattermost-server/v5/app (/home/agniva/play/go/src/github.com/mattermost/mattermost-server/app/channel.go:1889:64: missing ',' before newline in argument list)] 
```

Compare that to the `go vet` output:

```
# github.com/mattermost/mattermost-server/v5/app
app/channel.go:1889:64: syntax error: unexpected newline, expecting comma or )
# github.com/mattermost/mattermost-server/v5/app
vet: app/channel.go:1889:64: missing ',' before newline in argument list (and 10 more errors)
```

The warnings which should have been an error already had an {{< newtabref href="https://github.com/golangci/golangci-lint/issues/866" title="issue" >}}. We filed another {{< newtabref href="https://github.com/golangci/golangci-lint/issues/886" title="one" >}} for the poor syntax errors.

Lastly, we just wanted to touch upon something that might be surprising to new Gophers out there. Mattermost has a very thin enterprise layer which gets built by including the directory as a symlink from inside the open-source repo.

While running GolangCI-Lint with the enterprise layer included, we observed that it was failing to run the checks inside the symlink. This is due to the fact that the Go toolchain does not work very well with symlinks. As a simple fix, we added another {{< newtabref href="https://github.com/mattermost/mattermost/blob/f672eb729103ef0c8512a3facb48d44c386cd00a/Makefile#L163" title="command" >}} to run that directory specifically.

#### Future Work

Now that we have a base in place, our plan is to add more linters. Here is a short wish-list for the near term, roughly in the order of priority:

* __errcheck__: This got missed out in our initial cut because the work involved was too big. It is one of the most common mistakes in Go code, and extremely important that these get caught.
* __bodyclose__: A common slip is to forget to close the body while reading HTTP responses. This is our next linter to integrate.
* __misspell__: Spelling mistakes are sometimes hard to detect, and they invariably creep in the codebase. This is a great linter to check that.
* __nakedret__: This flags usages of naked returns in functions greater than a specified length. It is a recommended point in the {{< newtabref href="https://github.com/golang/go/wiki/CodeReviewComments#named-result-parameters" title="Code Review Comments" >}} guide. There are not too many instances of this in our codebase. So we would like them removed to be more idiomatic.
That’s the plan for now. We may want to integrate `staticcheck` also in the long-term future.

Lastly, we would like to mention that any community contributions to help out with adding these linters are highly appreciated !

Feel free to check out the [getting started](https://developers.mattermost.com/contribute/getting-started) page to find out how to set up the project on your machine. You can also join the `~Developers` channel on our Mattermost {{< newtabref href="https://community.mattermost.com/" title="community server" >}} if you have any questions. We would be happy to help out.
