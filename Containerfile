FROM quay.io/fedora/fedora-bootc:45

LABEL org.opencontainers.image.title="Keift OS" \
  org.opencontainers.image.version="1 Mabolla"

# File system

RUN rm -rf /opt && ln -sf /var/opt /opt
RUN rm -rf /usr/local && ln -sf /var/usrlocal /usr/local

# Softwares

RUN dnf install -y \
  https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm \
  https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm

RUN dnf install -y \
  # System
  fedora-release-ostree-desktop \
  # Desktop
  gnome-shell \
  gnome-session \
  gdm \
  gnome-initial-setup \
  glibc-all-langpacks \
  # Boot
  plymouth \
  plymouth-system-theme \
  # Applications
  flatpak \
  gnome-software \
  nautilus \
  ptyxis \
  # Misc
  git \
  wget \
  bash-color-prompt

RUN dnf group install -y --skip-broken \
  # Desktop
  fonts \
  # Drivers
  hardware-support \
  input-methods \
  multimedia \
  guest-desktop-agents

RUN dnf remove -y \
  # Misc
  console-login-helper-messages

RUN dnf clean all

# Backups

RUN cp -f /usr/lib/os-release /usr/lib/os-release.bak

RUN cp -rf /usr/share/anaconda /usr/share/anaconda.bak
RUN cp -rf /usr/share/gnome-initial-setup /usr/share/gnome-initial-setup.bak
RUN cp -rf /usr/share/icons /usr/share/icons.bak
RUN cp -rf /usr/share/pixmaps /usr/share/pixmaps.bak
RUN cp -rf /usr/share/plymouth /usr/share/plymouth.bak

# Copies

COPY ./src/fs/etc /etc
COPY ./src/fs/usr /usr

RUN cp -f /usr/share/icons/Adwaita/scalable/places/user-home.svg /usr/share/icons/hicolor/scalable/apps/org.gnome.Nautilus.svg

RUN find /usr/share/icons/hicolor -name "fedora-logo-icon.png" ! -path /usr/share/icons/hicolor/scalable/apps/fedora-logo-icon.png -exec cp -f /usr/share/icons/hicolor/scalable/apps/fedora-logo-icon.png {} \;
RUN find /usr/share/icons/hicolor -name "fedora-logo-icon.svg" ! -path /usr/share/icons/hicolor/scalable/apps/fedora-logo-icon.svg -exec cp -f /usr/share/icons/hicolor/scalable/apps/fedora-logo-icon.svg {} \;

# Systemd

RUN systemctl preset-all

RUN systemctl mask bootc-fetch-apply-updates
RUN systemctl mask bootc-fetch-apply-updates.timer

RUN sed -i "/^\[Service\]/a SuccessExitStatus=1" /usr/lib/systemd/system/systemd-remount-fs.service

# Brew

COPY --from=ghcr.io/ublue-os/brew:latest /system_files /
RUN --mount=type=cache,dst=/var/cache \
  --mount=type=cache,dst=/var/log \
  --mount=type=tmpfs,dst=/tmp \
  /usr/bin/systemctl preset brew-setup.service \
  && /usr/bin/systemctl preset brew-update.timer \
  && /usr/bin/systemctl preset brew-upgrade.timer

# Extensions

RUN chmod +x /usr/share/keift-os/scripts/install_extension.sh

RUN /usr/share/keift-os/scripts/install_extension.sh appindicatorsupport@rgcjonas.gmail.com
RUN /usr/share/keift-os/scripts/install_extension.sh blur-my-shell@aunetx
RUN /usr/share/keift-os/scripts/install_extension.sh clipboard-indicator@tudmotu.com
RUN /usr/share/keift-os/scripts/install_extension.sh dash-to-dock@micxgx.gmail.com
RUN /usr/share/keift-os/scripts/install_extension.sh ding@rastersoft.com
RUN /usr/share/keift-os/scripts/install_extension.sh logomenu@aryan_k

# Misc

RUN chmod +x /usr/bin/keift-os-maintenance.sh

RUN gtk-update-icon-cache -f /usr/share/icons/Adwaita
RUN gtk-update-icon-cache -f /usr/share/icons/hicolor
RUN glib-compile-schemas /usr/share/glib-2.0/schemas
RUN dconf update
