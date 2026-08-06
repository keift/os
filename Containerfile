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
  # VM
  spice-vdagent \
  spice-webdavd \
  # Applications
  flatpak \
  gnome-software \
  nautilus \
  ptyxis

RUN dnf group install -y \
  # Desktop
  fonts \
  # Drivers
  hardware-support

COPY --from=ghcr.io/ublue-os/brew:latest /system_files /
RUN --mount=type=cache,dst=/var/cache \
  --mount=type=cache,dst=/var/log \
  --mount=type=tmpfs,dst=/tmp \
  /usr/bin/systemctl preset brew-setup.service \
  && /usr/bin/systemctl preset brew-update.timer \
  && /usr/bin/systemctl preset brew-upgrade.timer

RUN dnf clean all

COPY ./src/etc /etc
COPY ./src/usr /usr

RUN rm -rf /opt && ln -sf /var/opt /opt
RUN rm -rf /usr/local && ln -sf /var/usrlocal /usr/local

RUN chmod +x /usr/bin/keift-os-maintenance.sh
RUN glib-compile-schemas /usr/share/glib-2.0/schemas

RUN systemctl enable keift-os-maintenance.service
RUN systemctl mask systemd-remount-fs.service
