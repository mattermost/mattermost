## Issuing a Let's Encrypt certificate

**NOTE:** Commands with a **$** prefix denote those are executed as user, **#** as root and commands without a prefix are database commands.

For issuing a Let's Encrypt certificate one can use Docker as well which will save you from messing around with
installing on the host system.
This guide assumes you're inside the mattermost-docker directory but if using absolute paths in the volume bind mounts
(e.g. /home/admin/mattermost-docker instead of `${PWD}`) it doesn't matter because the paths are unique. These commands
requires that DNS records (A or CNAME) have been set and resolve to your server's external IP.

### 1. Issuing the certificate using the standalone authenticator (because there is no nginx yet)
```
$ sudo docker run -it --rm --name certbot -p 80:80 \
    -v "${PWD}/certs/etc/letsencrypt:/etc/letsencrypt" \
    -v "${PWD}/certs/lib/letsencrypt:/var/lib/letsencrypt" \
    certbot/certbot certonly --standalone -d mm.example.com
```

### 2. Changing the authenticator to webroot for later renewals

```
$ sudo docker run -it --rm --name certbot \
    -v "${PWD}/certs/etc/letsencrypt:/etc/letsencrypt" \
    -v "${PWD}/certs/lib/letsencrypt:/var/lib/letsencrypt" \
    -v shared-webroot:/usr/share/nginx/html \
    certbot/certbot certonly -a webroot -w /usr/share/nginx/html -d mm.example.com
```

This will ask you to abort or renew the certificate. When choosing to renew `certbot` will alter the renewal
configuration to *webroot*.
As an alternative (which will save you one certificate creation request https://letsencrypt.org/docs/rate-limits/) this can be done by yourself with the following commands

```
$ sudo sed -i 's/standalone/webroot/' ${PWD}/certs/etc/letsencrypt/renewal/mm.example.com.conf
$ sudo tee -a ${PWD}/certs/etc/letsencrypt/renewal/mm.example.com.conf > /dev/null << EOF
webroot_path = /usr/share/nginx/html,
[[webroot_map]]
EOF
```

### 3. Command for requesting renewal (Let's Encrypt certificates do have a 3 month lifetime)

```
sudo docker run --rm --name certbot \
    --network mattermost \
    -v "${PWD}/certs/etc/letsencrypt:/etc/letsencrypt" \
    -v "${PWD}/certs/lib/letsencrypt:/var/lib/letsencrypt" \
    -v shared-webroot:/usr/share/nginx/html \
    certbot/certbot renew --webroot-path /usr/share/nginx/html
```

This command can be called with a systemd timer on a regulary basis (e.g. once a day). Please take a look at the
*contrib/systemd* folder.
