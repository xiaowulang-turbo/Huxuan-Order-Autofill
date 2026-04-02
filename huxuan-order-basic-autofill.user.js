// ==UserScript==
// @name         互选下单页-基本信息自动填充
// @namespace    https://huxuan.qq.com/
// @icon         https://file.daihuo.qq.com/fe_free_trade/favicon.png
// @version      1.0.3
// @description  在广告下单创建页自动填充「基本信息」区块（营销项目、任务名称、推广产品等）
// @author       xiaowu
// @homepageURL  https://github.com/xiaowulang-turbo/Huxuan-AutoLogin
// @supportURL   https://github.com/xiaowulang-turbo/Huxuan-AutoLogin/issues
// @match        https://huxuan.qq.com/trade/order_free_trade/*/create*
// @match        https://test-huxuan.qq.com/trade/order_free_trade/*/create*
// @match        https://pre-huxuan.qq.com/trade/order_free_trade/*/create*
// @include      /^https:\/\/(test-|pre-)?huxuan\.qq\.com\/trade\/order_free_trade\/\d+\/create/
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX = '[互选下单基本信息填充]';
  const CONFIG_KEYS = {
    MARKETING: 'orderBasic_marketingProject',
    TASK_NAME: 'orderBasic_taskName',
    TASK_AUTO_PREFIX: 'orderBasic_taskNameAutoPrefix',
    PRODUCT: 'orderBasic_promotedProduct',
    INTRO: 'orderBasic_productIntro',
    PHONE: 'orderBasic_phone',
    WECHAT: 'orderBasic_wechat',
    ENABLED: 'orderBasic_enabled',
    AUTO_ON_LOAD: 'orderBasic_autoOnLoad',
  };

  const PLACEHOLDER = {
    task: '请输入任务名称',
    product: '请输入推广产品',
    intro:
      '请详细填写本次推广的内容主题、营销目标、以及想要传达的主要信息',
    phone: '请输入手机号码，以便创作者联系',
    wechat: '请输入微信号，以便创作者联系',
    projectSearch: '输入项目名称 / 项目ID 搜索',
  };

  function log(...args) {
    console.log(PREFIX, ...args);
  }

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
    } catch {
      return str || '';
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForElement(selector, root = document, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }
      const obsRoot = root === document ? document.body || document.documentElement : root;
      const observer = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
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
    el.focus();
    el.value = '';
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 从「任务名称」输入框向上找同时包含营销项目 .spaui-select 的最小祖先。
   * 不依赖 textContent 长度阈值，避免慢渲染或大块壳层导致旧逻辑永远 null。
   */
  function resolveBasicSectionRoot(taskInput) {
    if (!taskInput) return null;
    let el = taskInput.parentElement;
    while (el && el !== document.documentElement) {
      if (el.querySelector('.spaui-select') && el.contains(taskInput)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  /** 兜底：文案锚点（无长度限制，取命中节点中最短的） */
  function findBasicInfoRootByText() {
    let best = null;
    let bestLen = Infinity;
    for (const d of document.querySelectorAll('div')) {
      const t = d.textContent || '';
      if (
        t.includes('基本信息') &&
        t.includes('营销项目') &&
        t.includes('任务名称')
      ) {
        if (t.length < bestLen) {
          bestLen = t.length;
          best = d;
        }
      }
    }
    return best;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function defaultTaskName(config) {
    const prefix =
      config.taskNameAutoPrefix || '公众号-图片消息';
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    return `${prefix}-${stamp}`;
  }

  function getConfig() {
    return {
      marketingProject: GM_getValue(CONFIG_KEYS.MARKETING, ''),
      taskName: decode(GM_getValue(CONFIG_KEYS.TASK_NAME, '')),
      taskNameAutoPrefix: GM_getValue(CONFIG_KEYS.TASK_AUTO_PREFIX, '公众号-图片消息'),
      promotedProduct: decode(GM_getValue(CONFIG_KEYS.PRODUCT, '')),
      productIntro: decode(GM_getValue(CONFIG_KEYS.INTRO, '')),
      phone: decode(GM_getValue(CONFIG_KEYS.PHONE, '')),
      wechat: decode(GM_getValue(CONFIG_KEYS.WECHAT, '')),
      enabled: GM_getValue(CONFIG_KEYS.ENABLED, true),
      autoOnLoad: GM_getValue(CONFIG_KEYS.AUTO_ON_LOAD, true),
    };
  }

  function saveConfig(c) {
    GM_setValue(CONFIG_KEYS.MARKETING, c.marketingProject);
    GM_setValue(CONFIG_KEYS.TASK_NAME, encode(c.taskName));
    GM_setValue(CONFIG_KEYS.TASK_AUTO_PREFIX, c.taskNameAutoPrefix);
    GM_setValue(CONFIG_KEYS.PRODUCT, encode(c.promotedProduct));
    GM_setValue(CONFIG_KEYS.INTRO, encode(c.productIntro));
    GM_setValue(CONFIG_KEYS.PHONE, encode(c.phone));
    GM_setValue(CONFIG_KEYS.WECHAT, encode(c.wechat));
    GM_setValue(CONFIG_KEYS.ENABLED, c.enabled);
    GM_setValue(CONFIG_KEYS.AUTO_ON_LOAD, c.autoOnLoad);
  }

  function isFillConfigValid(c) {
    return !!(
      c.marketingProject &&
      c.promotedProduct &&
      c.productIntro &&
      c.phone &&
      (c.taskName.trim() || c.taskNameAutoPrefix)
    );
  }

  function getMarketingSelectRoot(root) {
    const listTable = root.querySelector('.dhx-list-table-select');
    if (listTable) return listTable;
    return root.querySelector('.spaui-select');
  }

  async function waitForOpenPanel(selectRoot, timeout = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (!selectRoot.classList.contains('spaui-select-open')) {
        await sleep(80);
        continue;
      }
      const tableRows = selectRoot.querySelectorAll(
        'tbody tr.art-table-row, tbody tr:not(.art-table-header-row)'
      );
      const simpleLis = selectRoot.querySelectorAll(
        '.selection-results li, .selection-drop .selection-results li'
      );
      if (tableRows.length > 0 || simpleLis.length > 0) {
        return selectRoot;
      }
      if (
        selectRoot.querySelector('.dhx-list-table-select__table') ||
        selectRoot.querySelector('table tbody')
      ) {
        await sleep(100);
        continue;
      }
      if (selectRoot.querySelector('.selection-drop')) {
        return selectRoot;
      }
      await sleep(80);
    }
    return document.querySelector(
      '.dhx-list-table-select.spaui-select-open, .spaui-select.spaui-select-open'
    );
  }

  /** 列表式 li（旧 UI） + 表格式 tr（dhx-list-table-select） */
  async function ensureMarketingProject(root, name) {
    const raw = (name || '').trim();
    if (!raw) return;

    const selectRoot = getMarketingSelectRoot(root);
    if (!selectRoot) {
      log('未找到营销项目下拉');
      return;
    }

    const collapsedText =
      selectRoot.querySelector('.selection-single-text')?.getAttribute('title') ||
      selectRoot.querySelector('.spaui-selection-item-content')?.textContent?.trim() ||
      selectRoot.textContent?.trim() ||
      '';
    if (collapsedText && raw && collapsedText.includes(raw)) {
      log('营销项目已是目标项，跳过:', collapsedText.slice(0, 80));
      return;
    }

    const trigger = selectRoot.querySelector('.selection-single');
    if (!trigger) return;
    trigger.click();
    await sleep(250);

    const openPanel = await waitForOpenPanel(selectRoot, 10000);
    if (!openPanel) {
      log('营销项目面板未打开');
      return;
    }

    const searchIn =
      openPanel.querySelector(
        `input[placeholder="${PLACEHOLDER.projectSearch}"]`
      ) ||
      document.querySelector(
        `input[placeholder="${PLACEHOLDER.projectSearch}"]`
      );

    if (searchIn) {
      searchIn.focus();
      setInputValue(searchIn, raw);
      searchIn.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      searchIn.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      await sleep(700);
    }

    function tableRows(panel) {
      return [
        ...panel.querySelectorAll(
          'tbody tr.art-table-row, tbody tr:not(.art-table-header-row)'
        ),
      ].filter((tr) => !tr.closest('thead'));
    }

    function listItems(panel) {
      return panel.querySelectorAll(
        '.selection-results li, .selection-drop .selection-results li'
      );
    }

    function tryClickTableRow(panel, key) {
      const rows = tableRows(panel);
      for (const tr of rows) {
        const text = (tr.textContent || '').replace(/\s+/g, '');
        const compactKey = key.replace(/\s+/g, '');
        if (text.includes(compactKey) || (tr.textContent || '').includes(key)) {
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
          li.textContent?.trim() ||
          '';
        if (label && label.includes(key)) {
          li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          li.click();
          return label;
        }
      }
      return null;
    }

    let picked =
      tryClickTableRow(openPanel, raw) ||
      tryClickListItem(openPanel, raw);

    if (!picked && searchIn) {
      setInputValue(searchIn, '');
      searchIn.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      await sleep(600);
      picked =
        tryClickTableRow(openPanel, raw) ||
        tryClickListItem(openPanel, raw);
    }

    if (picked) {
      log('已选择营销项目:', picked);
      await sleep(350);
      return;
    }

    log(
      '未在下拉里找到营销项目:',
      raw,
      '（可填项目名称或项目ID；若仍失败请检查列表是否懒加载）'
    );
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  async function fillBasicFields(config) {
    let taskInput;
    try {
      taskInput = await waitForElement(
        `input[placeholder="${PLACEHOLDER.task}"]`,
        document,
        25000
      );
    } catch (e) {
      log(
        '等待「任务名称」输入框超时，页面可能仍在加载:',
        e?.message || e
      );
      return false;
    }

    let root = resolveBasicSectionRoot(taskInput);
    if (!root || !root.querySelector('.spaui-select')) {
      root = findBasicInfoRootByText();
    }
    if (!root || !root.querySelector('.spaui-select')) {
      log('未找到「基本信息」区块（含营销项目下拉）');
      return false;
    }

    const task =
      config.taskName.trim() || defaultTaskName(config);

    await ensureMarketingProject(root, config.marketingProject);

    setInputValue(taskInput, task);

    const productInput = root.querySelector(
      `input[placeholder="${PLACEHOLDER.product}"]`
    );
    if (productInput) setInputValue(productInput, config.promotedProduct);

    const introInput = root.querySelector(
      `textarea[placeholder="${PLACEHOLDER.intro}"]`
    );
    if (introInput) setInputValue(introInput, config.productIntro);

    const phoneInput = root.querySelector(
      `input[placeholder="${PLACEHOLDER.phone}"]`
    );
    if (phoneInput) setInputValue(phoneInput, config.phone);

    const wechatInput = root.querySelector(
      `input[placeholder="${PLACEHOLDER.wechat}"]`
    );
    if (wechatInput && config.wechat) {
      setInputValue(wechatInput, config.wechat);
    }

    log('基本信息已填充');
    return true;
  }

  function showConfigDialog() {
    const existing = document.getElementById('huxuan-order-basic-dialog');
    if (existing) existing.remove();

    const c = getConfig();

    GM_addStyle(`
      #huxuan-order-basic-dialog { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:999999;
        display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
      #huxuan-order-basic-dialog .box { background:#fff; border-radius:12px; padding:28px 32px; width:420px;
        box-shadow:0 8px 32px rgba(0,0,0,.15); max-height:90vh; overflow-y:auto; }
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
        <div class="row">
          <label class="req">营销项目（与下拉里文案一致，用于搜索匹配）</label>
          <input id="ob-marketing" type="text" placeholder="例如：发布测试 或 51013767675">
          <div class="hint">填项目名称或项目ID，与表格行文案匹配即可（表格 UI 与旧版列表均支持）</div>
        </div>
        <div class="row">
          <label>任务名称（留空则按前缀+时间戳自动生成）</label>
          <input id="ob-task" type="text" placeholder="留空 → 自动">
        </div>
        <div class="row">
          <label>自动生成前缀</label>
          <input id="ob-task-prefix" type="text" placeholder="公众号-图片消息">
        </div>
        <div class="row">
          <label class="req">推广产品</label>
          <input id="ob-product" type="text">
        </div>
        <div class="row">
          <label class="req">产品介绍</label>
          <textarea id="ob-intro"></textarea>
        </div>
        <div class="row">
          <label class="req">业务对接人手机号</label>
          <input id="ob-phone" type="text" maxlength="11">
        </div>
        <div class="row">
          <label>业务对接人微信（选填）</label>
          <input id="ob-wechat" type="text">
        </div>
        <div class="chk"><input type="checkbox" id="ob-enabled"><label for="ob-enabled">启用脚本</label></div>
        <div class="chk"><input type="checkbox" id="ob-autoload"><label for="ob-autoload">进入页面时自动填充一次</label></div>
        <div class="btns">
          <button type="button" class="b-cancel" id="ob-close">关闭</button>
          <button type="button" class="b-primary" id="ob-save">保存</button>
        </div>
        <div class="btns">
          <button type="button" class="b-primary" id="ob-fillnow" style="flex:1">仅本次：立即填充</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('ob-marketing').value = c.marketingProject;
    document.getElementById('ob-task').value = c.taskName;
    document.getElementById('ob-task-prefix').value = c.taskNameAutoPrefix;
    document.getElementById('ob-product').value = c.promotedProduct;
    document.getElementById('ob-intro').value = c.productIntro;
    document.getElementById('ob-phone').value = c.phone;
    document.getElementById('ob-wechat').value = c.wechat;
    document.getElementById('ob-enabled').checked = c.enabled;
    document.getElementById('ob-autoload').checked = c.autoOnLoad;

    const close = () => wrap.remove();
    document.getElementById('ob-close').addEventListener('click', close);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) close();
    });
    document.getElementById('ob-save').addEventListener('click', () => {
      const next = {
        marketingProject: document.getElementById('ob-marketing').value.trim(),
        taskName: document.getElementById('ob-task').value.trim(),
        taskNameAutoPrefix: document.getElementById('ob-task-prefix').value.trim() || '公众号-图片消息',
        promotedProduct: document.getElementById('ob-product').value.trim(),
        productIntro: document.getElementById('ob-intro').value.trim(),
        phone: document.getElementById('ob-phone').value.trim(),
        wechat: document.getElementById('ob-wechat').value.trim(),
        enabled: document.getElementById('ob-enabled').checked,
        autoOnLoad: document.getElementById('ob-autoload').checked,
      };
      if (!isFillConfigValid(next)) {
        log('请填写必填项（营销项目、推广产品、产品介绍、手机号；任务名或前缀至少一种）');
        return;
      }
      saveConfig(next);
      log('已保存');
      close();
    });
    document.getElementById('ob-fillnow').addEventListener('click', async () => {
      const next = {
        marketingProject: document.getElementById('ob-marketing').value.trim(),
        taskName: document.getElementById('ob-task').value.trim(),
        taskNameAutoPrefix: document.getElementById('ob-task-prefix').value.trim() || '公众号-图片消息',
        promotedProduct: document.getElementById('ob-product').value.trim(),
        productIntro: document.getElementById('ob-intro').value.trim(),
        phone: document.getElementById('ob-phone').value.trim(),
        wechat: document.getElementById('ob-wechat').value.trim(),
        enabled: true,
        autoOnLoad: document.getElementById('ob-autoload').checked,
      };
      if (!isFillConfigValid(next)) {
        log('立即填充：请先填好必填项');
        return;
      }
      await fillBasicFields(next);
    });
  }

  GM_registerMenuCommand('互选下单·基本信息填充设置', showConfigDialog);

  async function main() {
    const path = window.location.pathname || '';
    if (!/\/trade\/order_free_trade\/\d+\/create/.test(path)) return;

    const config = getConfig();
    if (!config.enabled) {
      log('已禁用');
      return;
    }

    if (!isFillConfigValid(config)) {
      log('配置未完成，请通过油猴菜单「互选下单·基本信息填充设置」填写');
      showConfigDialog();
      return;
    }

    if (config.autoOnLoad) {
      try {
        await fillBasicFields(config);
      } catch (e) {
        log('自动填充失败:', e?.message || e);
      }
    } else {
      log('已关闭「进入页面自动填充」，请用设置里的「仅本次：立即填充」');
    }
  }

  main();
})();
