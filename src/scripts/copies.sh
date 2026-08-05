#!/usr/bin/env bash

mkdir -p ./src/usr/share/icons/hicolor/scalable/apps

cp ./assets/logo-black.svg ./src/usr/share/icons/hicolor/scalable/apps/keift-os-logo.svg
cp ./assets/logo-black-small.png ./src/usr/share/icons/hicolor/scalable/apps/keift-os-logo.png

mkdir -p ./src/usr/share/pixmaps

cp ./assets/logo-white-small.png ./src/usr/share/pixmaps/fedora-gdm-logo.png
cp ./assets/logo-black-small.png ./src/usr/share/pixmaps/fedora-logo.png
cp ./assets/logo-black-small.png ./src/usr/share/pixmaps/fedora_logo_med.png
cp ./assets/logo-black-small.png ./src/usr/share/pixmaps/fedora-logo-small.png
cp ./assets/icon-black.png ./src/usr/share/pixmaps/fedora-logo-sprite.png
cp ./assets/icon-black.svg ./src/usr/share/pixmaps/fedora-logo-sprite.svg
cp ./assets/logo-white.svg ./src/usr/share/pixmaps/fedora_whitelogo.svg
cp ./assets/logo-white-small.png ./src/usr/share/pixmaps/fedora_whitelogo_med.png
cp ./assets/icon-white.png ./src/usr/share/pixmaps/system-logo-white.png

mkdir -p ./src/usr/share/plymouth/themes/spinner

cp ./assets/logo-white-small.png ./src/usr/share/plymouth/themes/spinner/watermark.png

mkdir -p ./src/usr/share/anaconda/pixmaps

cp ./assets/logo-black-small-x2.png ./src/usr/share/anaconda/pixmaps/anaconda_header.png
cp ./assets/logo-black-small-x2.png ./src/usr/share/anaconda/pixmaps/sidebar-logo.png
cp ./assets/transparent.png ./src/usr/share/anaconda/pixmaps/sidebar-bg.png
cp ./assets/transparent.png ./src/usr/share/anaconda/pixmaps/topbar-bg.png
