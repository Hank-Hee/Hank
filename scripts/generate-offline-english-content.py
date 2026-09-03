#!/usr/bin/env python3
"""Generate versioned English content with a local Argos CTranslate2 model.

This script is an offline editorial tool. It is not called by the website build,
the Worker, or a browser request.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

import ctranslate2
import sentencepiece as spm


HAN = re.compile(r"[\u3400-\u9fff]")
SPLIT = re.compile(r"(?<=[。！？；;])")


def slugify(value: str) -> str:
    value = value.lower().replace("&", " and ")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", value))


def chunks(value: str, limit: int = 110) -> list[str]:
    parts = [part.strip() for part in SPLIT.split(value) if part.strip()]
    result: list[str] = []
    for part in parts or [value]:
        while len(part) > limit:
            split_at = max(part.rfind(mark, 0, limit) for mark in ["，", ",", "：", ":", " "])
            if split_at < limit // 2:
                split_at = limit
            result.append(part[: split_at + 1].strip())
            part = part[split_at + 1 :].strip()
        if part:
            result.append(part)
    return result


def clean(value: str) -> str:
    value = value.replace("▁", " ").replace("_", " ")
    value = re.sub(r"\s+", " ", value).strip()
    replacements = {
        "L N G": "LNG",
        "F P S O": "FPSO",
        "F L N G": "FLNG",
        "F S R U": "FSRU",
        "E P C": "EPC",
        "E P C I": "EPCI",
        "M & A": "M&A",
        "Rystad energy": "Rystad Energy",
        "Bp ": "BP ",
        "Eni ": "Eni ",
        "Petroleum natural gas": "oil and gas",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value


class OfflineTranslator:
    def __init__(self, model_root: Path) -> None:
        os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
        self.processor = spm.SentencePieceProcessor(model_file=str(model_root / "sentencepiece.model"))
        self.translator = ctranslate2.Translator(
            str(model_root / "model"),
            device="cpu",
            inter_threads=1,
            intra_threads=2,
            compute_type="int8",
        )

    def translate_many(self, values: list[str]) -> dict[str, str]:
        unique = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        segment_owners: list[tuple[str, int]] = []
        segments: list[str] = []
        for value in unique:
            for index, segment in enumerate(chunks(value)):
                segment_owners.append((value, index))
                segments.append(segment)

        tokenized = [self.processor.encode(segment, out_type=str) for segment in segments]
        translated = self.translator.translate_batch(
            tokenized,
            replace_unknowns=True,
            max_batch_size=32,
            batch_type="tokens",
            beam_size=2,
            num_hypotheses=1,
            length_penalty=0.2,
        )
        translated_segments = [clean(self.processor.decode_pieces(item.hypotheses[0])) for item in translated]
        grouped: dict[str, list[tuple[int, str]]] = {}
        for (owner, index), translated_segment in zip(segment_owners, translated_segments, strict=True):
            grouped.setdefault(owner, []).append((index, translated_segment))
        return {
            owner: clean(" ".join(text for _, text in sorted(parts)))
            for owner, parts in grouped.items()
        }


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--repository-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.repository_root.resolve()
    translator = OfflineTranslator(args.model_root.resolve())

    reports = json.loads((root / "data/report-catalog.json").read_text(encoding="utf-8"))["reports"]
    profiles = json.loads((root / "company-text-dashboard/data/company-data.json").read_text(encoding="utf-8"))
    inventory = json.loads((root / "data/company-demo-inventory.json").read_text(encoding="utf-8"))
    operators = json.loads((root / "maps/operators.json").read_text(encoding="utf-8"))["operators"]
    featured = {item["displayName"].lower(): item["slug"] for item in inventory["companies"]}
    operator_names = {
        name.lower(): item["slug"]
        for item in operators
        for name in [item["name"], *item.get("aliases", [])]
    }

    report_sources = {
        report["id"]: report["title"]
        for report in reports
        if not report.get("subtitle") or HAN.search(report["subtitle"])
    }
    company_fields = ["国家", "地区", "主营业务", "市场定位", "总部"]
    company_sources = [profile[field] for profile in profiles for field in company_fields]
    value_sources = {
        value
        for report in reports
        for value in [
            report["industry"], report["region"], report["informationType"],
            report["sourceFamily"], report["publisher"], report["language"], report["sourceFormat"],
        ]
        if HAN.search(value)
    }
    value_sources.update(
        keyword
        for report in reports
        for keyword in report["keywords"]
        if HAN.search(keyword)
    )
    value_sources.update(
        value
        for profile in profiles
        for value in [profile["公司类型"], profile["国家"], profile["地区"], *profile["主营业务"].split("、")]
        if HAN.search(value)
    )

    translations = translator.translate_many([
        *report_sources.values(), *company_sources, *sorted(value_sources),
    ])

    report_english = {
        report["id"]: clean(report["subtitle"])
        if report.get("subtitle") and not HAN.search(report["subtitle"])
        else translations[report_sources[report["id"]]]
        for report in reports
    }
    company_english = {}
    for profile in profiles:
        name = profile["公司名称"]
        slug = featured.get(name.lower()) or operator_names.get(name.lower()) or slugify(name)
        company_english[slug] = {
            "business": translations[profile["主营业务"].strip()],
            "country": translations[profile["国家"].strip()],
            "headquarters": translations[profile["总部"].strip()],
            "marketPosition": translations[profile["市场定位"].strip()],
            "region": translations[profile["地区"].strip()],
        }

    value_english = {value: translations[value] for value in sorted(value_sources)}
    value_english.update({
        "上游勘探开发": "Upstream exploration and production",
        "综合油气": "Integrated oil and gas",
        "阿联酋": "United Arab Emirates",
        "北海/北欧": "North Sea / Northern Europe",
    })
    company_english.update({
        "shell": {
            "business": "Integrated oil and gas, upstream exploration and production, LNG",
            "country": "United Kingdom", "headquarters": "London, United Kingdom",
            "marketPosition": "Global integrated energy company with leading positions in LNG trading and deepwater oil and gas",
            "region": "North Sea / Northern Europe",
        },
        "bp": {
            "business": "Integrated oil and gas, upstream exploration and production, LNG",
            "country": "United Kingdom", "headquarters": "London, United Kingdom",
            "marketPosition": "Global integrated energy company focused on natural gas, LNG and low-carbon investment",
            "region": "North Sea / Northern Europe",
        },
        "exxonmobil": {
            "business": "Integrated oil and gas, upstream exploration and production, LNG",
            "country": "United States", "headquarters": "Spring, United States",
            "marketPosition": "One of the world's largest publicly traded integrated energy companies, with major upstream, LNG and refining operations",
            "region": "Gulf of Mexico",
        },
        "petronas": {
            "business": "Integrated oil and gas, LNG, upstream exploration and production",
            "country": "Malaysia", "headquarters": "Kuala Lumpur, Malaysia",
            "marketPosition": "Malaysia's national energy company and a major global LNG and upstream operator",
            "region": "Southeast Asia",
        },
        "adnoc": {
            "business": "Integrated oil and gas, upstream exploration and production, refining and chemicals",
            "country": "United Arab Emirates", "headquarters": "Abu Dhabi, United Arab Emirates",
            "marketPosition": "The UAE's national energy company and a major Middle East upstream, refining and chemicals operator",
            "region": "Middle East and South Asia",
        },
        "chevron": {
            "business": "Integrated oil and gas, upstream exploration and production, LNG",
            "country": "United States", "headquarters": "Houston, United States",
            "marketPosition": "Global integrated energy company with strong deepwater, LNG and large-scale upstream project capabilities",
            "region": "Gulf of Mexico",
        },
        "totalenergies": {
            "business": "Integrated oil and gas, upstream exploration and production, LNG",
            "country": "France", "headquarters": "Courbevoie, France",
            "marketPosition": "Global multi-energy company active in LNG, deepwater oil and gas, and renewable power",
            "region": "Other Europe",
        },
        "eni": {
            "business": "Integrated oil and gas, upstream exploration and production, LNG",
            "country": "Italy", "headquarters": "Rome, Italy",
            "marketPosition": "Italian integrated energy company with strong African oil and gas and LNG portfolio integration capabilities",
            "region": "Mediterranean / Southern Europe",
        },
    })
    for label, mapping in [
        ("report titles", report_english),
        ("company content", company_english),
        ("metadata values", value_english),
    ]:
        leftovers = [key for key, value in mapping.items() if HAN.search(json.dumps(value, ensure_ascii=False))]
        if leftovers:
            raise RuntimeError(f"{label} still contain Chinese text: {leftovers[:10]}")

    write_json(root / "data/report-title-en.json", report_english)
    write_json(root / "data/company-content-en.json", company_english)
    write_json(root / "data/value-content-en.json", value_english)
    print(json.dumps({
        "companies": len(company_english),
        "reportTitles": len(report_english),
        "translatedReportTitles": len(report_sources),
        "values": len(value_english),
    }))


if __name__ == "__main__":
    main()
