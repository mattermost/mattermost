.. _mmctl_user_edit_email:

mmctl user edit email
---------------------

Edit user's email

Synopsis
~~~~~~~~


Edit a user's email address.

::

  mmctl user edit email [user] [new email] [flags]

Examples
~~~~~~~~

::

  user edit email user@example.com newemail@example.com

Options
~~~~~~~

::

  -h, --help   help for email

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

* `mmctl user edit <mmctl_user_edit.rst>`_ 	 - Edit user properties

