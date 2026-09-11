# QR班チェック 簡易Web版

修学旅行・校外学習向けの簡易QR班チェックWebアプリです。

## 使い方

1. HTTPSで配信するか、localhostで開いてください（カメラ利用条件のため）。
2. 「今回のチェックを開始」を押します。
3. 班QRを読み取ります。対応形式: `A-1`〜`N-8` / `1-1`〜`10-8`
4. 同じ班を再度読むと「チェック済みです」と表示します。
5. 記録はブラウザの `localStorage` に保存されます。

## 構成

- `index.html`
- `style.css`
- `app.js`

## 外部依存

- `html5-qrcode`（CDN読み込み）

Pages deployment trigger.
