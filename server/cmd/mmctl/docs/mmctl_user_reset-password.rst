.. _mmctl_user_reset-password:

mmctl user reset-password
-------------------------

Send users an email to reset their password

Synopsis
~~~~~~~~


Send users an email to reset their password

::

  mmctl user reset-password [users] [flags]

Examples
~~~~~~~~

::

    user reset-password user@example.com

Options
~~~~~~~

::

  -h, --help   help for reset-password

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

