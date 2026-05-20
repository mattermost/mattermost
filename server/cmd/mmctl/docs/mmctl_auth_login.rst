.. _mmctl_auth_login:

mmctl auth login
----------------

Login into an instance

Synopsis
~~~~~~~~


Login into an instance and store credentials

::

  mmctl auth login [instance url] --name [server name] --username [username] --password-file [password-file] [flags]

Examples
~~~~~~~~

::

    auth login https://mattermost.example.com
    auth login https://mattermost.example.com --name local-server --username sysadmin --password-file mysupersecret.txt
    auth login https://mattermost.example.com --name local-server --username sysadmin --password-file mysupersecret.txt --mfa-token 123456
    auth login https://mattermost.example.com --name local-server --access-token myaccesstoken

Options
~~~~~~~

::

  -t, --access-token-file string   Access token file to be read to use instead of username/password
  -h, --help                       help for login
  -m, --mfa-token string           MFA token for the credentials
  -n, --name string                Name for the credentials
      --no-activate                If present, it won't activate the credentials after login
  -f, --password-file string       Password file to be read for the credentials
  -u, --username string            Username for the credentials

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl auth <mmctl_auth.rst>`_ 	 - Manages the credentials of the remote Mattermost instances

