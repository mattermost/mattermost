**NOTE:** We don't officially support Arch Linux for use with the Mattermost Desktop App. The provided guide is unofficial.

1. Open a terminal
2. Install nvm via
   1. [nvm-sh](https://github.com/nvm-sh/nvm#installing-and-updating):
      ```sh
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
      ```
      OR
   2. [AUR](https://aur.archlinux.org/) (possibly using [a helper](https://wiki.archlinux.org/title/AUR_helpers)):
      ```sh
      yay -S nvm
      ```
4. Install NodeJS via
   ```sh
   nvm install --lts
   ```
6. Install other dependencies:

    Linux requires the X11 development libraries and `libpng` to build native Node modules.
    Arch requires `libffi` since it's not installed by default.

    ```sh
    sudo pacman -S npm git python3 gcc make libx11 libxtst libpng libffi
    ```

#### Notes
* To build RPMs, you need `rpmbuild`

    ```sh
    sudo pacman -S rpm
    ```
