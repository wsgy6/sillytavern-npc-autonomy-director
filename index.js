const MODULE_NAME = 'npcAutonomyDirector';
const PANEL_ID = 'npc-autonomy-director-panel';
const PROMPT_KEY = '3_npc_autonomy_director';
const HISTORY_LIMIT_MAX = 24;
const DRAWER_STATE_KEY = 'npcAutonomyDirector.drawerOpen';

const LONG_TERM_DRIVES = [
  '想逐步取得更多局面掌控权，并避免再次被轻视。',
  '想让关系朝更亲近、更可信赖的方向自然发展。',
  '想证明自己的能力与判断值得被重视。',
  '想从被动应对转向主动塑造局势。',
  '想建立更鲜明、更不容易被忽视的个人存在感。',
  '想在保护自身安全的同时，稳步扩展影响力。',
];

const APPEARANCE_ARCS = [
  {
    id: 'practical-refined',
    label: '实用 → 精致',
    stages: [
      '穿搭偏实用与克制，以耐用、低调、方便行动为主。',
      '开始加入更合身的剪裁与更统一的配色，整体显得利落。',
      '逐步出现更明确的层次感、材质区分与细节装饰。',
      '外在形象已经明显精致起来，会主动挑选能凸显身份与心情的服饰。',
    ],
  },
  {
    id: 'reserved-bold',
    label: '克制 → 张扬',
    stages: [
      '颜色与款式都比较保守，尽量不让自己过于显眼。',
      '开始尝试更鲜明的配色点缀或更有存在感的配件。',
      '会在关键场合用更醒目的款式来表达态度与立场。',
      '穿搭已经具备强烈的个人主张，能够主动利用外表制造印象。',
    ],
  },
  {
    id: 'soft-commanding',
    label: '柔和 → 强势',
    stages: [
      '轮廓与材质偏柔和，给人的感觉较温顺、低压。',
      '开始引入更利落的线条和更明确的结构感。',
      '整体风格在保留气质的同时，逐渐强化了威慑力与控制感。',
      '穿搭与姿态都会主动传达“我知道自己要什么”的气场。',
    ],
  },
];

const BEHAVIOR_ARCS = [
  {
    id: 'guarded-warm',
    label: '戒备 → 温热',
    stages: [
      '表达谨慎，常先观察、试探，再决定是否表露真实态度。',
      '开始在安全时机透露更多想法，偶尔给出更柔软的回应。',
      '会更自然地主动接话、延长互动，并给出带情绪温度的反馈。',
      '面对在意的人时明显更温热，也更愿意主动维系关系。',
    ],
  },
  {
    id: 'passive-assertive',
    label: '被动 → 主动',
    stages: [
      '更多是对局势作出回应，很少主动提出自己的安排。',
      '会开始在小事上做选择、给建议、推动话题方向。',
      '能较明确地主导节奏，并让自己的偏好进入共同决策。',
      '会主动布局、主动试探、主动索取自己想要的结果。',
    ],
  },
  {
    id: 'formal-intimate',
    label: '正式 → 亲密',
    stages: [
      '语气克制有分寸，会保持相对安全的社交距离。',
      '开始用更贴近私人关系的称呼、玩笑或暗示。',
      '会在对话中加入更多只有双方能理解的默契与偏爱。',
      '语言和行为都明显更亲密，愿意通过细节表达占有欲、关心或依赖。',
    ],
  },
];

const GOAL_TEMPLATES = {
  early: [
    '确认当前局势中谁最值得信任，并建立一个只属于自己的安全支点。',
    '通过一次低风险试探，判断{user}会如何回应自己的主动表达。',
    '在不引人警觉的前提下，让别人开始注意到自己的判断力。',
    '先为自己争取一个更有利的位置、话语权或行动空间。',
  ],
  middle: [
    '把一次普通互动悄悄导向更有利于自己的结果。',
    '让{user}更依赖自己的观点、审美或安排。',
    '借一次细节变化测试周围人对自己新形象的反应。',
    '为下一步更大胆的表态铺垫气氛与理由。',
  ],
  late: [
    '把已经积累的影响力转化为更明确的主动权。',
    '让自己的外在与态度形成一致的强烈个人印象。',
    '通过一次关键选择，证明自己不再只是被动跟随。',
    '在关系推进与自我表达之间找到一个更有掌控感的平衡点。',
  ],
};

const DEFAULT_SETTINGS = {
  enabled: true,
  autonomyIntensity: 72,
  goalTurnInterval: 3,
  appearanceStep: 16,
  behaviorStep: 14,
  promptDepth: 2,
  historyLimit: 10,
  extraInstruction: '',
  customLongTermDrive: '',
  appearanceKeywords: '低调,利落,层次,配饰',
  behaviorKeywords: '观察,试探,靠近,主导',
};

const DEFAULT_STATE = {
  seed: '',
  longTermDrive: '',
  currentGoal: '',
  turnCounter: 0,
  turnsSinceGoal: 0,
  appearanceProgress: 0,
  behaviorProgress: 0,
  appearanceArcId: '',
  behaviorArcId: '',
  manualAppearanceNote: '',
  manualBehaviorNote: '',
  history: [],
  updatedAt: '',
};

function getContextSafe() {
  if (!window.SillyTavern?.getContext) {
    throw new Error('未检测到 SillyTavern 上下文接口');
  }
  return window.SillyTavern.getContext();
}

function getSettings() {
  const ctx = getContextSafe();
  const settings = ctx.extensionSettings[MODULE_NAME] || {};
  return { ...DEFAULT_SETTINGS, ...settings };
}

function saveSettings(patch) {
  const ctx = getContextSafe();
  const next = { ...getSettings(), ...patch };
  ctx.extensionSettings[MODULE_NAME] = next;
  ctx.saveSettingsDebounced();
  return next;
}

function getState() {
  const ctx = getContextSafe();
  const state = ctx.chatMetadata[MODULE_NAME] || {};
  return { ...DEFAULT_STATE, ...state };
}

function saveState(patch) {
  const ctx = getContextSafe();
  const next = { ...getState(), ...patch };
  ctx.chatMetadata[MODULE_NAME] = next;
  ctx.saveMetadataDebounced();
  return next;
}

function resetState() {
  const ctx = getContextSafe();
  ctx.chatMetadata[MODULE_NAME] = { ...DEFAULT_STATE };
  ctx.saveMetadataDebounced();
  return ensureState();
}

function hashString(input) {
  let hash = 0;
  const text = String(input || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitKeywords(text) {
  return String(text || '')
    .split(/[，,\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function pickDeterministic(list, seed, offset = 0) {
  if (!list.length) {
    return '';
  }
  const index = (hashString(`${seed}-${offset}`) + offset) % list.length;
  return list[index];
}

function getCurrentIdentifiers() {
  const ctx = getContextSafe();
  return {
    chatId: ctx.getCurrentChatId?.() || 'no-chat',
    userName: ctx.name1 || '用户',
    charName: ctx.name2 || '角色',
  };
}

function getAppearanceArc(state = getState()) {
  return APPEARANCE_ARCS.find(item => item.id === state.appearanceArcId);
}

function getBehaviorArc(state = getState()) {
  return BEHAVIOR_ARCS.find(item => item.id === state.behaviorArcId);
}

function getStageIndex(progress) {
  if (progress >= 75) return 3;
  if (progress >= 50) return 2;
  if (progress >= 25) return 1;
  return 0;
}

function getGoalBucket(progressValue) {
  if (progressValue < 34) return 'early';
  if (progressValue < 68) return 'middle';
  return 'late';
}

function formatGoal(template, ids) {
  return String(template || '')
    .replace(/\{user\}/g, ids.userName)
    .replace(/\{char\}/g, ids.charName);
}

function addHistory(title, detail, state = getState()) {
  const settings = getSettings();
  const historyLimit = clamp(Number(settings.historyLimit) || DEFAULT_SETTINGS.historyLimit, 1, HISTORY_LIMIT_MAX);
  const history = Array.isArray(state.history) ? [...state.history] : [];
  history.unshift({
    title,
    detail,
    turn: state.turnCounter,
    at: new Date().toLocaleString(),
  });
  return history.slice(0, historyLimit);
}

function ensureState() {
  const state = getState();
  const settings = getSettings();
  const ids = getCurrentIdentifiers();
  const seed = state.seed || `${ids.chatId}:${ids.charName}`;
  const appearanceArc = getAppearanceArc(state) || pickDeterministic(APPEARANCE_ARCS, `${seed}:appearance`);
  const behaviorArc = getBehaviorArc(state) || pickDeterministic(BEHAVIOR_ARCS, `${seed}:behavior`);
  const generatedDrive = pickDeterministic(LONG_TERM_DRIVES, `${seed}:drive`);
  const longTermDrive = settings.customLongTermDrive.trim() || state.longTermDrive || generatedDrive;
  let next = state;

  if (!state.seed || !state.longTermDrive || !state.appearanceArcId || !state.behaviorArcId) {
    next = saveState({
      seed,
      longTermDrive,
      appearanceArcId: appearanceArc.id,
      behaviorArcId: behaviorArc.id,
      updatedAt: new Date().toISOString(),
    });
  }

  if (settings.customLongTermDrive.trim() && settings.customLongTermDrive.trim() !== next.longTermDrive) {
    next = saveState({ longTermDrive: settings.customLongTermDrive.trim(), updatedAt: new Date().toISOString() });
  }

  if (!next.currentGoal) {
    next = rotateGoal(true, next);
  }

  return next;
}

function getAppearanceSummary(state = getState(), settings = getSettings()) {
  const arc = getAppearanceArc(state);
  const stageText = arc.stages[getStageIndex(state.appearanceProgress)] || arc.stages[0];
  const keywords = splitKeywords(settings.appearanceKeywords);
  const keywordText = keywords.length ? `关键词：${keywords.join('、')}。` : '';
  const manualText = state.manualAppearanceNote?.trim() ? `额外提示：${state.manualAppearanceNote.trim()}。` : '';
  return `${arc.label}｜${stageText}${keywordText ? ` ${keywordText}` : ''}${manualText ? ` ${manualText}` : ''}`.trim();
}

function getBehaviorSummary(state = getState(), settings = getSettings()) {
  const arc = getBehaviorArc(state);
  const stageText = arc.stages[getStageIndex(state.behaviorProgress)] || arc.stages[0];
  const keywords = splitKeywords(settings.behaviorKeywords);
  const keywordText = keywords.length ? `关键词：${keywords.join('、')}。` : '';
  const manualText = state.manualBehaviorNote?.trim() ? `额外提示：${state.manualBehaviorNote.trim()}。` : '';
  return `${arc.label}｜${stageText}${keywordText ? ` ${keywordText}` : ''}${manualText ? ` ${manualText}` : ''}`.trim();
}

function buildPrompt(state = ensureState(), settings = getSettings()) {
  const ids = getCurrentIdentifiers();
  const appearanceSummary = getAppearanceSummary(state, settings);
  const behaviorSummary = getBehaviorSummary(state, settings);
  const intensity = clamp(Number(settings.autonomyIntensity) || DEFAULT_SETTINGS.autonomyIntensity, 0, 100);
  const extraInstruction = settings.extraInstruction?.trim() ? `附加限制：${settings.extraInstruction.trim()}` : '';

  return [
    `[${ids.charName} 自主性导演指令]`,
    `长期驱动力：${state.longTermDrive}`,
    `当前目标：${state.currentGoal}`,
    `外在穿搭变化：${appearanceSummary}`,
    `行为表现变化：${behaviorSummary}`,
    `自主强度：${intensity}/100。强度越高，越主动推动自身目标；但仍需服从当前剧情、设定与场景合理性。`,
    '执行要求：',
    '1. 始终让角色像“有自己打算的人”一样行动，而不是只被动回应。',
    '2. 每次回复只推进一小步，通过措辞、动作、关注点、穿搭细节和选择倾向体现变化。',
    '3. 不要突然 OOC 地宣布“我进入下一阶段”；变化必须自然、连贯、渐进。',
    '4. 当前目标优先影响角色的主动性、提议、观察重点、欲望表达和风险选择。',
    '5. 穿搭变化要通过具体细节自然体现，例如材质、配色、剪裁、配饰、整理程度、气场。',
    '6. 行为变化要通过语气、主动程度、边界感、亲密度、控制欲或依赖感的细微变化体现。',
    extraInstruction,
  ]
    .filter(Boolean)
    .join('\n');
}

function syncPrompt() {
  const ctx = getContextSafe();
  const settings = getSettings();
  const state = ensureState();

  if (!ctx.getCurrentChatId?.() || !settings.enabled) {
    ctx.setExtensionPrompt(PROMPT_KEY, '', 1, Number(settings.promptDepth) || DEFAULT_SETTINGS.promptDepth, false, 0);
    return;
  }

  ctx.setExtensionPrompt(
    PROMPT_KEY,
    buildPrompt(state, settings),
    1,
    Number(settings.promptDepth) || DEFAULT_SETTINGS.promptDepth,
    false,
    0,
  );
}

function rotateGoal(force = false, inputState = getState()) {
  const settings = getSettings();
  const ids = getCurrentIdentifiers();
  const state = { ...inputState };
  if (!force && state.turnsSinceGoal < Number(settings.goalTurnInterval || DEFAULT_SETTINGS.goalTurnInterval)) {
    return state;
  }

  const combinedProgress = Math.round((Number(state.appearanceProgress || 0) + Number(state.behaviorProgress || 0)) / 2);
  const bucket = getGoalBucket(combinedProgress);
  const pool = GOAL_TEMPLATES[bucket] || GOAL_TEMPLATES.early;
  const offset = state.turnCounter + Math.floor(combinedProgress / 10);
  const template = pickDeterministic(pool, `${state.seed}:${bucket}`, offset);
  const nextGoal = formatGoal(template, ids);
  const changed = nextGoal !== state.currentGoal;
  const history = changed ? addHistory('目标刷新', nextGoal, state) : state.history;

  return saveState({
    currentGoal: nextGoal,
    turnsSinceGoal: 0,
    updatedAt: new Date().toISOString(),
    history,
  });
}

function advanceState(reason = 'auto') {
  const settings = getSettings();
  if (!settings.enabled || !getContextSafe().getCurrentChatId?.()) {
    return getState();
  }

  const state = ensureState();
  const previousAppearanceStage = getStageIndex(state.appearanceProgress);
  const previousBehaviorStage = getStageIndex(state.behaviorProgress);
  const intensityFactor = (Number(settings.autonomyIntensity) || DEFAULT_SETTINGS.autonomyIntensity) / 100;
  const appearanceDelta = clamp(Math.round((Number(settings.appearanceStep) || 0) * intensityFactor), 1, 25);
  const behaviorDelta = clamp(Math.round((Number(settings.behaviorStep) || 0) * intensityFactor), 1, 25);

  let next = saveState({
    turnCounter: Number(state.turnCounter || 0) + 1,
    turnsSinceGoal: Number(state.turnsSinceGoal || 0) + 1,
    appearanceProgress: clamp(Number(state.appearanceProgress || 0) + appearanceDelta, 0, 100),
    behaviorProgress: clamp(Number(state.behaviorProgress || 0) + behaviorDelta, 0, 100),
    updatedAt: new Date().toISOString(),
  });

  const nextAppearanceStage = getStageIndex(next.appearanceProgress);
  const nextBehaviorStage = getStageIndex(next.behaviorProgress);

  if (nextAppearanceStage !== previousAppearanceStage) {
    next = saveState({ history: addHistory('穿搭推进', getAppearanceSummary(next, settings), next) });
  }

  if (nextBehaviorStage !== previousBehaviorStage) {
    next = saveState({ history: addHistory('行为推进', getBehaviorSummary(next, settings), next) });
  }

  next = rotateGoal(false, next);

  if (reason === 'manual') {
    next = saveState({ history: addHistory('手动推进', '你手动触发了一次自主性演化。', next) });
  }

  syncPrompt();
  renderPanel();
  return next;
}

function getStatusSnapshot() {
  const settings = getSettings();
  const state = ensureState();
  const appearanceArc = getAppearanceArc(state) || APPEARANCE_ARCS[0];
  const behaviorArc = getBehaviorArc(state) || BEHAVIOR_ARCS[0];
  return {
    settings,
    state,
    appearanceArc,
    behaviorArc,
    appearanceStage: getStageIndex(state.appearanceProgress) + 1,
    behaviorStage: getStageIndex(state.behaviorProgress) + 1,
    appearanceSummary: getAppearanceSummary(state, settings),
    behaviorSummary: getBehaviorSummary(state, settings),
  };
}

function createPanelHtml() {
  const snapshot = getStatusSnapshot();
  const { settings, state, appearanceArc, behaviorArc, appearanceStage, behaviorStage, appearanceSummary, behaviorSummary } = snapshot;
  const enabledChecked = settings.enabled ? 'checked' : '';
  const history = Array.isArray(state.history) ? state.history : [];

  return `
    <div class="inline-drawer npc-autonomy-director-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>NPC 自主性导演</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
      </div>
      <div class="inline-drawer-content npc-autonomy-director-content">
        <div class="npcad-grid">
          <section class="npcad-card npcad-hero">
            <div class="npcad-card-title">当前状态</div>
            <div class="npcad-pill-row">
              <span class="npcad-pill ${settings.enabled ? 'is-on' : 'is-off'}">${settings.enabled ? '已启用' : '已停用'}</span>
              <span class="npcad-pill">回合 ${state.turnCounter || 0}</span>
              <span class="npcad-pill">目标刷新频率 ${settings.goalTurnInterval}</span>
            </div>
            <div class="npcad-field">
              <label>长期驱动力</label>
              <div class="npcad-value">${escapeHtml(state.longTermDrive || '未初始化')}</div>
            </div>
            <div class="npcad-field">
              <label>当前目标</label>
              <div class="npcad-value npcad-goal">${escapeHtml(state.currentGoal || '未初始化')}</div>
            </div>
            <div class="npcad-progress-group">
              <div>
                <div class="npcad-progress-label">穿搭渐变 · ${appearanceArc.label} · 阶段 ${appearanceStage}/4</div>
                <div class="npcad-progress"><span style="width:${state.appearanceProgress || 0}%"></span></div>
              </div>
              <div>
                <div class="npcad-progress-label">行为渐变 · ${behaviorArc.label} · 阶段 ${behaviorStage}/4</div>
                <div class="npcad-progress"><span style="width:${state.behaviorProgress || 0}%"></span></div>
              </div>
            </div>
            <div class="npcad-summary-grid">
              <div class="npcad-summary-box">
                <div class="npcad-summary-title">穿搭表现</div>
                <div>${escapeHtml(appearanceSummary)}</div>
              </div>
              <div class="npcad-summary-box">
                <div class="npcad-summary-title">行为表现</div>
                <div>${escapeHtml(behaviorSummary)}</div>
              </div>
            </div>
          </section>

          <section class="npcad-card">
            <div class="npcad-card-title">调整面板</div>
            <div class="npcad-form-row npcad-toggle-row">
              <label for="npcad-enabled">启用 NPC 自主性</label>
              <input id="npcad-enabled" type="checkbox" data-setting="enabled" ${enabledChecked} />
            </div>
            <div class="npcad-form-row">
              <label>自主强度</label>
              <input type="range" min="0" max="100" step="1" value="${escapeHtml(settings.autonomyIntensity)}" data-setting="autonomyIntensity" />
            </div>
            <div class="npcad-form-row">
              <label>目标刷新间隔（NPC 回合）</label>
              <input type="number" min="1" max="12" step="1" value="${escapeHtml(settings.goalTurnInterval)}" data-setting="goalTurnInterval" />
            </div>
            <div class="npcad-form-row">
              <label>穿搭推进速度</label>
              <input type="range" min="1" max="30" step="1" value="${escapeHtml(settings.appearanceStep)}" data-setting="appearanceStep" />
            </div>
            <div class="npcad-form-row">
              <label>行为推进速度</label>
              <input type="range" min="1" max="30" step="1" value="${escapeHtml(settings.behaviorStep)}" data-setting="behaviorStep" />
            </div>
            <div class="npcad-form-row">
              <label>提示词注入深度</label>
              <input type="number" min="0" max="10" step="1" value="${escapeHtml(settings.promptDepth)}" data-setting="promptDepth" />
            </div>
            <div class="npcad-form-row">
              <label>历史记录条数</label>
              <input type="number" min="1" max="24" step="1" value="${escapeHtml(settings.historyLimit)}" data-setting="historyLimit" />
            </div>
            <div class="npcad-button-row">
              <button type="button" class="menu_button" data-action="advance">立即推进一轮</button>
              <button type="button" class="menu_button" data-action="goal">刷新目标</button>
              <button type="button" class="menu_button" data-action="sync">同步提示词</button>
              <button type="button" class="menu_button danger_button" data-action="reset">重置当前会话状态</button>
            </div>
          </section>

          <section class="npcad-card">
            <div class="npcad-card-title">定制驱动</div>
            <div class="npcad-form-row">
              <label>自定义长期驱动力</label>
              <textarea data-setting="customLongTermDrive" rows="3" placeholder="为空则自动生成，例如：想在关系里取得更多主动权，同时保持体面。">${escapeHtml(settings.customLongTermDrive)}</textarea>
            </div>
            <div class="npcad-form-row">
              <label>穿搭关键词（逗号分隔）</label>
              <input type="text" data-setting="appearanceKeywords" value="${escapeHtml(settings.appearanceKeywords)}" placeholder="例如：利落,层次,皮革,银饰" />
            </div>
            <div class="npcad-form-row">
              <label>行为关键词（逗号分隔）</label>
              <input type="text" data-setting="behaviorKeywords" value="${escapeHtml(settings.behaviorKeywords)}" placeholder="例如：试探,靠近,主导,占有欲" />
            </div>
            <div class="npcad-form-row">
              <label>当前会话穿搭补充</label>
              <textarea data-state="manualAppearanceNote" rows="2" placeholder="例如：最近更喜欢暗色长外套和有金属感的饰品。">${escapeHtml(state.manualAppearanceNote || '')}</textarea>
            </div>
            <div class="npcad-form-row">
              <label>当前会话行为补充</label>
              <textarea data-state="manualBehaviorNote" rows="2" placeholder="例如：对亲近对象会更明显地主动安排节奏。">${escapeHtml(state.manualBehaviorNote || '')}</textarea>
            </div>
            <div class="npcad-form-row">
              <label>附加提示词限制</label>
              <textarea data-setting="extraInstruction" rows="3" placeholder="例如：不要过快进入暧昧阶段；变化要更偏贵族风。">${escapeHtml(settings.extraInstruction)}</textarea>
            </div>
          </section>

          <section class="npcad-card">
            <div class="npcad-card-title">演化历史</div>
            <div class="npcad-history">
              ${history.length
                ? history
                    .map(
                      item => `
                  <div class="npcad-history-item">
                    <div class="npcad-history-head">
                      <strong>${escapeHtml(item.title || '记录')}</strong>
                      <span>回合 ${escapeHtml(item.turn || 0)} · ${escapeHtml(item.at || '')}</span>
                    </div>
                    <div>${escapeHtml(item.detail || '')}</div>
                  </div>`,
                    )
                    .join('')
                : '<div class="npcad-empty">还没有演化记录。等 NPC 说过几轮话后，这里会显示目标和表现变化。</div>'}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function isDrawerOpen() {
  try {
    return localStorage.getItem(DRAWER_STATE_KEY) === '1';
  } catch {
    return false;
  }
}

function setDrawerOpenState(isOpen) {
  try {
    localStorage.setItem(DRAWER_STATE_KEY, isOpen ? '1' : '0');
  } catch {
  }
}

function ensurePanelMount() {
  let root = document.getElementById(PANEL_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PANEL_ID;
    const mountTarget = document.querySelector('#extensions_settings');
    if (!mountTarget) return null;
    mountTarget.append(root);
  }
  return root;
}

function renderPanel() {
  const root = ensurePanelMount();
  if (!root) return;
  root.innerHTML = createPanelHtml();

  const drawer = root.querySelector('.inline-drawer');
  const content = root.querySelector('.inline-drawer-content');
  const icon = root.querySelector('.inline-drawer-icon');
  const open = isDrawerOpen();

  if (drawer && content) {
    drawer.classList.toggle('open', open);
    content.style.display = open ? 'block' : 'none';
  }

  if (icon) {
    icon.classList.toggle('down', !open);
    icon.classList.toggle('up', open);
    icon.classList.toggle('fa-circle-chevron-down', !open);
    icon.classList.toggle('fa-circle-chevron-up', open);
  }
}

function coerceSettingValue(key, rawValue) {
  if (key === 'enabled') {
    return Boolean(rawValue);
  }
  if (['autonomyIntensity', 'goalTurnInterval', 'appearanceStep', 'behaviorStep', 'promptDepth', 'historyLimit'].includes(key)) {
    return Number(rawValue);
  }
  return String(rawValue ?? '');
}

function bindPanelEvents() {
  $(document).off('.npcad');

  $(document).on('inline-drawer-toggle.npcad', `#${PANEL_ID} .inline-drawer`, event => {
    const drawer = event.currentTarget;
    const isOpen = drawer.classList.contains('openDrawer') || drawer.classList.contains('open');
    setDrawerOpenState(isOpen);
  });

  $(document).on('change.npcad', `#${PANEL_ID} [data-setting]`, event => {
    const element = event.currentTarget;
    const key = element.dataset.setting;
    const rawValue = element.type === 'checkbox' ? element.checked : element.value;
    saveSettings({ [key]: coerceSettingValue(key, rawValue) });

    if (key === 'customLongTermDrive') {
      const text = String(rawValue || '').trim();
      if (text) {
        saveState({ longTermDrive: text, updatedAt: new Date().toISOString() });
      } else {
        const state = getState();
        const ids = getCurrentIdentifiers();
        const seed = state.seed || `${ids.chatId}:${ids.charName}`;
        saveState({ longTermDrive: pickDeterministic(LONG_TERM_DRIVES, `${seed}:drive`), updatedAt: new Date().toISOString() });
      }
    }

    syncPrompt();
    renderPanel();
  });

  $(document).on('change.npcad', `#${PANEL_ID} [data-state]`, event => {
    const element = event.currentTarget;
    const key = element.dataset.state;
    saveState({ [key]: String(element.value || ''), updatedAt: new Date().toISOString() });
    syncPrompt();
    renderPanel();
  });

  $(document).on('click.npcad', `#${PANEL_ID} [data-action]`, event => {
    const action = event.currentTarget.dataset.action;
    if (action === 'advance') {
      advanceState('manual');
      toastr.success('已手动推进一轮自主性演化。', 'NPC 自主性导演');
      return;
    }

    if (action === 'goal') {
      rotateGoal(true, ensureState());
      syncPrompt();
      renderPanel();
      toastr.success('已刷新当前目标。', 'NPC 自主性导演');
      return;
    }

    if (action === 'sync') {
      syncPrompt();
      toastr.success('提示词已同步。', 'NPC 自主性导演');
      return;
    }

    if (action === 'reset') {
      const confirmed = window.confirm('确定要重置当前聊天会话中的 NPC 自主性状态吗？');
      if (!confirmed) return;
      resetState();
      syncPrompt();
      renderPanel();
      toastr.success('当前会话状态已重置。', 'NPC 自主性导演');
    }
  });
}

function handleMessageReceived(messageId) {
  const ctx = getContextSafe();
  const message = ctx.chat?.[messageId];
  const settings = getSettings();

  if (!settings.enabled || !message) return;
  if (message.is_user || message.is_system) return;

  advanceState('auto');
}

function registerSlashCommands() {
  const ctx = getContextSafe();
  const { SlashCommandParser, SlashCommand } = ctx;
  if (!SlashCommandParser?.addCommandObject || !SlashCommand?.fromProps) {
    return;
  }

  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'npc-auto-status',
      callback: () => {
        const state = ensureState();
        return `长期驱动力：${state.longTermDrive}\n当前目标：${state.currentGoal}\n穿搭进度：${state.appearanceProgress}%\n行为进度：${state.behaviorProgress}%`;
      },
      returns: '当前 NPC 自主性状态文本',
      unnamedArgumentList: [],
      namedArgumentList: [],
      helpString: '<div>输出当前会话中 NPC 的长期驱动力、目标与渐变进度。</div>',
    }),
  );

  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'npc-auto-step',
      callback: () => {
        const state = advanceState('manual');
        return `已推进。当前目标：${state.currentGoal}`;
      },
      returns: '推进后的目标说明',
      unnamedArgumentList: [],
      namedArgumentList: [],
      helpString: '<div>手动推进一轮 NPC 自主性演化。</div>',
    }),
  );

  SlashCommandParser.addCommandObject(
    SlashCommand.fromProps({
      name: 'npc-auto-reset',
      callback: () => {
        resetState();
        syncPrompt();
        renderPanel();
        return '已重置当前会话的 NPC 自主性状态。';
      },
      returns: '重置结果',
      unnamedArgumentList: [],
      namedArgumentList: [],
      helpString: '<div>重置当前聊天会话中的自主性演化状态。</div>',
    }),
  );
}

function wireEvents() {
  const ctx = getContextSafe();
  ctx.eventSource.on(ctx.eventTypes.APP_READY, () => {
    ensureState();
    renderPanel();
    syncPrompt();
  });

  ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
    ensureState();
    renderPanel();
    syncPrompt();
  });

  ctx.eventSource.on(ctx.eventTypes.MESSAGE_RECEIVED, messageId => {
    handleMessageReceived(messageId);
  });

  ctx.eventSource.on(ctx.eventTypes.SETTINGS_UPDATED, () => {
    renderPanel();
    syncPrompt();
  });
}

function bootstrap() {
  ensureState();
  renderPanel();
  syncPrompt();
  bindPanelEvents();
  registerSlashCommands();
  wireEvents();
}

jQuery(() => {
  try {
    bootstrap();
  } catch (error) {
    console.error('[NPC 自主性导演] 初始化失败', error);
    toastr.error(String(error?.message || error), 'NPC 自主性导演');
  }
});


