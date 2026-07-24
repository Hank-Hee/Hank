(function () {
  "use strict";

  function unwrap(value) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (typeof value === "object") {
      return unwrap(value.text ?? value.name ?? value.label ?? value.value ?? value.url ?? "");
    }
    return "";
  }

  function pick(record, keys, fallback = "") {
    for (const key of keys) {
      if (record[key] != null && record[key] !== "") return record[key];
    }
    return fallback;
  }

  function toList(value) {
    if (Array.isArray(value)) return value.map(unwrap).filter(Boolean);
    const text = unwrap(value);
    return text ? text.split(/[、,，;；|]/).map(item => item.trim()).filter(Boolean) : [];
  }

  function toConclusions(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(item => {
        if (Array.isArray(item)) return { lead: unwrap(item[0]), explanation: unwrap(item[1]) };
        if (typeof item === "object") return { lead: unwrap(item.lead ?? item.title), explanation: unwrap(item.explanation ?? item.content) };
        return { lead: unwrap(item), explanation: "" };
      }).filter(item => item.lead || item.explanation);
    }
    return toList(value).map(item => ({ lead: item, explanation: "" }));
  }

  function safeUrl(value) {
    const text = unwrap(value);
    if (!text) return "";
    try {
      const url = new URL(text, window.location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function normalize(record) {
    const id = unwrap(pick(record, ["id", "report_id", "reportId", "报告编号", "数据ID", "_id"]));
    const title = unwrap(pick(record, ["title", "report_title", "报告标题", "中文标题"]));
    return {
      id,
      title,
      subtitle: unwrap(pick(record, ["subtitle", "english_title", "英文标题", "副标题"])),
      summary: unwrap(pick(record, ["summary", "report_summary", "报告摘要", "摘要"])),
      industry: unwrap(pick(record, ["industry", "行业", "行业分类"], "未分类")),
      region: unwrap(pick(record, ["region", "区域", "国家地区"], "全球")),
      type: unwrap(pick(record, ["type", "report_type", "报告类型"], "行业报告")),
      source: unwrap(pick(record, ["source", "source_name", "来源", "来源机构"], "内部研究")),
      date: unwrap(pick(record, ["date", "publish_date", "发布日期", "报告日期"])),
      language: unwrap(pick(record, ["language", "语言"], "中文")),
      format: unwrap(pick(record, ["format", "file_type", "文件类型", "格式"], "WEB")),
      companies: toList(pick(record, ["companies", "related_companies", "关联公司"])),
      keywords: toList(pick(record, ["keywords", "tags", "关键词", "主题标签"])),
      conclusions: toConclusions(pick(record, ["conclusions", "key_findings", "关键结论"])),
      createdAt: unwrap(pick(record, ["createdAt", "created_at", "首次收录", "创建时间"])),
      updatedAt: unwrap(pick(record, ["updatedAt", "updated_at", "最近更新", "更新时间"])),
      owner: unwrap(pick(record, ["owner", "maintainer", "维护人"], "市场研究组")),
      verification: unwrap(pick(record, ["verification", "verification_status", "核验状态"], "待核验")),
      jiandaoyunUrl: safeUrl(pick(record, ["jiandaoyunUrl", "data_access_url", "dataAccessUrl", "数据访问链接", "简道云链接"])),
      detailAvailable: record.detailAvailable !== false
    };
  }

  function getReports() {
    const source = Array.isArray(window.JIANDAOYUN_REPORTS)
      ? window.JIANDAOYUN_REPORTS
      : window.INDUSTRY_REPORTS;
    if (!Array.isArray(source)) return null;
    return source.map(normalize).filter(report => report.id && report.title);
  }

  window.IndustryResearchData = Object.freeze({ getReports, normalize });
})();
