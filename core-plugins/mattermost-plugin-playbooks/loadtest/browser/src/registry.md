# Browser Simulations Registry

This document lists all available browser simulations that can be run using the browser controller for Mattermost Playbooks plugin load testing. Programmatically it is defined in the [registry.ts file](./registry.ts).

## Simulations list

#### Create and Run Playbook scenario

**Id:** `playbooksCreateAndRun`

**Description:** A simulation that mimics typical Playbooks user behavior by creating playbooks, running them, and browsing through lists.

**Flow:**
1. Navigates to the Playbooks page
2. Handles the landing page if present
3. Logs in using the provided credentials
4. Selects the first team if team selection is required
5. Continuously loops through the following actions:
   - Creates a new playbook with a random name
   - Runs the newly created playbook with a random run name
   - Opens the runs list and scrolls to the bottom
   - Opens the playbooks list and scrolls to the bottom
