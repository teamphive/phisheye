# Setup

## Voraussetzungen

```bash
brew install uv
brew install node
brew install awslogin
brew install opentofu
```

Check ob's geklappt hat:

```bash
uv --version
node --version
aws --version
tofu -version
```

## AWS / Tofu

IAM-User (nicht Root!) verwenden, Access Key erstellen:

IAM -> Users -> dein User -> "Security credentials" -> "Access keys" -> "Create access key" (CLI-Use-Case) -> ID + Secret sichern.

```bash
aws configure
# Access Key ID, Secret Access Key, eu-central-1, json

# prüft ob's klappt
aws sts get-caller-identity
```
