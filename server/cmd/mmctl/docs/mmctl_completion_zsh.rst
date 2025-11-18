.. _mmctl_completion_zsh:

mmctl completion zsh
--------------------

Generate the autocompletion script for zsh

Synopsis
~~~~~~~~


Generate the autocompletion script for the zsh shell.

If shell completion is not already enabled in your environment you will need
to enable it.  You can execute the following once:

	echo "autoload -U compinit; compinit" >> ~/.zshrc

To load completions in your current shell session:

	source <(mmctl completion zsh)

To load completions for every new session, execute once:

#### Linux:

	mmctl completion zsh > "${fpath[1]}/_mmctl"

#### macOS:

	mmctl completion zsh > $(brew --prefix)/share/zsh/site-functions/_mmctl

You will need to start a new shell for this setup to take effect.


::

  mmctl completion zsh [flags]

Options
~~~~~~~

::

  -h, --help              help for zsh
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

