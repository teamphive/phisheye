import re

from publicsuffixlist import PublicSuffixList
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models.team import Team
from ..models.team_domain import TeamDomain

_psl = PublicSuffixList()

# public mail providers belong to no company
FREEMAIL = [
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "gmx.de",
    "gmx.net",
    "web.de",
    "t-online.de",
    "freenet.de",
    "proton.me",
    "protonmail.com",
]

_label = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


class DomainError(ValueError):
    pass


def covered_by(domain: str, parent: str) -> bool:
    return domain == parent or domain.endswith(f".{parent}")


# what was typed becomes the stored form, same rules as the frontend
def normalize_domain(value: str) -> str:
    domain = value.strip().lower().removeprefix("@").removeprefix("www.").rstrip(".")

    if not domain or re.search(r"[\s/:@?#]", domain):
        raise DomainError("Das ist keine gültige Domain.")

    try:
        domain = domain.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise DomainError("Das ist keine gültige Domain.") from exc

    labels = domain.split(".")

    if len(labels) < 2 or not all(_label.match(label) for label in labels):
        raise DomainError("Das ist keine gültige Domain.")

    if not re.match(r"^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$", labels[-1]):
        raise DomainError("Das ist keine gültige Domain.")

    if any(covered_by(domain, entry) for entry in FREEMAIL):
        raise DomainError(
            "Öffentliche Mail-Anbieter lassen sich nicht eintragen, sie gehören zu keiner Firma."
        )

    # co.uk and the like are shared by many companies
    if _psl.privatesuffix(domain) is None:
        raise DomainError(
            "Öffentliche Endungen wie co.uk lassen sich nicht eintragen, sie gehören zu keiner Firma."
        )

    return domain


# the team whose domain covers the address, None if no team claims it.
# Runs its own transaction, so call it before the caller opens one.
async def team_for_address(address: str | None, db: AsyncSession) -> int | None:
    if not address or "@" not in address:
        return None

    domain = address.rsplit("@", 1)[1].lower()
    labels = domain.split(".")
    candidates = [".".join(labels[i:]) for i in range(len(labels))]

    async with db.begin():
        result = await db.exec(
            select(TeamDomain)
            .join(Team, Team.id == TeamDomain.team_id)
            .where(TeamDomain.domain.in_(candidates))
            .where(Team.deleted_at.is_(None))
        )
        matches = result.all()

    if not matches:
        return None

    # overlaps are refused when a domain is added, the longest match is the closest
    return max(matches, key=lambda entry: len(entry.domain)).team_id
