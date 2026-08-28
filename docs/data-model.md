# Datenbankschema

## users

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| email | string, unique | |
| password_hash | string | |
| name | string | |
| role | enum (admin, analyst) | |
| totp_secret | string, nullable | für 2FA |
| totp_enabled | bool | |
| created_at | timestamp | |

## teams

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| name | string | |
| created_at | timestamp | |

## team_members (many-to-many User <-> Team)

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| team_id | FK -> teams | |
| user_id | FK -> users | |
| joined_at | timestamp | |
| | unique constraint | (team_id, user_id) |

## team_invitations

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| team_id | FK -> teams | |
| email | string | eingeladene Adresse, evtl. noch kein User |
| invited_by | FK -> users | |
| status | enum (pending, accepted, expired) | |
| token | string | für den Einladungslink |
| created_at | timestamp | |

## mail_analyses

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| team_id | FK -> teams | |
| submitted_by | FK -> users | |
| source | enum (upload, imap, forward) | |
| subject | string | |
| sender | string | |
| raw_headers | text/JSON | |
| status | enum (pending, processing, completed, failed) | |
| verdict | enum (phishing, clean, suspicious), nullable | bis Analyse fertig |
| confidence_score | float, nullable | |
| llm_report | text, nullable | |
| created_at | timestamp | |
| completed_at | timestamp, nullable | |

## mail_attachments

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| mail_analysis_id | FK -> mail_analyses | |
| filename | string | |
| file_hash | string | sha256 |
| mime_type | string | |
| created_at | timestamp | |

## vt_results

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| attachment_id | FK -> mail_attachments, nullable | |
| mail_analysis_id | FK -> mail_analyses, nullable | für URL/Domain-Checks ohne Attachment |
| indicator_type | enum (hash, domain, url, ip) | |
| indicator_value | string | |
| vt_verdict | string | |
| vt_raw_response | JSON | |
| checked_at | timestamp | |

## notifications

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| user_id | FK -> users | |
| mail_analysis_id | FK -> mail_analyses, nullable | |
| message | string | |
| read | bool | |
| created_at | timestamp | |

## Entity-Relationship-Modell

```mermaid
erDiagram
  USERS ||--o{ TEAM_MEMBERS : has
  TEAMS ||--o{ TEAM_MEMBERS : has
  TEAMS ||--o{ TEAM_INVITATIONS : has
  USERS ||--o{ TEAM_INVITATIONS : invites
  TEAMS ||--o{ MAIL_ANALYSES : owns
  USERS ||--o{ MAIL_ANALYSES : submits
  MAIL_ANALYSES ||--o{ MAIL_ATTACHMENTS : has
  MAIL_ANALYSES ||--o{ VT_RESULTS : has
  MAIL_ATTACHMENTS ||--o{ VT_RESULTS : has
  USERS ||--o{ NOTIFICATIONS : receives
  MAIL_ANALYSES ||--o{ NOTIFICATIONS : triggers

  USERS {
    int id PK
    string email
    string password_hash
    string name
    string role
    string totp_secret
    bool totp_enabled
    timestamp created_at
  }
  TEAMS {
    int id PK
    string name
    timestamp created_at
  }
  TEAM_MEMBERS {
    int id PK
    int team_id FK
    int user_id FK
    timestamp joined_at
  }
  TEAM_INVITATIONS {
    int id PK
    int team_id FK
    string email
    int invited_by FK
    string status
    string token
    timestamp created_at
  }
  MAIL_ANALYSES {
    int id PK
    int team_id FK
    int submitted_by FK
    string source
    string subject
    string sender
    text raw_headers
    string status
    string verdict
    float confidence_score
    text llm_report
    timestamp created_at
    timestamp completed_at
  }
  MAIL_ATTACHMENTS {
    int id PK
    int mail_analysis_id FK
    string filename
    string file_hash
    string mime_type
    timestamp created_at
  }
  VT_RESULTS {
    int id PK
    int attachment_id FK
    int mail_analysis_id FK
    string indicator_type
    string indicator_value
    string vt_verdict
    json vt_raw_response
    timestamp checked_at
  }
  NOTIFICATIONS {
    int id PK
    int user_id FK
    int mail_analysis_id FK
    string message
    bool read
    timestamp created_at
  }
```
