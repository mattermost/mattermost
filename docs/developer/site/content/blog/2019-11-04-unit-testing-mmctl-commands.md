---
title: "Unit testing mmctl commands"
heading: "Unit Testing mmctl Commands"
description: "Mattermost is starting a new open source campaign, this time around increasing the unit test coverage for the mmctl tool."
slug: unit-testing-mmctl-commands
date: 2019-11-07T00:00:00-04:00
author: Miguel de la Cruz
github: mgdelacroix
community: miguel.delacruz
---

Mattermost is starting a new Open Source campaign, this time around increasing the unit test coverage for {{< newtabref href="https://github.com/mattermost/mmctl" title="the `mmctl` tool" >}}.

The `mmctl` tool is a CLI application that mimics the commands and features of the current Mattermost CLI tool and uses the Mattermost REST API to communicate with the server. Using the tool, you can control and manage several Mattermost servers without having to access the specific machine on which the server is running. If you can reach a Mattermost instance over the network, you can use `mmctl` to run commands on it.

The goal of the campaign is to create unit tests for the different `mmctl` commands. These tests should be centered around how the tool reacts to different inputs and server responses. We'll be using {{< newtabref href="https://github.com/golang/mock" title="the `gomock` mocking framework" >}} to simulate whatever response we want from the server, and to ensure that the command is performing the requests we expect quickly and accurately.

# The Client Interface

First, let's take a look at the signature of a typical `mmctl` command:

```go
func userSearchCmdF(c client.Client, cmd *cobra.Command, args []string) error { }
```

We use {{< newtabref href="https://github.com/spf13/cobra" title="the awesome Cobra library" >}} to create our commands, and on top of the required cobra arguments (`cmd` and `args`), every command that needs to interact with the server will receive {{< newtabref href="https://github.com/mattermost/mmctl/blob/master/client/client.go" title="a `Client` instance" >}}. This client represents our connection with the server, and at the time we call the command function, it is already logged in with a server and ready to run requests. During testing, this is the interface that we will be simulating and where we will make sure that the command is performing the requests we expect.

# Testing a Use Case

For the purposes of this post, we are going to be following the test for an example case, the `mmctl user search` command. This command receives a user email argument and performs a search in the remote Mattermost instance. If a user with that email exists, it will print its information; if it doesn't, it will print an error message.

This is the test function that checks the behavior when the user does exist in the remote instance:

```go
func (s *MmctlUnitTestSuite) TestSearchUserCmd() {
	s.Run("Search for an existing user", func() {
		emailArg := "example@example.com"
		mockUser := model.User{Username: "ExampleUser", Email: emailArg}

		s.client.
			EXPECT().
			GetUserByEmail(emailArg, "").
			Return(&mockUser, &model.Response{Error: nil}).
			Times(1)

		err := searchUserCmdF(s.client, &cobra.Command{}, []string{emailArg})
		s.Require().Nil(err)
		s.Require().Equal(&mockUser, printer.GetLines()[0])
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}
```

Let's split the test and go through each one of its parts.

# Adding a New Test to The Suite

So first things first, we need to create the test function for our command. We use one function per command and then we separate the different test cases with `s.Run` blocks.

Our tests are part of a {{< newtabref href="https://godoc.org/github.com/stretchr/testify/suite" title="`testify` suite" >}} that prepares the environment for us and generates the mocked client so we can easily use it inside our tests. To add a new test function to the suite, we just need to define it on the suite struct:

```go
func (s *MmctlUnitTestSuite) TestSearchUserCmd() {
    s.Run("Our test case", func() {
        // ...
    })
}
```

This way, we will have an `s` instance inside our test function that will contain a mocked instance of the client ready for us to use, and we will be able to use the suite to run our assertions.

# Mocking an Interaction With the Server

So now that we have our test function defined, the next step is to think about our test case: what inputs is the command going to receive? What interactions with the server are those inputs going to cause? And what responses do I want to mock for them?

For our given test case, we are going to receive an email address as the input and we want to mock a valid response for it. The client method that our command is going to use to send the request to the server is the `GetUserByEmail` method, and for the case of an existing user, it will return the found user instance:

```go
emailArg := "example@example.com"
mockUser := model.User{Username: "ExampleUser", Email: emailArg}

s.client.
	EXPECT().
	GetUserByEmail(emailArg, "").
	Return(&mockUser, &model.Response{Error: nil}).
	Times(1)
```

First we define our input, the `emailArg` that the command is going to receive, and the `mockUser` we are going to mock as the server's response for the user search request. As the response is valid, we will create a simple response that contains no error.

Then we have to state the expectations of the mock. We expect our command to use the `GetUserByEmail` function, calling it with the `emailArg` we mocked and a second argument that will always be an empty string. We also want the server to return our mocked user as a response for that call. Last, we state that this call should happen once.

During our test run, if the client's method is called with the arguments that we expect, it will respond accordingly. At the end of the test, `gomock` will check that our assertions were correct, and it will mark the test as failed if they were not.

# Asserting the Command's Behavior

After mocking the server interactions, all that's left to do is run the command and check the outputs. There are two things that we can use to check that the command behaved as we expected: the command's return value and whatever was printed during its execution.

To perform these assertions we can use the suite itself for {{< newtabref href="https://godoc.org/github.com/stretchr/testify/assert" title="assertions" >}} or `s.Require()` for {{< newtabref href="https://godoc.org/github.com/stretchr/testify/require" title="requires" >}}. Both implement the same helpers to check that our values meet our expectations. The difference between the two is that a failed check with `require` will mark the test as failed and will stop it right after, and a failed check with `assert` will mark the test as failed too, but it will continue running it.

The rule of thumb here is to use `assert` when you can still get valuable information from the following assertions of your test, and use `require` if, after an error, the following checks won't make sense. For example, if we get an error opening a file, it doesn't make sense to check the file contents.

This is what the command execution and its assertions look like:

```go
err := searchUserCmdF(s.client, &cobra.Command{}, []string{emailArg})
s.Require().Nil(err)
s.Require().Equal(&mockUser, printer.GetLines()[0])
s.Require().Len(printer.GetErrorLines(), 0)
```

In the case of searching for an existing user, the first thing we expect is the error to come back as `nil`, so that's our first thing to assert.

To check the output of the commands, we use the `printer` struct. Every significant message that a command prints goes through this struct, which accumulates the output during the execution. At testing time, we can use these accumulated lines to check that the output matches our expectations.

We have two kinds of output: the lines for `stdout` and the error lines for `stderr`. In our case, as the user should have been found and printed through `stdout`, we can use the `printer.GetLines` method to get a slice with the printed messages, and the `Equal` helper to perform the assertion. Then, as we are expecting no errors, we can check that the `printer` struct printed none during the command execution asserting that `printer.GetErrorLines` is empty.

# Printer Cleanup

One thing we need to remember is that although the `printer` struct gets cleaned for us between test functions courtesy of `MmctlUnitTestSuite`, we will need to clean it manually between test cases. Therefore, and to ensure that the output data is clean when we start each test case, we need to run `printer.Clean()` at the beginning of all the `s.Run` blocks of our test files:

```go
func (s *MmctlUnitTestSuite) TestMyCommandCmd() {
    s.Run("First test case", func() {
        printer.Clean()
        // ...
    })

    s.Run("First test case", func() {
        printer.Clean()
        // ...
    })

    s.Run("First test case", func() {
        printer.Clean()
        // ...
    })
}
```

# Participate in The Campaign!

And that's it! That's how you write a unit test for an `mmctl` command.

If you are interested in contributing to this Open Source campaign, take a look at the {{< newtabref href="https://github.com/mattermost/mattermost/issues?q=is%3Aissue+is%3Aopen+label%3A%22Up+For+Grabs%22+label%3AArea%2Fmmctl" title="Up for Grabs tickets for `mmctl`" >}} on the `mattermost-server` repository, or just check {{< newtabref href="https://github.com/mattermost/mattermost/issues?q=is%3Aissue+is%3Aopen+label%3A%22Up+For+Grabs%22" title="all the Up for Grabs tickets" >}} of the project to find tickets related to the Mattermost fronted, the documentation, the Plugin system and any other Open Source campaign we might be running. If you see a ticket that you would like to work on, just leave a comment asking for it to be assigned to you.

Check out the [getting started documentation](https://developers.mattermost.com/contribute/getting-started/) to find out how to set up the project on your machine and read about [the project's development workflow](https://developers.mattermost.com/contribute/server/developer-workflow/). You can go to the {{< newtabref href="https://community.mattermost.com/" title="Mattermost community server" >}} and join the `Developers` channel to ask any question you may have. Hope to see you there!
