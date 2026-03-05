1. Install Chocolatey: https://chocolatey.org/install
2. Install Visual Studio Community: https://visualstudio.microsoft.com/vs/community/
	- Include **Desktop development with C++** when installing
3. If you are on Windows 11, you may need to install `wmic` via the system settings > Optional Features.
4. Open PowerShell
5. Install dependencies

    ```sh
    choco install nvm git python3
    ```

6. Restart PowerShell (to refresh the environment variables)
7. Run `nvm install lts` and `nvm use lts` to install and use the latest NodeJS LTS version.
