**Mattermost Preview<br>**
**Team Communication Service<br>**
**Version 0.40**

What matters most to your team?
===============================

Words have power.<br>
Mattermost serves teams who use words to shape the future.<br>
The words you choose are up to you.

*- SpinPunch*

Installing the Mattermost Preview 
=================================

You're installing "Mattermost Preview", a pre-released 0.40 version intended for an early look at what we're building. While SpinPunch runs this version internally, it's not recommended for production deployments since we can't guarantee API stability or backwards compatibility until our 1.0 version release. 

That said, any issues at all, please let us know on the Mattermost forum at: http://bit.ly/1MY1kul

Developer Machine Setup (Mac)
-----------------------------

DOCKER SETUP

1. Follow the instructions at http://docs.docker.com/installation/mac/
<br>a) Use the Boot2Docker command-line utility 
<br>b) If you do command-line setup use: `boot2docker init eval “$(boot2docker shellinit)”`
2. Get your Docker IP address with `boot2docker ip`
3. Add a line to your /etc/hosts that goes `<Docker IP> dockerhost` 
4. Run `boot2docker shellinit` and copy the export statements to your ~/.bash_profile 

Any issues? Please let us know on our forums at: http://bit.ly/1MY1kul

GO SETUP

1. Download Go from http://golang.org/dl/ 

NODE.JS SETUP 

1. Install homebrew from brew.sh 
2. `brew install node`

COMPASS SETUP 

1. Make sure you have the latest version of Ruby 
2. `gem install compass`

MATTERMOST SETUP 

1. Make a project directory for Mattermost, which we'll call **$PROJECT** for the rest of these instructions
2. Make a `go` directory in your $PROJECT directory 
3. Open or create your ~/.bash_profile and add the following lines: <br>   `export GOPATH=$PROJECT/go`<br>   `export PATH=$PATH:$GOPATH/bin` <br>then refresh your bash profile with `source ~/.bash_profile`
4. Then use `cd $GOPATH` and `mkdir -p src/github.com/mattermost` then cd into this directory and run `git clone github.com/mattermost/platform.git` 
5. If you do not have Mercurial, download it with: `brew install mercurial`
6. Then do `cd platform` and `make test`. Provided the test runs fine, you now have a complete build environment. 
7. Use `make run` to run your code

Any issues? Please let us know on our forums at: http://bit.ly/1MY1kul

License
-------

This software uses the Apache 2.0 open source license. For more details see: http://bit.ly/1Lc25Sv<br>

**XXXXXX TODO: Test install procedures**
