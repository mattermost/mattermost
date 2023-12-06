# Testing with subpath servers
Some tests need multiple servers running in subpath mode. These tests have the cypress `Group: @subpath` metadata near the top of the test file. Instructions on running a server under subpath can be found here: [https://developers.mattermost.com/blog/subpath/](https://developers.mattermost.com/blog/subpath/)

In the `cypress.json` configuration file, the `baseURL` setting will need to be updated with the subpath URL of the first server, and the `secondServerURL` setting with the subpath URL of the second server.

### Running subpath tests on local machine
Two mattermost servers running on the same machine must be served from different ports. To have the servers respond on the same URL and the same port under different subpaths, you will need to use a reverse proxy (nginx or apache) to proxy the same local url to both mattermost servers under different subpaths.

#### Example set up using NGINX:

You'll need to run two Mattermost servers.

1. Set the `SiteURL` and the listening port for the first server:

```
"SiteURL": "http://localhost/company/mattermost1"
"ListenAddress": ":8065",
```

2. Set the `SiteURL` and the listening port for the second server:

```
"SiteURL": "http://localhost/company/mattermost2"
"ListenAddress": ":8066",
```

The DB `DataSource` will need to be different for both servers.

3. Install NGINX -  exact steps depend on your OS

4. Update your NGINX site configuration. The specific details for each setting can be found in the [Mattermost docs](https://docs.mattermost.com/install/config-proxy-nginx.html)

```
upstream backend1 {
   server localhost:8065;
   keepalive 32;
}

upstream backend2 {
   server localhost:8066;
   keepalive 32;
}

server {
        listen 80 default_server;
        listen [::]:80 default_server;

        location ~ /company/mattermost1/api/v[0-9]+/(users/)?websocket$ {
               client_body_timeout 60;
               client_max_body_size 50M;
               lingering_timeout 5;
               proxy_buffer_size 16k;
               proxy_buffers 256 16k;
               proxy_connect_timeout 90;
               proxy_pass http://backend1;
               proxy_read_timeout 90s;
               proxy_send_timeout 300;
               proxy_set_header Connection "upgrade";
               proxy_set_header Host $host;
               proxy_set_header Upgrade $http_upgrade;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
               proxy_set_header X-Frame-Options SAMEORIGIN;
               proxy_set_header X-Real-IP $remote_addr;
               send_timeout 300;
        }

        location /company/mattermost1 {
                client_max_body_size 50M;
                proxy_buffer_size 16k;
                proxy_buffers 256 16k;
                proxy_cache_lock on;
                proxy_cache_min_uses 2;
                proxy_cache_revalidate on;
                proxy_cache_use_stale timeout;
                proxy_http_version 1.1;
                proxy_pass http://backend1;
                proxy_read_timeout 600s;
                proxy_set_header Connection "";
                proxy_set_header Host $http_host;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_set_header X-Frame-Options SAMEORIGIN;
                proxy_set_header X-Real-IP $remote_addr;
        }

        location ~ /company/mattermost2/api/v[0-9]+/(users/)?websocket$ {
               client_body_timeout 60;
               client_max_body_size 50M;
               lingering_timeout 5;
               proxy_buffer_size 16k;
               proxy_buffers 256 16k;
               proxy_connect_timeout 90;
               proxy_pass http://backend2;
               proxy_read_timeout 90s;
               proxy_send_timeout 300;
               proxy_set_header Connection "upgrade";
               proxy_set_header Host $host;
               proxy_set_header Upgrade $http_upgrade;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
               proxy_set_header X-Frame-Options SAMEORIGIN;
               proxy_set_header X-Real-IP $remote_addr;
               send_timeout 300;
        }

        location /company/mattermost2 {
                proxy_buffer_size 16k;
                proxy_buffers 256 16k;
                proxy_cache_lock on;
                proxy_cache_min_uses 2;
                proxy_cache_revalidate on;
                proxy_cache_use_stale timeout;
                proxy_http_version 1.1;
                proxy_pass http://backend2;
                proxy_read_timeout 600s;
                proxy_set_header Connection "";
                proxy_set_header Host $http_host;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_set_header X-Frame-Options SAMEORIGIN;
                proxy_set_header X-Real-IP $remote_addr;
                client_max_body_size 50M;
        }
}
```

5. Restart NGINX to reload the configuration. Exact steps depend on your OS/distribution. On most Linux distributions you can run `sudo systemctl restart nginx`

6. In the `cypress.json` file, set `baseURL` to  `"http://localhost/company/mattermost1"` and `secondServerURL` to `"http://localhost/company/mattermost2"`

7. Start both Mattermost tests and run the e2e tests.
