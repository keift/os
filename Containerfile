FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
  # Desktop
  gnome-initial-setup \
  glibc-all-langpacks \
  # QEMU/KVM
  spice-vdagent \
  spice-webdavd \
  # Applications
  flatpak \
  gnome-software \
  nautilus \
  ptyxis fedora-release-silverblue

RUN dnf clean all

# RUN rm -rf /usr/etc/yum.repos.d/*.repo

COPY ./usr /usr

RUN chmod +x /usr/bin/keift-os-maintenance.sh
RUN glib-compile-schemas /usr/share/glib-2.0/schemas

RUN systemctl enable keift-os-maintenance.service
RUN systemctl mask systemd-remount-fs.service

RUN echo "root:root" | chpasswd
