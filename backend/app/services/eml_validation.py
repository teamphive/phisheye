from email.message import Message

from fastapi import HTTPException

MAX_EML_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = (".eml", ".msg")

# first bytes of files that are never a mail: pdf, png, zip, jpeg, gif,
# windows and linux executables, gzip, rar, 7z
_BINARY_SIGNATURES = (
    b"%PDF-",
    b"\x89PNG",
    b"PK\x03\x04",
    b"\xff\xd8\xff",
    b"GIF8",
    b"MZ",
    b"\x7fELF",
    b"\x1f\x8b",
    b"Rar!",
    b"7z\xbc\xaf",
)

# every real mail carries at least one of these
_MAIL_HEADERS = ("From", "Date", "Message-ID")


class InvalidEmlError(HTTPException):
    """Input that is not a mail. Pollers delete it, the API answers 422."""

    def __init__(self, reason: str):
        super().__init__(status_code=422, detail=reason)


def check_upload(filename: str | None, size: int) -> None:
    """Checks only an upload can fail: name and size."""
    if not (filename or "").lower().endswith(ALLOWED_EXTENSIONS):
        raise InvalidEmlError("Only .eml and .msg files are supported")

    if size > MAX_EML_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 25 MB")


def check_eml(content: bytes, msg: Message) -> None:
    """Rejects whatever is not a mail, whatever its name says.

    The parser accepts any bytes and returns a message without headers, so the
    content has to be looked at.
    """
    if content.startswith(_BINARY_SIGNATURES):
        raise InvalidEmlError("The file is not a mail")

    # header lines are text, a NUL byte there means binary data
    if b"\x00" in content[:8192]:
        raise InvalidEmlError("The file is not a mail")

    if not any(msg.get(header) for header in _MAIL_HEADERS):
        raise InvalidEmlError("The file has no mail headers")
