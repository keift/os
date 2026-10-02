#!/usr/bin/env bash

mkdir -p ./src/usr/share/icons/hicolor/scalable/apps

cp -f ./assets/logo-black.png ./src/usr/share/icons/hicolor/scalable/apps/fedora-logo-icon.png
cp -f ./assets/logo-black.svg ./src/usr/share/icons/hicolor/scalable/apps/fedora-logo-icon.svg
cp -f ./assets/logo-black.svg ./src/usr/share/icons/hicolor/scalable/apps/start-here.svg

mkdir -p ./src/usr/share/pixmaps

cp -f ./assets/icon-black.png ./src/usr/share/pixmaps/fedora-logo-sprite.png
cp -f ./assets/icon-black.svg ./src/usr/share/pixmaps/fedora-logo-sprite.svg
cp -f ./assets/icon-white.png ./src/usr/share/pixmaps/system-logo-white.png
cp -f ./assets/logo-black-small-x2.png ./src/usr/share/pixmaps/fedora-logo-small.png
cp -f ./assets/logo-black-small-x2.png ./src/usr/share/pixmaps/fedora_logo_med.png
cp -f ./assets/logo-black-small.ico ./src/usr/share/pixmaps/fedora-logo.ico
cp -f ./assets/logo-black-small.png ./src/usr/share/pixmaps/fedora-logo.png
cp -f ./assets/logo-white-small-x2.png ./src/usr/share/pixmaps/fedora-gdm-logo.png
cp -f ./assets/logo-white-small-x2.png ./src/usr/share/pixmaps/fedora_whitelogo_med.png
cp -f ./assets/logo-white.svg ./src/usr/share/pixmaps/fedora_whitelogo.svg

mkdir -p ./src/usr/share/plymouth/themes/spinner

cp -f ./assets/logo-white-small-x2.png ./src/usr/share/plymouth/themes/spinner/watermark.png

mkdir -p ./src/usr/share/anaconda/pixmaps

cp -f ./assets/logo-white-small-x2.png ./src/usr/share/anaconda/pixmaps/anaconda_header.png
cp -f ./assets/logo-white-small-x2.png ./src/usr/share/anaconda/pixmaps/sidebar-logo.png
cp -f ./assets/transparent.png ./src/usr/share/anaconda/pixmaps/sidebar-bg.png
cp -f ./assets/transparent.png ./src/usr/share/anaconda/pixmaps/topbar-bg.png
