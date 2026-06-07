const mongoose = require('mongoose');

// MongoDB接続の設定
// 環境変数 MONGODB_URI があればそれを使用し、なければローカルのデフォルトに接続
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sleeptime';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDBに接続成功しました。'))
  .catch(err => {
    console.error('MongoDB接続エラー:', err);
    console.log('※デプロイ時には環境変数 MONGODB_URI を正しく設定してください。');
  });

// --- スキーマ定義 ---

// 1. ユーザー定義
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 2. 睡眠記録定義
const SleepRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sleepTime: {
    type: Date,
    required: true
  },
  wakeTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  memo: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

// モデルのコンパイル
const User = mongoose.model('User', UserSchema);
const SleepRecord = mongoose.model('SleepRecord', SleepRecordSchema);

// データベース操作関数（すべて非同期 async に変更）
const db = {
  // ユーザーの検索（メールアドレス）
  findUserByEmail: async (email) => {
    return await User.findOne({ email: email.toLowerCase() });
  },

  // ユーザーの新規作成
  createUser: async (userData) => {
    const newUser = new User({
      email: userData.email,
      password: userData.password
    });
    return await newUser.save();
  },

  // 特定ユーザーの睡眠レコード一覧取得（就寝日時の新しい順）
  getRecords: async (userId) => {
    return await SleepRecord.find({ userId })
      .sort({ sleepTime: -1 });
  },

  // 睡眠レコードの作成
  createRecord: async (userId, recordData) => {
    const newRecord = new SleepRecord({
      userId,
      sleepTime: recordData.sleepTime,
      wakeTime: recordData.wakeTime,
      duration: recordData.duration,
      memo: recordData.memo || ''
    });
    return await newRecord.save();
  },

  // 睡眠レコードの更新
  updateRecord: async (userId, recordId, recordData) => {
    // 該当ユーザーの該当レコードのみ更新
    const updated = await SleepRecord.findOneAndUpdate(
      { _id: recordId, userId },
      {
        sleepTime: recordData.sleepTime,
        wakeTime: recordData.wakeTime,
        duration: recordData.duration,
        memo: recordData.memo || '',
        updatedAt: new Date()
      },
      { new: true } // 更新後のデータを返す
    );
    return updated;
  },

  // 睡眠レコードの削除
  deleteRecord: async (userId, recordId) => {
    const deleted = await SleepRecord.findOneAndDelete({ _id: recordId, userId });
    return !!deleted; // 削除できたら true、見つからなければ false
  }
};

module.exports = db;
