Developer Machine Setup (Mac)
-----------------------------

DOCKER SETUP

1. Follow the instructions at http://docs.docker.com/installation/mac/
    1. Use the Boot2Docker command-line utility
    2. If you do command-line setup use: `boot2docker init eval “$(boot2docker shellinit)”`
2. Get your Docker IP address with `boot2docker ip`
3. Add a line to your /etc/hosts that goes `<Docker IP> dockerhost` 
4. Run `boot2docker shellinit` and copy the export statements to your ~/.bash_profile 

Any issues? Please let us know on our forums at: http://forum.mattermost.org

GO SETUP

1. Download Go from http://golang.org/dl/ 

NODE.JS SETUP 

1. Install homebrew from http://brew.sh 
2. `brew install node`

COMPASS SETUP 

1. Make sure you have the latest version of Ruby 
2. `gem install compass`

MATTERMOST SETUP 

1. Make a project directory for Mattermost, which we'll call **$PROJECT** for the rest of these instructions
2. Make a `go` directory in your $PROJECT directory 
3. Open or create your ~/.bash_profile and add the following lines:  
    `export GOPATH=$PROJECT/go`  
    `export PATH=$PATH:$GOPATH/bin`  
    then refresh your bash profile with `source ~/.bash_profile`
4. Then use `cd $GOPATH` and `mkdir -p src/github.com/mattermost` then cd into this directory and run `git clone github.com/mattermost/platform.git` 
5. If you do not have Mercurial, download it with: `brew install mercurial`
6. Then do `cd platform` and `make test`. Provided the test runs fine, you now have a complete build environment. 
7. Use `make run` to run your code

Any issues? Please let us know on our forums at: http://forum.mattermost.org
