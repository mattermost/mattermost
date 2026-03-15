1. Open Terminal
2. Install NodeJS from one of the following sources:

    1. [nvm](https://github.com/nvm-sh/nvm#installing-and-updating):

        ```sh
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
        nvm install --lts
        ```

    2. [NodeSource](https://github.com/nodesource/distributions#installation-instructions):

        ```sh
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_16.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
        sudo apt-get update
        sudo apt-get install -y nodejs
        ```

	* You might need to install `curl` as well:

        ```sh
        sudo apt install curl
        ```

3. Install other dependencies:

    Linux requires the X11 developement libraries and `libpng` to build native Node modules.

    ```sh
    sudo apt install git python3 make g++ libx11-dev libxtst-dev libpng-dev
    ```

#### Notes
* To build RPMs, you need `rpmbuild`:

    ```sh
    sudo apt install rpm
    ```
