# 📸 証明写真ジェネレーター

ペットや推しの証明写真風画像をかんたん作成！

**🌐 公開URL: https://uchinoko-id.morilab-garage.com/**

## 機能

- 7枚の画像をアップロード（お手本1枚＋証明写真6枚）
- ブラウザ内で背景を自動除去（@imgly/background-removal）
- 画像の位置・スケールをドラッグ＆スライダーで調整
- 背景色・レイアウト・枠線のカスタマイズ
- 高解像度PNG画像のダウンロード
- Twitter/Xシェア機能

## デプロイ（Cloudflare Pages）

### 方法1: ダイレクトアップロード
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. Workers & Pages → Create → Pages → Upload assets
3. `index.html` と `_headers` をアップロード
4. デプロイ！

### 方法2: Git連携
1. このリポジトリをGitHubにプッシュ
2. Cloudflare PagesでGitリポジトリを接続
3. ビルド設定:
   - **Build command:** (空欄)
   - **Build output directory:** `/`
4. デプロイ！

## 重要: `_headers` ファイル

背景除去機能には `SharedArrayBuffer` が必要です。
`_headers` ファイルで以下のヘッダーを設定しています:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## ローカル開発

```bash
npx serve . -p 3000
```

> ⚠️ ローカルでは背景除去がCOOP/COEPヘッダー不足で動作しない場合があります。
> その場合はChrome起動オプション `--enable-features=SharedArrayBuffer` を使用してください。

## 技術スタック

- Vanilla HTML/CSS/JS（フレームワーク不使用）
- @imgly/background-removal（CDN経由、ブラウザ内推論）
- Canvas API（画像合成）
- Cloudflare Pages（ホスティング）
- Google Fonts（Zen Maru Gothic, M PLUS Rounded 1c）

## ライセンス

### AGPL-3.0

このプロジェクトは **GNU Affero General Public License v3.0** (AGPL-3.0) の下でライセンスされています。

本プロジェクトは以下のAGPL-3.0ライセンスのライブラリを使用しているため、
AGPL-3.0のコピレフト条項（伝播性）により、プロジェクト全体がAGPL-3.0でライセンスされます。

### 使用しているオープンソースライブラリ

| ライブラリ | ライセンス | 用途 |
|---|---|---|
| [@imgly/background-removal](https://github.com/imgly/background-removal-js) | AGPL-3.0 | ブラウザ内背景除去 |
| [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | SIL OFL 1.1 | フォント |
| [M PLUS Rounded 1c](https://fonts.google.com/specimen/M+PLUS+Rounded+1c) | SIL OFL 1.1 | フォント |

### AGPL-3.0 に関する注意

AGPL-3.0では、このソフトウェアをネットワーク越しに提供する場合、
利用者がソースコード全体にアクセスできるようにする義務があります。

- ソースコード公開: 本リポジトリで全ソースコードを公開しています
- 改変した場合: 改変後のソースコードもAGPL-3.0で公開する必要があります
- 商用利用: AGPL-3.0は商用利用を許可していますが、上記の義務は適用されます
- 別ライセンスでの利用: IMG.LY社に直接お問い合わせください（support@img.ly）

ライセンス全文: https://www.gnu.org/licenses/agpl-3.0.html
