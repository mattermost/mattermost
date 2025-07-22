.. _mmctl_completion_powershell:

mmctl completion powershell
---------------------------

Generate the autocompletion script for powershell

Synopsis
~~~~~~~~


Generate the autocompletion script for powershell.

To load completions in your current shell session:

	mmctl completion powershell | Out-String | Invoke-Expression

To load completions for every new session, add the output of the above command
to your powershell profile.


::

  mmctl completion powershell [flags]

Options
~~~~~~~

::

  -h, --help              help for powershell
      --no-descriptions   disable completion descriptions

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

* `mmctl completion <mmctl_completion.rst>`_ 	 - Generate the autocompletion script for the specified shell

