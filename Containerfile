FROM quay.io/fedora/fedora-bootc:44

ARG TARGETARCH

RUN set -eux; \
  if [ "${TARGETARCH}" = "amd64" ]; then \
    boot_packages="shim-x64 grub2-efi-x64 grub2-efi-x64-cdboot"; \
  elif [ "${TARGETARCH}" = "arm64" ]; then \
    boot_packages="shim-aa64 grub2-efi-aa64"; \
  else \
    echo "Unsupported arch: ${TARGETARCH}" && exit 1; \
  fi; \
  dnf install -y \
  # Bootloader (UEFI)
  ${boot_packages} \
  # Desktop
  gnome-shell \
  gnome-session \
  gdm \
  glibc-all-langpacks \
  gnome-initial-setup \
  # Drivers
  mesa-vulkan-drivers \
  mesa-dri-drivers \
  \
  # Sounds and network
  pipewire \
  pipewire-pulseaudio \
  wireplumber \
  NetworkManager-wifi \
  bluez \
  \
  # Softwares and portals
  flatpak \
  gnome-software \
  xdg-desktop-portal-gnome \
  \
  # Applications
  gnome-control-center \
  nautilus \
  ptyxis

RUN mkdir -p /boot/efi && cp -ra /usr/lib/efi/*/*/EFI /boot/efi

RUN dnf clean all

# RUN rm -rf /usr/etc/yum.repos.d/*.repo

COPY ./usr /usr

RUN chmod +x /usr/bin/keift-os-maintenance.sh

RUN cat <<EOF > /usr/share/glib-2.0/schemas/99-keift-os.gschema.override
[org.gnome.desktop.interface]
accent-color="blue"

[org.gnome.desktop.background]
picture-uri="/usr/share/backgrounds/anders-jilden-cYrMQA7a3Wc-unsplash.jpg"
picture-uri-dark="/usr/share/backgrounds/anders-jilden-cYrMQA7a3Wc-unsplash.jpg"

[org.gnome.shell]
favorite-apps=["org.gnome.Software.desktop", "org.gnome.Nautilus.desktop", "org.gnome.TextEditor.desktop", "org.gnome.Ptyxis.desktop", "org.gnome.Epiphany.desktop"]
EOF

RUN glib-compile-schemas /usr/share/glib-2.0/schemas
