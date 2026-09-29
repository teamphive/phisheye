# Datenbankschema

## users

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| email | string, unique | |
| password_hash | string | |
| name | string | |
| totp_secret | string, nullable | für 2FA |
| totp_enabled | bool | |
| is_operator | bool | systemweit, nur für das Monitoring |
| created_at | timestamp | |

## teams

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| name | string | |
| created_at | timestamp | |
| deleted_at | timestamp, nullable | weich gelöscht, harte Löschung nach 10 Tagen |

## team_members (many-to-many User <-> Team)

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| team_id | FK -> teams | |
| user_id | FK -> users | |
| role | enum (admin, analyst, audit) | gilt nur in diesem Team |
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
| submitted_by | FK -> users | bei Outlook-Meldungen der Systemnutzer, die Adresse der meldenden Person steht in `reported_by` |
| subject | string | |
| sender | string | Absender der gemeldeten Mail, nicht der meldenden Person |
| reported_by | string, nullable | Adresse der meldenden Person, nur bei Meldung per Mail |
| storage_key | string, nullable | UUID der gespeicherten `.eml` in MinIO |
| notified_at | timestamp, nullable | Zeitpunkt der Benachrichtigungsmail, verhindert doppelten Versand |
| raw_headers | text/JSON | |
| status | enum (pending, processing, completed, failed) | |
| verdict | enum (phishing, clean, suspicious), nullable | bis Analyse fertig |
| confidence_score | float, nullable | |
| decided_verdict | enum (phishing, clean), nullable | vom Analysten bestätigt oder als falsch-positiv gemeldet |
| decided_by | FK -> users, nullable | |
| decided_at | timestamp, nullable | zurücknehmbar, dann wieder null |
| created_at | timestamp | |
| completed_at | timestamp, nullable | |
| deleted_at | timestamp, nullable | weich gelöscht, harte Löschung nach 10 Tagen |

## mail_attachments

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| id | PK | |
| mail_analysis_id | FK -> mail_analyses | |
| filename | string | |
| file_hash | string | sha256 |
| mime_type | string | |
| size | int, nullable | Bytes |
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
    string totp_secret
    bool totp_enabled
    bool is_operator
    timestamp created_at
  }
  TEAMS {
    int id PK
    string name
    timestamp created_at
    timestamp deleted_at
  }
  TEAM_MEMBERS {
    int id PK
    int team_id FK
    int user_id FK
    string role
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
    string subject
    string sender
    text raw_headers
    string status
    string verdict
    float confidence_score
    string decided_verdict
    int decided_by FK
    timestamp decided_at
    timestamp created_at
    timestamp completed_at
    timestamp deleted_at
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
