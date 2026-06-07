/**
 * SleepyMagenta - Frontend Logic (app.js)
 * すべてのコメントは日本語で記述しています。
 */

// --- 状態管理 ---
let currentUser = null;
let currentToken = null;
let sleepRecords = [];

// APIエンドポイント設定（同じホスト名を使用するため相対パス）
const API_URL = '';

// --- ページ読み込み時の初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  // 保存された認証トークンの確認
  const savedToken = localStorage.getItem('token');
  const savedEmail = localStorage.getItem('email');

  if (savedToken && savedEmail) {
    currentToken = savedToken;
    currentUser = savedEmail;
    showAppSection();
  } else {
    showAuthSection();
    // ログインフォームにフォーカス
    document.getElementById('login-email').focus();
  }

  // フォーム初期日付設定 (今日の日付)
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sleep-date').value = today;
  document.getElementById('wake-date').value = today;

  // 時間ドロップダウンの初期化とデフォルト設定 (就寝 23:00 / 起床 07:00)
  populateTimeDropdowns('sleep-hour', 'sleep-minute', '23', '00');
  populateTimeDropdowns('wake-hour', 'wake-minute', '07', '00');
  populateTimeDropdowns('edit-sleep-hour', 'edit-sleep-minute', '23', '00');
  populateTimeDropdowns('edit-wake-hour', 'edit-wake-minute', '07', '00');

  // 初回時間計算プレビュー実行
  updateAddPreview();

  // --- イベントリスナーの登録 ---
  
  // リアルタイム睡眠時間計算プレビュー (追加フォーム)
  const inputs = ['sleep-date', 'sleep-hour', 'sleep-minute', 'wake-date', 'wake-hour', 'wake-minute'];
  inputs.forEach(id => {
    document.getElementById(id).addEventListener('change', updateAddPreview);
    document.getElementById(id).addEventListener('input', updateAddPreview);
  });

  // リアルタイム睡眠時間計算プレビュー (編集フォーム)
  const editInputs = ['edit-sleep-date', 'edit-sleep-hour', 'edit-sleep-minute', 'edit-wake-date', 'edit-wake-hour', 'edit-wake-minute'];
  editInputs.forEach(id => {
    document.getElementById(id).addEventListener('change', updateEditPreview);
    document.getElementById(id).addEventListener('input', updateEditPreview);
  });

  // 認証フォームサブミット
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);

  // 睡眠記録追加フォームサブミット
  document.getElementById('record-form').addEventListener('submit', handleAddRecord);

  // 睡眠記録編集フォームサブミット
  document.getElementById('edit-form').addEventListener('submit', handleUpdateRecord);
});

// --- 認証状態切り替え & UI制御 ---

// ログインと新規登録のタブ切り替え
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');

  if (tab === 'login') {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    document.getElementById('login-email').focus();
  } else {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    document.getElementById('register-email').focus();
  }
}

// 認証エリアを表示
function showAuthSection() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
}

// アプリケーション（ダッシュボード）エリアを表示
function showAppSection() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
  document.getElementById('user-display-email').textContent = currentUser;
  
  // 睡眠データの読み込み
  loadRecords();
}

// --- トースト通知システム ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  
  const icon = type === 'error' 
    ? '<i class="fa-solid fa-circle-exclamation"></i>' 
    : '<i class="fa-solid fa-circle-check"></i>';
    
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  // 3秒後にフェードアウト＆削除
  setTimeout(() => {
    toast.classList.add('toast-leave');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// --- 睡眠時間計算ロジック (5分単位) ---

/**
 * 就寝と起床の日時から睡眠時間を計算し、プレビューを更新する
 */
// 追加フォーム用プレビュー更新ラッパー
function updateAddPreview() {
  return updateCalcPreview(
    'sleep-date', 'sleep-hour', 'sleep-minute',
    'wake-date', 'wake-hour', 'wake-minute',
    'preview-hours', 'preview-minutes', 'calc-preview'
  );
}

// 編集フォーム用プレビュー更新ラッパー
function updateEditPreview() {
  return updateCalcPreview(
    'edit-sleep-date', 'edit-sleep-hour', 'edit-sleep-minute',
    'edit-wake-date', 'edit-wake-hour', 'edit-wake-minute',
    'edit-preview-hours', 'edit-preview-minutes', 'edit-calc-preview'
  );
}

/**
 * 就寝と起床の日時から睡眠時間を計算し、プレビューを更新する
 */
function updateCalcPreview(sleepDateId, sleepHourId, sleepMinId, wakeDateId, wakeHourId, wakeMinId, hoursSpanId, minsSpanId, previewBoxId) {
  const sDate = document.getElementById(sleepDateId).value;
  const sHour = document.getElementById(sleepHourId).value;
  const sMin = document.getElementById(sleepMinId).value;
  const wDate = document.getElementById(wakeDateId).value;
  const wHour = document.getElementById(wakeHourId).value;
  const wMin = document.getElementById(wakeMinId).value;

  const hoursSpan = document.getElementById(hoursSpanId);
  const minsSpan = document.getElementById(minsSpanId);
  const previewBox = document.getElementById(previewBoxId);

  if (!sDate || !sHour || !sMin || !wDate || !wHour || !wMin) {
    hoursSpan.textContent = '0';
    minsSpan.textContent = '0';
    return 0;
  }

  // Dateオブジェクトの作成
  const sleepDateTime = new Date(`${sDate}T${sHour}:${sMin}`);
  const wakeDateTime = new Date(`${wDate}T${wHour}:${wMin}`);

  // 起床が就寝より前である場合
  if (wakeDateTime <= sleepDateTime) {
    hoursSpan.textContent = '0';
    minsSpan.textContent = '0';
    previewBox.style.border = '2px dashed #ff334b';
    previewBox.style.backgroundColor = '#ffeef0';
    return 0;
  }

  previewBox.style.border = '2px dashed rgba(255, 0, 123, 0.2)';
  previewBox.style.backgroundColor = 'var(--primary-light)';

  // 差分ミリ秒の取得
  const diffMs = wakeDateTime - sleepDateTime;
  const diffMins = Math.round(diffMs / 1000 / 60);

  // 5分単位のバリデーション・丸め
  const roundedMins = Math.round(diffMins / 5) * 5;

  const hours = Math.floor(roundedMins / 60);
  const minutes = roundedMins % 60;

  // 数値が変化した時のみアニメーションを実行
  const prevHours = parseInt(hoursSpan.textContent);
  const prevMinutes = parseInt(minsSpan.textContent);

  if (prevHours !== hours || prevMinutes !== minutes) {
    hoursSpan.textContent = hours;
    minsSpan.textContent = minutes;
    
    // アニメーション適用（トリガー）
    hoursSpan.classList.remove('pop-animation');
    minsSpan.classList.remove('pop-animation');
    void hoursSpan.offsetWidth; // リフローを起こして再適用
    hoursSpan.classList.add('pop-animation');
    minsSpan.classList.add('pop-animation');
  }

  // 時間単位の実数として返す（例: 7時間30分 -> 7.5）
  return parseFloat((roundedMins / 60).toFixed(2));
}

// --- 認証機能API連携 ---

// ログインの実行
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'ログインに失敗しました');
    }

    // 認証情報の保存
    currentToken = data.token;
    currentUser = data.email;
    localStorage.setItem('token', currentToken);
    localStorage.setItem('email', currentUser);

    showToast('ログインしました！');
    showAppSection();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 新規登録の実行
async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '新規登録に失敗しました');
    }

    // 認証情報の保存
    currentToken = data.token;
    currentUser = data.email;
    localStorage.setItem('token', currentToken);
    localStorage.setItem('email', currentUser);

    showToast('アカウントを作成し、ログインしました！');
    showAppSection();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ログアウト処理
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  currentUser = null;
  currentToken = null;
  sleepRecords = [];
  
  showToast('ログアウトしました');
  showAuthSection();
}

// --- 睡眠データAPI連携 (CRUD) ---

// データの読み込み
async function loadRecords() {
  const syncIcon = document.getElementById('sync-icon');
  const loadingIndicator = document.getElementById('loading-indicator');
  const emptyState = document.getElementById('empty-state');
  const listElement = document.getElementById('records-list');

  syncIcon.classList.add('spin-animation');
  loadingIndicator.classList.remove('hidden');
  emptyState.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/api/sleep`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    if (res.status === 401 || res.status === 403) {
      // トークンエラー時はログアウト
      handleLogout();
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'データの読み込みに失敗しました');

    sleepRecords = data;
    renderRecordsList();
    updateDashboardStats();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    syncIcon.classList.remove('spin-animation');
    loadingIndicator.classList.add('hidden');
  }
}

// 履歴リストのレンダリング
function renderRecordsList() {
  const listElement = document.getElementById('records-list');
  const emptyState = document.getElementById('empty-state');
  
  listElement.innerHTML = '';

  if (sleepRecords.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  sleepRecords.forEach((record, index) => {
    const card = document.createElement('div');
    card.className = 'record-card';
    // 新しくロードしたカードに遅延フェードインアニメーションを付与
    card.style.animation = `cardBounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 0.05}s both`;
    
    // 表示形式の整形
    const sDateTime = new Date(record.sleepTime);
    const wDateTime = new Date(record.wakeTime);
    
    const dateStr = `${sDateTime.getFullYear()}/${sDateTime.getMonth() + 1}/${sDateTime.getDate()}`;
    const sTimeStr = sDateTime.toTimeString().slice(0, 5);
    const wTimeStr = wDateTime.toTimeString().slice(0, 5);
    
    // 睡眠時間を「X時間Y分」にパース
    const totalMinutes = Math.round(record.duration * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const durationText = `${hours}時間${minutes}分`;

    card.innerHTML = `
      <div class="record-info">
        <div class="record-time-meta">
          <span class="record-date-badge">${dateStr}</span>
          <span class="record-hours-badge">${durationText}</span>
        </div>
        <div class="record-time-details">
          <span>${sTimeStr}</span> 就寝 <i class="fa-solid fa-arrow-right-long"></i> <span>${wTimeStr}</span> 起床
        </div>
        ${record.memo ? `<div class="record-memo"><i class="fa-regular fa-comment-dots"></i> ${escapeHTML(record.memo)}</div>` : ''}
      </div>
      <div class="record-actions">
        <button onclick="openEditModal('${record.id}')" class="action-btn action-btn-edit" title="編集">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button onclick="handleDeleteRecord('${record.id}', this)" class="action-btn action-btn-delete" title="削除">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    listElement.appendChild(card);
  });
}

// 統計情報の更新
function updateDashboardStats() {
  const avgElement = document.getElementById('stat-avg-duration');
  const totalElement = document.getElementById('stat-total-records');

  if (sleepRecords.length === 0) {
    avgElement.innerHTML = `0.0<small>時間</small>`;
    totalElement.innerHTML = `0<small>回</small>`;
    return;
  }

  const totalDuration = sleepRecords.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = (totalDuration / sleepRecords.length).toFixed(1);

  // カウントアップ風アニメーション効果を演出
  animateValue(avgElement, 0, parseFloat(avgDuration), 800, '時間');
  animateValue(totalElement, 0, sleepRecords.length, 800, '回');
}

// 数値のカウントアップ演出
function animateValue(element, start, end, duration, unit) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const currentValue = (progress * (end - start) + start);
    
    // 小数点第1位まで表示するかどうか
    const displayValue = Number.isInteger(end) 
      ? Math.floor(currentValue) 
      : currentValue.toFixed(1);
      
    element.innerHTML = `${displayValue}<small>${unit}</small>`;
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// レコードの追加処理
async function handleAddRecord(e) {
  e.preventDefault();

  const sDate = document.getElementById('sleep-date').value;
  const sHour = document.getElementById('sleep-hour').value;
  const sMin = document.getElementById('sleep-minute').value;
  const wDate = document.getElementById('wake-date').value;
  const wHour = document.getElementById('wake-hour').value;
  const wMin = document.getElementById('wake-minute').value;
  const memo = document.getElementById('record-memo').value;

  const sleepTime = `${sDate}T${sHour}:${sMin}`;
  const wakeTime = `${wDate}T${wHour}:${wMin}`;

  // 事前検証
  if (new Date(wakeTime) <= new Date(sleepTime)) {
    showToast('起床時間は就寝時間より後の時間を設定してください', 'error');
    return;
  }

  // 睡眠時間の算出
  const duration = updateAddPreview();

  try {
    const btn = document.getElementById('submit-record-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>保存中...</span>`;

    const res = await fetch(`${API_URL}/api/sleep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ sleepTime, wakeTime, duration, memo })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '記録の追加に失敗しました');

    showToast('睡眠記録を追加しました！');
    
    // フォームリセット（日付は維持、メモのみクリア）
    document.getElementById('record-memo').value = '';
    
    // リロード
    loadRecords();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    const btn = document.getElementById('submit-record-btn');
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-plus"></i> <span>記録を追加する</span>`;
  }
}

// レコードの削除処理
async function handleDeleteRecord(recordId, buttonElement) {
  if (!confirm('この睡眠記録を削除しますか？')) return;

  // 削除ボタンの親要素(record-card)を取得
  const cardElement = buttonElement.closest('.record-card');

  try {
    const res = await fetch(`${API_URL}/api/sleep/${recordId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '記録の削除に失敗しました');

    showToast('記録を削除しました');

    // 削除時のスライドアウトアニメーション適用
    cardElement.classList.add('card-remove-animation');
    
    // アニメーション完了後にDOMから削除し、メモリと統計を更新
    cardElement.addEventListener('animationend', () => {
      cardElement.remove();
      sleepRecords = sleepRecords.filter(r => r.id !== recordId);
      updateDashboardStats();
      if (sleepRecords.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// --- 編集モーダルの制御 ---

// モーダルを開く
function openEditModal(recordId) {
  const record = sleepRecords.find(r => r.id === recordId);
  if (!record) return;

  // フォームにデータを投入
  document.getElementById('edit-record-id').value = record.id;
  
  const sDateTime = new Date(record.sleepTime);
  const wDateTime = new Date(record.wakeTime);
  
  document.getElementById('edit-sleep-date').value = sDateTime.toISOString().split('T')[0];
  
  const sHour = sDateTime.getHours().toString().padStart(2, '0');
  const sMin = (Math.round(sDateTime.getMinutes() / 5) * 5).toString().padStart(2, '0');
  const displaySMin = sMin === '60' ? '55' : sMin; // 万が一の丸め誤差防止
  document.getElementById('edit-sleep-hour').value = sHour;
  document.getElementById('edit-sleep-minute').value = displaySMin;
  
  document.getElementById('edit-wake-date').value = wDateTime.toISOString().split('T')[0];
  
  const wHour = wDateTime.getHours().toString().padStart(2, '0');
  const wMin = (Math.round(wDateTime.getMinutes() / 5) * 5).toString().padStart(2, '0');
  const displayWMin = wMin === '60' ? '55' : wMin;
  document.getElementById('edit-wake-hour').value = wHour;
  document.getElementById('edit-wake-minute').value = displayWMin;
  
  document.getElementById('edit-record-memo').value = record.memo || '';

  // プレビュー計算の初期化
  updateEditPreview();

  // モーダル表示
  document.getElementById('edit-modal').classList.remove('hidden');
}

// モーダルを閉じる
function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

// レコードの更新実行
async function handleUpdateRecord(e) {
  e.preventDefault();

  const recordId = document.getElementById('edit-record-id').value;
  const sDate = document.getElementById('edit-sleep-date').value;
  const sHour = document.getElementById('edit-sleep-hour').value;
  const sMin = document.getElementById('edit-sleep-minute').value;
  const wDate = document.getElementById('edit-wake-date').value;
  const wHour = document.getElementById('edit-wake-hour').value;
  const wMin = document.getElementById('edit-wake-minute').value;
  const memo = document.getElementById('edit-record-memo').value;

  const sleepTime = `${sDate}T${sHour}:${sMin}`;
  const wakeTime = `${wDate}T${wHour}:${wMin}`;

  // 事前検証
  if (new Date(wakeTime) <= new Date(sleepTime)) {
    showToast('起床時間は就寝時間より後の時間を設定してください', 'error');
    return;
  }

  // 睡眠時間の算出
  const duration = updateEditPreview();

  try {
    const res = await fetch(`${API_URL}/api/sleep/${recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ sleepTime, wakeTime, duration, memo })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '記録の更新に失敗しました');

    showToast('睡眠記録を更新しました！');
    closeEditModal();
    
    // リロード
    loadRecords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 時・分セレクトボックスのオプション生成ヘルパー
function populateTimeDropdowns(hourId, minuteId, defaultHour, defaultMinute) {
  const hourSelect = document.getElementById(hourId);
  const minuteSelect = document.getElementById(minuteId);
  if (!hourSelect || !minuteSelect) return;

  // 時のoption生成 (00-23)
  hourSelect.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const val = i.toString().padStart(2, '0');
    const opt = new Option(val, val);
    if (val === defaultHour) opt.selected = true;
    hourSelect.add(opt);
  }

  // 分のoption生成 (00, 05, 10, ..., 55)
  minuteSelect.innerHTML = '';
  for (let i = 0; i < 60; i += 5) {
    const val = i.toString().padStart(2, '0');
    const opt = new Option(val, val);
    if (val === defaultMinute) opt.selected = true;
    minuteSelect.add(opt);
  }
}

// --- ユーティリティ関数 ---
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
