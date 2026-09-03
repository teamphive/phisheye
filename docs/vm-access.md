# VM-Zugriff

Zugriff auf die Homelab-VM `neuserphis1c` erfolgt per SSH über MyFritz DynDNS mit Port-Forwarding.

## SSH-Config

In `~/.ssh/config` ergänzen:

```bash
Host neuserphis1c
    HostName a4o67bikn3m7tfk6.myfritz.net
    User <dein-username>
    IdentityFile ~/.ssh/id_rsa
    Port 2222
```

Danach reicht:

```bash
ssh neuserphis1c
```

## Voraussetzungen

- Eigener SSH-Key wurde von Oliver als `authorized_keys`-Eintrag hinterlegt (kein Passwort-Login möglich)
- Port 2222 ist auf der Fritzbox auf die VM weitergeleitet

## Projekt-Verzeichnis auf der VM

```dir
/opt/phisheye
```

Zugriff über die Gruppe `phisheye-dev`, Mitglieder: Oliver, Adrijus, Tom.
