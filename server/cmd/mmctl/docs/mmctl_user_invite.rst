.. _mmctl_user_invite:

mmctl user invite
-----------------

Send user an email invite to a team.

Synopsis
~~~~~~~~


Send user an email invite to a team.
You can invite a user to multiple teams by listing them.
You can specify teams by name or ID.

::

  mmctl user invite [email] [teams] [flags]

Examples
~~~~~~~~

::

    user invite user@example.com myteam
    user invite user@example.com myteam1 myteam2

Options
~~~~~~~

::

  -h, --help   help for invite

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

* `mmctl user <mmctl_user.rst>`_ 	 - Management of users

