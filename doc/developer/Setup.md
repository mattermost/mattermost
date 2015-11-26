Developer Machine Setup
-----------------------------

### Mac OS X ###

1. Download and set up Docker Toolbox
	1. Follow the instructions at http://docs.docker.com/installation/mac/
	2. Start a new docker host  
		`docker-machine create -d virtualbox dev`
	2. Get the IP address of your docker host  
		`docker-machine ip dev`
	3. Add a line to your /etc/hosts that goes `<Docker IP> dockerhost`
	4. Run `docker-machine env dev` and copy the export statements to your ~/.bash_profile
2. Download Go 1.5.1 and Node.js using Homebrew
	1. Download Homebrew from http://brew.sh/
	2. `brew install go`
	3. `brew install node`
3. Set up your Go workspace
	1. `mkdir ~/go`
	2. Add the following to your ~/.bash_profile  
		`export GOPATH=$HOME/go`  
		`export PATH=$PATH:$GOPATH/bin`  
		`ulimit -n 8096`  
		If you don't increase the file handle limit you may see some weird build issues with browserify or npm.  
	3. Reload your bash profile  
		`source ~/.bash_profile`
4. Install Godep
	1. `cd ~/go`
	2. `go get github.com/tools/godep`
5. Install Compass
	1. Run `ruby -v` and check the ruby version is 1.8.7 or higher
	2. `sudo gem install compass`
6. Download Mattermost  
	`cd ~/go`  
	`mkdir -p src/github.com/mattermost`  
	`cd src/github.com/mattermost`  
	`git clone https://github.com/mattermost/platform.git`  
	`cd platform`
7. Run unit tests on Mattermost using `make test` to make sure the installation was successful
8. If tests passed, you can now run Mattermost using `make run`

Any issues? Please let us know on our forums at: http://forum.mattermost.org

### Ubuntu ###

1. Download Docker
	1. Follow the instructions at https://docs.docker.com/installation/ubuntulinux/ or use the summary below:  
		`sudo apt-get update`  
		`sudo apt-get install wget`  
		`wget -qO- https://get.docker.com/ | sh`  
		`sudo usermod -aG docker <username>`  
		`sudo service docker start`  
		`newgrp docker`
2. Set up your dockerhost address
	1. Edit your /etc/hosts file to include the following line  
		`127.0.0.1 dockerhost`
3. Install build essentials
	1. `apt-get install build-essential`
4. Download Go 1.5.1 from http://golang.org/dl/
5. Set up your Go workspace and add Go to the PATH
	1. `mkdir ~/go`
	2. Add the following to your ~/.bashrc  
		`export GOPATH=$HOME/go`  
		`export GOROOT=/usr/local/go`  
		`export PATH=$PATH:$GOROOT/bin`  
		`ulimit -n 8096`  
		If you don't increase the file handle limit you may see some weird build issues with browserify or npm.  
	3. Reload your bashrc  
		`source ~/.bashrc`
6. Install Node.js
	1. Download the newest version of the Node.js sources from https://nodejs.org/en/download/
	2. Extract the contents of the package and cd into the extracted files
	3. Compile and install Node.js  
		`./configure`  
		`make`  
		`make install`
7. Install Ruby and Compass  
	`apt-get install ruby`  
	`apt-get install ruby-dev`  
	`gem install compass`
8. Download Mattermost  
	`cd ~/go`  
	`mkdir -p src/github.com/mattermost`  
	`cd src/github.com/mattermost`  
	`git clone https://github.com/mattermost/platform.git`  
	`cd platform`
9. Run unit tests on Mattermost using `make test` to make sure the installation was successful
10. If tests passed, you can now run Mattermost using `make run`

Any issues? Please let us know on our forums at: http://forum.mattermost.org
