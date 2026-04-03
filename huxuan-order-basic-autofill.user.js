// ==UserScript==
// @name         互选下单页-基本信息自动填充
// @namespace    https://huxuan.qq.com/
// @icon         https://file.daihuo.qq.com/fe_free_trade/favicon.png
// @version      1.1.0
// @description  在互选下单/招募创建页自动填充基础字段（营销项目、任务概况、预算与任务需求等）
// @author       xiaowu
// @homepageURL  https://github.com/xiaowulang-turbo/Huxuan-AutoLogin
// @supportURL   https://github.com/xiaowulang-turbo/Huxuan-AutoLogin/issues
// @match        https://*.huxuan.qq.com/trade/order_free_trade/*/create*
// @match        https://*.huxuan.qq.com/trade/recruitment/*/create*
// @match        https://huxuan.qq.com/trade/order_free_trade/*/create*
// @match        https://huxuan.qq.com/trade/recruitment/*/create*
// @include      /^https:\/\/(test-|pre-)?huxuan\.qq\.com\/trade\/order_free_trade\/\d+\/create/
// @include      /^https:\/\/(test-|pre-)?huxuan\.qq\.com\/trade\/recruitment\/\d+\/create/
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX = '[互选下单基本信息填充]';

  // ---------------------------------------------------------------------------
  // FIELD_DEFS — 所有配置字段的唯一定义，驱动 getConfig / saveConfig / dialog / fill
  // 新增字段只需在此处追加一项。
  //
  // key           — config 对象属性名
  // sk            — GM_setValue / GM_getValue 的 key
  // enc           — true 时存取走 encode/decode（UTF-8 Base64）
  // dflt          — 默认值（缺省 ''）
  // ph            — 页面 placeholder（用于 fillByPlaceholder；null = 特殊处理）
  // ta            — true → textarea（影响 fill 与 dialog）
  // norm          — 'number' → 填充前用 normalizeNumberLike
  // scope         — 'order' | 'recruitment' | 'common' | null（null = 特殊逻辑，不走通用 fill）
  // root          — 'root' | 'doc'（查找起点：root = 任务区块内；doc = document）
  // dId           — dialog input 的 id
  // dLabel        — dialog label 文案
  // dType         — 'input' | 'textarea' | 'checkbox'（缺省 'input'）
  // dReq          — true → label 加 * 必填标记
  // dHint         — dialog 提示文案
  // dPh           — dialog input placeholder
  // dMax          — maxlength
  // dSec          — dialog 分区：'top' | 'shared' | 'recruitment' | 'settings'
  // ---------------------------------------------------------------------------
  const FIELD_DEFS = [
    { key: 'marketingProject', sk: 'orderBasic_marketingProject',
      dId: 'ob-marketing', dLabel: '营销项目（下单页必填）', dReq: true,
      dHint: '仅 <code>order_free_trade/.../create</code> 需要；招募页可留空',
      dPh: '例如：发布测试 或 51013767675', dSec: 'top' },

    { key: 'taskName', sk: 'orderBasic_taskName', enc: true,
      dId: 'ob-task', dLabel: '任务名称（留空则按前缀+时间戳自动生成）',
      dPh: '留空 → 自动', dSec: 'top' },

    { key: 'taskNameAutoPrefix', sk: 'orderBasic_taskNameAutoPrefix', dflt: '公众号-图片消息',
      dId: 'ob-task-prefix', dLabel: '自动生成前缀',
      dPh: '公众号-图片消息', dSec: 'top' },

    { key: 'promotedProduct', sk: 'orderBasic_promotedProduct', enc: true,
      ph: '请填写本次推广的产品名称', scope: 'common', root: 'root',
      selector: 'input[placeholder="请输入推广产品"], input[placeholder="请填写本次推广的产品名称"]',
      dId: 'ob-product', dLabel: '推广产品', dReq: true, dSec: 'top' },

    { key: 'productIntro', sk: 'orderBasic_productIntro', enc: true,
      ph: '请详细填写本次推广的内容主题、营销目标、以及想要传达的主要信息',
      ta: true, scope: 'common', root: 'root',
      dId: 'ob-intro', dLabel: '产品介绍', dReq: true, dType: 'textarea', dSec: 'top' },

    { key: 'phone', sk: 'orderBasic_phone', enc: true,
      ph: '请输入手机号码，以便创作者联系', scope: 'order', root: 'root',
      dId: 'ob-phone', dLabel: '业务对接人手机号（下单页必填）', dReq: true,
      dHint: '招募创建页无此项，可随意填占位或留空', dMax: 11, dSec: 'top' },

    { key: 'wechat', sk: 'orderBasic_wechat', enc: true,
      ph: '请输入微信号，以便创作者联系', scope: 'order', root: 'root', optional: true,
      dId: 'ob-wechat', dLabel: '业务对接人微信（选填）', dSec: 'top' },

    { key: 'promoCopy', sk: 'orderBasic_promoCopy', enc: true,
      dId: 'ob-promo-copy', dLabel: '推广文案（选填，填写后自动启用营销组件）',
      dPh: '如：限时优惠',
      dHint: '填写后会自动开启营销组件开关并填入「推广文案」输入框；留空则跳过', dSec: 'shared' },

    { key: 'promotionScene', sk: 'orderBasic_promotionScene',
      dId: 'ob-scene', dLabel: '推广场景（与卡片文案完全一致）', dReq: true,
      dPh: '例如：推广品牌活动', dSec: 'recruitment' },

    { key: 'recruitmentBudget', sk: 'orderBasic_recruitmentBudget',
      ph: '请输入本次招募任务的预算金额', scope: 'recruitment', root: 'doc', norm: 'number',
      dId: 'ob-budget', dLabel: '总预算（整数元）', dReq: true,
      dPh: '≥ 平台最低，如 5000', dSec: 'recruitment' },

    { key: 'recruitmentBid', sk: 'orderBasic_recruitmentBid',
      ph: '请输入本次招募任务的单阅读出价', scope: 'recruitment', root: 'doc', norm: 'number',
      dId: 'ob-bid', dLabel: '单阅读出价（元）', dReq: true,
      dPh: '如 0.2', dSec: 'recruitment' },

    { key: 'recruitmentCap', sk: 'orderBasic_recruitmentCap',
      ph: '请输入本次招募任务的单篇预算上限', scope: 'recruitment', root: 'doc', norm: 'number',
      dId: 'ob-cap', dLabel: '单篇预算上限（整数元）', dReq: true,
      dPh: '如 500', dSec: 'recruitment' },

    { key: 'recruitmentTitleReq', sk: 'orderBasic_recruitmentTitleReq', enc: true,
      ph: '可要求标题必须露出某些文字（可以是品牌、产品名、利益点）',
      ta: true, scope: 'recruitment', root: 'doc',
      dId: 'ob-title-req', dLabel: '标题要求（任务需求-必填）', dReq: true,
      dType: 'textarea', dPh: '可要求标题必须露出某些文字…', dSec: 'recruitment' },

    { key: 'recruitmentBodyReq', sk: 'orderBasic_recruitmentBodyReq', enc: true,
      ph: '可要求正文必须露出某些文字（可以是品牌、产品名、利益点）',
      ta: true, scope: 'recruitment', root: 'doc',
      dId: 'ob-body-req', dLabel: '正文要求（任务需求-必填）', dReq: true,
      dType: 'textarea', dPh: '可要求正文必须露出某些文字…', dSec: 'recruitment' },

    { key: 'publishDays', sk: 'orderBasic_publishDays', dflt: '30',
      dId: 'ob-publish-days', dLabel: '发表时段（天数，从明天起算）',
      dPh: '如 30', dSec: 'shared',
      dHint: '自动选择日期范围：明天 至 明天+N天；留空或 0 则跳过' },

    { key: 'enabled', sk: 'orderBasic_enabled', dflt: true,
      dId: 'ob-enabled', dLabel: '启用脚本', dType: 'checkbox', dSec: 'settings' },

    { key: 'autoOnLoad', sk: 'orderBasic_autoOnLoad', dflt: true,
      dId: 'ob-autoload', dLabel: '进入页面时自动填充一次', dType: 'checkbox', dSec: 'settings' },
  ];

  const SECTION_HEADERS = {
    shared: '通用（下单页 & 招募页）',
    recruitment: '招募任务页 <code>recruitment/.../create</code>',
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function isRecruitmentCreatePath(p) {
    return /\/trade\/recruitment\/\d+\/create/.test(p || '');
  }

  function isOrderCreatePath(p) {
    return /\/trade\/order_free_trade\/\d+\/create/.test(p || '');
  }

  function log(...args) { console.log(PREFIX, ...args); }

  function encode(str) {
    return btoa(
      Array.from(new TextEncoder().encode(str || ''), (b) =>
        String.fromCharCode(b)
      ).join('')
    );
  }

  function decode(str) {
    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
      );
    } catch { return str || ''; }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function waitForElement(selector, root = document, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) { resolve(existing); return; }
      const obsRoot = root === document ? document.body || document.documentElement : root;
      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) { observer.disconnect(); clearTimeout(timer); resolve(el); }
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待元素 "${selector}" 超时 (${timeout}ms)`));
      }, timeout);
      observer.observe(obsRoot, { childList: true, subtree: true });
    });
  }

  function setInputValue(el, value) {
    if (!el || value === undefined || value === null) return;
    const v = String(value);
    el.focus();
    const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, v); else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function normalizeText(v) { return String(v || '').replace(/\s+/g, '').trim(); }

  function normalizeNumberLike(v) {
    return String(v || '').replace(/[,\s]/g, '').trim();
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function defaultTaskName(config) {
    const prefix = config.taskNameAutoPrefix || '公众号-图片消息';
    const d = new Date();
    return `${prefix}-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  }

  // ---------------------------------------------------------------------------
  // Config CRUD — driven by FIELD_DEFS
  // ---------------------------------------------------------------------------

  function getConfig() {
    const c = {};
    for (const f of FIELD_DEFS) {
      const raw = GM_getValue(f.sk, f.dflt ?? '');
      c[f.key] = f.enc ? decode(raw) : raw;
    }
    return c;
  }

  function saveConfig(c) {
    for (const f of FIELD_DEFS) {
      const v = c[f.key];
      if (f.enc) {
        GM_setValue(f.sk, encode(v || ''));
      } else {
        GM_setValue(f.sk, typeof v === 'string' ? v.trim() : v);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function taskNameOk(c) {
    return !!(c.taskName && String(c.taskName).trim()) ||
           !!(c.taskNameAutoPrefix && String(c.taskNameAutoPrefix).trim());
  }

  function isOrderFillConfigValid(c) {
    return !!(c.marketingProject && c.promotedProduct && c.productIntro && c.phone && taskNameOk(c));
  }

  function isRecruitmentFillConfigValid(c) {
    return !!(
      taskNameOk(c) &&
      (c.promotionScene || '').trim() &&
      c.promotedProduct && c.productIntro &&
      (c.recruitmentBudget || '').trim() &&
      (c.recruitmentBid || '').trim() &&
      (c.recruitmentCap || '').trim() &&
      (c.recruitmentTitleReq || '').trim() &&
      (c.recruitmentBodyReq || '').trim()
    );
  }

  function isFillConfigValidForPath(c, path) {
    if (isRecruitmentCreatePath(path)) return isRecruitmentFillConfigValid(c);
    if (isOrderCreatePath(path)) return isOrderFillConfigValid(c);
    return isOrderFillConfigValid(c) || isRecruitmentFillConfigValid(c);
  }

  function isFillConfigValidAny(c) {
    return isOrderFillConfigValid(c) || isRecruitmentFillConfigValid(c);
  }

  // ---------------------------------------------------------------------------
  // DOM root resolvers
  // ---------------------------------------------------------------------------

  const PRODUCT_SEL = 'input[placeholder="请输入推广产品"], input[placeholder="请填写本次推广的产品名称"]';
  const INTRO_SEL = 'textarea[placeholder="请详细填写本次推广的内容主题、营销目标、以及想要传达的主要信息"]';
  const ROOT_ANCHOR_SEL = `${PRODUCT_SEL}, ${INTRO_SEL}`;

  function resolveTaskSectionRoot(taskInput) {
    if (!taskInput) return null;
    let el = taskInput.parentElement;
    while (el && el !== document.documentElement) {
      if (el.querySelector(ROOT_ANCHOR_SEL) && el.contains(taskInput)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function findBasicSectionRootByText() {
    let best = null;
    let bestLen = Infinity;
    for (const d of document.querySelectorAll('div')) {
      const t = d.textContent || '';
      const hit =
        (t.includes('基本信息') && t.includes('营销项目') && t.includes('任务名称')) ||
        (t.includes('任务概况') && t.includes('任务名称') && t.includes('推广产品'));
      if (hit && t.length < bestLen) { bestLen = t.length; best = d; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Generic fill helper — driven by FIELD_DEFS
  // ---------------------------------------------------------------------------

  function fillByPlaceholder(scope, f, value) {
    if (!value && !f.optional) return;
    if (f.optional && !value) return;
    const v = f.norm === 'number' ? normalizeNumberLike(value) : value;
    const searchRoot = f.root === 'doc' ? document : scope;
    let el;
    if (f.selector) {
      el = searchRoot.querySelector(f.selector);
    } else {
      const tag = f.ta ? 'textarea' : 'input';
      el = searchRoot.querySelector(`${tag}[placeholder="${f.ph}"]`);
    }
    if (el) setInputValue(el, v);
  }

  // ---------------------------------------------------------------------------
  // Marketing project dropdown (complex — kept as-is)
  // ---------------------------------------------------------------------------

  function getMarketingSelectRoot(root) {
    return root.querySelector('.dhx-list-table-select') || root.querySelector('.spaui-select');
  }

  async function waitForOpenPanel(selectRoot, timeout = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (!selectRoot.classList.contains('spaui-select-open')) { await sleep(80); continue; }
      const trs = selectRoot.querySelectorAll('tbody tr.art-table-row, tbody tr:not(.art-table-header-row)');
      const lis = selectRoot.querySelectorAll('.selection-results li, .selection-drop .selection-results li');
      if (trs.length > 0 || lis.length > 0) return selectRoot;
      if (selectRoot.querySelector('.dhx-list-table-select__table') || selectRoot.querySelector('table tbody')) { await sleep(100); continue; }
      if (selectRoot.querySelector('.selection-drop')) return selectRoot;
      await sleep(80);
    }
    return document.querySelector('.dhx-list-table-select.spaui-select-open, .spaui-select.spaui-select-open');
  }

  async function ensureMarketingProject(root, name) {
    const raw = (name || '').trim();
    if (!raw) return;

    const selectRoot = getMarketingSelectRoot(root);
    if (!selectRoot) { log('未找到营销项目下拉'); return; }

    const collapsedText =
      selectRoot.querySelector('.selection-single-text')?.getAttribute('title') ||
      selectRoot.querySelector('.spaui-selection-item-content')?.textContent?.trim() ||
      selectRoot.textContent?.trim() || '';
    if (collapsedText && collapsedText.includes(raw)) {
      log('营销项目已是目标项，跳过:', collapsedText.slice(0, 80));
      return;
    }

    const trigger = selectRoot.querySelector('.selection-single');
    if (!trigger) return;
    trigger.click();
    await sleep(250);

    const openPanel = await waitForOpenPanel(selectRoot, 10000);
    if (!openPanel) { log('营销项目面板未打开'); return; }

    const searchIn =
      openPanel.querySelector('input[placeholder="输入项目名称 / 项目ID 搜索"]') ||
      document.querySelector('input[placeholder="输入项目名称 / 项目ID 搜索"]');

    if (searchIn) {
      searchIn.focus();
      setInputValue(searchIn, raw);
      searchIn.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      searchIn.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      await sleep(700);
    }

    const tableRows = (p) =>
      [...p.querySelectorAll('tbody tr.art-table-row, tbody tr:not(.art-table-header-row)')].filter((tr) => !tr.closest('thead'));
    const listItems = (p) =>
      p.querySelectorAll('.selection-results li, .selection-drop .selection-results li');

    function tryClickTableRow(panel, key) {
      for (const tr of tableRows(panel)) {
        const t = (tr.textContent || '').replace(/\s+/g, '');
        if (t.includes(key.replace(/\s+/g, '')) || (tr.textContent || '').includes(key)) {
          tr.scrollIntoView({ block: 'nearest' });
          tr.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          tr.click();
          return tr.textContent?.trim().slice(0, 80);
        }
      }
      return null;
    }

    function tryClickListItem(panel, key) {
      for (const li of listItems(panel)) {
        const label =
          li.querySelector('.selection-name')?.getAttribute('title') ||
          li.querySelector('.name')?.textContent?.trim() ||
          li.textContent?.trim() || '';
        if (label && label.includes(key)) {
          li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          li.click();
          return label;
        }
      }
      return null;
    }

    let picked = tryClickTableRow(openPanel, raw) || tryClickListItem(openPanel, raw);

    if (!picked && searchIn) {
      setInputValue(searchIn, '');
      searchIn.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      await sleep(600);
      picked = tryClickTableRow(openPanel, raw) || tryClickListItem(openPanel, raw);
    }

    if (picked) { log('已选择营销项目:', picked); await sleep(350); return; }

    // 兜底：关闭面板 → 重新打开（清除搜索过滤） → 选第一行
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(400);

    trigger.click();
    await sleep(300);
    const fallbackPanel = await waitForOpenPanel(selectRoot, 8000);
    if (fallbackPanel) {
      const fallbackRows = tableRows(fallbackPanel);
      const fallbackLis = listItems(fallbackPanel);
      if (fallbackRows.length > 0) {
        const first = fallbackRows[0];
        first.scrollIntoView({ block: 'nearest' });
        first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        first.click();
        log('营销项目未精确匹配，已兜底选择第一项:', first.textContent?.trim()?.slice(0, 80));
        await sleep(350);
        return;
      }
      if (fallbackLis.length > 0) {
        const first = fallbackLis[0];
        first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        first.click();
        log('营销项目未精确匹配，已兜底选择第一项:', first.textContent?.trim()?.slice(0, 40));
        await sleep(350);
        return;
      }
    }

    log('营销项目兜底失败：下拉列表为空');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  // ---------------------------------------------------------------------------
  // Promotion scene card click (complex — kept as-is)
  // ---------------------------------------------------------------------------

  function hasIcon(el) { return !!(el.querySelector('img') || el.querySelector('svg')); }

  async function ensurePromotionScene(scope, label) {
    const raw = (label || '').trim();
    if (!raw) return;
    const root = scope && scope.nodeType === Node.ELEMENT_NODE ? scope : document.body;
    const target = normalizeText(raw);
    const candidates = [];

    for (const d of root.querySelectorAll('div')) {
      if (!hasIcon(d)) continue;
      const txt = normalizeText(d.textContent || '');
      if (!txt || txt.length > 30) continue;
      candidates.push({ el: d, txt });
    }

    for (const c of candidates) {
      if (c.txt === target) {
        c.el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        log('推广场景已选:', raw);
        await sleep(220);
        return;
      }
    }
    for (const c of candidates) {
      if (c.txt.includes(target) || target.includes(c.txt)) {
        c.el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        log('推广场景已按模糊匹配选中:', raw, '=>', c.txt);
        await sleep(220);
        return;
      }
    }

    const hints = Array.from(new Set(candidates.map((c) => c.txt))).slice(0, 12);
    log('未找到推广场景卡片，当前可选项（部分）:', hints.join(' / ') || '无');
    log('请将「推广场景」配置为页面中的卡片文案，例如：推广品牌活动');
  }

  // ---------------------------------------------------------------------------
  // Publish date range picker
  // ---------------------------------------------------------------------------

  function formatDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function getReactEventHandlers(el) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactEventHandlers'));
    return key ? el[key] : null;
  }

  async function ensurePublishDateRange(days) {
    const n = parseInt(days, 10);
    if (!n || n <= 0) return;

    const dc = document.querySelector('.datechoose');
    if (!dc) { log('未找到发表时段选择器'); return; }

    const eh = getReactEventHandlers(dc);
    if (eh?.onClick) {
      eh.onClick({ preventDefault() {}, stopPropagation() {} });
    } else {
      dc.click();
    }
    await sleep(800);

    const picker = document.querySelector('.spaui-datepicker-open');
    if (!picker) { log('发表时段面板未打开'); return; }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + n - 1);
    const startStr = formatDate(tomorrow);
    const endStr = formatDate(endDate);

    function reactClick(el) {
      const reh = getReactEventHandlers(el);
      if (reh?.onClick) reh.onClick({ preventDefault() {}, stopPropagation() {} });
      else el.click();
    }

    function getDateAreas() {
      return [...picker.querySelectorAll('.datearea')];
    }

    function getAreaYearMonth(area) {
      const links = area.querySelectorAll('.ymselect a');
      if (links.length >= 2) {
        const y = parseInt(links[0].textContent, 10);
        const m = parseInt(links[1].textContent, 10);
        if (y && m) return { y, m };
      }
      return null;
    }

    function clickDayInArea(area, day) {
      const cells = [...area.querySelectorAll('.spaui-datepicker-pointer')]
        .filter((el) => !el.classList.contains('disabled') &&
                        !el.classList.contains('spaui-datepicker-nextmonth-date') &&
                        !el.classList.contains('spaui-datepicker-lastmonth-date') &&
                        el.textContent.trim());
      for (const cell of cells) {
        if (cell.textContent.trim() === String(day)) {
          reactClick(cell);
          return true;
        }
      }
      return false;
    }

    function clickNextMonth() {
      const fwd = picker.querySelector('.roll-forward');
      if (!fwd) return false;
      reactClick(fwd);
      return true;
    }

    async function findAreaAndClickDay(targetDate) {
      const ty = targetDate.getFullYear();
      const tm = targetDate.getMonth() + 1;
      const td = targetDate.getDate();

      for (let attempt = 0; attempt < 14; attempt++) {
        for (const area of getDateAreas()) {
          const ym = getAreaYearMonth(area);
          if (ym && ym.y === ty && ym.m === tm) {
            if (clickDayInArea(area, td)) return true;
          }
        }
        if (!clickNextMonth()) return false;
        await sleep(300);
      }
      return false;
    }

    const startClicked = await findAreaAndClickDay(tomorrow);
    if (!startClicked) { log('发表时段：未能选中起始日期', startStr); return; }
    await sleep(400);

    const endClicked = await findAreaAndClickDay(endDate);
    if (!endClicked) { log('发表时段：未能选中结束日期', endStr); return; }
    await sleep(400);

    const confirmBtn = picker.querySelector('button.spaui-button-primary');
    if (confirmBtn) {
      confirmBtn.click();
      log('发表时段已选择:', startStr, '至', endStr);
      await sleep(300);
    } else {
      log('发表时段面板未找到确定按钮');
    }
  }

  // ---------------------------------------------------------------------------
  // Marketing component switch + promo copy (complex — kept as-is)
  // ---------------------------------------------------------------------------

  async function ensureMarketingComponentAndFillPromo(promoCopy) {
    const raw = (promoCopy || '').trim();
    if (!raw) return;

    let switchLabel = document.querySelector('label.spaui-switch[role=switch]');
    if (!switchLabel) {
      try {
        switchLabel = await waitForElement('label.spaui-switch[role=switch]', document, 8000);
      } catch {
        log('营销组件开关未找到（可能页面底部尚未渲染）');
        return;
      }
    }

    const switchInput = switchLabel.querySelector('input[type=checkbox]');
    if (switchInput && !switchInput.checked) {
      switchLabel.click();
      log('已启用营销组件');
      await sleep(1500);
    }

    const phPromo = '请输入推广文案';
    let promoInput = document.querySelector(`input[placeholder="${phPromo}"]`);
    if (!promoInput) {
      try {
        promoInput = await waitForElement(`input[placeholder="${phPromo}"]`, document, 5000);
      } catch {
        log('营销组件已启用但未找到推广文案输入框');
        return;
      }
    }

    setInputValue(promoInput, raw);
    log('推广文案已填充:', raw);
  }

  // ---------------------------------------------------------------------------
  // fillBasicFields — uses fillByPlaceholder for simple fields
  // ---------------------------------------------------------------------------

  async function fillBasicFields(config) {
    const path = window.location.pathname || '';
    const recruitment = isRecruitmentCreatePath(path);

    let taskInput;
    try {
      taskInput = await waitForElement('input[placeholder="请输入任务名称"]', document, 25000);
    } catch (e) {
      log('等待「任务名称」输入框超时，页面可能仍在加载:', e?.message || e);
      return false;
    }

    let root = resolveTaskSectionRoot(taskInput);
    if (!root || !root.querySelector(ROOT_ANCHOR_SEL)) root = findBasicSectionRootByText();
    if (!root || !root.querySelector(ROOT_ANCHOR_SEL)) {
      log('未找到任务/基本信息区块');
      return false;
    }

    if (recruitment) {
      await ensurePromotionScene(root, config.promotionScene);
    } else {
      if (!root.querySelector('.spaui-select')) {
        log('未找到「营销项目」下拉（是否非下单创建页？）');
        return false;
      }
      await ensureMarketingProject(root, config.marketingProject);
    }

    const task = (config.taskName && config.taskName.trim()) || defaultTaskName(config);
    setInputValue(taskInput, task);

    for (const f of FIELD_DEFS) {
      if (!f.ph && !f.selector) continue;
      if (f.scope === 'order' && recruitment) continue;
      if (f.scope === 'recruitment' && !recruitment) continue;
      fillByPlaceholder(root, f, config[f.key]);
    }

    if (recruitment) {
      const pubDays = parseInt(config.publishDays, 10);
      if (pubDays > 0) {
        await ensurePublishDateRange(pubDays);
      }
    }

    if ((config.promoCopy || '').trim()) {
      await ensureMarketingComponentAndFillPromo(config.promoCopy);
    }

    log(recruitment ? '招募页：任务概况与预算、制作要求等已尝试填充' : '下单页：基本信息已填充');
    return true;
  }

  // ---------------------------------------------------------------------------
  // Settings dialog — driven by FIELD_DEFS
  // ---------------------------------------------------------------------------

  function buildDialogRows(section) {
    return FIELD_DEFS
      .filter((f) => f.dSec === section && f.dType !== 'checkbox')
      .map((f) => {
        const tag = f.dType === 'textarea' ? 'textarea' : 'input';
        const req = f.dReq ? ' class="req"' : '';
        const ph = f.dPh ? ` placeholder="${f.dPh}"` : '';
        const ml = f.dMax ? ` maxlength="${f.dMax}"` : '';
        const hint = f.dHint ? `\n          <div class="hint">${f.dHint}</div>` : '';
        return `        <div class="row">
          <label${req}>${f.dLabel}</label>
          <${tag} id="${f.dId}" type="text"${ph}${ml}></${tag}>${hint}
        </div>`;
      })
      .join('\n');
  }

  function buildCheckboxes() {
    return FIELD_DEFS
      .filter((f) => f.dType === 'checkbox')
      .map((f) =>
        `        <div class="chk"><input type="checkbox" id="${f.dId}"><label for="${f.dId}">${f.dLabel}</label></div>`
      )
      .join('\n');
  }

  function showConfigDialog() {
    const existing = document.getElementById('huxuan-order-basic-dialog');
    if (existing) existing.remove();

    const c = getConfig();

    GM_addStyle(`
      #huxuan-order-basic-dialog { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:999999;
        display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
      #huxuan-order-basic-dialog .box { background:#fff; border-radius:12px; padding:28px 32px; width:480px;
        box-shadow:0 8px 32px rgba(0,0,0,.15); max-height:90vh; overflow-y:auto; }
      #huxuan-order-basic-dialog h4 { margin:20px 0 10px; font-size:15px; color:#333; border-top:1px solid #eee; padding-top:16px; }
      #huxuan-order-basic-dialog h3 { margin:0 0 16px; font-size:18px; text-align:center; color:#1a1a1a; }
      #huxuan-order-basic-dialog .row { margin-bottom:12px; }
      #huxuan-order-basic-dialog label { display:block; font-size:13px; color:#555; margin-bottom:4px; font-weight:500; }
      #huxuan-order-basic-dialog .req::after { content:' *'; color:#ff4d4f; }
      #huxuan-order-basic-dialog input, #huxuan-order-basic-dialog textarea {
        width:100%; padding:8px 12px; border:1px solid #d9d9d9; border-radius:6px; font-size:14px; box-sizing:border-box; }
      #huxuan-order-basic-dialog textarea { min-height:72px; resize:vertical; }
      #huxuan-order-basic-dialog .hint { font-size:12px; color:#999; margin-top:2px; }
      #huxuan-order-basic-dialog .chk { display:flex; align-items:center; gap:8px; margin:10px 0; }
      #huxuan-order-basic-dialog .chk input { width:auto; }
      #huxuan-order-basic-dialog .btns { display:flex; gap:10px; margin-top:18px; }
      #huxuan-order-basic-dialog .btns button { flex:1; padding:8px 16px; border:none; border-radius:6px; font-size:14px; cursor:pointer; }
      #huxuan-order-basic-dialog .b-primary { background:#1677ff; color:#fff; }
      #huxuan-order-basic-dialog .b-cancel { background:#f0f0f0; color:#333; }
    `);

    const wrap = document.createElement('div');
    wrap.id = 'huxuan-order-basic-dialog';
    wrap.innerHTML = `
      <div class="box">
        <h3>基本信息自动填充</h3>
${buildDialogRows('top')}
        <h4>${SECTION_HEADERS.shared}</h4>
${buildDialogRows('shared')}
        <h4>${SECTION_HEADERS.recruitment}</h4>
${buildDialogRows('recruitment')}
${buildCheckboxes()}
        <div class="btns">
          <button type="button" class="b-cancel" id="ob-close">关闭</button>
          <button type="button" class="b-primary" id="ob-save">保存</button>
        </div>
        <div class="btns">
          <button type="button" class="b-primary" id="ob-fillnow" style="flex:1">仅本次：立即填充</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    for (const f of FIELD_DEFS) {
      const el = document.getElementById(f.dId);
      if (!el) continue;
      if (f.dType === 'checkbox') el.checked = !!c[f.key];
      else el.value = c[f.key] ?? '';
    }

    function readDialogConfig(overrides) {
      const o = overrides || {};
      const next = {};
      for (const f of FIELD_DEFS) {
        const el = document.getElementById(f.dId);
        if (!el) { next[f.key] = c[f.key]; continue; }
        if (f.dType === 'checkbox') {
          next[f.key] = o[f.key] !== undefined ? o[f.key] : el.checked;
        } else {
          next[f.key] = el.value.trim();
        }
      }
      return next;
    }

    const close = () => wrap.remove();
    document.getElementById('ob-close').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

    document.getElementById('ob-save').addEventListener('click', () => {
      const next = readDialogConfig();
      if (!isFillConfigValidAny(next)) {
        log('保存失败：请至少完成一套有效配置——下单页（营销项目+手机+产品与介绍+任务名/前缀）或招募页（推广场景+预算三项+标题/正文要求+产品与介绍+任务名/前缀）');
        return;
      }
      saveConfig(next);
      log('已保存');
      close();
    });

    document.getElementById('ob-fillnow').addEventListener('click', async () => {
      const next = readDialogConfig({ enabled: true });
      const path = window.location.pathname || '';
      if (!isFillConfigValidForPath(next, path)) {
        log('立即填充：当前页面所需的必填项未齐（招募/下单校验规则不同，请对照设置表单）');
        return;
      }
      await fillBasicFields(next);
    });
  }

  // ---------------------------------------------------------------------------
  // Entry
  // ---------------------------------------------------------------------------

  GM_registerMenuCommand('互选下单·基本信息填充设置', showConfigDialog);

  async function main() {
    const path = window.location.pathname || '';
    if (!isOrderCreatePath(path) && !isRecruitmentCreatePath(path)) return;

    const config = getConfig();
    if (!config.enabled) { log('已禁用'); return; }

    if (!isFillConfigValidForPath(config, path)) {
      log('配置未完成，请通过油猴菜单「互选下单·基本信息填充设置」填写');
      showConfigDialog();
      return;
    }

    if (config.autoOnLoad) {
      try { await fillBasicFields(config); }
      catch (e) { log('自动填充失败:', e?.message || e); }
    } else {
      log('已关闭「进入页面自动填充」，请用设置里的「仅本次：立即填充」');
    }
  }

  main();
})();
