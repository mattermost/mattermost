# Tools

This directory aims to provide a set of tools that simplify and enhance various development tasks. This README file serves as a guide to help you understand the directory, features of these tools, and how to get started using it. This is a collection of utilities and scripts designed to streamline common development tasks for Mattermost. These tools aim to help automate repetitive tasks and improve productivity.

## Included tools

* **mmgotool**: is a CLI to help with i18n related checks for the mattermost/server development.

## Installation & Usage

### mmgotool

To install `mmgotool`, simply run the following command: `go install github.com/mattermost/mattermost/tools/mmgotool`

Make sure you have the necessary prerequisites such as [Go](https://go.dev/) compiler.

`mmgotool i18n` has following subcommands described below:

* `check`: Check translations
* `check-empty-src`: Check for empty translation source strings
* `clean-empty`: Clean empty translations
* `extract`: Extract translations
