FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
  https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm \
  https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm

RUN dnf install -y \
  # Desktop
  gnome-initial-setup \
  glibc-all-langpacks \
  # Boot
  plymouth \
  plymouth-system-theme \
  # Drivers
  linux-firmware \
  # VM
  spice-vdagent \
  spice-webdavd \
  # Applications
  flatpak \
  gnome-software \
  nautilus \
  ptyxis

RUN dnf clean all

# RUN rm -rf /usr/etc/yum.repos.d/*.repo

COPY ./src/etc /etc
COPY ./src/usr /usr

RUN chmod +x /usr/bin/keift-os-maintenance.sh
RUN glib-compile-schemas /usr/share/glib-2.0/schemas

RUN systemctl enable keift-os-maintenance.service
RUN systemctl mask systemd-remount-fs.service
