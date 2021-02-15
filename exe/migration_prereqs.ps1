#!/usr/bin/env pwsh

Write-Host "Installing scoop"
Set-ExecutionPolicy RemoteSigned -scope CurrentUser
iwr -useb get.scoop.sh | iex

Write-Host "Installing migrate via scoop"
scoop install migrate
