XXXXXX TODO: Test install procedures 

Mattermost (Preview)<br>
Team Communication Service<br>
Version 0.40

What matters most to your team?
===============================

Words have power.<br>
We built Mattermost for teams who use words to shape the future.<br>
The words you choose are up to you.

*- SpinPunch*

Installing the Mattermost Preview 
=================================

You're installing "Mattermost Preview", a pre-released version intended for an early look at what we're building. While SpinPunch runs this codebase internally, because your use will differ from ours this version is not recommended for production deployments.

That said, any issues at all, please let us know on the Mattermost forum at: http://bit.ly/1MY1kul

Developer Machine Setup (Mac)
-----------------------------

DOCKER 

1. Follow the instructions at http://docs.docker.com/installation/mac/ Use the Boot2Docker command-line utility 
If you do command-line setup use: `boot2docker init eval “$(boot2docker shellinit)”`
2. Get your Docker ip address with `boot2docker ip`
3. Add a line to your /etc/hosts that goes `<Docker IP> dockerhost` 
4. Run `boot2docker shellinit` and copy the export statements to your ~/.bash_profile 

Any issues? Please let us know on our forums at: http://bit.ly/1MY1kul

GO

1. Download Go from http://golang.org/dl/ 

NODE.JS SETUP 

1. Install homebrew from brew.sh 
2. `brew install node`

COMPASS SETUP 

1. Make sure you have the latest version of Ruby 
2. `gem install compass`

MATTERMOST SETUP 

1. Make a project directory for Mattermost, which will for the rest of this document be referred to as $PROJECT 
2. Make a go directory in your $PROJECT directory 
3. Create/Open your ~/.bash_profile and add the following lines: `export GOPATH=$PROJECT/go export PATH=$PATH:$GOPATH/bin`
4. Refresh your bash profile with `source ~/.bash_profile`
5. `cd $GOPATH`
6. `mkdir -p src/github.com/mattermost` then cd into this directory 
7. `git clone github.com/mattermost/platform.git` 
8. If you do not have Mercurial, download it with: `brew install mercurial`
9. `cd platform` 
10. `make test` 
11. Provided the test runs fine, you now have a complete build environment. Use `make run` to run your code

Any issues? Please let us know on our forums at: http://bit.ly/1MY1kul
