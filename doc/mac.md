# Mac developer setup

1. Install and configure Docker CE
  1. Follow the instructions at <https://docs.docker.com/docker-for-mac/>
  1. Edit your `/etc/hosts` file to include the following line:

  ```
  127.0.0.1     dockerhost
  ```
1. Download and install homebrew, using the instructions at <https://brew.sh/>

1. Install Go:

  ```
  brew install go
  ```
1. Set up your Go workspace:

  1. `mkdir ~/go`
  2. Add the following lines to your `~/.bash_profile` file:

    ```
    export GOPATH=$HOME/go
    export PATH=$PATH:$GOPATH/bin
    export PATH=$PATH:/usr/local/go/bin
    ulimit -n 8096
    source ~/.bash_profile
    ```

1. Go to <https://github.com/mattermost/mattermost-server> and create a fork

1. Get the Mattermost source code:

  ```
  go get github.com/mattermost/mattermost-server
  ```
  
1. Change to the `mattermost-server` repository folder:

  ```
  cd ~/go/src/github.com/mattermost/mattermost-server
  ```
  
1. Add your fork as a remote replacing `{me}` by the remote name of you choice and `{yourgithubusername}` with your Github user name:

   ```
   git remote add {me} https://github.com/{yourgithubusername}/mattermost-server.git
   ```

1. Start up the server and test your environment:

```
make run-server
make stop-server # stop the server after it starts succesfully
```

1. You can check if the server is running using the following curl command or opening the URL in your web browser:

  ```
  curl https://localhost:8065/api/v4/system/ping
  ```
  
The server should return a JSON object containing `"status":"OK"`.

**Notice:** The server root will return a `404 Not Found` status, since the web app is not configured as part of the server setup. Please refer to the [Web App Developer Setup](https://developers.mattermost.com/contribute/webapp/developer-setup/) and [Mobile App Developer Setup](https://developers.mattermost.com/contribute/mobile/developer-setup/) for the setup steps.
