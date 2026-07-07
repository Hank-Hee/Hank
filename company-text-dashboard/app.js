(function () {
  const { clean, columns, loadCompanies } = window.companyTextDashboard;

  function findCompany(companies) {
    const params = new URLSearchParams(window.location.search);
    const id = clean(params.get("id") || params.get("data_id"));
    const company = clean(params.get("company") || params.get("slug") || params.get("name"));
    const hasSelection = Boolean(id || company);

    if (id) {
      const byId = companies.find((item) => item.id === id);
      if (byId) return byId;
    }

    if (company) {
      const wanted = company.toLowerCase();
      return companies.find((item) =>
        item.slug === wanted ||
        item.name.toLowerCase() === wanted ||
        item.key.toLowerCase() === wanted
      );
    }

    if (hasSelection) return null;
    return companies[0] || null;
  }

  function combineCountryRegion(row) {
    const country = clean(row[columns.country]);
    const region = clean(row[columns.region]);
    return [country, region].filter(Boolean).join(" / ");
  }

  function renderOverview(company) {
    const list = document.getElementById("overviewList");
    const row = company.source;
    const items = [
      ["国家/地区", combineCountryRegion(row)],
      ["公司类型", clean(row[columns.type])],
      ["主营业务", clean(row[columns.business])],
      ["市场定位", clean(row[columns.position])]
    ].filter(([, value]) => value);

    list.replaceChildren();
    for (const [label, value] of items) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      list.append(dt, dd);
    }
  }

  function renderState(message) {
    const shell = document.querySelector(".dashboard-shell");
    const state = document.createElement("div");
    state.className = "dashboard-state";
    state.textContent = message;
    shell.replaceChildren(state);
  }

  async function init() {
    try {
      const companies = await loadCompanies();
      const company = findCompany(companies);
      if (!company) {
        renderState("未找到公司数据");
        return;
      }
      document.title = `${company.name} - 公司文字看板`;
      renderOverview(company);
    } catch (error) {
      console.error(error);
      renderState("公司数据加载失败");
    }
  }

  init();
}());
