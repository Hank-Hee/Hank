import json
import os
import unittest
from pathlib import Path

from maps.tools.build_map_data import (
    aggregate_rows,
    build_country_index,
    build_payloads,
    company_for_operator,
    operator_matches_company_family,
    stable_project_id,
)


class BuildMapDataTests(unittest.TestCase):
    def test_company_matching_is_exact(self):
        config = {
            "Shell": {"sourceOperators": ["Shell"]},
            "BP": {"sourceOperators": ["BP"]},
        }

        self.assertEqual(company_for_operator("Shell", config), "Shell")
        self.assertIsNone(company_for_operator("Petronas/Shell", config))
        self.assertIsNone(company_for_operator("Aker BP", config))

    def test_family_matching_includes_visible_subsidiaries(self):
        self.assertTrue(operator_matches_company_family("Chevron", "Chevron"))
        self.assertTrue(operator_matches_company_family("ADNOC", "ADNOC Offshore"))
        self.assertTrue(operator_matches_company_family("QatarEnergy", "QatarEnergy LNG"))
        self.assertTrue(operator_matches_company_family("BP", "BPTT"))
        self.assertFalse(operator_matches_company_family("Shell", "Petronas/Shell"))
        self.assertFalse(operator_matches_company_family("BP", "Aker BP"))

    def test_project_id_is_stable_and_company_specific(self):
        shell_id = stable_project_id("Shell", "Malaysia", "Alpha, MY")

        self.assertEqual(shell_id, stable_project_id("Shell", "Malaysia", "Alpha, MY"))
        self.assertNotEqual(shell_id, stable_project_id("BP", "Malaysia", "Alpha, MY"))
        self.assertRegex(shell_id, r"^shell-[0-9a-f]{12}$")

    def test_aggregate_rows_unions_detail_fields(self):
        rows = [
            {
                "Operator": "ADNOC Offshore",
                "Country": "UAE",
                "Project": "Upper Zakum",
                "Region": "Middle East",
                "Business Region": "中东及南亚",
                "Facility Category": "Fixed",
                "Discovery Year": 1963,
            },
            {
                "Operator": "ADNOC Offshore",
                "Country": "UAE",
                "Project": "Upper Zakum",
                "Region": "Middle East",
                "Business Region": "中东及南亚",
                "Facility Category": "Subsea",
                "Discovery Year": 1963,
            },
        ]

        payload = aggregate_rows(rows, "ADNOC", {"ADNOC Offshore"})

        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["facilities"], ["Fixed", "Subsea"])
        self.assertEqual(payload[0]["sourceOperators"], ["ADNOC Offshore"])
        self.assertEqual(payload[0]["businessRegions"], ["中东及南亚"])
        self.assertEqual(payload[0]["discoveryYears"], [1963])

    def test_aggregate_rows_ignores_nonmatching_and_tax_rows(self):
        rows = [
            {"Operator": "Shell", "Country": "Malaysia", "Project": "Alpha", "Supply Segment Group": "Tax"},
            {"Operator": "Petronas/Shell", "Country": "Malaysia", "Project": "Beta"},
            {"Operator": "Shell", "Country": "Malaysia", "Project": "Gamma"},
        ]

        payload = aggregate_rows(rows, "Shell", {"Shell"})

        self.assertEqual([project["project"] for project in payload], ["Gamma"])

    @unittest.skipUnless(os.environ.get("RYSTAD_XLSX"), "RYSTAD_XLSX is required")
    def test_real_workbook_counts_regions_and_country_centers(self):
        root = Path(__file__).resolve().parents[2]
        result = build_payloads(
            os.environ["RYSTAD_XLSX"],
            root / "maps" / "tools" / "company-config.json",
        )

        self.assertEqual(len(result["companies"]["Shell"]), 552)
        self.assertEqual(len(result["companies"]["BP"]), 396)
        self.assertEqual(len(result["companies"]["Eni"]), 437)
        self.assertEqual(len(result["companies"]["ADNOC"]), 49)
        self.assertEqual(
            sum("东南亚" in project["businessRegions"] for project in result["companies"]["Shell"]),
            58,
        )
        self.assertFalse(result["missingCountries"])
        self.assertTrue(
            all(
                project["country"] in result["countryCenters"]
                for projects in result["companies"].values()
                for project in projects
            )
        )

    def test_company_config_is_valid_json(self):
        root = Path(__file__).resolve().parents[2]
        config_path = root / "maps" / "tools" / "company-config.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        company_keys = {company.casefold() for company in config["companies"]}

        self.assertIn("shell", company_keys)
        self.assertIn("bp", company_keys)
        self.assertIn("eni", company_keys)
        self.assertIn("adnoc", company_keys)
        self.assertGreaterEqual(len(config["companies"]), 4)

    def test_country_index_does_not_let_territories_shadow_sovereign_country_names(self):
        features = [
            {"properties": {"NAME": "St. Maarten", "SOVEREIGNT": "Netherlands", "NAME_ZH": "荷属圣马丁"}},
            {"properties": {"NAME": "Netherlands", "SOVEREIGNT": "Netherlands", "NAME_ZH": "荷兰"}},
        ]

        index = build_country_index(features)

        self.assertEqual(index["netherlands"]["NAME_ZH"], "荷兰")


if __name__ == "__main__":
    unittest.main()
