(function () {
  function makeUrl(company) {
    const base = window.location.href.replace(/\/links\.html(?:[?#].*)?$/, "/index.html");
    if (company.id) {
      return `${base}?id=${encodeURIComponent(company.id)}`;
    }
    return `${base}?company=${encodeURIComponent(company.slug)}`;
  }

  function renderRows(companies) {
    const body = document.getElementById("linksTableBody");
    const fragment = document.createDocumentFragment();

    for (const company of companies) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      const key = document.createElement("td");
      const url = document.createElement("td");
      const link = document.createElement("a");

      const href = makeUrl(company);
      name.textContent = company.name;
      key.textContent = company.id || company.slug;
      key.className = "key-cell";
      link.href = href;
      link.textContent = href;
      link.target = "_blank";
      link.rel = "noopener";

      url.append(link);
      tr.append(name, key, url);
      fragment.append(tr);
    }

    body.replaceChildren(fragment);
  }

  function renderError() {
    const body = document.getElementById("linksTableBody");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "公司外链加载失败";
    tr.append(td);
    body.replaceChildren(tr);
  }

  async function init() {
    try {
      const companies = await window.companyTextDashboard.loadCompanies();
      renderRows(companies);
    } catch (error) {
      console.error(error);
      renderError();
    }
  }

  init();
}());
