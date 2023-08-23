.. _mmctl_user_change-password:

mmctl user change-password
--------------------------

Changes a user's password

Synopsis
~~~~~~~~


Changes the password of a user by a new one provided. If the user is changing their own password, the flag --current must indicate the current password. The flag --hashed can be used to indicate that the new password has been introduced already hashed

::

  mmctl user change-password <user> [flags]

Examples
~~~~~~~~

::

    # if you have system permissions, you can change other user's passwords
    $ mmctl user change-password john_doe --password new-password

    # if you are changing your own password, you need to provide the current one
    $ mmctl user change-password my-username --current current-password --password new-password

    # you can ommit these flags to introduce them interactively
    $ mmctl user change-password my-username
    Are you changing your own password? (YES/NO): YES
    Current password:
    New password:

    # if you have system permissions, you can update the password with the already hashed new
    # password. The hashing method should be the same that the server uses internally
    $ mmctl user change-password john_doe --password HASHED_PASSWORD --hashed

Options
~~~~~~~

::

  -c, --current string    The current password of the user. Use only if changing your own password
      --hashed            The supplied password is already hashed
  -h, --help              help for change-password
  -p, --password string   The new password for the user

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

