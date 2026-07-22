(function () {
  const DATA_URL = "data/company-data.xlsx";

  const columns = {
    id: "data_id",
    name: "公司名称",
    type: "公司类型",
    country: "国家",
    region: "地区",
    business: "主营业务",
    position: "市场定位",
    website: "官网Link"
  };

  function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function slugify(value, fallback) {
    const slug = clean(value)
      .normalize("NFKD")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback;
  }

  function getBaseUrl() {
    return window.location.href.split("#")[0].split("?")[0];
  }

  function getKey(row, index) {
    const id = clean(row[columns.id]);
    return id || slugify(row[columns.name], `company-${index + 1}`);
  }

  async function loadCompanies() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Workbook request failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false })
      .filter((row) => clean(row[columns.name]))
      .map((row, index) => ({
        source: row,
        index,
        id: clean(row[columns.id]),
        name: clean(row[columns.name]),
        slug: slugify(row[columns.name], `company-${index + 1}`),
        key: getKey(row, index)
      }));
  }

  window.companyTextDashboard = {
    columns,
    clean,
    loadCompanies,
    slugify,
    getBaseUrl
  };
}());
