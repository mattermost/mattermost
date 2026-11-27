.. _mmctl_user_revoke-passkey-sessions:

mmctl user revoke-passkey-sessions
----------------------------------

Revoke all passkey sessions

Synopsis
~~~~~~~~


Sign out every user whose session was started by signing in with a passkey.
Sessions started any other way are not affected. Their passkeys are kept.

::

  mmctl user revoke-passkey-sessions [flags]

Examples
~~~~~~~~

::

    user revoke-passkey-sessions --confirm

Options
~~~~~~~

::

      --confirm   Confirm you really want to sign out every user who signed in with a passkey
  -h, --help      help for revoke-passkey-sessions

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

