#!/usr/bin/env bash

set -exo pipefail

dnf install -y \ 
anaconda-live \
  anaconda-webui \
  libblockdev-{btrfs,lvm,dm}

mkdir -p /var/lib/rpm-state
