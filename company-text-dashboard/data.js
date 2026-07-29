(function () {
  const DATA_URL = "data/company-data.json";

  const columns = {
    id: "data_id",
    name: "公司名称",
    type: "公司类型",
    country: "国家",
    region: "地区",
    business: "主营业务",
    position: "市场定位",
    website: "官方网站",
    founded: "成立年份",
    headquarters: "总部"
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
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Company data request failed: ${response.status}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      throw new Error("Company data response must be an array");
    }
    return rows
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
