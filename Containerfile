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
  xdg-utils \
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
  git \
  wget

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

RUN systemctl preset-all

RUN systemctl mask systemd-remount-fs
RUN systemctl mask bootc-fetch-apply-updates
RUN systemctl mask bootc-fetch-apply-updates.timer

# Brew

COPY --from=ghcr.io/ublue-os/brew:latest /system_files /
RUN --mount=type=cache,dst=/var/cache \
  --mount=type=cache,dst=/var/log \
  --mount=type=tmpfs,dst=/tmp \
  /usr/bin/systemctl preset brew-setup.service \
  && /usr/bin/systemctl preset brew-update.timer \
  && /usr/bin/systemctl preset brew-upgrade.timer

# Extensions

RUN id="clipboard-indicator@tudmotu.com" \
  && version="71" \
  && url="https://extensions.gnome.org/extension-data/clipboard-indicatortudmotu.com.v${version}.shell-extension.zip" \
  && mkdir -p /usr/share/gnome-shell/extensions \
  && wget -O /tmp/"${id}".zip "${url}" \
  && unzip -d /usr/share/gnome-shell/extensions/"${id}" /tmp/"${id}".zip \
  && rm -f /tmp/"${id}".zip \
  && glib-compile-schemas /usr/share/gnome-shell/extensions/"${id}"/schemas \
  && cp /usr/share/gnome-shell/extensions/"${id}"/schemas/*.xml /usr/share/glib-2.0/schemas

RUN id="ding@rastersoft.com" \
  && version="93" \
  && url="https://extensions.gnome.org/extension-data/dingrastersoft.com.v${version}.shell-extension.zip" \
  && mkdir -p /usr/share/gnome-shell/extensions \
  && wget -O /tmp/"${id}".zip "${url}" \
  && unzip -d /usr/share/gnome-shell/extensions/"${id}" /tmp/"${id}".zip \
  && rm -f /tmp/"${id}".zip \
  && glib-compile-schemas /usr/share/gnome-shell/extensions/"${id}"/schemas \
  && cp /usr/share/gnome-shell/extensions/"${id}"/schemas/*.xml /usr/share/glib-2.0/schemas

RUN id="logomenu@aryan_k" \
  && version="43" \
  && url="https://extensions.gnome.org/extension-data/logomenuaryan_k.v${version}.shell-extension.zip" \
  && mkdir -p /usr/share/gnome-shell/extensions \
  && wget -O /tmp/"${id}".zip "${url}" \
  && unzip -d /usr/share/gnome-shell/extensions/"${id}" /tmp/"${id}".zip \
  && rm -f /tmp/"${id}".zip \
  && glib-compile-schemas /usr/share/gnome-shell/extensions/"${id}"/schemas \
  && cp /usr/share/gnome-shell/extensions/"${id}"/schemas/*.xml /usr/share/glib-2.0/schemas

RUN chmod -R 755 /usr/share/gnome-shell/extensions

# Misc

RUN chmod +x /usr/bin/keift-os-maintenance.sh

RUN ln -sf /usr/share/icons/Adwaita/scalable/places/user-home.svg /usr/share/icons/hicolor/scalable/apps/org.gnome.Nautilus.svg

RUN dconf update
RUN glib-compile-schemas /usr/share/glib-2.0/schemas
