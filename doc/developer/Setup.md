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
4. Install Compass
	1. Run `ruby -v` and check the ruby version is 1.8.7 or higher
	2. `sudo gem install compass`
5. Download Mattermost  
	`cd ~/go`  
	`mkdir -p src/github.com/mattermost`  
	`cd src/github.com/mattermost`  
	`git clone https://github.com/mattermost/platform.git`  
	`cd platform`
6. Run unit tests on Mattermost using `make test` to make sure the installation was successful
7. If tests passed, you can now run Mattermost using `make run`

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
		`export PATH=$PATH:$GOPATH/bin`  
		`ulimit -n 8096`  
		If you don't increase the file handle limit you may see some weird build issues with browserify or npm.  
	3. Reload your bashrc  
		`source ~/.bashrc`
6. Install Node.js  
	`curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -`  
	`sudo apt-get install -y nodejs`
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

### Archlinux ###

1. Install Docker
	1. `pacman -S docker`
	2. `gpasswd -a user docker`
	3. `systemctl enable docker.service`
	4. `systemctl start docker.service`
	5. `newgrp docker`
2. Set up your dockerhost address
	1. Edit your /etc/hosts file to include the following line
		`127.0.0.1 dockerhost`
3. Install Go
	1. `pacman -S go`
4. Set up your Go workspace and add Go to the PATH
	1. `mkdir ~/go`
	2. Add the following to your ~/.bashrc
		1. `export GOPATH=$HOME/go`
		2. `export GOROOT=/usr/lib/go`
		3. `export PATH=$PATH:$GOROOT/bin`
	3. Reload your bashrc
		`source ~/.bashrc`
4. Edit /etc/security/limits.conf and add the following lines (replace *username* with your user):

	```
		username	soft	nofile	8096  
		username	hard	nofile	8096  
	```

	You will need to reboot after changing this. If you don't increase the file handle limit you may see some weird build issues with browserify or npm.
5. Install Node.js
	`pacman -S nodejs npm`
6. Install Ruby and Compass
	1. `pacman -S ruby`
	2. Add executable gems to your path in your ~/.bashrc

		`PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"`
	3. `gem install compass`
7. Download Mattermost
	`cd ~/go`  
	`mkdir -p src/github.com/mattermost`  
	`cd src/github.com/mattermost`  
	`git clone https://github.com/mattermost/platform.git`  
	`cd platform`  
8. Run unit tests on Mattermost using `make test` to make sure the installation was successful
9. If tests passed, you can now run Mattermost using `make run`

Any issues? Please let us know on our forums at: http://forum.mattermost.org
