.. _mmctl_cpa_field_delete:

mmctl cpa field delete
----------------------

Delete a CPA field

Synopsis
~~~~~~~~


Delete a Custom Profile Attribute field. This will automatically delete all user values for this field.

::

  mmctl cpa field delete [field-id] [flags]

Examples
~~~~~~~~

::

    cpa field delete n4qdbtro4j8x3n8z81p48ww9gr --confirm
    cpa field delete 8kj9xm4p6f3y7n2z9q5w8r1t4v --confirm

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

* `mmctl cpa field <mmctl_cpa_field.rst>`_ 	 - Management of CPA fields

