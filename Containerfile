FROM quay.io/fedora/fedora-bootc:44

# File system

RUN rm -rf /opt && ln -sf /var/opt /opt
RUN rm -rf /usr/local && ln -sf /var/usrlocal /usr/local

# Softwares

RUN dnf install -y \
  https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm \
  https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm

RUN dnf install -y \
  # Desktop
  gnome-initial-setup \
  glibc-all-langpacks \
  # Extensions
  gnome-shell-extension-appindicator \
  gnome-shell-extension-blur-my-shell \
  gnome-shell-extension-dash-to-dock \
  # gnome-shell-extension-logo-menu \
  # Boot
  plymouth \
  plymouth-system-theme \
  # VM
  spice-vdagent \
  spice-webdavd \
  # Applications
  flatpak \
  gnome-software \
  nautilus \
  ptyxis \
  # Misc
  git

RUN dnf group install -y \
  # Desktop
  fonts \
  # Drivers
  hardware-support \
  multimedia

RUN dnf remove -y \
  # Applications
  gnome-extensions-app

RUN dnf clean all

# Copies

COPY ./src/etc /etc
COPY ./src/usr /usr

# Systemd

RUN systemctl enable keift-os-maintenance.service
RUN systemctl mask systemd-remount-fs.service

# Brew

COPY --from=ghcr.io/ublue-os/brew:latest /system_files /
RUN --mount=type=cache,dst=/var/cache \
  --mount=type=cache,dst=/var/log \
  --mount=type=tmpfs,dst=/tmp \
  /usr/bin/systemctl preset brew-setup.service \
  && /usr/bin/systemctl preset brew-update.timer \
  && /usr/bin/systemctl preset brew-upgrade.timer

# Misc

RUN chmod +x /usr/bin/keift-os-maintenance.sh

RUN ln -sf /usr/share/icons/Adwaita/scalable/places/folder.svg /usr/share/icons/hicolor/scalable/apps/org.gnome.Nautilus.svg

RUN glib-compile-schemas /usr/share/glib-2.0/schemas
RUN glib-compile-schemas /usr/share/gnome-shell/extensions/ding@rastersoft.com/schemas
RUN glib-compile-schemas /usr/share/gnome-shell/extensions/logomenu@aryan_k/schemas
