
XXXXXX - TODO someone needs to update

Will become a heading
==============

Will become a sub heading
--------------

*This will be Italic*

**This will be Bold**

- This will be a list item
- This will be a list item

    Add a indent and this will end up as code


See
---
[http://daringfireball.net/projects/markdown/](http://daringfireball.net/projects/markdown/)
[http://en.wikipedia.org/wiki/Markdown](http://en.wikipedia.org/wiki/Markdown)
[http://github.github.com/github-flavored-markdown/](http://github.github.com/github-flavored-markdown/)


Developer Machine Setup (Mac)
=============================

Docker Setup 
------------
1. Follow the instructions at docs.docker.com/installation/mac/ Use the Boot2Docker command-line utility 
If you do command-line setup use: `boot2docker init eval “$(boot2docker shellinit)”`
2. Get your Docker ip address with `boot2docker ip`
3. Add a line to your /etc/hosts that goes `<Docker IP> dockerhost` 
4. Run `boot2docker shellinit` and copy the export statements to your ~/.bash_profile 

Go Setup 
--------
1. Download Go from golang.org/dl/ 

Node.js Setup 
-------------
1. Install homebrew from brew.sh 
2. `brew install node`

Compass Setup 
-------------
1. Make sure you have the latest version of Ruby 
2. `gem install compass`

Mattermost Setup 
----------------
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

