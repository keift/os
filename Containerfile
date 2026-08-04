FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
  # Desktop
  gnome-initial-setup \
  glibc-all-langpacks \
  # Loading
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

RUN dnf clean all

# RUN rm -rf /usr/etc/yum.repos.d/*.repo

COPY ./usr /usr

COPY ./assets/logo-black.svg /usr/share/icons/hicolor/scalable/apps/keift-os-logo.svg
COPY ./assets/logo-black-small.png /usr/share/icons/hicolor/scalable/apps/keift-os-logo.png

COPY ./assets/logo-white-small.png /usr/share/pixmaps/fedora-gdm-logo.png
COPY ./assets/logo-black-small.png /usr/share/pixmaps/fedora-logo.png
COPY ./assets/logo-black-small.png /usr/share/pixmaps/fedora_logo_med.png
COPY ./assets/logo-black-small.png /usr/share/pixmaps/fedora-logo-small.png
COPY ./assets/icon-black.png /usr/share/pixmaps/fedora-logo-sprite.png
COPY ./assets/icon-black.svg /usr/share/pixmaps/fedora-logo-sprite.svg
COPY ./assets/logo-white.svg /usr/share/pixmaps/fedora_whitelogo.svg
COPY ./assets/logo-white-small.png /usr/share/pixmaps/fedora_whitelogo_med.png
COPY ./assets/icon-white.png /usr/share/pixmaps/system-logo-white.png

COPY ./assets/logo-white-small.png /usr/share/plymouth/themes/spinner/watermark.png

COPY ./assets/logo-white-small.png /usr/share/anaconda/pixmaps/anaconda_header.png
COPY ./assets/logo-white-small.png /usr/share/anaconda/pixmaps/sidebar-logo.png

RUN chmod +x /usr/bin/keift-os-maintenance.sh
RUN glib-compile-schemas /usr/share/glib-2.0/schemas

RUN systemctl enable keift-os-maintenance.service
RUN systemctl mask systemd-remount-fs.service
