# すいみんきろく デプロイ手順書 (Render & MongoDB Atlas)

本アプリケーションを完全無料でインターネット上に公開（デプロイ）し、データを永続化するための詳細な手順書です。
以下のステップに沿って設定を行ってください。

---

## 全体概要
1. **GitHub** にコードをプッシュする
2. **MongoDB Atlas**（無料データベース）をセットアップして「接続文字列 (URI)」を取得する
3. **Render.com**（無料Webサービス）にリポジトリを連携し、環境変数を設定して公開する

---

## ステップ 1: GitHub へコードをプッシュする

Render.com は GitHub リポジトリと連携して自動デプロイを行います。

1. **GitHub アカウント**が無い場合は作成します：[https://github.com/](https://github.com/)
2. GitHub 上で新しいプライベート（またはパブリック）リポジトリを作成します。
3. ローカルのプロジェクトディレクトリで以下の Git コマンドを実行し、コードをプッシュします：
   ```bash
   git init
   git add .
   git commit -m "Initial commit for deployment"
   git branch -M main
   git remote add origin <作成したリポジトリのURL>
   git push -u origin main
   ```

---

## ステップ 2: MongoDB Atlas (無料データベース) のセットアップ

睡眠データとユーザーデータを安全に永久保存するためのクラウドデータベースを構築します。

1. **MongoDB Atlas** にアクセスし、無料登録します：[https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. サインイン後、**「Deploy a database」**（データベースのデプロイ）画面で **「M0 (Free)」**（無料プラン）を選択します。
3. **Provider** に「AWS」または「Google Cloud」を、**Region** はお近くの場所（「Tokyo (ap-northeast-1)」など）を選択し、**「Create」** をクリックします。
4. **Security Quickstart**（セキュリティ設定）画面が表示されます：
   - **Username** と **Password** を設定し、**「Create User」** をクリックしてデータベースユーザーを作成します。
     *(※このパスワードは後で接続文字列に使用します。忘れないようにメモしてください。)*
   - **IP Access List** で、一時的に `0.0.0.0/0`（すべてのIPからのアクセスを許可）を追加します。Render.com のサーバーのIPアドレスは変動するため、すべてのアクセスを許可する必要があります。
   - 設定が終わったら **「Finish and Close」** をクリックします。
5. ダッシュボード画面（Database Deployments）で、作成したクラスターの横にある **「Connect」**（接続）ボタンをクリックします。
6. 接続方法の選択で **「Drivers」** をクリックします。
7. 表示された **「Connection String」**（接続文字列）をコピーします。
   - 文字列の形式例：
     `mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`
   - `<password>` の部分を、手順4で設定したデータベースユーザーの実際のパスワードに置き換えます。これが環境変数 `MONGODB_URI` の値となります。

---

## ステップ 3: Render.com へのデプロイ

Node.jsサーバーを無料で公開し、データベースと紐づけます。

1. **Render.com** にアクセスし、GitHub アカウントを使用してサインインします：[https://render.com/](https://render.com/)
2. ダッシュボードで **「New +」** ボタンをクリックし、**「Web Service」** を選択します。
3. **「Build and deploy from a Git repository」** を選択し、先ほど GitHub にプッシュしたリポジトリを選択して **「Connect」** をクリックします。
4. Web Service の設定項目を入力します：
   - **Name**: `suimin-kiroku`（任意のサイト名）
   - **Region**: 「Singapore (Southeast Asia)」または「Oregon (US West)」など
   - **Branch**: `main`
   - **Root Directory**: （空欄のままでOK）
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: **「Free」**（無料プラン）を選択
5. ページ下部の **「Advanced」** をクリックし、**「Environment Variables」**（環境変数）を追加します。以下の2つのキーを設定します：
   - **キー 1**: 
     - **Key**: `MONGODB_URI`
     - **Value**: *(ステップ2の最後でコピーし、パスワードを書き換えたMongoDB接続文字列)*
   - **キー 2**:
     - **Key**: `JWT_SECRET`
     - **Value**: *(ランダムで強力な文字列。例: `my-super-secret-jwt-key-998877`)*
6. 最下部の **「Create Web Service」** をクリックします。

---

## デプロイ完了と確認
- デプロイのログが動き出します。3分〜5分程度でログの最後に `Server is running...` と `MongoDBに接続成功しました。` が表示されれば成功です。
- 画面左上に表示されている URL（例: `https://suimin-kiroku.onrender.com`）にアクセスすれば、全世界から「すいみんきろく」が利用可能になります！
- 同じメールアドレスでログインすれば、スマートフォンや他のPCからでも睡眠データを同期して管理できます。

---

## 💡 トラブルシューティング
- **「MongoDB接続エラー」が表示される場合**: MongoDB Atlas の IP Access List で `0.0.0.0/0` (すべてのIPを許可) が追加されているか、および環境変数 `MONGODB_URI` のパスワード部分が正しいか再確認してください。
- **Renderの無料枠制限**: 無料プランのサーバーは、しばらくアクセスがないと自動的にスリープ状態になります。スリープ後の初回アクセス時は、サーバーが起動するまで30秒〜1分ほど読み込みに時間がかかりますが、これは無料プランの仕様です（起動後はサクサク動きます）。
