const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sleep-tracker-secret-key-12345';

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT認証用ミドルウェア
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '認証トークンが必要です' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '有効期限切れまたは不正なトークンです' });
    }
    req.user = user;
    next();
  });
};

// --- 認証API ---

// 1. 新規登録
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
  }

  try {
    // 既存ユーザーチェック
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザー作成
    const newUser = await db.createUser({
      email,
      password: hashedPassword
    });

    // トークン生成
    const token = jwt.sign({ userId: newUser.id || newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: '登録が完了しました',
      token,
      email: newUser.email
    });
  } catch (error) {
    console.error('登録エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 2. ログイン
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
  }

  try {
    // ユーザー検索
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // パスワードの検証
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // トークン生成
    const token = jwt.sign({ userId: user.id || user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'ログインしました',
      token,
      email: user.email
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// --- 睡眠データAPI（認証必須） ---

// 1. 記録一覧の取得
app.get('/api/sleep', authenticateToken, async (req, res) => {
  try {
    const records = await db.getRecords(req.user.userId);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'データの取得に失敗しました' });
  }
});

// 2. 新規記録の追加
app.post('/api/sleep', authenticateToken, async (req, res) => {
  const { sleepTime, wakeTime, duration, memo } = req.body;

  if (!sleepTime || !wakeTime || duration === undefined) {
    return res.status(400).json({ error: '就寝時間、起床時間、および睡眠時間は必須です' });
  }

  try {
    const newRecord = await db.createRecord(req.user.userId, {
      sleepTime,
      wakeTime,
      duration,
      memo
    });
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ error: 'データの保存に失敗しました' });
  }
});

// 3. 記録の更新
app.put('/api/sleep/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { sleepTime, wakeTime, duration, memo } = req.body;

  if (!sleepTime || !wakeTime || duration === undefined) {
    return res.status(400).json({ error: '就寝時間、起床時間、および睡眠時間は必須です' });
  }

  try {
    const updatedRecord = await db.updateRecord(req.user.userId, id, {
      sleepTime,
      wakeTime,
      duration,
      memo
    });

    if (!updatedRecord) {
      return res.status(404).json({ error: '該当する記録が見つからないか、編集権限がありません' });
    }

    res.json(updatedRecord);
  } catch (error) {
    res.status(500).json({ error: 'データの更新に失敗しました' });
  }
});

// 4. 記録の削除
app.delete('/api/sleep/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const success = await db.deleteRecord(req.user.userId, id);

    if (!success) {
      return res.status(404).json({ error: '該当する記録が見つからないか、削除権限がありません' });
    }

    res.json({ message: '記録を削除しました' });
  } catch (error) {
    res.status(500).json({ error: 'データの削除に失敗しました' });
  }
});

// SPA対応：すべての未知のルートをフロントエンドの index.html へ案内
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`To access from other devices in the same network, use http://<your-ip-address>:${PORT}`);
});
