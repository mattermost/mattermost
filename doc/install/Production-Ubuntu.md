The following guide will walk you through installing Mattermost on a number of Ubuntu servers.

# Requirements

We will require three servers: a proxy server (for load balancing), an application server (for running mattermost) and a database server. Each of these servers should have at minimum:

* Ubuntu Server (x64) 14.04
  Different distros may work but have not been tested. 64 bit support is required on the application server to use the pre-built binaries.
* 2GB of RAM or more
* The latest security updates. These can be installed like so:

   ```
   sudo apt-get update
   sudo apt-get upgrade
   ```

* PostgreSQL 9.3+ or MySQL 5.6+
  Other versions may work but have not been tested.

To ease deployment, please export the following variables in all environment, adjusting as you see fit:

    # server IP addresses

    export MM_IP_DB=10.10.10.1
    export MM_IP_APP=10.10.10.2
    export MM_IP_PRX=10.10.10.3

    # database username/password

    export MM_DB_USER=mmuser
    export MM_DB_PASS=mmuser_password
    export MM_DB_NAME=mattermost

    # application install configuration

    export MM_APP_VER=1.0.0

# Database Server

**NOTE:** Please ensure you have the minimum required versions of PostgreSQL or MySQL instaled. These are given [above](#Requirements).
**NOTE:** You can skip this step if you have an existing database server: just use that.

## PostgreSQL

Install PostgreSQL:

    sudo apt-get install -y postgresql postgresql-contrib

PostgreSQL created a user account called `postgres`.  You will need to run commands as this user. log into that account with:

    sudo -u postgres psql <<< EOF
    CREATE DATABASE $MM_DB_NAME;
    CREATE USER "$MM_DB_USER" WITH PASSWORD "'"$MM_DB_PASS"'";
    GRANT ALL PRIVILEGES ON DATABASE mattermost to mmuser;
    EOF

# Application Server

## Configure users and directories

Create a service user and required directories:

    sudo useradd --home-dir "/var/lib/mattermost" \
      --create-home \
      --system \
      --shell /bin/false \
      mattermost

    sudo cat > /etc/sudoers.d/mattermost_sudoers << EOF
    Defaults:mattermost !requiretty

    mattermost ALL=(root) NOPASSWD: /srv/www/mattermost/bin/platform
    EOF
    sudo chmod 440 /etc/sudoers.d/mattermost_sudoers

    sudo mkdir -p /var/lib/mattermost
    sudo mkdir -p /etc/mattermost
    sudo mkdir -p /srv/www/mattermost

    sudo chown -R mattermost:mattermost /var/lib/mattermost
    sudo chown -R mattermost:mattermost /etc/mattermost
    sudo chown -R mattermost:mattermost /srv/www/mattermost

    sudo chmod 700 /var/lib/mattermost
    sudo chmod 700 /etc/mattermost

Download and extract the latest Mattermost release:

    wget https://github.com/mattermost/platform/releases/download/$MM_APP_VER/mattermost.tar.gz -o /tmp/mattermost.tar.gz &&\
      cd /srv/www/mattermost &&\
      sudo tar -xvzf /tmp/mattermost.tar.gz --strip-components 1 &&\
      rm /tmp/mattermost.tar.gz

    sudo cp -R /srv/www/mattermost/config/* /etc/mattermost
    sudo ln -s /srv/www/mattermost/bin/platform /usr/bin/mattermost

## Configure settings

Configure Mattermost Server by editing the `config.json` file now found in `/etc/mattermost/config.json`. You will need to make at least the following changes:

* Database driver type (`SqlSettings.DriveName`)
* Database URL (`SqlSettings.DataSource`)
* File storage location (`FileSettings.Directory`)

You can do this use the `jq` tool:

    sudo apt-get install jq
    CONF_FILE=/etc/mattermost/config.json
    jq '.SqlSettings.DriverName |= "postgres"' $CONF_FILE > $CONF_FILE
    jq '.SqlSettings.DataSource |= "'${MM_DB_USER}':'${MM_DB_PASS}'@tcp('${MM_IP_DB}':3306)/'${MM_DB_NAME}'?charset?utfmb4,utf8' $CONF_FILE > $CONF_FILE
    jq '.FileSettings.Directory |= "/var/lib/mattermost"' $CONF_FILE > $CONF_FILE

You may continue to edit configuration settings in `config.json` to finish configuration. Alternatively, you may choose to use the System Console described in a later section.

## Validate configuration

You can now test the Mattermost Server

    cd /srv/www/mattermost/bin
    ./platform -config=/etc/mattermost/config.json

You should see a console log like `Server is listening on :8065` letting you know the service is running. Once you see this you can stop the server for now by typing `ctrl-c`.

## Add Upstart script

We can use the Ubuntu Upstart daemon to handles supervision of the Mattermost process. This will provide functionality like restarting the service when it crashes and starting it on boot. To do this, run the following:

    sudo cat > /etc/init/mattermost.conf << EOF
    # vim:set ft=upstart ts=2 et:

    author "Awesome Sysadmin <sys.admin@example.com"
    description "Mattermost is an open source, on-prem Slack-alternative"
    version "0.1.0"

    start on runlevel [2345]
    stop on runlevel [!2345]

    respawn

    script
    exec start-stop-daemon \\
      --start \\
      --chuid mattermost \\
      --exec mattermost \\
      -- -config=/etc/mattermost/config.json

## Start as background process

You can now run the process:

    sudo start mattermost

Verify the service is running by typing:

    curl http://localhost:8065

You should see a page titles *Mattermost - Signup*. We can stop the proces using the `stop` command like below, but we will skip this for now:

    sudo stop mattermost

# Proxy Server

We use Nginx for proxying request to the Mattermost Server.  The main benefits are:

 * SSL termination
 * http to https redirect
 * Port mapping :80 to :8065
 * Standard request logs

# Nginx

To begin, install Nginx like so:

    sudo apt-get install nginx

Verify Nginx is running:

    curl http://localhost:80

You should see a *Welcome to nginx!* page.  You can manage Nginx with the following commands:

  * `sudo service nginx stop`
  * `sudo service nginx start`
  * `sudo service nginx restart`

You will need to map a FQDN (fully qualified domain name) like **mattermost.example.com** to point to the Nginx server. Once done, you can configure Nginx to proxy connections from the internet to the Mattermost Server. To do this create a configuration for Mattermost:

    sudo cat > /etc/nginx/sites-available/mattermost << EOF
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
    EOF

Remove the existing, default "site" with:

    sudo rm /etc/nginx/sites-enabled/default

Enable the site by linking it to `sites-enable`:

    sudo ln -s /etc/nginx/sites-available/mattermost /etc/nginx/sites-enabled/mattermost

Restart Nginx by typing:

    sudo service nginx restart

Verify you can see Mattermost thru the proxy by typing:

    curl http://localhost

 You should see a page titles *Mattermost - Signup*

## Nginx with SSL (recommended)

You will need a SSL cert from a certificate authority. For simplicity we will generate a test certificate:

    mkdir ~/cert
    cd ~/cert
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout mattermost.key -out mattermost.crt

Input the following information:

 * Country Name (2 letter code) [AU]:US
 * State or Province Name (full name) [Some-State]:California
 * Locality Name (eg, city) []:Palo Alto
 * Organization Name (eg, company) [Internet Widgits Pty Ltd]:Example LLC
 * Organizational Unit Name (eg, section) []:
 * Common Name (e.g. server FQDN or YOUR name) []:mattermost.example.com
 * Email Address []:admin@mattermost.example.com

Modify the file at `/etc/nginx/sites-available/mattermost` and add the following lines:

    server {
        listen         80;
        server_name    mattermost.example.com;
        return         301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name mattermost.example.com;

        ssl on;
        ssl_certificate /home/ubuntu/cert/mattermost.crt;
        ssl_certificate_key /home/ubuntu/cert/mattermost.key;
        ssl_session_timeout 5m;
        ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2;
        ssl_ciphers "HIGH:!aNULL:!MD5 or HIGH:!aNULL:!MD5:!3DES";
        ssl_prefer_server_ciphers on;

        # add to location / above
        location / {
            gzip off;
            proxy_set_header X-Forwarded-Ssl on;

# Finish Mattermost configuration

Navigate to **https://mattermost.example.com** and create a team and user. The first user in the system is automatically granted the `system_admin` role, which gives you access to the System Console. From the `town-square` channel click the dropdown and choose the `System Console` option. Modify each setting below, saving on each page.

## Update Email settings

We recommend using an email sending service.  The example below assumes AmazonSES:

 * Set *Send Email Notifications* to true
 * Set *Require Email Verification* to true
 * Set *Feedback Name* to `No-Reply`
 * Set *Feedback Email* to `mattermost@example.com`
 * Set *SMTP Username* to `AFIADTOVDKDLGERR`
 * Set *SMTP Password* to `DFKJoiweklsjdflkjOIGHLSDFJewiskdjf`
 * Set *SMTP Server* to `email-smtp.us-east-1.amazonaws.com`
 * Set *SMTP Port* to `465`
 * Set *Connection Security* to `TLS`

## Update Log settings

 * Set *Log to The Console* to false

## Update Rate Limit settings

 * Set *Vary By Remote Address* to false
 * Set *Vary By HTTP Header* to X-Real-IP

## Other settings

Feel free to modify other settings. Once done, restart the Mattermost Service by typing:

    sudo restart mattermost
