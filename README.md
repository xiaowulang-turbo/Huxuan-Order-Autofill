# Huxuan Order Autofill

A Tampermonkey / Violentmonkey userscript that fills the **basic information** section on the Tencent Huxuan (互选) **free trade order creation** page: marketing project, task name, promoted product, description, phone, and optional WeChat.

## Target pages

- `https://huxuan.qq.com/trade/order_free_trade/*/create*`
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

## Caveats

The script relies on page structure and input placeholders. If Huxuan updates the UI, the selectors may need updating.

## License

Use at your own risk. Not affiliated with Tencent.
