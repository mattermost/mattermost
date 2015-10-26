# (Community Guide) Production Installation on Debian Jessie (x64)

Note: This install guide has been generously contributed by the Mattermost community. It has not yet been tested by the core. We have [an open ticket](https://github.com/mattermost/platform/issues/1185) requesting community help testing and improving this guide. Once the community has confirmed we have multiple deployments on these instructions, we can update the text here. If you're installing on Debian anyway, please let us know any issues or instruciton improvements? https://github.com/mattermost/platform/issues/1185


## Install Debian Jessie (x64)
1. Set up 3 machines with Debian Jessie with 2GB of RAM or more.  The servers will be used for the Load Balancer, Mattermost (this must be x64 to use pre-built binaries), and Database.
1. This can also be set up all on a single server for small teams:
  * I have a Mattermost instance running on a single Debian Jessie server with 1GB of ram and 30 GB SSD
  * This has been working in production for ~20 users without issue.
  * The only difference in the below instructions for this method is to do everything on the same server
1. Make sure the system is up to date with the most recent security patches.
  * ``` sudo apt-get update```
  * ``` sudo apt-get upgrade```

## Set up Database Server
1. For the purposes of this guide we will assume this server has an IP address of 10.10.10.1
1. Install PostgreSQL 9.3+ (or MySQL 5.6+)
  * ``` sudo apt-get install postgresql postgresql-contrib```
1. PostgreSQL created a user account called `postgres`.  You will need to log into that account with:
  * ``` sudo -i -u postgres```
1. You can get a PostgreSQL prompt by typing:
  * ``` psql```
1. Create the Mattermost database by typing:
  * ```postgres=# CREATE DATABASE mattermost;```
1. Create the Mattermost user by typing:
  * ```postgres=# CREATE USER mmuser WITH PASSWORD 'mmuser_password';```
1. Grant the user access to the Mattermost database by typing:
  * ```postgres=# GRANT ALL PRIVILEGES ON DATABASE mattermost to mmuser;```
1. You can exit out of PostgreSQL by typing:
  * ```postgre=# \q```
1. You can exit the postgres account by typing:
  * ``` exit```

## Set up Mattermost Server
1. For the purposes of this guide we will assume this server has an IP address of 10.10.10.2
1. Download the latest Mattermost Server by typing:
  * ``` wget https://github.com/mattermost/platform/releases/download/v1.1.0/mattermost.tar.gz```
1. Install Mattermost under /opt
   * ``` cd /opt```
   * Unzip the Mattermost Server by typing:
   * ``` tar -xvzf mattermost.tar.gz```
1. Create the storage directory for files.  We assume you will have attached a large drive for storage of images and files.  For this setup we will assume the directory is located at `/mattermost/data`.
  * Create the directory by typing:
  * ``` sudo mkdir -p /opt/mattermost/data```
1. Create a system user and group called mattermost that will run this service
   * ``` useradd -r mattermost -U```
   * Set the mattermost account as the directory owner by typing:
   * ``` sudo chown -R mattermost:mattermost /opt/mattermost```
   * Add yourself to the mattermost group to ensure you can edit these files:
   * ``` sudo usermod -aG mattermost USERNAME```
1. Configure Mattermost Server by editing the config.json file at /opt/mattermost/config
  * ``` cd /opt/mattermost/config```
  * Edit the file by typing:
  * ``` vi config.json```
  * replace `DriverName": "mysql"` with `DriverName": "postgres"`
  * replace `"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8"` with `"DataSource": "postgres://mmuser:mmuser_password@10.10.10.1:5432/mattermost?sslmode=disable&connect_timeout=10"`
  * Optionally you may continue to edit configuration settings in `config.json` or use the System Console described in a later section to finish the configuration.
1. Test the Mattermost Server
  * ``` cd /opt/mattermost/bin```
  * Run the Mattermost Server by typing:
  * ``` ./platform```
  * You should see a console log like `Server is listening on :8065` letting you know the service is running.
  * Stop the server for now by typing `ctrl-c`
1. Setup Mattermost to use the systemd init daemon which handles supervision of the  Mattermost process
   * ``` sudo touch /etc/init.d/mattermost```
   * ``` sudo vi /etc/init.d/mattermost```
   * Copy the following lines into `/etc/init.d/mattermost`
```
#! /bin/sh
### BEGIN INIT INFO
# Provides:          mattermost
# Required-Start:    $network $syslog
# Required-Stop:     $network $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Mattermost Group Chat
# Description:       Mattermost: An open-source Slack
### END INIT INFO

PATH=/sbin:/usr/sbin:/bin:/usr/bin
DESC="Mattermost"
NAME=mattermost
MATTERMOST_ROOT=/opt/mattermost
MATTERMOST_GROUP=mattermost
MATTERMOST_USER=mattermost
DAEMON="$MATTERMOST_ROOT/bin/platform"
PIDFILE=/var/run/$NAME.pid
SCRIPTNAME=/etc/init.d/$NAME

. /lib/lsb/init-functions

do_start() {
    # Return
    #   0 if daemon has been started
    #   1 if daemon was already running
    #   2 if daemon could not be started
    start-stop-daemon --start --quiet \
        --chuid $MATTERMOST_USER:$MATTERMOST_GROUP --chdir $MATTERMOST_ROOT --background \
        --pidfile $PIDFILE --exec $DAEMON --test > /dev/null \
        || return 1
    start-stop-daemon --start --quiet \
        --chuid $MATTERMOST_USER:$MATTERMOST_GROUP --chdir $MATTERMOST_ROOT --background \
        --make-pidfile --pidfile $PIDFILE --exec $DAEMON \
        || return 2
}

#
# Function that stops the daemon/service
#
do_stop() {
    # Return
    #   0 if daemon has been stopped
    #   1 if daemon was already stopped
    #   2 if daemon could not be stopped
    #   other if a failure occurred
    start-stop-daemon --stop --quiet --retry=TERM/30/KILL/5 \
        --pidfile $PIDFILE --exec $DAEMON
    RETVAL="$?"
    [ "$RETVAL" = 2 ] && return 2
    # Wait for children to finish too if this is a daemon that forks
    # and if the daemon is only ever run from this initscript.
    # If the above conditions are not satisfied then add some other code
    # that waits for the process to drop all resources that could be
    # needed by services started subsequently.  A last resort is to
    # sleep for some time.
    start-stop-daemon --stop --quiet --oknodo --retry=0/30/KILL/5 \
        --exec $DAEMON
    [ "$?" = 2 ] && return 2
    # Many daemons don't delete their pidfiles when they exit.
    rm -f $PIDFILE
    return "$RETVAL"
}

case "$1" in
start)
        [ "$VERBOSE" != no ] && log_daemon_msg "Starting $DESC" "$NAME"
        do_start
        case "$?" in
                0|1) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
                2) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
        esac
        ;;
stop)
        [ "$VERBOSE" != no ] && log_daemon_msg "Stopping $DESC" "$NAME"
        do_stop
        case "$?" in
                0|1) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
                2) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
        esac
        ;;
status)
    status_of_proc "$DAEMON" "$NAME" && exit 0 || exit $?
    ;;
restart|force-reload)
        #
        # If the "reload" option is implemented then remove the
        # 'force-reload' alias
        #
        log_daemon_msg "Restarting $DESC" "$NAME"
        do_stop
        case "$?" in
        0|1)
                do_start
                case "$?" in
                        0) log_end_msg 0 ;;
                        1) log_end_msg 1 ;; # Old process is still running
                        *) log_end_msg 1 ;; # Failed to start
                esac
                ;;
        *)
                # Failed to stop
                log_end_msg 1
                ;;
        esac
        ;;
*)
        echo "Usage: $SCRIPTNAME {start|stop|status|restart|force-reload}" >&2
        exit 3
        ;;
esac

exit 0
```
  * Make sure that /etc/init.d/mattermost is executable
  * ``` chmod +x /etc/init.d/mattermost```
1. On reboot, systemd will generate a unit file from the headers in this init script and install it in `/run/systemd/generator.late/`
  
## Set up Nginx Server
1. For the purposes of this guide we will assume this server has an IP address of 10.10.10.3
1. We use Nginx for proxying request to the Mattermost Server.  The main benefits are:
  * SSL termination
  * http to https redirect
  * Port mapping :80 to :8065
  * Standard request logs
1. Install Nginx on Debian with
  * ``` sudo apt-get install nginx```
1. Verify Nginx is running
  * ``` curl http://10.10.10.3```
  * You should see a *Welcome to nginx!* page
1. You can manage Nginx with the following commands
  * ``` sudo service nginx stop```
  * ``` sudo service nginx start```
  * ``` sudo service nginx restart```
1. Map a FQDN (fully qualified domain name) like **mattermost.example.com** to point to the Nginx server.
1. Configure Nginx to proxy connections from the internet to the Mattermost Server
  * Create a configuration for Mattermost
  * ``` sudo touch /etc/nginx/sites-available/mattermost```
  * Below is a sample configuration with the minimum settings required to configure Mattermost
 ```
   server {
	  server_name mattermost.example.com;
      location / {
		  client_max_body_size 50M;
		  proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
		  proxy_set_header Host $http_host;
		  proxy_set_header X-Real-IP $remote_addr;
		  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		  proxy_set_header X-Forwarded-Proto $scheme;
		  proxy_set_header   X-Frame-Options   SAMEORIGIN;
          proxy_pass http://localhost:8065;
      }
    }
```
  * Remove the existing file with
  * ``` sudo rm /etc/nginx/sites-enabled/default```
  * Link the mattermost config by typing:
  * ```sudo ln -s /etc/nginx/sites-available/mattermost /etc/nginx/sites-enabled/mattermost```
  * Restart Nginx by typing:
  * ``` sudo service nginx restart```
  * Verify you can see Mattermost thru the proxy by typing:
  * ``` curl http://localhost```
  * You should see a page titles *Mattermost - Signup*
  
## Set up Nginx with SSL (Recommended)
1. You will need a SSL cert from a certificate authority.
1. For simplicity we will generate a test certificate.
  * ``` mkdir ~/cert```
  * ``` cd ~/cert```
  * ``` sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout mattermost.key -out mattermost.crt```
  * Input the following info 
```
    Country Name (2 letter code) [AU]:US
    State or Province Name (full name) [Some-State]:California
    Locality Name (eg, city) []:Palo Alto
    Organization Name (eg, company) [Internet Widgits Pty Ltd]:Example LLC
    Organizational Unit Name (eg, section) []:
    Common Name (e.g. server FQDN or YOUR name) []:mattermost.example.com
    Email Address []:admin@mattermost.example.com
```
1. Modify the file at `/etc/nginx/sites-available/mattermost` and add the following lines
  * 
```
  server {
       listen         80;
       server_name    mattermost.example.com;
       return         301 https://$server_name$request_uri;
  }
  
  server {
        listen 443 ssl;
        server_name mattermost.example.com;
		
        ssl on;
        ssl_certificate /home/mattermost/cert/mattermost.crt;
        ssl_certificate_key /home/mattermost/cert/mattermost.key;
        ssl_session_timeout 5m;
        ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2;
        ssl_ciphers "HIGH:!aNULL:!MD5 or HIGH:!aNULL:!MD5:!3DES";
        ssl_prefer_server_ciphers on;
		
		# add to location / above
		location / {
			gzip off;
			proxy_set_header X-Forwarded-Ssl on;
```
## Finish Mattermost Server setup
1. Navigate to https://mattermost.example.com and create a team and user.
1. The first user in the system is automatically granted the `system_admin` role, which gives you access to the System Console.
1. From the `town-square` channel click the dropdown and choose the `System Console` option
1. Update Email Settings.  We recommend using an email sending service.  The example below assumes AmazonSES.
  * Set *Send Email Notifications* to true
  * Set *Require Email Verification* to true
  * Set *Feedback Name* to `No-Reply`
  * Set *Feedback Email* to `mattermost@example.com`
  * Set *SMTP Username* to `AFIADTOVDKDLGERR`
  * Set *SMTP Password* to `DFKJoiweklsjdflkjOIGHLSDFJewiskdjf`
  * Set *SMTP Server* to `email-smtp.us-east-1.amazonaws.com`
  * Set *SMTP Port* to `465`
  * Set *Connection Security* to `TLS`
  * Save the Settings
1. Update File Settings
  * Change *Local Directory Location* from `./data/` to `/mattermost/data`
1. Update Log Settings.
  * Set *Log to The Console* to false  
1. Update Rate Limit Settings.
  * Set *Vary By Remote Address* to false
  * Set *Vary By HTTP Header* to X-Real-IP
1. Feel free to modify other settings.
1. Restart the Mattermost Service by typing:
  * ``` sudo restart mattermost```
