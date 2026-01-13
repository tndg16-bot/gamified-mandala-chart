# Gamified Mandala Chart - 目標設定アプリ

ゲーミフィケーションを取り入れた曼荼羅チャート形式の目標設定・達成管理アプリケーションです。

## 🚀 概要

Mandala Chart（曼荼羅チャート）の手法を活用して、中心目標から8つのサブ目標へ、さらにそれぞれのアクションへと目標を細分化し、ゲーム要素（XP、実績、レベル）を通じて継続的な目標達成をサポートします。

## ✨ 機能

### 📊 Mandala Chart
- 中心目標を8つのセクションに分解
- 各セクションをさらに8つのアクションに細分化
- 進捗の可視化とトラッキング

### 🎮 ゲーミフィケーション
- XP（経験値）システム
- レベルアップ機能
- 実績・バッジ解除
- 週間・月間統計

### ✅ タスク管理
- サブタスク機能
- Kanban形式の表示
- AI サジェスト機能

### 📔 ジャーナル
- 日々の振り返り記録
- 達成・課題・目標の記録
- 履歴閲覧

### 📚 レッスン機能
- カスタムレッスン作成
- レッスンインポート/エクスポート
- マーケットプレイス連携

### 👥 チーム機能
- チーム作成
- 共同目標管理

### 🔗 連携機能
- Obsidian同期
- Markdown/PDFエクスポート
- データインポート/エクスポート

### 🔔 通知機能
- リマインダー設定
- メール/プッシュ通知対応

## 🛠️ 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **UI**: React 19, Tailwind CSS v4, shadcn/ui
- **アニメーション**: Framer Motion
- **認証**: Firebase Authentication
- **データベース**: Firebase Firestore
- **決済**: Stripe
- **エクスポート**: html2canvas, jsPDF

## 📦 セットアップ

### 前提条件

- Node.js 20以上
- npm または yarn
- Firebase プロジェクト
- Stripe アカウント（決済機能を使用する場合）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/tndg16-bot/gamified-mandala-chart.git
cd gamified-mandala-chart

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

### 環境変数

`.env.local`ファイルを作成：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
STRIPE_SECRET_KEY=your_stripe_secret_key
```

開発サーバーは [http://localhost:3000](http://localhost:3000) で起動します。

## 📁 プロジェクト構成

```
gamified-mandala-chart/
├── src/
│   ├── app/               # Next.js App Router
│   │   └── page.tsx       # メインアプリケーション
│   ├── components/        # UIコンポーネント
│   │   └── ui/           # shadcn/uiコンポーネント
│   └── lib/              # ユーティリティ
├── public/               # 静的ファイル
├── docs/                 # ドキュメント
└── tests/                # テストファイル
```

## 🧪 テスト

```bash
# テストを実行
npm run test
```

## 📄 ライセンス

MIT

## 🤝 コントリビューション

プルリクエストを歓迎します！

## 📧 お問い合わせ

問題や質問がある場合は、GitHub Issuesをご利用ください。
