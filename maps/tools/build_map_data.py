"""Build static per-company map payloads from the approved Rystad workbook."""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from typing import Iterable


LIST_FIELDS = {
    "Operator": "sourceOperators",
    "Region": "regions",
    "Business Region": "businessRegions",
    "Supply Segment Group": "supplySegments",
    "Field Type Category": "fieldTypes",
    "Life Cycle Category": "lifecycleCategories",
    "Life Cycle Detail": "lifecycleDetails",
    "Facility Category": "facilities",
    "Water Depth Category": "waterDepthCategories",
    "Discovery Year": "discoveryYears",
    "Approval Year": "approvalYears",
    "Start-up Year": "startupYears",
    "Ownership": "ownerships",
}


def _clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "operator"


def company_for_operator(operator: str, config: dict) -> str | None:
    """Return the canonical company for an exact source Operator match."""
    cleaned = str(operator or "").strip()
    for company, details in config.items():
        if cleaned in details.get("sourceOperators", []):
            return company
    return None


def stable_project_id(company: str, country: str, project: str) -> str:
    """Return a stable public ID without exposing raw workbook row numbers."""
    raw = "\x1f".join(part.strip() for part in (company, country, project))
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    return f"{_slug(company)}-{digest}"


def _sort_values(values: Iterable):
    return sorted(values, key=lambda value: (isinstance(value, str), str(value).casefold()))


def aggregate_rows(rows: Iterable[dict], canonical_company: str, source_operators: set[str]) -> list[dict]:
    """Aggregate exact Operator rows into one object per country and project."""
    projects = {}
    collected = defaultdict(lambda: defaultdict(set))

    for row in rows:
        operator = _clean(row.get("Operator"))
        country = _clean(row.get("Country"))
        project = _clean(row.get("Project"))
        supply_segment = _clean(row.get("Supply Segment Group"))
        if operator not in source_operators or not country or not project:
            continue
        if isinstance(supply_segment, str) and supply_segment.casefold() == "tax":
            continue

        key = (country, project)
        if key not in projects:
            projects[key] = {
                "id": stable_project_id(canonical_company, country, project),
                "operator": canonical_company,
                "country": country,
                "project": project,
            }

        for source_name, output_name in LIST_FIELDS.items():
            value = _clean(row.get(source_name))
            if value is not None:
                collected[key][output_name].add(value)

    output = []
    for key, project in projects.items():
        for output_name in LIST_FIELDS.values():
            project[output_name] = _sort_values(collected[key].get(output_name, set()))
        output.append(project)

    return sorted(output, key=lambda item: (item["country"].casefold(), item["project"].casefold()))
