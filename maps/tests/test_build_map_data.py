import unittest

from maps.tools.build_map_data import (
    aggregate_rows,
    company_for_operator,
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


if __name__ == "__main__":
    unittest.main()
