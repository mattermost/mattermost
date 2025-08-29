.. _mmctl_cpa_field_create:

mmctl cpa field create
----------------------

Create a CPA field

Synopsis
~~~~~~~~


Create a new Custom Profile Attribute field with the specified name and type.

::

  mmctl cpa field create [name] [type] [flags]

Examples
~~~~~~~~

::

    cpa field create "Department" text --managed
    cpa field create "Skills" multiselect --option Go --option React --option Python
    cpa field create "Level" select --attrs '{"visibility":"always"}'

Options
~~~~~~~

::

      --attrs string     Full attrs JSON object for advanced configuration
  -h, --help             help for create
      --managed          Mark field as admin-managed (overrides --attrs)
      --option strings   Add an option for select/multiselect fields (overrides --attrs, can be repeated)

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

