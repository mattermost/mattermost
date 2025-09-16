.. _mmctl_cpa_field_list:

mmctl cpa field list
--------------------

List CPA fields

Synopsis
~~~~~~~~


List all Custom Profile Attribute fields with their properties.

::

  mmctl cpa field list [flags]

Examples
~~~~~~~~

::

    cpa field list

Options
~~~~~~~

::

  -h, --help   help for list

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

