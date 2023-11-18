.. _mmctl_auth:

mmctl auth
----------

Manages the credentials of the remote Mattermost instances

Synopsis
~~~~~~~~


Manages the credentials of the remote Mattermost instances

Options
~~~~~~~

::

  -h, --help   help for auth

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

* `mmctl <mmctl.rst>`_ 	 - Remote client for the Open Source, self-hosted Slack-alternative
* `mmctl auth clean <mmctl_auth_clean.rst>`_ 	 - Clean all credentials
* `mmctl auth current <mmctl_auth_current.rst>`_ 	 - Show current user credentials
* `mmctl auth delete <mmctl_auth_delete.rst>`_ 	 - Delete an credentials
* `mmctl auth list <mmctl_auth_list.rst>`_ 	 - Lists the credentials
* `mmctl auth login <mmctl_auth_login.rst>`_ 	 - Login into an instance
* `mmctl auth renew <mmctl_auth_renew.rst>`_ 	 - Renews a set of credentials
* `mmctl auth set <mmctl_auth_set.rst>`_ 	 - Set the credentials to use

