.. _mmctl_user_attributes_field_delete:

mmctl user attributes field delete
----------------------------------

Delete a User Attributes field

Synopsis
~~~~~~~~


Delete a User Attributes field. This will automatically delete all user values for this field.

::

  mmctl user attributes field delete [field] [flags]

Examples
~~~~~~~~

::

    user attributes field delete n4qdbtro4j8x3n8z81p48ww9gr --confirm
    user attributes field delete Department --confirm

Options
~~~~~~~

::

      --confirm   Bypass confirmation prompt
  -h, --help      help for delete

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

* `mmctl user attributes field <mmctl_user_attributes_field.rst>`_ 	 - Management of User Attributes fields

