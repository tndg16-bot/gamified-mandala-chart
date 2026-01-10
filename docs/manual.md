# Gamified Mandala Chart 取扱説明書

このアプリケーションは、マンダラチャートを用いた目標達成と、RPG要素（経験値・レベルアップ）を組み合わせたタスク管理ツールです。

---

## 🐯 主な機能と使い方

### 1. マンダラチャート (Mandala View)
目標を構造化して管理します。
- **中心 (Core Vision)**: 人生で達成したい最大のテーマ。
- **周辺 (Areas)**: それを構成する8つの要素（健康、仕事、趣味など）。
- **詳細 (Cells)**: さらに具体的なアクションプラン。
    - **操作**: セルをクリックすると、詳細画面（SubTask Modal）が開きます。
    - **AI Brainstorming**: 具体的なアクションが見つからない時、AIに3つのアイデアを提案してもらえます。

### 2. タスク管理 (SubTask)
- 各セルの中に、具体的なToDo（SubTask）を追加できます。
- **XP獲得**: タスクにチェックを入れると、XP（経験値）が入り、トラちゃんが成長します。

### 3. レッスン・教材学習 (Lessons)
- **Import**: 外部AIで作成したMarkdown教材を取り込みます。
- **学習**: 「Start」して学習を進め、「Complete」すると大量のXPを獲得できます。

### 4. AI Chat
- トラちゃん（AI）と会話して、日々の悩み相談や目標の壁打ちができます。

---

## 🔧 [開発者向け] Obsidian連携機能

この機能は、アプリ内のデータをローカルのObsidian Vaultと同期するための**上級者・開発者向け機能**です。
Vercel（Web版）ではなく、**ローカルPC上でサーバーを起動している時のみ**機能します。

### 🛠️ 仕組み
```mermaid
graph TD
    User[ユーザー] -->|操作| WebApp[Webアプリ (localhost:3000)]
    WebApp -->|保存| Firebase[(Firebase)]
    
    subgraph Local PC
        WebApp -.->|Export Pathへ書き出し| LocalFile[Markdownファイル]
        LocalFile -.->|同期| Obsidian[Obsidian Vault]
    end
    
    style WebApp fill:#f9f,stroke:#333,stroke-width:2px
    style Obsidian fill:#000,stroke:#fff,stroke-width:2px,color:#fff
```

### 🚀 手順

1. **アプリをローカルで起動する**
   ターミナルを開き、プロジェクトフォルダで以下を実行します。
   ```powershell
   npm run dev
   ```
   ブラウザで `http://localhost:3000` を開きます。

2. **エクスポートパスの設定**
   - 画面右上の **[⚙️]** アイコンをクリック。
   - **Export Path** を入力。
     - 例: `../Gamified-Mandala-Data` （推奨: プロジェクトと同階層に保存）
     - 例: `C:/Users/chatg/Obsidian Vault/papa/MandalaSync` （Obsidian直下）

3. **同期の実行**
   - **手動**: ヘッダーの **[📤 MD]** ボタンをクリック。
   - **自動**: 設定画面で **Auto Sync** をONにする（変更のたびに自動保存）。

---

## 🗺️ システム構成図 (Architecture)

現在のプロジェクトで使用しているツールとデータの流れです。

```mermaid
graph TB
    subgraph Frontend [Next.js App]
        UI[User Interface]
        Auth[Auth Context]
        Hooks[React Hooks]
        
        UI --> Auth
        UI --> Hooks
    end

    subgraph Backend Services
        FirebaseAuth[Firebase Auth]
        Firestore[Firestore DB]
        
        Auth --> FirebaseAuth
        Hooks --> Firestore
    end

    subgraph External AI
        Gemini[Gemini / ChatGPT] -->|Markdown生成| Import[Import Dialog]
        Import -->|Parse| UI
    end

    subgraph User Tools
        Obsidian[Obsidian]
        Cursor[Cursor / VSCode]
        Browser[Chrome / Edge]
    end

    UI -->|Local Sync (Dev Only)| Obsidian
    Cursor -->|Dev| Frontend
```

---

## 📝 運用フローの推奨例

1. **目標設定**: 外部AI（Gemini/ChatGPT）でマンダラチャートの中身を相談。
2. **教材作成**: AIに「〇〇を学ぶためのカリキュラムを作って」と依頼し、フォーマット通りに出力。
   - 参考: [教材インポートフォーマット](./lesson_import_format.md)
3. **インポート**: アプリのレッスン画面からインポート。
4. **日々の実行**: アプリでタスク消化＆XP稼ぎ。
5. **振り返り**: 時々Obsidian連携でログを吐き出し、日記に貼り付け。
