#!/usr/bin/env python3
"""Fetch daily oil and gas futures prices for the dashboard."""

from __future__ import annotations

import json
import math
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "oil-gas-prices.json"
START_DATE = "2025-01-01"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

SERIES = [
    {
        "key": "brent",
        "symbol": "BZ=F",
        "nameZh": "布伦特原油",
        "nameEn": "Brent Crude Oil",
        "unit": "USD/bbl",
        "group": "oil",
        "color": "#2f80ed",
        "sourceUrl": "https://finance.yahoo.com/quote/BZ=F",
    },
    {
        "key": "wti",
        "symbol": "CL=F",
        "nameZh": "西德州原油",
        "nameEn": "WTI Crude Oil",
        "unit": "USD/bbl",
        "group": "oil",
        "color": "#16a085",
        "sourceUrl": "https://finance.yahoo.com/quote/CL=F",
    },
    {
        "key": "nymex_gas",
        "symbol": "NG=F",
        "nameZh": "纽约亨利港天然气",
        "nameEn": "NYMEX Natural Gas",
        "unit": "USD/MMBtu",
        "group": "gas",
        "color": "#4f7fd1",
        "sourceUrl": "https://finance.yahoo.com/quote/NG=F",
    },
    {
        "key": "jkm_lng",
        "symbol": "JKM=F",
        "nameZh": "日韩标杆液化天然气",
        "nameEn": "JKM LNG",
        "unit": "USD/MMBtu",
        "group": "gas",
        "color": "#e05a47",
        "sourceUrl": "https://finance.yahoo.com/quote/JKM=F",
    },
]


def unix_seconds(date_text: str) -> int:
    return int(datetime.fromisoformat(date_text).replace(tzinfo=timezone.utc).timestamp())


def request_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            ),
        },
    )
    with urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_series(item: dict[str, str]) -> dict[str, Any]:
    period1 = unix_seconds(START_DATE)
    period2 = int(time.time())
    symbol = quote(item["symbol"], safe="")
    url = (
        YAHOO_CHART_URL.format(symbol=symbol)
        + f"?period1={period1}&period2={period2}&interval=1d&events=history"
    )
    payload = request_json(url)
    result = payload.get("chart", {}).get("result", [None])[0]
    if not result:
        error = payload.get("chart", {}).get("error")
        raise RuntimeError(f"No chart data for {item['symbol']}: {error}")

    timestamps = result.get("timestamp") or []
    quote_data = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes = quote_data.get("close") or []
    points: list[list[Any]] = []

    for timestamp, close in zip(timestamps, closes):
        if close is None or not math.isfinite(float(close)):
            continue
        date_text = datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
        if date_text < START_DATE:
            continue
        points.append([date_text, round(float(close), 4)])

    if not points:
        raise RuntimeError(f"No valid close prices for {item['symbol']}")

    return {
        **item,
        "data": points,
        "latest": build_latest(points),
    }


def build_latest(points: list[list[Any]]) -> dict[str, Any]:
    latest_date, latest_price = points[-1]
    previous = points[-2] if len(points) >= 2 else None
    week_ref = find_reference(points, latest_date, 7)
    month_ref = find_reference(points, latest_date, 30)
    ytd_ref = next((point for point in points if point[0] >= f"{latest_date[:4]}-01-01"), points[0])

    return {
        "date": latest_date,
        "price": latest_price,
        "day": make_change(latest_price, previous[1] if previous else None),
        "week": make_change(latest_price, week_ref[1] if week_ref else None),
        "month": make_change(latest_price, month_ref[1] if month_ref else None),
        "ytd": make_change(latest_price, ytd_ref[1] if ytd_ref else None),
    }


def find_reference(points: list[list[Any]], latest_date: str, days_back: int) -> list[Any] | None:
    target_ts = datetime.fromisoformat(latest_date).replace(tzinfo=timezone.utc).timestamp() - days_back * 86400
    target = datetime.fromtimestamp(target_ts, tz=timezone.utc).date().isoformat()
    candidates = [point for point in points if point[0] <= target]
    return candidates[-1] if candidates else None


def make_change(current: float, reference: float | None) -> dict[str, float | None]:
    if reference is None or reference == 0:
        return {"value": None, "pct": None}
    value = round(current - reference, 4)
    pct = round(value / reference * 100, 2)
    return {"value": value, "pct": pct}


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent) as handle:
        handle.write(text)
        temp_name = handle.name
    os.replace(temp_name, path)


def main() -> None:
    series = [fetch_series(item) for item in SERIES]
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "startDate": START_DATE,
        "endDate": max(item["latest"]["date"] for item in series),
        "source": {
            "name": "Yahoo Finance",
            "note": "Delayed futures quote history; automated daily refresh.",
            "url": "https://finance.yahoo.com/commodities",
        },
        "series": series,
    }
    write_json(OUTPUT_PATH, payload)
    print(f"Wrote {OUTPUT_PATH} with {len(series)} series through {payload['endDate']}")


if __name__ == "__main__":
    main()
