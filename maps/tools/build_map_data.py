"""Build static per-company map payloads from the approved Rystad workbook."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import unicodedata
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
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
    "Start-up Year": "startupYears",
    "Ownership": "ownerships",
}

RESOURCE_FIELDS = {
    "P90 Resources": "p90",
    "P50 Incremental Resources": "p50",
    "Pmean Incremental Resources": "pMean",
    "Prospective Unawarded Resources": "prospective",
}
RESOURCE_UNIT = "million bbl"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NATURAL_EARTH_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_10m_admin_0_countries.geojson"
)
EXPECTED_HEADERS = [
    "地区 Region",
    "国家 Country",
    "供应板块组 Supply Segment Group",
    "油气田类型 Field Type Category",
    "项目 Project",
    "资产 Asset",
    "发现年份 Discovery Year",
    "批准年份 Approval Year",
    "投产年份 Start-up Year",
    "生命周期类别 Life Cycle Category",
    "生命周期明细 Life Cycle Detail",
    "设施类别 Facility Category",
    "水深类别 Water Depth Category",
    "运营商 Operator",
    "权益 Ownership",
    "P90资源量（百万桶） P90 Resources (Million bbl)",
    "P50增量资源量（百万桶） P50 Incremental Resources (Million bbl)",
    "Pmean增量资源量（百万桶） Pmean Incremental Resources (Million bbl)",
    "未授予远景资源量（百万桶） Prospective Unawarded Resources (Million bbl)",
    "年份 Year",
    "业务区域 Business Region",
]
HEADER_KEYS = [
    "Region",
    "Country",
    "Supply Segment Group",
    "Field Type Category",
    "Project",
    "Asset",
    "Discovery Year",
    "Approval Year",
    "Start-up Year",
    "Life Cycle Category",
    "Life Cycle Detail",
    "Facility Category",
    "Water Depth Category",
    "Operator",
    "Ownership",
    "P90 Resources",
    "P50 Incremental Resources",
    "Pmean Incremental Resources",
    "Prospective Unawarded Resources",
    "Year",
    "Business Region",
]
COUNTRY_ALIASES = {
    "Congo": "Republic of the Congo",
    "Democratic Republic of Congo": "Democratic Republic of the Congo",
    "Nigeria/Sao Tome JDZ": "Sao Tome and Principe",
    "Taiwan (China)": "Taiwan",
    "Timor-Leste": "East Timor",
    "Turkiye": "Turkey",
    "UAE": "United Arab Emirates",
}
CORPORATE_SUFFIX_RE = re.compile(
    r"\b("
    r"plc|inc|corp|corporation|company|co|ltd|limited|llc|"
    r"sa|s a|nv|n v|asa|spa|s p a|ag|gmbh|group|holdings?|"
    r"energy|energies|oil|gas|petroleum|petrol|resources|international|the"
    r")\b",
    re.IGNORECASE,
)


def _clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _ascii_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", _ascii_key(value).casefold()).strip("-")
    return slug or "operator"


def _unique_slug(value: str, used_slugs: set[str]) -> str:
    base = _slug(value)
    candidate = base
    index = 2
    while candidate in used_slugs:
        candidate = f"{base}-{index}"
        index += 1
    used_slugs.add(candidate)
    return candidate


def normalize_company_family(value: str) -> str:
    normalized = _ascii_key(value).casefold()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    normalized = CORPORATE_SUFFIX_RE.sub(" ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def operator_matches_company_family(company: str, operator: str) -> bool:
    """Return True when an Operator is part of the company's visible corporate family."""
    company_key = normalize_company_family(company)
    operator_key = normalize_company_family(operator)
    if not company_key or not operator_key:
        return False
    if operator_key == company_key:
        return True
    if operator_key.startswith(f"{company_key} "):
        return True

    compact_company = re.sub(r"[^a-z0-9]+", "", company_key)
    compact_operator = re.sub(r"[^a-z0-9]+", "", operator_key)
    if len(compact_company) >= 3 and compact_operator.startswith(compact_company):
        return True

    raw_company = str(company or "").strip()
    if raw_company.isupper() and len(raw_company) >= 2 and compact_operator.startswith(raw_company.casefold()):
        return True
    return False


def company_for_operator(operator: str, config: dict) -> str | None:
    """Return the canonical company for an exact source Operator match."""
    cleaned = str(operator or "").strip()
    for company, details in config.items():
        if cleaned in details.get("sourceOperators", []):
            return company
    return None


def _load_xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    strings = []
    with archive.open("xl/sharedStrings.xml") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag == f"{{{MAIN_NS}}}si":
                strings.append("".join(node.text or "" for node in element.iter(f"{{{MAIN_NS}}}t")))
                element.clear()
    return strings


def _first_worksheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    relation_namespace = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    targets = {relation.attrib["Id"]: relation.attrib["Target"] for relation in rels}
    first_sheet = workbook.find(f"{{{MAIN_NS}}}sheets")[0]
    target = targets[first_sheet.attrib[f"{relation_namespace}id"]]
    return target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"


def _iter_xlsx_first_sheet_rows(path: str | os.PathLike):
    with zipfile.ZipFile(path) as archive:
        shared_strings = _load_xlsx_shared_strings(archive)
        worksheet_path = _first_worksheet_path(archive)
        with archive.open(worksheet_path) as stream:
            for _, element in ET.iterparse(stream, events=("end",)):
                if element.tag != f"{{{MAIN_NS}}}row":
                    continue
                cells = {}
                for cell in element.findall(f"{{{MAIN_NS}}}c"):
                    cells[_column_index(cell.attrib["r"])] = _cell_value(cell, shared_strings)
                element.clear()
                yield cells


def read_company_names(path: str | os.PathLike, column_name: str = "公司名称") -> list[str]:
    rows = _iter_xlsx_first_sheet_rows(path)
    try:
        header_cells = next(rows)
    except StopIteration:
        return []
    header_lookup = {
        str(value or "").strip(): index
        for index, value in header_cells.items()
        if str(value or "").strip()
    }
    if column_name not in header_lookup:
        available = ", ".join(header_lookup)
        raise ValueError(f"Company column {column_name!r} not found. Available columns: {available}")
    column_index = header_lookup[column_name]

    names = []
    seen = set()
    for cells in rows:
        name = _clean(cells.get(column_index))
        if name and name not in seen:
            names.append(name)
            seen.add(name)
    return names


def derive_company_config_from_list(
    company_list_path: str | os.PathLike,
    rystad_input_path: str | os.PathLike,
    company_column: str = "公司名称",
) -> tuple[dict, list[dict]]:
    company_names = read_company_names(company_list_path, company_column)
    source_operators = sorted(
        {_clean(row.get("Operator")) for row in stream_xlsx_rows(rystad_input_path) if _clean(row.get("Operator"))},
        key=str.casefold,
    )

    companies = {}
    skipped = []
    used_slugs = set()
    for company in company_names:
        matches = [
            operator
            for operator in source_operators
            if operator_matches_company_family(company, operator)
        ]
        if not matches:
            skipped.append({"name": company, "reason": "上游数据源无匹配 Operator"})
            continue
        slug = _unique_slug(company, used_slugs)
        companies[company] = {
            "slug": slug,
            "aliases": [company, slug],
            "sourceOperators": matches,
        }

    return {"companies": companies}, skipped


def stable_project_id(company: str, country: str, project: str) -> str:
    """Return a stable public ID without exposing raw workbook row numbers."""
    raw = "\x1f".join(part.strip() for part in (company, country, project))
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    return f"{_slug(company)}-{digest}"


def _sort_values(values: Iterable):
    return sorted(values, key=lambda value: (isinstance(value, str), str(value).casefold()))


def _sort_resource_values(values: Iterable[int | float]):
    return sorted(values)


def aggregate_rows(rows: Iterable[dict], canonical_company: str, source_operators: set[str]) -> list[dict]:
    """Aggregate exact Operator rows into one object per country and project."""
    projects = {}
    collected = defaultdict(lambda: defaultdict(set))
    collected_resources = defaultdict(lambda: defaultdict(set))
    resource_record_counts = defaultdict(lambda: defaultdict(int))

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

        for source_name, output_name in RESOURCE_FIELDS.items():
            value = _clean(row.get(source_name))
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                collected_resources[key][output_name].add(value)
                resource_record_counts[key][output_name] += 1

    output = []
    for key, project in projects.items():
        for output_name in LIST_FIELDS.values():
            project[output_name] = _sort_values(collected[key].get(output_name, set()))
        project["resources"] = {
            "unit": RESOURCE_UNIT,
            **{
                output_name: _sort_resource_values(collected_resources[key].get(output_name, set()))
                for output_name in RESOURCE_FIELDS.values()
            },
            "rawCounts": {
                output_name: resource_record_counts[key].get(output_name, 0)
                for output_name in RESOURCE_FIELDS.values()
            },
        }
        output.append(project)

    return sorted(output, key=lambda item: (item["country"].casefold(), item["project"].casefold()))


def _column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - 64
    return value - 1


def _load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    strings = []
    with archive.open("xl/sharedStrings.xml") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag == f"{{{MAIN_NS}}}si":
                strings.append("".join(node.text or "" for node in element.iter(f"{{{MAIN_NS}}}t")))
                element.clear()
    return strings


def _cell_value(cell, shared_strings: list[str]):
    cell_type = cell.attrib.get("t")
    value_node = cell.find(f"{{{MAIN_NS}}}v")
    raw = value_node.text if value_node is not None else None
    if cell_type == "s" and raw is not None:
        return shared_strings[int(raw)]
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))
    if raw is None:
        return None
    if cell_type == "b":
        return raw == "1"
    try:
        number = float(raw)
        return int(number) if number.is_integer() else number
    except ValueError:
        return raw


def stream_xlsx_rows(path: str | os.PathLike):
    """Yield normalized workbook rows without materializing the 55MB sheet XML."""
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheets = workbook.find(f"{{{MAIN_NS}}}sheets")
        sheet_names = [sheet.attrib["name"] for sheet in sheets]
        if sheet_names != ["ExportCubeBrowser 1"]:
            raise ValueError(f"Unexpected worksheet list: {sheet_names}")

        shared_strings = _load_shared_strings(archive)
        headers = None
        with archive.open("xl/worksheets/sheet1.xml") as stream:
            for _, element in ET.iterparse(stream, events=("end",)):
                if element.tag != f"{{{MAIN_NS}}}row":
                    continue
                cells = {}
                for cell in element.findall(f"{{{MAIN_NS}}}c"):
                    cells[_column_index(cell.attrib["r"])] = _cell_value(cell, shared_strings)
                row_number = int(element.attrib.get("r", "0"))
                element.clear()

                if row_number == 1:
                    headers = [cells.get(index) for index in range(len(EXPECTED_HEADERS))]
                    if headers != EXPECTED_HEADERS:
                        raise ValueError(f"Unexpected workbook headers: {headers}")
                    continue
                if headers is None:
                    raise ValueError("Workbook header row was not found")
                yield {
                    HEADER_KEYS[index]: cells.get(index)
                    for index in range(len(HEADER_KEYS))
                    if cells.get(index) is not None
                }


def _normalize_country(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", ascii_value.casefold()).strip()


@lru_cache(maxsize=4)
def _load_natural_earth(source: str = NATURAL_EARTH_URL) -> dict:
    if source.startswith(("https://", "http://")):
        request = urllib.request.Request(source, headers={"User-Agent": "Codex map data builder"})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    return json.loads(Path(source).read_text(encoding="utf-8"))


def build_country_index(features: list[dict]) -> dict[str, dict]:
    """Index each map unit by its own names, never by a territory's sovereign."""
    index = {}
    name_fields = ("NAME", "NAME_LONG", "ADMIN", "BRK_NAME", "FORMAL_EN", "NAME_EN", "ISO_A2", "ISO_A3", "ADM0_A3")
    for feature in features:
        properties = feature["properties"]
        for field in name_fields:
            value = properties.get(field)
            if value and value != "-99":
                index.setdefault(_normalize_country(str(value)), properties)
    return index


def build_country_centers(countries: set[str], natural_earth_source: str = NATURAL_EARTH_URL):
    geojson = _load_natural_earth(natural_earth_source)
    index = build_country_index(geojson["features"])

    centers = {}
    missing = []
    for country in sorted(countries, key=str.casefold):
        lookup_name = COUNTRY_ALIASES.get(country, country)
        properties = index.get(_normalize_country(lookup_name))
        if not properties:
            missing.append(country)
            continue
        latitude = properties.get("LABEL_Y")
        longitude = properties.get("LABEL_X")
        if latitude in (None, -99) or longitude in (None, -99):
            missing.append(country)
            continue
        centers[country] = {
            "sourceName": country,
            "nameZh": properties.get("NAME_ZH") or country,
            "isoA2": properties.get("ISO_A2"),
            "center": [round(float(latitude), 6), round(float(longitude), 6)],
        }
    return centers, missing


def _load_config(config_or_path: dict | str | os.PathLike) -> dict:
    if isinstance(config_or_path, dict):
        return config_or_path["companies"] if "companies" in config_or_path else config_or_path
    return json.loads(Path(config_or_path).read_text(encoding="utf-8"))["companies"]


def build_payloads(
    input_path: str | os.PathLike,
    config_path: dict | str | os.PathLike,
    natural_earth_source: str = NATURAL_EARTH_URL,
) -> dict:
    config = _load_config(config_path)
    matched_rows = {company: [] for company in config}
    for row in stream_xlsx_rows(input_path):
        company = company_for_operator(row.get("Operator", ""), config)
        if company:
            matched_rows[company].append(row)

    companies = {}
    for company, details in config.items():
        projects = aggregate_rows(matched_rows[company], company, set(details["sourceOperators"]))
        expected = details.get("expectedProjectCount")
        if expected is not None and len(projects) != expected:
            raise ValueError(f"{company} project count mismatch: expected {expected}, got {len(projects)}")
        companies[company] = projects

    countries = {
        project["country"]
        for projects in companies.values()
        for project in projects
    }
    country_centers, missing_countries = build_country_centers(countries, natural_earth_source)
    return {
        "config": config,
        "companies": companies,
        "countryCenters": country_centers,
        "missingCountries": missing_countries,
        "sourceFile": Path(input_path).name,
    }


def _write_json_atomic(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False, newline="\n") as temp:
        json.dump(payload, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        temp_path = Path(temp.name)
    os.replace(temp_path, path)


def write_outputs(result: dict, output_dir: str | os.PathLike, manifest_path: str | os.PathLike):
    output_dir = Path(output_dir)
    if result["missingCountries"]:
        raise ValueError(f"Missing country centers: {', '.join(result['missingCountries'])}")
    output_dir.mkdir(parents=True, exist_ok=True)
    for stale_file in output_dir.glob("*.json"):
        if stale_file.name != "country-centers.json":
            stale_file.unlink()

    manifest = {
        "meta": {
            "sourceFile": result["sourceFile"],
            "locationRule": "Country-level Natural Earth label points; not project coordinates",
        },
        "operators": [],
    }
    for company, details in result["config"].items():
        projects = result["companies"][company]
        business_regions = sorted(
            {region for project in projects for region in project["businessRegions"]},
            key=str.casefold,
        )
        manifest["operators"].append({
            "name": company,
            "slug": details["slug"],
            "aliases": details["aliases"],
            "dataFile": f"data/{details['slug']}.json",
            "projectCount": len(projects),
            "countryCount": len({project["country"] for project in projects}),
            "businessRegions": business_regions,
        })
        _write_json_atomic(output_dir / f"{details['slug']}.json", {
            "meta": {
                "sourceFile": result["sourceFile"],
                "sourceYear": 2026,
                "operator": company,
                "sourceOperators": details["sourceOperators"],
                "projectCount": len(projects),
                "countryCount": len({project["country"] for project in projects}),
                "businessRegions": business_regions,
                "projectRule": "Aggregate by canonical operator + country + project",
                "locationRule": "Country-level aggregation only; not project coordinates",
            },
            "projects": projects,
        })

    _write_json_atomic(Path(manifest_path), manifest)
    _write_json_atomic(output_dir / "country-centers.json", {
        "meta": {
            "dataset": "Natural Earth Admin 0 Countries 1:10m",
            "sourceUrl": NATURAL_EARTH_URL,
            "coordinateRule": "LABEL_Y and LABEL_X country-level representative points",
        },
        "countries": result["countryCenters"],
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to the approved Rystad XLSX")
    parser.add_argument("--output", required=True, help="Directory for per-company JSON files")
    parser.add_argument("--manifest", required=True, help="Path for operators.json")
    parser.add_argument("--config", default=str(Path(__file__).with_name("company-config.json")))
    parser.add_argument("--company-list", help="Optional workbook containing target company names")
    parser.add_argument("--company-column", default="公司名称", help="Column name in --company-list")
    parser.add_argument("--write-config", help="Write the derived company config JSON to this path")
    parser.add_argument("--skipped-report", help="Write skipped company reasons to this JSON path")
    parser.add_argument("--natural-earth", default=NATURAL_EARTH_URL)
    args = parser.parse_args()

    skipped = []
    config = args.config
    if args.company_list:
        config, skipped = derive_company_config_from_list(args.company_list, args.input, args.company_column)

    result = build_payloads(args.input, config, args.natural_earth)
    if args.company_list:
        zero_project_companies = [
            company
            for company, projects in result["companies"].items()
            if not projects
        ]
        for company in zero_project_companies:
            result["companies"].pop(company, None)
            result["config"].pop(company, None)
            skipped.append({"name": company, "reason": "上游数据源匹配到 Operator，但无有效项目"})
        if args.write_config:
            _write_json_atomic(Path(args.write_config), {"companies": result["config"]})
        if args.skipped_report:
            _write_json_atomic(Path(args.skipped_report), {"skipped": skipped})

    write_outputs(result, args.output, args.manifest)
    print(json.dumps({
        company: len(projects)
        for company, projects in result["companies"].items()
    }, ensure_ascii=False))
    if skipped:
        print(json.dumps({"skipped": skipped}, ensure_ascii=False))


if __name__ == "__main__":
    main()
