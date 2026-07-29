# Huxuan Order Autofill

A Tampermonkey / Violentmonkey userscript that fills the **basic information** section on the Tencent Huxuan (互选) **free trade order creation** page: marketing project, task name, promoted product, description, phone, and optional WeChat.

## Target pages

- `https://huxuan.qq.com/trade/order_free_trade/*/create*` — 下单创建页
- `https://huxuan.qq.com/trade/recruitment/*/create*` — 招募创建页（含 `?type=finder` 视频号招募）
- `https://huxuan.qq.com/trade/joint/*/create*` — 联投创建页（含 `?type=finder` 视频号联投）
- `https://huxuan.qq.com/trade/selection/*/selection_list*` — 选号列表页
- Same path on `test-huxuan.qq.com` and `pre-huxuan.qq.com`

## Requirements

- A userscript manager with **Greasemonkey-compatible** APIs: `GM_getValue`, `GM_setValue`, `GM_registerMenuCommand`, `GM_addStyle`.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or similar).
2. Create a new script and paste the contents of [`huxuan-order-basic-autofill.user.js`](./huxuan-order-basic-autofill.user.js), or open the raw file from your fork and let the manager install it.

## First run

1. Open an order **create** URL (see above).
2. Use the userscript menu: **「互选下单·基本信息填充设置」** to open settings.
3. Fill required fields and save. With **auto-fill on load** enabled, the form will fill once when the page loads.

## Required configuration

- Marketing project (must match dropdown search text or ID)
- Promoted product
- Product introduction
- Business contact phone  
- Either a fixed task name **or** an auto-prefix for timestamped task names

WeChat is optional.

## 联合创建页（/trade/joint/.../create）特殊说明

联合页面与普通招募页的区别：
- 无「营销项目」下拉与「集团名称」
- 无「推广场景」卡片选择（页面默认展开）
- 使用 **CPO 单价**（而非 CPM）
- 「标题文案要求」「#话题」「@视频号」「其他要求」需先勾选对应 checkbox 才会渲染输入框（脚本会自动处理）

## 图文模式（trade_mode=4）特殊说明

图文模式下，下单创建页会额外出现：
- **品牌名称**（输入框，placeholder「请输入品牌名称」，≤10字）— 通过设置中的「品牌名称（选填，图文模式下出现，≤10字）」配置
- **品牌形象**（800×800 / ≤80KB 的 PNG/JPEG/GIF）— **默认自动填充** 800×800 蓝色纯色 JPEG 占位图；如需关闭，进入设置取消勾选「自动填充品牌形象占位图」即可
- **任务图标**（800×800 JPEG）— 默认关闭，需在设置中手动勾选「自动填充任务图标占位图」才生效

容器就近选择 file input：任务图标 / 品牌形象各自独立容器，不再共用页面级第一个 `input[type=file]`，避免互相覆盖。

## Caveats

The script relies on page structure and input placeholders. If Huxuan updates the UI, the selectors may need updating.

## License

Use at your own risk. Not affiliated with Tencent.
