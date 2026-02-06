// 就労選択支援サービス - アセスメントアプリケーション
// メインJavaScriptファイル

// ===== LocalStorage管理（利用者単位） =====
/**
 * 利用者単位のLocalStorageキーを取得
 */
function getStorageKey(userName) {
    if (!userName || userName.trim() === '') {
        return null;
    }
    // 安全なキー名に変換（特殊文字を除去）
    const safeUserName = userName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    return `assessments_${safeUserName}`;
}

/**
 * 現在の利用者名を取得
 */
function getCurrentUserName() {
    return document.getElementById('userName')?.value?.trim() || '';
}

/**
 * 利用者の評価履歴を取得
 */
function getUserAssessments(userName) {
    const key = getStorageKey(userName);
    if (!key) return [];
    
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('評価履歴の読み込みエラー:', e);
        return [];
    }
}

/**
 * 利用者の評価履歴を保存
 */
function saveUserAssessments(userName, assessments) {
    const key = getStorageKey(userName);
    if (!key) return false;
    
    try {
        localStorage.setItem(key, JSON.stringify(assessments));
        return true;
    } catch (e) {
        console.error('評価履歴の保存エラー:', e);
        alert('保存に失敗しました。ブラウザのストレージ容量を確認してください。');
        return false;
    }
}

// グローバル変数
let assessmentItems = [];
let currentAssessment = {
    basicInfo: {},
    scores: {},
    memos: {}
};
let currentLoadedAssessmentId = null; // 現在読み込んでいる評価ID

// 評価項目のデフォルトデータ
const defaultItems = [
    // 就労意欲・意欲
    { category: "就労意欲・意欲", name: "就労意欲", description: "働きたいという意欲や動機の強さ" },
    { category: "就労意欲・意欲", name: "学習意欲", description: "新しいスキルや知識を学ぶ意欲" },
    { category: "就労意欲・意欲", name: "目標設定", description: "明確な就労目標を持っているか" },
    
    // 就労能力・技能
    { category: "就労能力・技能", name: "作業遂行能力", description: "指示された作業を完遂できる能力" },
    { category: "就労能力・技能", name: "作業速度", description: "作業を効率的に行う能力" },
    { category: "就労能力・技能", name: "正確性", description: "作業を正確に行う能力" },
    { category: "就労能力・技能", name: "持続力", description: "長時間作業を継続できる能力" },
    
    // 対人関係・コミュニケーション
    { category: "対人関係・コミュニケーション", name: "コミュニケーション能力", description: "他者と円滑にコミュニケーションを取る能力" },
    { category: "対人関係・コミュニケーション", name: "協調性", description: "チームで協力して作業する能力" },
    { category: "対人関係・コミュニケーション", name: "報告・連絡・相談", description: "適切に報告・連絡・相談ができるか" },
    
    // 身体面・健康
    { category: "身体面・健康", name: "体力", description: "身体的な作業に耐えられる体力" },
    { category: "身体面・健康", name: "健康管理", description: "自己の健康状態を管理する能力" },
    { category: "身体面・健康", name: "通勤能力", description: "職場まで安定して通勤できる能力" },
    
    // 環境的要因
    { category: "環境的要因", name: "家族の理解", description: "家族からの就労への理解と支援" },
    { category: "環境的要因", name: "生活リズム", description: "規則正しい生活リズムの確立" },
    
    // 自己理解・自己管理
    { category: "自己理解・自己管理", name: "自己理解", description: "自分の強みや課題を理解しているか" },
    { category: "自己理解・自己管理", name: "ストレス管理", description: "ストレスに適切に対処できる能力" },
    { category: "自己理解・自己管理", name: "感情コントロール", description: "感情を適切にコントロールできる能力" },
    
    // 職業知識・準備
    { category: "職業知識・準備", name: "職業理解", description: "希望する職業についての理解度" },
    { category: "職業知識・準備", name: "ビジネスマナー", description: "基本的なビジネスマナーの習得度" },
    
    // 適応性・柔軟性
    { category: "適応性・柔軟性", name: "環境適応力", description: "新しい環境に適応する能力" },
    { category: "適応性・柔軟性", name: "変化への対応", description: "予期せぬ変化に柔軟に対応できるか" }
];

// 評価基準データ
const scoreCriteria = {
    1: {
        label: "非常に困難",
        description: "かなりの支援が必要で、単独での実施が困難",
        color: "#dc3545"
    },
    2: {
        label: "支援が必要",
        description: "継続的な支援があれば実施可能",
        color: "#fd7e14"
    },
    3: {
        label: "普通",
        description: "時々支援が必要だが、概ね自立して実施可能",
        color: "#ffc107"
    },
    4: {
        label: "良好",
        description: "ほとんど支援なく自立して実施可能",
        color: "#20c997"
    },
    5: {
        label: "非常に良好",
        description: "完全に自立して実施でき、他者への支援も可能",
        color: "#198754"
    }
};

// 初期化処理
document.addEventListener('DOMContentLoaded', function() {
    console.log('アプリケーション初期化開始');
    
    // 今日の日付をデフォルトで設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entryDate').value = today;
    
    // 評価項目をローカルストレージから読み込み、なければデフォルトを使用
    loadAssessmentItems();
    
    // 評価基準を表示
    renderScoreCriteria();
    
    // 評価項目を表示
    renderAssessmentItems();
    
    // 項目管理リストを表示
    renderItemManagementList();
    
    // 過去の評価結果を読み込み
    loadPastAssessments();
    
    // イベントリスナーを設定
    setupEventListeners();
    
    console.log('アプリケーション初期化完了');
});

// 評価項目の読み込み
function loadAssessmentItems() {
    const stored = localStorage.getItem('assessmentItems');
    
    // localStorageに評価項目が存在する場合
    if (stored) {
        const parsed = JSON.parse(stored);
        
        // 空配列の場合は初期データを投入
        if (Array.isArray(parsed) && parsed.length === 0) {
            console.log('評価項目が空のため、初期データを投入します');
            assessmentItems = [...defaultItems];
            saveAssessmentItems();
        } else {
            assessmentItems = parsed;
            console.log(`評価項目を読み込みました（${assessmentItems.length}項目）`);
        }
    } else {
        // localStorageに評価項目が存在しない場合は初期データを投入
        console.log('初回起動: 初期評価項目データを投入します');
        assessmentItems = [...defaultItems];
        saveAssessmentItems();
        console.log(`初期データを保存しました（${assessmentItems.length}項目）`);
    }
}

// 評価項目の保存
function saveAssessmentItems() {
    localStorage.setItem('assessmentItems', JSON.stringify(assessmentItems));
}

// 評価基準の表示
function renderScoreCriteria() {
    const criteriaContainer = document.getElementById('scoreCriteria');
    
    let html = '<div class="table-responsive"><table class="table table-bordered criteria-table">';
    html += '<thead><tr><th>スコア</th><th>評価</th><th>説明</th></tr></thead><tbody>';
    
    for (let score = 5; score >= 1; score--) {
        const criteria = scoreCriteria[score];
        html += `<tr>
            <td class="criteria-score" style="background-color: ${criteria.color}; color: white;">${score}</td>
            <td><strong>${criteria.label}</strong></td>
            <td>${criteria.description}</td>
        </tr>`;
    }
    
    html += '</tbody></table></div>';
    criteriaContainer.innerHTML = html;
}

// 評価基準パネルの表示切り替え
function toggleCriteriaPanel() {
    const panel = document.getElementById('criteriaPanel');
    const button = document.getElementById('toggleCriteria');
    
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        button.innerHTML = '<i class="bi bi-info-circle me-1"></i>評価基準を非表示';
    } else {
        panel.style.display = 'none';
        button.innerHTML = '<i class="bi bi-info-circle me-1"></i>評価基準を表示';
    }
}

// 評価項目の表示
function renderAssessmentItems() {
    const container = document.getElementById('assessmentItems');
    
    if (assessmentItems.length === 0) {
        container.innerHTML = '<div class="alert alert-info">評価項目がありません。「項目を追加」から項目を登録してください。</div>';
        return;
    }
    
    // カテゴリごとにグループ化
    const groupedItems = {};
    assessmentItems.forEach((item, index) => {
        if (!groupedItems[item.category]) {
            groupedItems[item.category] = [];
        }
        groupedItems[item.category].push({ ...item, index });
    });
    
    let html = '';
    
    for (const category in groupedItems) {
        html += `<div class="category-section fade-in">
            <div class="category-title">
                <i class="bi bi-folder me-2"></i>${category}
            </div>`;
        
        groupedItems[category].forEach(item => {
            html += `<div class="assessment-item" data-index="${item.index}">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <label class="form-label mb-1">${item.name}</label>
                        <small class="text-muted">${item.description}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger btn-delete" onclick="deleteAssessmentItem(${item.index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                
                <div class="score-selection mb-2">
                    ${[1, 2, 3, 4, 5].map(score => `
                        <button class="score-btn score-${score}" 
                                data-item="${item.index}" 
                                data-score="${score}"
                                onclick="selectScore(${item.index}, ${score})">
                            ${score}
                        </button>
                    `).join('')}
                </div>
                
                <div class="mt-2">
                    <label class="form-label small">メモ・所見</label>
                    <textarea class="memo-textarea" 
                              data-item="${item.index}"
                              placeholder="特記事項や観察内容を記入してください"
                              onchange="saveMemo(${item.index}, this.value)"></textarea>
                </div>
            </div>`;
        });
        
        html += '</div>';
    }
    
    container.innerHTML = html;
    
    // 現在の評価データを復元
    restoreCurrentAssessment();
}

// スコアの選択
function selectScore(itemIndex, score) {
    currentAssessment.scores[itemIndex] = score;
    
    // ボタンの状態を更新
    const buttons = document.querySelectorAll(`button[data-item="${itemIndex}"]`);
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.score) === score) {
            btn.classList.add('active');
        }
    });
    
    console.log(`項目 ${itemIndex} のスコアを ${score} に設定`);
}

// メモの保存
function saveMemo(itemIndex, value) {
    currentAssessment.memos[itemIndex] = value;
    console.log(`項目 ${itemIndex} のメモを保存`);
}

// 現在の評価データを復元
function restoreCurrentAssessment() {
    // スコアを復元
    for (const itemIndex in currentAssessment.scores) {
        const score = currentAssessment.scores[itemIndex];
        selectScore(parseInt(itemIndex), score);
    }
    
    // メモを復元
    for (const itemIndex in currentAssessment.memos) {
        const memo = currentAssessment.memos[itemIndex];
        const textarea = document.querySelector(`textarea[data-item="${itemIndex}"]`);
        if (textarea) {
            textarea.value = memo;
        }
    }
}

// 評価項目の削除
function deleteAssessmentItem(index) {
    if (confirm('この評価項目を削除してもよろしいですか?')) {
        assessmentItems.splice(index, 1);
        saveAssessmentItems();
        renderAssessmentItems();
        renderItemManagementList();
        
        // 現在の評価データからも削除
        delete currentAssessment.scores[index];
        delete currentAssessment.memos[index];
    }
}

// 項目管理リストの表示
function renderItemManagementList() {
    const container = document.getElementById('itemManagementList');
    
    if (assessmentItems.length === 0) {
        container.innerHTML = '<div class="alert alert-info">登録済みの項目がありません。</div>';
        return;
    }
    
    let html = '<div class="list-group">';
    
    assessmentItems.forEach((item, index) => {
        const isFirst = index === 0;
        const isLast = index === assessmentItems.length - 1;
        
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="badge bg-primary me-2">${item.category}</span>
                            <strong>${item.name}</strong>
                        </div>
                        <small class="text-muted">${item.description}</small>
                    </div>
                    <div class="btn-group ms-3" role="group">
                        <button class="btn btn-sm btn-outline-secondary" 
                                onclick="moveItemUp(${index})" 
                                ${isFirst ? 'disabled' : ''} 
                                title="上に移動">
                            <i class="bi bi-arrow-up"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" 
                                onclick="moveItemDown(${index})" 
                                ${isLast ? 'disabled' : ''} 
                                title="下に移動">
                            <i class="bi bi-arrow-down"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteAssessmentItem(${index})" 
                                title="削除">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 項目を上に移動
function moveItemUp(index) {
    if (index <= 0) return;
    moveItem(index, index - 1);
}

// 項目を下に移動
function moveItemDown(index) {
    if (index >= assessmentItems.length - 1) return;
    moveItem(index, index + 1);
}

// 項目を移動
function moveItem(oldIndex, newIndex) {
    // 範囲チェック
    if (oldIndex < 0 || oldIndex >= assessmentItems.length) return;
    if (newIndex < 0 || newIndex >= assessmentItems.length) return;
    
    // 項目を取り出して新しい位置に挿入
    const [item] = assessmentItems.splice(oldIndex, 1);
    assessmentItems.splice(newIndex, 0, item);
    
    // 保存して再描画
    saveAssessmentItems();
    renderItemManagementList();
    renderAssessmentItems();
}

// イベントリスナーの設定
function setupEventListeners() {
    // 新規項目登録
    document.getElementById('registerItemBtn').addEventListener('click', registerNewItem);
    
    // 一括項目登録
    document.getElementById('registerBulkItemsBtn').addEventListener('click', registerBulkItems);
    
    // 評価結果を保存
    document.getElementById('saveAssessment').addEventListener('click', saveAssessment);
    
    // フォームをクリア
    document.getElementById('clearForm').addEventListener('click', clearForm);
    
    // 評価結果を見る
    document.getElementById('viewResults').addEventListener('click', viewResults);
    
    // スキル分析を見る
    document.getElementById('viewChart').addEventListener('click', viewChart);
    
    // 画像保存
    document.getElementById('saveChartImage').addEventListener('click', saveChartAsImage);
    
    // 印刷
    document.getElementById('printResults').addEventListener('click', printResults);
    
    // CSV出力
    document.getElementById('exportCSV').addEventListener('click', handleExportCSV);
    
    // 利用者名変更時に履歴を自動更新
    document.getElementById('userName').addEventListener('blur', function() {
        const userName = this.value.trim();
        if (userName) {
            loadPastAssessments();
        }
    });
}

// 新規項目の登録
function registerNewItem() {
    const category = document.getElementById('newCategory').value;
    const name = document.getElementById('newItemName').value.trim();
    const description = document.getElementById('newDescription').value.trim();
    
    if (!category) {
        alert('カテゴリを選択してください');
        return;
    }
    
    if (!name) {
        alert('項目名を入力してください');
        return;
    }
    
    if (!description) {
        alert('説明を入力してください');
        return;
    }
    
    // 新しい項目を追加
    assessmentItems.push({ category, name, description });
    saveAssessmentItems();
    renderAssessmentItems();
    renderItemManagementList();
    
    // フォームをクリア
    document.getElementById('newCategory').value = '';
    document.getElementById('newItemName').value = '';
    document.getElementById('newDescription').value = '';
    
    alert('新しい評価項目を登録しました');
}

// 一括項目の解析
function parseBulkItems(text, categoryFromSelect) {
    const lines = text.split('\n');
    const items = [];
    const errors = [];
    const skipped = [];
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // 空行はスキップ
        if (!trimmedLine) {
            return;
        }
        
        let category, name, description;
        
        // 「カンマ」区切りの場合（カテゴリ,項目名,説明）
        if (trimmedLine.includes(',')) {
            const parts = trimmedLine.split(',').map(p => p.trim());
            
            if (parts.length >= 3) {
                // カテゴリ,項目名,説明
                category = parts[0];
                name = parts[1];
                description = parts[2];
            } else if (parts.length === 2) {
                // 項目名,説明（カテゴリはセレクトから）
                category = categoryFromSelect;
                name = parts[0];
                description = parts[1];
            } else {
                errors.push(`${index + 1}行目: カンマの数が不足しています`);
                return;
            }
        }
        // 「｜」または「タブ」で分割（従来の形式）
        else if (trimmedLine.includes('｜')) {
            const parts = trimmedLine.split('｜').map(p => p.trim());
            category = categoryFromSelect;
            name = parts[0];
            description = parts[1];
        } else if (trimmedLine.includes('\t')) {
            const parts = trimmedLine.split('\t').map(p => p.trim());
            category = categoryFromSelect;
            name = parts[0];
            description = parts[1];
        } else {
            errors.push(`${index + 1}行目: 区切り文字が見つかりません（,、｜、タブのいずれか）`);
            return;
        }
        
        // 必須項目チェック
        if (!category) {
            errors.push(`${index + 1}行目: カテゴリが空です`);
            return;
        }
        if (!name) {
            errors.push(`${index + 1}行目: 項目名が空です`);
            return;
        }
        if (!description) {
            description = '説明なし';
        }
        
        // 重複チェック（既存項目と同じカテゴリ・項目名）
        const isDuplicate = assessmentItems.some(item => 
            item.category === category && item.name === name
        );
        
        if (isDuplicate) {
            skipped.push(`${index + 1}行目: ${category} - ${name}（重複）`);
            return;
        }
        
        // 今回追加する項目内での重複チェック
        const isDuplicateInBatch = items.some(item => 
            item.category === category && item.name === name
        );
        
        if (isDuplicateInBatch) {
            skipped.push(`${index + 1}行目: ${category} - ${name}（重複）`);
            return;
        }
        
        items.push({
            category: category,
            name: name,
            description: description
        });
    });
    
    return { items, errors, skipped };
}

// 一括項目の登録
function registerBulkItems() {
    const category = document.getElementById('bulkCategory').value;
    const text = document.getElementById('bulkItemsText').value;
    
    // 入力チェック
    if (!text.trim()) {
        alert('評価項目を入力してください');
        return;
    }
    
    // カテゴリがカンマ区切りで指定されていない場合は必須
    const hasCommaFormat = text.includes(',');
    if (!hasCommaFormat && !category) {
        alert('カテゴリを選択するか、「カテゴリ,項目名,説明」形式で入力してください');
        return;
    }
    
    // テキストを解析
    const { items, errors, skipped } = parseBulkItems(text, category);
    
    // 結果サマリー
    let summaryMessage = `追加: ${items.length}件`;
    if (skipped.length > 0) {
        summaryMessage += ` / スキップ: ${skipped.length}件`;
    }
    if (errors.length > 0) {
        summaryMessage += ` / エラー: ${errors.length}件`;
    }
    
    // エラーがある場合は警告
    if (errors.length > 0 || skipped.length > 0) {
        let detailMessage = summaryMessage + '\n\n';
        
        if (skipped.length > 0) {
            detailMessage += '【スキップした項目（重複）】\n' + skipped.slice(0, 5).join('\n');
            if (skipped.length > 5) {
                detailMessage += `\n...他${skipped.length - 5}件`;
            }
            detailMessage += '\n\n';
        }
        
        if (errors.length > 0) {
            detailMessage += '【エラー】\n' + errors.slice(0, 5).join('\n');
            if (errors.length > 5) {
                detailMessage += `\n...他${errors.length - 5}件`;
            }
            detailMessage += '\n\n';
        }
        
        if (items.length === 0) {
            alert('登録できる項目がありません。\n\n' + detailMessage);
            return;
        }
        
        if (!confirm(detailMessage + '正常な項目のみ登録しますか?')) {
            return;
        }
    }
    
    // 項目を追加
    assessmentItems.push(...items);
    saveAssessmentItems();
    renderAssessmentItems();
    renderItemManagementList();
    
    // フォームをクリア
    document.getElementById('bulkCategory').value = '';
    document.getElementById('bulkItemsText').value = '';
    
    // 結果を表示
    alert(summaryMessage + '\n\n評価項目を登録しました');
    
    // 単項目登録タブに戻る
    const singleTab = document.getElementById('single-tab');
    if (singleTab) {
        singleTab.click();
    }
}

// 評価結果の保存
function saveAssessment() {
    // 基本情報の検証
    const userName = document.getElementById('userName').value.trim();
    const managementNumber = document.getElementById('managementNumber').value.trim();
    const evaluatorName = document.getElementById('evaluatorName').value.trim();
    const entryDate = document.getElementById('entryDate').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!userName || !evaluatorName || !entryDate || !startDate || !endDate) {
        alert('基本情報（※必須項目）をすべて入力してください');
        return;
    }
    
    // スコアが入力されているか確認
    if (Object.keys(currentAssessment.scores).length === 0) {
        alert('少なくとも1つの項目を評価してください');
        return;
    }
    
    // 評価データを作成
    const assessmentData = {
        id: Date.now(),
        basicInfo: {
            userName,
            managementNumber,
            evaluatorName,
            entryDate,
            startDate,
            endDate
        },
        scores: { ...currentAssessment.scores },
        memos: { ...currentAssessment.memos },
        items: assessmentItems.map(item => ({ ...item })),
        timestamp: new Date().toISOString()
    };
    
    // 利用者単位でローカルストレージに保存
    const userAssessments = getUserAssessments(userName);
    userAssessments.push(assessmentData);
    
    if (saveUserAssessments(userName, userAssessments)) {
        alert(`評価結果を保存しました\n\n利用者: ${userName}\n評価ID: ${assessmentData.id}`);
        loadPastAssessments();
    }
}

// フォームのクリア（新規評価を開始）
function clearForm() {
    // 基本情報をクリア
    document.getElementById('userName').value = '';
    document.getElementById('managementNumber').value = '';
    document.getElementById('evaluatorName').value = '';
    document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    
    // 評価データをクリア
    currentAssessment = {
        basicInfo: {},
        scores: {},
        memos: {}
    };
    
    // 現在読み込んでいる評価IDをクリア
    currentLoadedAssessmentId = null;
    
    // 評価項目を再描画（すべての選択状態とメモをクリア）
    renderAssessmentItems();
    
    // 過去の評価一覧をクリア（利用者が変わるため）
    document.getElementById('pastAssessments').innerHTML = '<p class="text-muted">利用者名を入力すると、その利用者の過去の評価が表示されます。</p>';
    
    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    console.log('新規評価を開始しました');
}

// 過去の評価結果を読み込み
function loadPastAssessments() {
    const userName = getCurrentUserName();
    const container = document.getElementById('pastAssessments');
    
    if (!userName) {
        container.innerHTML = '<p class="text-muted">利用者名を入力すると、その利用者の過去の評価が表示されます。</p>';
        return;
    }
    
    const assessments = getUserAssessments(userName);
    
    if (assessments.length === 0) {
        container.innerHTML = `<div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            <strong>${userName}</strong> さんの過去の評価結果はありません
        </div>`;
        return;
    }
    
    let html = `<div class="mb-3 text-muted small">
        <i class="bi bi-info-circle me-1"></i>
        <strong>${userName}</strong> さんの評価履歴（${assessments.length}件）
    </div>`;
    
    assessments.slice().reverse().forEach(assessment => {
        const avgScore = calculateAverageScore(assessment.scores);
        html += `<div class="assessment-history-item">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="date">
                        <i class="bi bi-calendar-check me-2"></i>
                        ${assessment.basicInfo.entryDate}${assessment.basicInfo.managementNumber ? ' [' + assessment.basicInfo.managementNumber + ']' : ''}
                    </div>
                    <div class="details">
                        評価者: ${assessment.basicInfo.evaluatorName} | 
                        期間: ${assessment.basicInfo.startDate} 〜 ${assessment.basicInfo.endDate} | 
                        平均スコア: ${avgScore.toFixed(2)}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); loadAssessment('${userName}', ${assessment.id})" title="再評価">
                        <i class="bi bi-arrow-repeat me-1"></i>再評価
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteAssessmentHistory('${userName}', ${assessment.id})" title="削除">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

// 平均スコアの計算
function calculateAverageScore(scores) {
    const values = Object.values(scores);
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
}

// 評価データの読み込み（再評価）
function loadAssessment(userName, id) {
    const assessments = getUserAssessments(userName);
    const assessment = assessments.find(a => a.id === id);
    
    if (!assessment) {
        alert('評価データが見つかりません');
        return;
    }
    
    // 確認メッセージ
    if (!confirm(`この評価結果をフォームに読み込みますか？\n\n再評価として編集できます。\n\n評価日: ${assessment.basicInfo.entryDate}\n評価者: ${assessment.basicInfo.evaluatorName}`)) {
        return;
    }
    
    // 基本情報を復元
    document.getElementById('userName').value = assessment.basicInfo.userName;
    document.getElementById('managementNumber').value = assessment.basicInfo.managementNumber || '';
    document.getElementById('evaluatorName').value = assessment.basicInfo.evaluatorName;
    document.getElementById('entryDate').value = assessment.basicInfo.entryDate;
    document.getElementById('startDate').value = assessment.basicInfo.startDate;
    document.getElementById('endDate').value = assessment.basicInfo.endDate;
    
    // 評価項目を復元
    assessmentItems = assessment.items.map(item => ({ ...item }));
    saveAssessmentItems();
    
    // スコアとメモを復元
    currentAssessment.scores = { ...assessment.scores };
    currentAssessment.memos = { ...assessment.memos };
    
    // 現在読み込んでいる評価IDを記録
    currentLoadedAssessmentId = id;
    
    renderAssessmentItems();
    renderItemManagementList();
    
    // 成功メッセージ
    alert('評価データを読み込みました。\n再評価として編集できます。');
    
    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 評価履歴の削除
function deleteAssessmentHistory(userName, id) {
    // 確認ダイアログ
    if (!confirm('この評価結果を削除してもよろしいですか？\n\nこの操作は取り消せません。')) {
        return;
    }
    
    // 利用者の評価履歴を取得
    const assessments = getUserAssessments(userName);
    
    // 該当IDを除外
    const filteredAssessments = assessments.filter(a => a.id !== id);
    
    // 保存
    saveUserAssessments(userName, filteredAssessments);
    
    // 削除した評価が現在フォームに読み込まれている場合
    if (currentLoadedAssessmentId === id) {
        currentLoadedAssessmentId = null;
        currentLoadedAssessmentId = null;
    }
    
    // 評価結果一覧を更新
    loadPastAssessments();
    
    // 成功メッセージ
    alert('評価結果を削除しました。');
}

// フォームをクリア（確認なし）- 内部使用
function clearFormWithoutConfirm() {
    // 基本情報をクリア
    document.getElementById('userName').value = '';
    document.getElementById('evaluatorName').value = '';
    document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    
    // 評価データをクリア
    currentAssessment = {
        basicInfo: {},
        scores: {},
        memos: {}
    };
    
    // localStorageから一時的な評価状態を削除
    localStorage.removeItem('currentAssessmentState');
    
    // 評価項目を再描画
    renderAssessmentItems();
    
    // ページトップにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 評価結果の表示
function viewResults() {
    const userName = document.getElementById('userName').value.trim();
    const managementNumber = document.getElementById('managementNumber').value.trim();
    
    if (!userName || Object.keys(currentAssessment.scores).length === 0) {
        alert('評価データを入力してください');
        return;
    }
    
    // モーダルに結果を表示
    const modal = new bootstrap.Modal(document.getElementById('resultsModal'));
    const container = document.getElementById('resultsContent');
    
    let html = `<div class="mb-4">
        <h6>利用者: ${userName}</h6>`;
    
    if (managementNumber) {
        html += `<p class="text-muted mb-1">管理番号: ${managementNumber}</p>`;
    }
    
    html += `<p class="text-muted">平均スコア: ${calculateAverageScore(currentAssessment.scores).toFixed(2)}</p>
    </div>`;
    
    // カテゴリごとに結果を表示
    const groupedItems = {};
    assessmentItems.forEach((item, index) => {
        if (currentAssessment.scores[index] !== undefined) {
            if (!groupedItems[item.category]) {
                groupedItems[item.category] = [];
            }
            groupedItems[item.category].push({ 
                ...item, 
                index, 
                score: currentAssessment.scores[index],
                memo: currentAssessment.memos[index] || ''
            });
        }
    });
    
    for (const category in groupedItems) {
        html += `<div class="mb-4">
            <h6 class="text-primary">${category}</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead><tr><th>項目</th><th>スコア</th><th>評価</th><th>メモ</th></tr></thead>
                    <tbody>`;
        
        groupedItems[category].forEach(item => {
            const criteria = scoreCriteria[item.score];
            html += `<tr>
                <td>${item.name}</td>
                <td class="text-center" style="background-color: ${criteria.color}; color: white; font-weight: bold;">${item.score}</td>
                <td>${criteria.label}</td>
                <td>${item.memo}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div></div>';
    }
    
    container.innerHTML = html;
    modal.show();
}

// チャートの表示
let categoryCharts = new Map(); // カテゴリ名 => Chart instance

// スコア別の色を取得（新仕様）
function getScoreColor(score) {
    switch (score) {
        case 1: return '#0d6efd'; // 青
        case 2: return '#198754'; // 緑
        case 3: return '#ffc107'; // 黄
        case 4: return '#fd7e14'; // オレンジ
        case 5: return '#dc3545'; // 赤
        default: return '#94a3b8'; // グレー：未評価
    }
}

function viewChart() {
    const userName = document.getElementById('userName').value.trim();
    
    if (!userName || Object.keys(currentAssessment.scores).length === 0) {
        alert('評価データを入力してください');
        return;
    }
    
    // 既存のチャートを破棄
    categoryCharts.forEach((chart, key) => {
        if (chart && chart.destroy) {
            chart.destroy();
        }
    });
    categoryCharts.clear();
    
    const modal = new bootstrap.Modal(document.getElementById('chartModal'));
    modal.show();
    
    // モーダルが表示された後にチャートを描画
    setTimeout(() => {
        renderChart();
    }, 300);
}

function renderChart() {
    const chartContainer = document.getElementById('chartContainer');
    
    if (!chartContainer) {
        console.error('chartContainer が見つかりません');
        return;
    }
    
    // カテゴリ別の色定義
    const categoryColors = {
        "就労意欲・意欲": 'rgba(255, 99, 132, 0.7)',
        "就労能力・技能": 'rgba(54, 162, 235, 0.7)',
        "対人関係・コミュニケーション": 'rgba(255, 206, 86, 0.7)',
        "身体面・健康": 'rgba(75, 192, 192, 0.7)',
        "環境的要因": 'rgba(153, 102, 255, 0.7)',
        "自己理解・自己管理": 'rgba(255, 159, 64, 0.7)',
        "職業知識・準備": 'rgba(199, 199, 199, 0.7)',
        "適応性・柔軟性": 'rgba(83, 102, 255, 0.7)',
        "カスタム": 'rgba(100, 100, 100, 0.7)'
    };
    
    // カテゴリごとに評価項目をグループ化
    const groupedItems = {};
    assessmentItems.forEach((item, index) => {
        if (currentAssessment.scores[index] !== undefined) {
            if (!groupedItems[item.category]) {
                groupedItems[item.category] = [];
            }
            groupedItems[item.category].push({
                name: item.name,
                description: item.description,
                score: currentAssessment.scores[index],
                index: index
            });
        }
    });
    
    // コンテナをクリア
    chartContainer.innerHTML = '';
    
    // カテゴリごとにチャートを作成
    let chartIndex = 0;
    for (const category in groupedItems) {
        const items = groupedItems[category];
        const color = categoryColors[category] || 'rgba(13, 110, 253, 0.7)';
        
        // チャートブロックを作成
        const chartBlock = document.createElement('div');
        chartBlock.className = 'chart-block';
        chartBlock.dataset.category = category;
        chartBlock.dataset.chartIndex = chartIndex;
        
        // カテゴリタイトルと保存ボタン
        const titleDiv = document.createElement('div');
        titleDiv.className = 'chart-title';
        
        const titleText = document.createElement('span');
        titleText.textContent = category;
        titleDiv.appendChild(titleText);
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-sm btn-outline-primary';
        saveBtn.innerHTML = '<i class="bi bi-download me-1"></i>このカテゴリを保存';
        saveBtn.dataset.category = category;
        saveBtn.onclick = function() {
            saveCategoryChart(category);
        };
        titleDiv.appendChild(saveBtn);
        
        chartBlock.appendChild(titleDiv);
        
        // キャンバス要素を作成（Excel用に完全固定）
        const BAR_HEIGHT = 32;  // 棒の太さ0.9cm以内
        const GAP = 6;          // 項目間余白
        const PADDING = 40;     // 上下余白
        
        const canvas = document.createElement('canvas');
        canvas.id = 'chart_' + category.replace(/[^a-zA-Z0-9]/g, '_');
        canvas.width = 520;  // Excelで約14cm
        canvas.height = items.length * (BAR_HEIGHT + GAP) + PADDING;
        canvas.style.width = '520px';
        canvas.style.height = canvas.height + 'px';
        chartBlock.appendChild(canvas);
        
        chartContainer.appendChild(chartBlock);
        
        // ラベルとデータを収集
        const labels = items.map(item => item.name);
        const data = items.map(item => item.score);
        const backgroundColors = data.map(score => getScoreColor(score));
        
        // チャートを作成
        const chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '評価スコア',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    barThickness: 32,
                    maxBarThickness: 32,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: false,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        min: 0,
                        max: 5,
                        ticks: {
                            stepSize: 1,
                            display: true,
                            font: { size: 10 }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        border: {
                            display: true,
                            color: '#666'
                        },
                        title: {
                            display: true,
                            text: '1=非常に困難 | 2=支援必要 | 3=普通 | 4=良好 | 5=非常に良好',
                            font: { size: 9 }
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: 10 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    datalabels: {
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        anchor: 'center',
                        align: 'center',
                        formatter: (value) => value
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const itemIndex = items[context.dataIndex].index;
                                if (itemIndex >= 0 && assessmentItems[itemIndex]) {
                                    return assessmentItems[itemIndex].description;
                                }
                                return '';
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 5,
                        right: 5,
                        top: 5,
                        bottom: 5
                    }
                }
            },
            plugins: [ChartDataLabels, {
                id: 'whiteBg',
                beforeDraw: (chart) => {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        });
        
        // チャートインスタンスを保存
        categoryCharts.set(category, chart);
        chartIndex++;
    }
}

function updateChart() {
    renderChart();
}

// チャートを画像として保存
function saveChartAsImage() {
    if (categoryCharts.size === 0) {
        alert('表示するチャートがありません');
        return;
    }
    
    // 最初のカテゴリのチャートを保存
    const firstCategory = categoryCharts.keys().next().value;
    if (firstCategory) {
        saveCategoryChart(firstCategory);
    }
}

// カテゴリ別にチャートを画像として保存（Excel用：幅520px固定、白背景）
function saveCategoryChart(categoryName) {
    const chart = categoryCharts.get(categoryName);
    
    if (!chart) {
        alert(`チャートが見つかりません。\nカテゴリ「${categoryName}」のグラフが生成されていない可能性があります。\n先にグラフ表示を完了してください。`);
        console.error('利用可能なカテゴリ:', Array.from(categoryCharts.keys()));
        return;
    }
    
    // 現在の日時を取得してファイル名を生成
    const now = new Date();
    const dateStr = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0') + '_' +
                    String(now.getHours()).padStart(2, '0') + 
                    String(now.getMinutes()).padStart(2, '0') + 
                    String(now.getSeconds()).padStart(2, '0');
    
    // カテゴリ名をファイル名に適した形式に変換
    const safeCategoryName = categoryName.replace(/[\/\\?%*:|"<>]/g, '_');
    const fileName = `assessment_${safeCategoryName}_${dateStr}.png`;
    
    // 元のcanvasを取得（既に520px幅で作成済み）
    const originalCanvas = chart.canvas;
    
    // 保存用canvasを作成（サイズはそのまま520px）
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = originalCanvas.width;   // 520px
    exportCanvas.height = originalCanvas.height; // BASE + items*(34+8)
    
    const ctx = exportCanvas.getContext('2d');
    
    // 白背景を塗る（透過PNG禁止）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    // 元のcanvasをそのまま描画（スケーリングなし）
    ctx.drawImage(originalCanvas, 0, 0);
    
    // 高品質PNG書き出し
    const url = exportCanvas.toDataURL('image/png', 1.0);
    
    // ダウンロードリンクを作成してクリック
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('チャート画像を保存しました: ' + fileName);
    console.log('画像サイズ: ' + exportCanvas.width + 'x' + exportCanvas.height + 'px (Excel用固定サイズ)');
}

// 結果を印刷
function printResults() {
    window.print();
}

// CSV出力のハンドラー
function handleExportCSV() {
    const exportData = getCurrentResultsForExport();
    if (!exportData.results || exportData.results.length === 0) {
        alert('評価結果がありません。');
        return;
    }
    exportResultsToCSV(exportData);
}

// 現在のフォームから評価結果を取得
function getCurrentResultsForExport() {
    const basicInfo = {
        userName: document.getElementById('userName')?.value?.trim() || '',
        managementNumber: document.getElementById('managementNumber')?.value?.trim() || '',
        evaluatorName: document.getElementById('evaluatorName')?.value?.trim() || '',
        entryDate: document.getElementById('entryDate')?.value || '',
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || ''
    };

    const results = [];
    
    assessmentItems.forEach((item, index) => {
        const score = currentAssessment.scores[index];
        if (score !== undefined) {
            const notesRaw = currentAssessment.memos[index] || '';
            const criteria = scoreCriteria[score];
            
            results.push({
                category: item.category,
                itemName: item.name,
                score: score,
                label: criteria ? criteria.label : '',
                notes: notesRaw
            });
        }
    });

    // カテゴリ→項目名でソート
    results.sort((a, b) => {
        const c = a.category.localeCompare(b.category, 'ja');
        if (c !== 0) return c;
        return a.itemName.localeCompare(b.itemName, 'ja');
    });

    return { basicInfo, results };
}

// CSV形式でエクスポート
function exportResultsToCSV(exportData) {
    const { basicInfo, results } = exportData;

    // CSVヘッダー
    const header = [
        "記入日", "利用者名（イニシャル）", "管理番号", "評価実施者名", "評価期間開始", "評価期間終了",
        "カテゴリ", "項目", "スコア", "評価", "メモ"
    ];

    // メモの改行を空白に変換（Excel表示の崩れ防止）
    const normalizeMemo = (s) => {
        return String(s ?? '')
            .replace(/\r\n|\n|\r/g, ' ')     // 改行→空白
            .replace(/\s+/g, ' ')            // 連続空白を1つに
            .trim();
    };

    const rows = [header];

    // データ行を追加
    results.forEach(r => {
        rows.push([
            basicInfo.entryDate,
            basicInfo.userName,
            basicInfo.managementNumber || '',
            basicInfo.evaluatorName,
            basicInfo.startDate,
            basicInfo.endDate,
            r.category,
            r.itemName,
            r.score,
            r.label,
            normalizeMemo(r.notes)
        ]);
    });

    // CSVエスケープ処理（ダブルクォートで囲み、内部のダブルクォートはエスケープ）
    const escapeCSV = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvBody = rows.map(row => row.map(escapeCSV).join(",")).join("\n");

    // UTF-8 BOM付き（Excel文字化け対策）
    const csv = "\uFEFF" + csvBody;

    // Blobを作成してダウンロード
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // ファイル名を生成（安全な文字のみ）
    const safeName = (basicInfo.userName || "user").replace(/[\\/:*?"<>|]/g, "_");
    const datePart = basicInfo.entryDate || new Date().toISOString().slice(0, 10);
    const filename = `assessment_${safeName}_${datePart}.csv`;

    // ダウンロードリンクを作成してクリック
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // メモリ解放
    URL.revokeObjectURL(url);
    
    console.log(`CSV出力完了: ${filename}`);
}
