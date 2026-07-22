(function () {
  const { clean, columns, loadCompanies } = window.companyTextDashboard;

  // Keep optional narrative details separate from the shared Excel contract.
  const companyProfiles = {
    "6a1e90aa11f1cb641ce4fe1c": {
      introduction: [
        "ExxonMobil 是全球大型综合能源公司之一，业务覆盖上游勘探开发、天然气与 LNG、炼化、化工及低碳解决方案。",
        "公司在北美、圭亚那、亚太及多个国际市场拥有长期运营与项目开发能力。"
      ],
      businessTags: ["上游油气", "LNG", "炼化与化工"],
      focusRegions: ["North America", "Guyana", "Asia Pacific"],
      founded: "1999",
      headquarters: "Spring, Texas, USA",
      companyType: "国际综合能源公司"
    }
  };

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

  function splitTags(value) {
    return [...new Set(clean(value)
      .split(/[、，,；;|/]/)
      .map((item) => clean(item))
      .filter(Boolean))];
  }

  function getProfile(company) {
    const row = company.source;
    const profile = companyProfiles[company.id] || {};
    return {
      introduction: profile.introduction || [clean(row[columns.position])].filter(Boolean),
      businessTags: profile.businessTags || splitTags(row[columns.business]),
      focusRegions: profile.focusRegions || [
        clean(row[columns.country]),
        clean(row[columns.region])
      ].filter(Boolean),
      founded: clean(profile.founded),
      headquarters: clean(profile.headquarters),
      companyType: clean(profile.companyType) || clean(row[columns.type]),
      website: clean(row[columns.website])
    };
  }

  function appendTagGroup(container, label, tags, neutral) {
    if (!tags.length) return;
    const group = document.createElement("div");
    group.className = "tag-group";
    const heading = document.createElement("strong");
    heading.textContent = label;
    group.append(heading);

    for (const tag of tags) {
      const element = document.createElement("span");
      element.className = neutral ? "tag tag-neutral" : "tag";
      element.textContent = tag;
      group.append(element);
    }
    container.append(group);
  }

  function renderIntroduction(profile) {
    const introduction = document.getElementById("companyIntroduction");
    const tags = document.getElementById("overviewTags");
    introduction.replaceChildren();
    tags.replaceChildren();

    for (const paragraph of profile.introduction) {
      const element = document.createElement("p");
      element.textContent = paragraph;
      introduction.append(element);
    }

    appendTagGroup(tags, "核心业务", profile.businessTags, false);
    appendTagGroup(tags, "重点区域", profile.focusRegions, true);
  }

  function normalizeExternalUrl(value) {
    const raw = clean(value);
    if (!raw) return null;
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(candidate);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function renderBasicInfo(profile) {
    const list = document.getElementById("basicInfoList");
    const website = normalizeExternalUrl(profile.website);
    const items = [
      ["成立年份", profile.founded],
      ["总部", profile.headquarters],
      ["公司类型", profile.companyType],
      ["官方网站", website]
    ].filter(([, value]) => value);

    list.replaceChildren();
    for (const [label, value] of items) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;

      if (value instanceof URL) {
        const link = document.createElement("a");
        link.href = value.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = value.hostname.replace(/^www\./i, "");
        detail.append(link);
      } else {
        detail.textContent = value;
      }
      row.append(term, detail);
      list.append(row);
    }
  }

  function renderOverview(company) {
    const profile = getProfile(company);
    renderIntroduction(profile);
    renderBasicInfo(profile);
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
