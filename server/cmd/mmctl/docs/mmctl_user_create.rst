.. _mmctl_user_create:

mmctl user create
-----------------

Create a user

Synopsis
~~~~~~~~


Create a user

::

  mmctl user create [flags]

Examples
~~~~~~~~

::

    # You can create a user
    $ mmctl user create --email user@example.com --username userexample --password Password1

    # You can define optional fields like first name, last name and nick name too
    $ mmctl user create --email user@example.com --username userexample --password Password1 --firstname User --lastname Example --nickname userex

    # Also you can create the user as system administrator
    $ mmctl user create --email user@example.com --username userexample --password Password1 --system-admin

    # Finally you can verify user on creation if you have enough permissions
    $ mmctl user create --email user@example.com --username userexample --password Password1 --system-admin --email-verified

Options
~~~~~~~

::

      --disable-welcome-email   Optional. If supplied, the new user will not receive a welcome email. Defaults to false
      --email string            Required. The email address for the new user account
      --email-verified          Optional. If supplied, the new user will have the email verified. Defaults to false
      --firstname string        Optional. The first name for the new user account
      --guest                   Optional. If supplied, the new user will be a guest. Defaults to false
  -h, --help                    help for create
      --lastname string         Optional. The last name for the new user account
      --locale string           Optional. The locale (ex: en, fr) for the new user account
      --nickname string         Optional. The nickname for the new user account
      --password string         Required. The password for the new user account
      --system-admin            Optional. If supplied, the new user will be a system administrator. Defaults to false
      --username string         Required. Username for the new user account

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

