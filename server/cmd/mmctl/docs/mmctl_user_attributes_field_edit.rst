.. _mmctl_user_attributes_field_edit:

mmctl user attributes field edit
--------------------------------

Edit a User Attributes field

Synopsis
~~~~~~~~


Edit an existing User Attributes field.

::

  mmctl user attributes field edit [field] [flags]

Examples
~~~~~~~~

::

    user attributes field edit n4qdbtro4j8x3n8z81p48ww9gr --name "Department Name" --managed
    user attributes field edit Department --option Go --option React --option Python --option Java
    user attributes field edit Skills --managed=false

Options
~~~~~~~

::

      --attrs string     Update full attrs JSON object
  -h, --help             help for edit
      --managed          Mark field as admin-managed (overrides --attrs)
      --name string      Update field name
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

* `mmctl user attributes field <mmctl_user_attributes_field.rst>`_ 	 - Management of User Attributes fields

