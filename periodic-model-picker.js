(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 仅在 Antigravity 本地宿主界面/本地测试页中生效，避免误拦截内置浏览器访问的外部网站按钮
  const hostName = String(window.location?.hostname || '').toLowerCase();
  const proto = String(window.location?.protocol || '').toLowerCase();
  const isAllowedOrigin =
    proto === 'file:' ||
    proto === 'vscode-file:' ||
    proto === 'vscode-webview:' ||
    proto === 'app:' ||
    proto === 'antigravity:' ||
    proto === 'plugin:' ||
    hostName === '127.0.0.1' ||
    hostName === 'localhost' ||
    hostName === '::1' ||
    hostName === '';
  if (!isAllowedOrigin) return;

  const MODULE_VERSION = '3.3.2-20261123';
  const MODULE_BUILD = 332;
  const HOST_ID = 'ag-periodic-model-picker-host';
  const CLOAK_STYLE_ID = 'ag-periodic-model-picker-cloak-style';
  const STORAGE_COMING_SOON_KEY = 'ag_periodic_picker_coming_soon_v2';
  const STORAGE_USAGE_CACHE_KEY = 'ag_periodic_picker_usage_cache_v31';
  const STORAGE_SUBMENU_EFFORTS_KEY = 'ag_periodic_picker_submenu_efforts_v3';
  const STORAGE_ORCHESTRATOR_SUBMENU_KEY = 'ag_periodic_picker_orch_submenu_v4';

  // 清除 v3.0.0 可能误存的旧版用量缓存
  try {
    window.localStorage?.removeItem('ag_periodic_picker_usage_cache_v3');
  } catch {}

  // 若已有更高版本的周期表模块在运行，避免被旧版重复注入降级覆盖
  if (typeof window.__agPeriodicPickerBuild === 'number' && window.__agPeriodicPickerBuild > MODULE_BUILD) {
    return;
  }

  // 先清理页面上可能已存在的旧版（v1.0~v2.4）或同版（v3.0）周期表监听器
  for (const fnName of ['__agPeriodicPickerCleanup', '__agPeriodicPickerCleanupV21', '__agPeriodicPickerCleanupV30']) {
    if (typeof window[fnName] === 'function') {
      try {
        window[fnName]();
      } catch {}
    }
  }

  // 读取外部配置（由 Sync-HansOverlay.ps1 / macos/sync-hans-overlay.sh / macos/agy-pt-cdp.pl 从 periodic-model-config.json 注入，缺省时使用内置默认）
  const DEFAULT_CONFIG = {
    version: 3,
    title: '模型周期表',
    subtitle: 'Model periodic table',
    seriesLabel: 'Gemini 4',
    integrateAllGoogleModels: true,
    classicModelWhitelist: ['3.8 flash'],
    guaranteedReleasedElements: [
      {
        symbol: 'H',
        baseName: 'Gemini 4 Hydrogen',
        colorLabel: '科技蓝',
        accent: '#4c8bf5',
        efforts: ['low', 'medium', 'high', 'extra'],
      },
      {
        symbol: 'C',
        baseName: 'Gemini 4 Carbon',
        colorLabel: '深邃紫',
        accent: '#a855f7',
        efforts: ['low', 'medium', 'high'],
      },
      {
        symbol: 'Ne',
        baseName: 'Gemini 4 Neon',
        colorLabel: '霓虹红',
        accent: '#f43f5e',
        efforts: ['low', 'medium', 'high', 'extra'],
      },
      {
        symbol: 'Ar',
        baseName: 'Gemini 4 Argon',
        colorLabel: '翡翠青',
        accent: '#14b8a6',
        efforts: ['low', 'medium', 'high'],
      },
    ],
    guaranteedClassicModels: [
      {
        baseName: 'Gemini 3.8 Flash',
        shortName: '3.8 Flash',
        versionTag: '3.8',
        cardLabel: 'Flash',
        accent: '#38bdf8',
        efforts: ['low', 'medium', 'high'],
      },
    ],
    guaranteedOrchestratorModels: [
      {
        baseName: 'Gemini 4 Neon',
        shortName: 'Neon',
        vendor: 'Google',
        accent: '#fb7185',
        hasLevel3: true,
        efforts: ['low', 'medium', 'high', 'extra'],
      },
      {
        baseName: 'Gemini 4 Carbon',
        shortName: 'Carbon',
        vendor: 'Google',
        accent: '#a855f7',
        hasLevel3: true,
        efforts: ['low', 'medium', 'high'],
      },
      {
        baseName: 'Gemini 4 Argon',
        shortName: 'Argon',
        vendor: 'Google',
        accent: '#2dd4bf',
        hasLevel3: true,
        efforts: ['low', 'medium', 'high'],
      },
      {
        baseName: 'Claude Opus 5.5',
        shortName: 'Opus 5.5',
        vendor: 'Anthropic',
        accent: '#d97757',
        hasLevel3: true,
        efforts: ['low', 'medium', 'high'],
      },
    ],
    guaranteedOrchestratorTiers: [
      {
        tier: 'Neon',
        label: 'Neon',
        sub: 'Orchestrator · Neon',
        desc: 'Gemini 4 Neon',
        accent: '#fb7185',
      },
      {
        tier: 'Argon',
        label: 'Argon',
        sub: 'Orchestrator · Argon',
        desc: 'Gemini 4 Argon',
        accent: '#2dd4bf',
      },
    ],
    knownSubmenuEfforts: {
      'gemini 4 neon': ['low', 'medium', 'high', 'extra'],
      'gemini 4 hydrogen': ['low', 'medium', 'high', 'extra'],
      'gemini 4 argon': ['low', 'medium', 'high'],
      'gemini 4 carbon': ['low', 'medium', 'high'],
      'gemini 3.8 flash': ['low', 'medium', 'high'],
      'claude opus 5.5': ['low', 'medium', 'high'],
      'claude sonnet 5.5': ['low', 'medium', 'high'],
    },
    comingSoon: [
      {
        symbol: 'He',
        codename: 'Helium',
        zhName: '氦 · 轻量级',
        note: '即将发布 · 轻量高速模型，上线后自动亮起',
        accent: '#38bdf8',
      },
      {
        symbol: 'Kr',
        codename: 'Krypton',
        zhName: '氪 · 下一代旗舰',
        note: '即将发布 · 下一代高阶推理旗舰，上线后自动亮起',
        accent: '#f59e0b',
      },
    ],
    elementBindings: {
      H: ['^(?!.*orchestrator).*\\bhydrogen\\b', '^(?!.*orchestrator).*gemini\\s*4\\s*h\\b'],
      He: ['^(?!.*orchestrator).*\\bhelium\\b', '^(?!.*orchestrator).*gemini\\s*4\\s*he\\b'],
      C: ['^(?!.*orchestrator).*\\bcarbon\\b', '^(?!.*orchestrator).*gemini\\s*4\\s*c\\b'],
      Ne: ['^(?!.*orchestrator).*\\bneon\\b', '^(?!.*orchestrator).*gemini\\s*4\\s*ne\\b'],
      Ar: ['^(?!.*orchestrator).*\\bargon\\b', '^(?!.*orchestrator).*gemini\\s*4\\s*ar\\b'],
      Kr: ['^(?!.*orchestrator).*\\bkrypton\\b', '^(?!.*orchestrator).*\\bkrypton-a\\b', '^(?!.*orchestrator).*gemini\\s*4\\s*kr\\b'],
    },
    virtualSlotDefaults: {
      efforts: ['low', 'medium', 'high', 'extra'],
    },
    customAccents: {
      H: '#4c8bf5',
      He: '#38bdf8',
      C: '#a855f7',
      Ne: '#f43f5e',
      Ar: '#14b8a6',
      Kr: '#f59e0b',
    },
  };

  const userConfig =
    window.__ANTIGRAVITY_PERIODIC_CONFIG__ && typeof window.__ANTIGRAVITY_PERIODIC_CONFIG__ === 'object'
      ? window.__ANTIGRAVITY_PERIODIC_CONFIG__
      : {};

  const CONFIG = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    integrateAllGoogleModels:
      userConfig.integrateAllGoogleModels !== undefined ? !!userConfig.integrateAllGoogleModels : true,
    classicModelWhitelist: Array.isArray(userConfig.classicModelWhitelist)
      ? userConfig.classicModelWhitelist
      : DEFAULT_CONFIG.classicModelWhitelist,
    guaranteedReleasedElements: Array.isArray(userConfig.guaranteedReleasedElements)
      ? userConfig.guaranteedReleasedElements
      : DEFAULT_CONFIG.guaranteedReleasedElements,
    guaranteedClassicModels: Array.isArray(userConfig.guaranteedClassicModels)
      ? userConfig.guaranteedClassicModels
      : DEFAULT_CONFIG.guaranteedClassicModels,
    guaranteedOrchestratorModels: Array.isArray(userConfig.guaranteedOrchestratorModels)
      ? userConfig.guaranteedOrchestratorModels
      : DEFAULT_CONFIG.guaranteedOrchestratorModels,
    guaranteedOrchestratorTiers: Array.isArray(userConfig.guaranteedOrchestratorTiers)
      ? userConfig.guaranteedOrchestratorTiers
      : DEFAULT_CONFIG.guaranteedOrchestratorTiers,
    knownSubmenuEfforts: {
      ...DEFAULT_CONFIG.knownSubmenuEfforts,
      ...(userConfig.knownSubmenuEfforts || {}),
    },
    comingSoon: Array.isArray(userConfig.comingSoon) ? userConfig.comingSoon : DEFAULT_CONFIG.comingSoon,
    elementBindings: {
      ...DEFAULT_CONFIG.elementBindings,
      ...(userConfig.elementBindings || {}),
    },
    virtualSlotDefaults: {
      ...DEFAULT_CONFIG.virtualSlotDefaults,
      ...(userConfig.virtualSlotDefaults || {}),
    },
    customAccents: {
      ...DEFAULT_CONFIG.customAccents,
      ...(userConfig.customAccents || {}),
    },
  };

  // 完整 118 种化学元素表：[原子序数, 符号, 英文名, 中文名, 行(1-7, 9=Ln, 10=An), 列(1-18), 元素族]
  const ELEMENTS_RAW = [
    [1, 'H', 'Hydrogen', '氢', 1, 1, 'nonmetal'],
    [2, 'He', 'Helium', '氦', 1, 18, 'noble'],
    [3, 'Li', 'Lithium', '锂', 2, 1, 'alkali'],
    [4, 'Be', 'Beryllium', '铍', 2, 2, 'alkaline'],
    [5, 'B', 'Boron', '硼', 2, 13, 'metalloid'],
    [6, 'C', 'Carbon', '碳', 2, 14, 'nonmetal'],
    [7, 'N', 'Nitrogen', '氮', 2, 15, 'nonmetal'],
    [8, 'O', 'Oxygen', '氧', 2, 16, 'nonmetal'],
    [9, 'F', 'Fluorine', '氟', 2, 17, 'halogen'],
    [10, 'Ne', 'Neon', '氖', 2, 18, 'noble'],
    [11, 'Na', 'Sodium', '钠', 3, 1, 'alkali'],
    [12, 'Mg', 'Magnesium', '镁', 3, 2, 'alkaline'],
    [13, 'Al', 'Aluminium', '铝', 3, 13, 'post'],
    [14, 'Si', 'Silicon', '硅', 3, 14, 'metalloid'],
    [15, 'P', 'Phosphorus', '磷', 3, 15, 'nonmetal'],
    [16, 'S', 'Sulfur', '硫', 3, 16, 'nonmetal'],
    [17, 'Cl', 'Chlorine', '氯', 3, 17, 'halogen'],
    [18, 'Ar', 'Argon', '氩', 3, 18, 'noble'],
    [19, 'K', 'Potassium', '钾', 4, 1, 'alkali'],
    [20, 'Ca', 'Calcium', '钙', 4, 2, 'alkaline'],
    [21, 'Sc', 'Scandium', '钪', 4, 3, 'transition'],
    [22, 'Ti', 'Titanium', '钛', 4, 4, 'transition'],
    [23, 'V', 'Vanadium', '钒', 4, 5, 'transition'],
    [24, 'Cr', 'Chromium', '铬', 4, 6, 'transition'],
    [25, 'Mn', 'Manganese', '锰', 4, 7, 'transition'],
    [26, 'Fe', 'Iron', '铁', 4, 8, 'transition'],
    [27, 'Co', 'Cobalt', '钴', 4, 9, 'transition'],
    [28, 'Ni', 'Nickel', '镍', 4, 10, 'transition'],
    [29, 'Cu', 'Copper', '铜', 4, 11, 'transition'],
    [30, 'Zn', 'Zinc', '锌', 4, 12, 'transition'],
    [31, 'Ga', 'Gallium', '镓', 4, 13, 'post'],
    [32, 'Ge', 'Germanium', '锗', 4, 14, 'metalloid'],
    [33, 'As', 'Arsenic', '砷', 4, 15, 'metalloid'],
    [34, 'Se', 'Selenium', '硒', 4, 16, 'nonmetal'],
    [35, 'Br', 'Bromine', '溴', 4, 17, 'halogen'],
    [36, 'Kr', 'Krypton', '氪', 4, 18, 'noble'],
    [37, 'Rb', 'Rubidium', '铷', 5, 1, 'alkali'],
    [38, 'Sr', 'Strontium', '锶', 5, 2, 'alkaline'],
    [39, 'Y', 'Yttrium', '钇', 5, 3, 'transition'],
    [40, 'Zr', 'Zirconium', '锆', 5, 4, 'transition'],
    [41, 'Nb', 'Niobium', '铌', 5, 5, 'transition'],
    [42, 'Mo', 'Molybdenum', '钼', 5, 6, 'transition'],
    [43, 'Tc', 'Technetium', '锝', 5, 7, 'transition'],
    [44, 'Ru', 'Ruthenium', '钌', 5, 8, 'transition'],
    [45, 'Rh', 'Rhodium', '铑', 5, 9, 'transition'],
    [46, 'Pd', 'Palladium', '钯', 5, 10, 'transition'],
    [47, 'Ag', 'Silver', '银', 5, 11, 'transition'],
    [48, 'Cd', 'Cadmium', '镉', 5, 12, 'transition'],
    [49, 'In', 'Indium', '铟', 5, 13, 'post'],
    [50, 'Sn', 'Tin', '锡', 5, 14, 'post'],
    [51, 'Sb', 'Antimony', '锑', 5, 15, 'metalloid'],
    [52, 'Te', 'Tellurium', '碲', 5, 16, 'metalloid'],
    [53, 'I', 'Iodine', '碘', 5, 17, 'halogen'],
    [54, 'Xe', 'Xenon', '氙', 5, 18, 'noble'],
    [55, 'Cs', 'Cesium', '铯', 6, 1, 'alkali'],
    [56, 'Ba', 'Barium', '钡', 6, 2, 'alkaline'],
    [57, 'La', 'Lanthanum', '镧', 9, 4, 'lanthanide'],
    [58, 'Ce', 'Cerium', '铈', 9, 5, 'lanthanide'],
    [59, 'Pr', 'Praseodymium', '镨', 9, 6, 'lanthanide'],
    [60, 'Nd', 'Neodymium', '钕', 9, 7, 'lanthanide'],
    [61, 'Pm', 'Promethium', '钷', 9, 8, 'lanthanide'],
    [62, 'Sm', 'Samarium', '钐', 9, 9, 'lanthanide'],
    [63, 'Eu', 'Europium', '铕', 9, 10, 'lanthanide'],
    [64, 'Gd', 'Gadolinium', '钆', 9, 11, 'lanthanide'],
    [65, 'Tb', 'Terbium', '铽', 9, 12, 'lanthanide'],
    [66, 'Dy', 'Dysprosium', '镝', 9, 13, 'lanthanide'],
    [67, 'Ho', 'Holmium', '钬', 9, 14, 'lanthanide'],
    [68, 'Er', 'Erbium', '铒', 9, 15, 'lanthanide'],
    [69, 'Tm', 'Thulium', '铥', 9, 16, 'lanthanide'],
    [70, 'Yb', 'Ytterbium', '镱', 9, 17, 'lanthanide'],
    [71, 'Lu', 'Lutetium', '镥', 9, 18, 'lanthanide'],
    [72, 'Hf', 'Hafnium', '铪', 6, 4, 'transition'],
    [73, 'Ta', 'Tantalum', '钽', 6, 5, 'transition'],
    [74, 'W', 'Tungsten', '钨', 6, 6, 'transition'],
    [75, 'Re', 'Rhenium', '铼', 6, 7, 'transition'],
    [76, 'Os', 'Osmium', '锇', 6, 8, 'transition'],
    [77, 'Ir', 'Iridium', '铱', 6, 9, 'transition'],
    [78, 'Pt', 'Platinum', '铂', 6, 10, 'transition'],
    [79, 'Au', 'Gold', '金', 6, 11, 'transition'],
    [80, 'Hg', 'Mercury', '汞', 6, 12, 'transition'],
    [81, 'Tl', 'Thallium', '铊', 6, 13, 'post'],
    [82, 'Pb', 'Lead', '铅', 6, 14, 'post'],
    [83, 'Bi', 'Bismuth', '铋', 6, 15, 'post'],
    [84, 'Po', 'Polonium', '钋', 6, 16, 'metalloid'],
    [85, 'At', 'Astatine', '砹', 6, 17, 'halogen'],
    [86, 'Rn', 'Radon', '氡', 6, 18, 'noble'],
    [87, 'Fr', 'Francium', '钫', 7, 1, 'alkali'],
    [88, 'Ra', 'Radium', '镭', 7, 2, 'alkaline'],
    [89, 'Ac', 'Actinium', '锕', 10, 4, 'actinide'],
    [90, 'Th', 'Thorium', '钍', 10, 5, 'actinide'],
    [91, 'Pa', 'Protactinium', '镤', 10, 6, 'actinide'],
    [92, 'U', 'Uranium', '铀', 10, 7, 'actinide'],
    [93, 'Np', 'Neptunium', '镎', 10, 8, 'actinide'],
    [94, 'Pu', 'Plutonium', '钚', 10, 9, 'actinide'],
    [95, 'Am', 'Americium', '镅', 10, 10, 'actinide'],
    [96, 'Cm', 'Curium', '锔', 10, 11, 'actinide'],
    [97, 'Bk', 'Berkelium', '锫', 10, 12, 'actinide'],
    [98, 'Cf', 'Californium', '锎', 10, 13, 'actinide'],
    [99, 'Es', 'Einsteinium', '锿', 10, 14, 'actinide'],
    [100, 'Fm', 'Fermium', '镄', 10, 15, 'actinide'],
    [101, 'Md', 'Mendelevium', '钔', 10, 16, 'actinide'],
    [102, 'No', 'Nobelium', '锘', 10, 17, 'actinide'],
    [103, 'Lr', 'Lawrencium', '铹', 10, 18, 'actinide'],
    [104, 'Rf', 'Rutherfordium', '𬬻', 7, 4, 'transition'],
    [105, 'Db', 'Dubnium', '𬭊', 7, 5, 'transition'],
    [106, 'Sg', 'Seaborgium', '𬭳', 7, 6, 'transition'],
    [107, 'Bh', 'Bohrium', '𬭛', 7, 7, 'transition'],
    [108, 'Hs', 'Hassium', '𬭶', 7, 8, 'transition'],
    [109, 'Mt', 'Meitnerium', '鿏', 7, 9, 'transition'],
    [110, 'Ds', 'Darmstadtium', '𫟼', 7, 10, 'transition'],
    [111, 'Rg', 'Roentgenium', '𬬭', 7, 11, 'transition'],
    [112, 'Cn', 'Copernicium', '鿔', 7, 12, 'transition'],
    [113, 'Nh', 'Nihonium', '鿭', 7, 13, 'post'],
    [114, 'Fl', 'Flerovium', '𫓧', 7, 14, 'post'],
    [115, 'Mc', 'Moscovium', '镆', 7, 15, 'post'],
    [116, 'Lv', 'Livermorium', '𫟷', 7, 16, 'post'],
    [117, 'Ts', 'Tennessine', '鿬', 7, 17, 'halogen'],
    [118, 'Og', 'Oganesson', '鿫', 7, 18, 'noble'],
  ];

  // 元素族默认配色与中文族名
  const GROUP_ACCENTS = {
    nonmetal: '#4c8bf5',
    noble: '#14b8a6',
    alkali: '#ef4444',
    alkaline: '#f97316',
    metalloid: '#8b5cf6',
    halogen: '#06b6d4',
    post: '#10b981',
    transition: '#eab308',
    lanthanide: '#ec4899',
    actinide: '#d946ef',
  };

  const GROUP_ZH_NAMES = {
    nonmetal: '非金属',
    noble: '稀有气体',
    alkali: '碱金属',
    alkaline: '碱土金属',
    metalloid: '类金属',
    halogen: '卤素',
    post: '贫金属',
    transition: '过渡金属',
    lanthanide: '镧系元素',
    actinide: '锕系元素',
  };

  const ELEMENT_COLOR_LABELS = {
    H: '科技蓝',
    He: '晴空青',
    C: '深邃紫',
    Ne: '霓虹红',
    Ar: '翡翠青',
    Kr: '琥珀金',
  };

  const ELEMENT_ALIASES = {
    aluminum: 'Al',
    caesium: 'Cs',
    sulphur: 'S',
  };

  const ELEMENTS = ELEMENTS_RAW.map(([number, symbol, en, zh, row, col, group]) => ({
    number,
    symbol,
    en,
    zh,
    row,
    col,
    group,
    groupZh: GROUP_ZH_NAMES[group] || '元素',
    colorLabel: ELEMENT_COLOR_LABELS[symbol] || GROUP_ZH_NAMES[group] || '主题色',
    accent: CONFIG.customAccents[symbol] || GROUP_ACCENTS[group] || '#4c8bf5',
  }));

  const ELEMENT_BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]));
  const ELEMENT_BY_EN = new Map(ELEMENTS.map((e) => [e.en.toLowerCase(), e]));
  for (const [alias, sym] of Object.entries(ELEMENT_ALIASES)) {
    const el = ELEMENT_BY_SYMBOL.get(sym.toLowerCase());
    if (el) ELEMENT_BY_EN.set(alias, el);
  }
  const ELEMENT_EN_LIST = Array.from(ELEMENT_BY_EN.keys()).sort((a, b) => b.length - a.length);

  // 推力 / 思考强度标准化映射（完整覆盖 Antigravity 原版二级子菜单的低/中/高/Extra/Max 等档位）
  const EFFORT_META = {
    off: { key: 'off', zh: '关闭', en: 'Off', desc: '直出不思考', order: 0, bars: 0 },
    minimal: { key: 'minimal', zh: '极低', en: 'Minimal', desc: '极简推理', order: 1, bars: 1 },
    xlow: { key: 'xlow', zh: '超低', en: 'Extra Low', desc: '超轻快答', order: 1.2, bars: 1 },
    fast: { key: 'fast', zh: '快速', en: 'Fast', desc: '极速响应', order: 1.5, bars: 1 },
    low: { key: 'low', zh: '低', en: 'Low', desc: '轻量快答', order: 2, bars: 1 },
    medium: { key: 'medium', zh: '中', en: 'Medium', desc: '均衡推荐', order: 3, bars: 2 },
    default: { key: 'default', zh: '标准', en: 'Default', desc: '官方默认', order: 3.5, bars: 2 },
    adaptive: { key: 'adaptive', zh: '自适应', en: 'Adaptive', desc: '按需思考', order: 3.8, bars: 2 },
    thinking: { key: 'thinking', zh: '思考', en: 'Thinking', desc: '链式推理', order: 4, bars: 3 },
    reasoning: { key: 'reasoning', zh: '推理', en: 'Reasoning', desc: '深度推理', order: 4.5, bars: 3 },
    high: { key: 'high', zh: '高', en: 'High', desc: '深度推理', order: 5, bars: 3 },
    extra: { key: 'extra', zh: '超高', en: 'Extra High', desc: '高配深思', order: 6, bars: 4 },
    max: { key: 'max', zh: '最高', en: 'Max', desc: '极限算力', order: 7, bars: 4 },
  };

  const EFFORT_SYNONYMS = new Map([
    ['off', 'off'],
    ['none', 'off'],
    ['关闭', 'off'],
    ['无', 'off'],
    ['minimal', 'minimal'],
    ['极低', 'minimal'],
    ['xlow', 'xlow'],
    ['x-low', 'xlow'],
    ['extra low', 'xlow'],
    ['extra-low', 'xlow'],
    ['extra 低', 'xlow'],
    ['extra-低', 'xlow'],
    ['超低', 'xlow'],
    ['fast', 'fast'],
    ['快', 'fast'],
    ['快速', 'fast'],
    ['low', 'low'],
    ['低', 'low'],
    ['medium', 'medium'],
    ['med', 'medium'],
    ['中', 'medium'],
    ['中等', 'medium'],
    ['default', 'default'],
    ['standard', 'default'],
    ['默认', 'default'],
    ['标准', 'default'],
    ['adaptive', 'adaptive'],
    ['自适应', 'adaptive'],
    ['thinking', 'thinking'],
    ['思考', 'thinking'],
    ['深度思考', 'thinking'],
    ['reasoning', 'reasoning'],
    ['推理', 'reasoning'],
    ['high', 'high'],
    ['高', 'high'],
    ['extra', 'extra'],
    ['xhigh', 'extra'],
    ['x-high', 'extra'],
    ['extra high', 'extra'],
    ['extra-high', 'extra'],
    ['extra 高', 'extra'],
    ['extra-高', 'extra'],
    ['very high', 'extra'],
    ['超高', 'extra'],
    ['极高', 'extra'],
    ['max', 'max'],
    ['maximum', 'max'],
    ['最高', 'max'],
    ['极限', 'max'],
  ]);

  // 未来模型上线预留接口注册表
  const dynamicRegistry = {
    elementModels: new Map(),
    customMatchers: new Map(),
    comingSoonMap: new Map(),
    virtualHooks: new Set(),
  };

  for (const item of CONFIG.comingSoon) {
    if (item && item.symbol) {
      dynamicRegistry.comingSoonMap.set(String(item.symbol).toLowerCase(), { ...item });
    }
  }

  function safeLoadJson(key, fallback) {
    try {
      const raw = window.localStorage?.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function safeSaveJson(key, val) {
    try {
      window.localStorage?.setItem(key, JSON.stringify(val));
    } catch {}
  }

  function loadPersistedComingSoon() {
    const obj = safeLoadJson(STORAGE_COMING_SOON_KEY, null);
    if (!obj) return;
    for (const [symKey, val] of Object.entries(obj)) {
      if (val === null) {
        dynamicRegistry.comingSoonMap.delete(symKey.toLowerCase());
      } else if (val && typeof val === 'object') {
        dynamicRegistry.comingSoonMap.set(symKey.toLowerCase(), val);
      }
    }
  }

  function savePersistedComingSoonDelta(symKey, metaOrNull) {
    const obj = safeLoadJson(STORAGE_COMING_SOON_KEY, {});
    obj[symKey.toLowerCase()] = metaOrNull;
    safeSaveJson(STORAGE_COMING_SOON_KEY, obj);
  }

  loadPersistedComingSoon();

  // 缓存上次从原版二级子菜单真实读出的模型档位表（仅加速首帧显示，每次打开都会后台重新静默探测同步）
  let cachedSubmenuEfforts = safeLoadJson(STORAGE_SUBMENU_EFFORTS_KEY, {});
  // 缓存上次从原版 Orchestrator 二/三级子菜单真实读出的底层模型及各自推理档位
  let cachedOrchestratorModels = safeLoadJson(STORAGE_ORCHESTRATOR_SUBMENU_KEY, null);
  // 缓存上次从原版 View Usage 真实读出的额度数据（不含任何编造默认值，首次未探测前为 null）
  let cachedUsageSnapshot = safeLoadJson(STORAGE_USAGE_CACHE_KEY, null);

  function registerMatcherInternal(symbol, patternOrFn) {
    const el = ELEMENT_BY_SYMBOL.get(String(symbol || '').toLowerCase());
    if (!el) return false;
    const key = el.symbol.toLowerCase();
    if (!dynamicRegistry.customMatchers.has(key)) {
      dynamicRegistry.customMatchers.set(key, []);
    }
    const list = dynamicRegistry.customMatchers.get(key);
    if (typeof patternOrFn === 'function' || patternOrFn instanceof RegExp) {
      list.push(patternOrFn);
      return true;
    }
    if (typeof patternOrFn === 'string' && patternOrFn.trim()) {
      try {
        list.push(new RegExp(patternOrFn, 'i'));
        return true;
      } catch {
        const escaped = patternOrFn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        list.push(new RegExp(escaped, 'i'));
        return true;
      }
    }
    return false;
  }

  if (CONFIG.elementBindings && typeof CONFIG.elementBindings === 'object') {
    for (const [sym, patterns] of Object.entries(CONFIG.elementBindings)) {
      const arr = Array.isArray(patterns) ? patterns : [patterns];
      for (const p of arr) registerMatcherInternal(sym, p);
    }
  }

  // 运行时状态对象
  const state = {
    open: false,
    openedAt: 0,
    skeletonMounted: false,
    capturing: false,
    bypassNextClick: false,
    triggerBtn: null,
    nativeMenuEl: null,
    nativeMenuHidden: false,
    usageTriggerEl: null, // 原版菜单底部的 View Usage 触发项
    lastNativeModelItems: [],
    lastNativeActionItems: [],
    modelsBySymbol: new Map(),
    googleClassicModels: [], // 元素表下方的 3.8 Flash（唯一 1 个模块）
    orchestratorModels: [], // 元素表下方的 Orchestrator 合并模块（支持多底层模型 + 三级推理档位）
    otherModels: [], // 底部其他厂商模型
    actionItems: [], // 原版菜单其余功能项
    activeModelKey: '', // 当前正在使用的 canonicalKey
    selectedGroup: null, // 当前展开档位选择面板的模型分组
    selectedOrchSubModelKey: '', // Orchestrator 面板中当前选中的底层模型 key
    virtualElement: null, // 点选未发布元素时打开的虚拟选择窗口
    virtualPickedEffort: null,
    virtualFeedback: '',
    showingUsagePanel: false, // 是否在中央显示完整用量面板
    hoveredInfo: null,
    detectedSeries: CONFIG.seriesLabel,
    usageData: cachedUsageSnapshot && Array.isArray(cachedUsageSnapshot.pools) ? cachedUsageSnapshot : null,
    probingSubmenus: false,
    probingUsage: false,
    probeToken: 0,
    hostEl: null,
    shadow: null,
    cloakStyleEl: null,
    isLightTheme: false,
    captureCleanup: null,
    extendCaptureDeadline: null,
  };

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#4c8bf5').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return `rgba(76, 139, 245, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function detectLightTheme() {
    try {
      const bg = getComputedStyle(document.body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const lum = 0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3]);
        if (lum > 165) return true;
      }
    } catch {}
    return false;
  }

  function normalizeKey(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[（(]\s*(?:极低|minimal)\s*[）)]/g, '(minimal)')
      .replace(/[（(]\s*(?:超低|xlow|x-low|extra[\s-]*(?:low|低))\s*[）)]/g, '(xlow)')
      .replace(/[（(]\s*(?:快|快速|fast)\s*[）)]/g, '(fast)')
      .replace(/[（(]\s*(?:低|low)\s*[）)]/g, '(low)')
      .replace(/[（(]\s*(?:中|中等|medium|med)\s*[）)]/g, '(medium)')
      .replace(/[（(]\s*(?:默认|标准|default|standard)\s*[）)]/g, '(default)')
      .replace(/[（(]\s*(?:自适应|adaptive)\s*[）)]/g, '(adaptive)')
      .replace(/[（(]\s*(?:思考|深度思考|thinking)\s*[）)]/g, '(thinking)')
      .replace(/[（(]\s*(?:推理|reasoning)\s*[）)]/g, '(reasoning)')
      .replace(/[（(]\s*(?:高|high)\s*[）)]/g, '(high)')
      .replace(/[（(]\s*(?:超高|极高|extra|xhigh|x-high|extra[\s-]*(?:high|高)|very\s*high)\s*[）)]/g, '(extra)')
      .replace(/[（(]\s*(?:最高|极限|max|maximum)\s*[）)]/g, '(max)')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isOrchestratorText(str) {
    return /orchestrator|编排/i.test(String(str || ''));
  }

  function detectOrchestratorTier(str) {
    const s = String(str || '');
    if (/\bneon\b|氖/i.test(s)) return 'Neon';
    if (/\bargon\b|氩/i.test(s)) return 'Argon';
    if (/\bhydrogen\b|氢/i.test(s)) return 'Hydrogen';
    if (/\bopus\s*5\.5\b/i.test(s)) return 'Opus 5.5';
    if (/\bsonnet\s*5\.5\b/i.test(s)) return 'Sonnet 5.5';
    if (/\bclaude\b/i.test(s)) return s.replace(/^.*?(claude\b[^()（）]*)/i, '$1').trim();
    return null;
  }

  function getOrchestratorSubModelAccent(baseName, vendor = 'Google') {
    const low = String(baseName || '').toLowerCase();
    if (/\bneon\b/.test(low)) return '#fb7185';
    if (/\bargon\b/.test(low)) return '#2dd4bf';
    if (/\bhydrogen\b/.test(low)) return '#4c8bf5';
    if (/\bcarbon\b/.test(low)) return '#a855f7';
    if (/\bflash\b/.test(low)) return '#38bdf8';
    if (vendor === 'Anthropic' || /\bclaude\b/.test(low)) return '#d97757';
    if (vendor === 'OpenAI' || /\bgpt\b/.test(low)) return '#10a37f';
    if (vendor === 'DeepSeek' || /\bdeepseek\b/.test(low)) return '#6366f1';
    return '#a855f7';
  }

  function getOrchestratorSubModelShortName(baseName) {
    const clean = String(baseName || '').trim();
    if (!clean) return 'Model';
    if (/^gemini\s+4\s+/i.test(clean)) return clean.replace(/^gemini\s+4\s+/i, '').trim();
    if (/^gemini\s+/i.test(clean)) return clean.replace(/^gemini\s+/i, '').trim();
    if (/^claude\s+/i.test(clean)) return clean.replace(/^claude\s+/i, '').trim();
    return clean;
  }

  function buildOrchestratorCanonicalKey(subModelBaseName, effortKey = null) {
    const sub = String(subModelBaseName || '').trim();
    if (!sub) return normalizeKey('Orchestrator');
    if (effortKey) {
      const en = EFFORT_META[effortKey]?.en || effortKey;
      return normalizeKey(`Orchestrator | ${sub} (${en})`);
    }
    return normalizeKey(`Orchestrator | ${sub}`);
  }

  function splitBadgesAndName(rawLine) {
    const badges = [];
    let isUnavailable = false;
    let text = String(rawLine || '')
      .replace(/[ⓘℹ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    text = text.replace(/^[✓✔•●○]\s*/, '').replace(/\s*[✓✔›>]+$/, '').trim();
    const badgeRegex =
      /\s+(NEW|New|BETA|Beta|Preview|PREVIEW|Recommended|推荐|新|实验性|Experimental|Deprecated|已弃用|Quota|Trial|TRIAL|试用|Notice|NOTICE|Unavailable|UNAVAILABLE|不可用|暂不可用|i)$/i;
    let m;
    while ((m = text.match(badgeRegex))) {
      const b = m[1];
      if (/^(unavailable|不可用|暂不可用)$/i.test(b)) isUnavailable = true;
      if (b.toLowerCase() !== 'i') badges.unshift(b);
      text = text.slice(0, m.index).trim();
    }
    return { name: text, badges, isUnavailable };
  }

  // 安全读取菜单选项 DOM 文本行：避免裸 el.textContent 把相邻 <span> 无空格粘连，也不受 flex 乱换行影响
  const BLOCK_TAGS = new Set([
    'DIV', 'P', 'LI', 'UL', 'OL', 'HEADER', 'FOOTER', 'SECTION', 'ARTICLE',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TABLE', 'DL', 'DT', 'DD', 'MAIN', 'NAV',
  ]);
  const SKIP_TAGS = new Set(['SVG', 'STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);

  function extractOptionLinesFromDom(rootEl, skipNodes = null) {
    if (!rootEl || !(rootEl instanceof Element)) return [];
    const lines = [];
    let current = [];

    const flush = () => {
      if (!current.length) return;
      const joined = current.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) lines.push(joined);
      current = [];
    };

    const walk = (node) => {
      if (!node) return;
      if (skipNodes && skipNodes.has(node)) return;
      if (node.nodeType === 3) {
        const t = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (t) current.push(t);
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName;
      if (SKIP_TAGS.has(tag)) return;
      if (node.hasAttribute('hidden')) return;
      if (tag === 'BR') {
        flush();
        return;
      }
      const isBlock = node !== rootEl && BLOCK_TAGS.has(tag);
      if (isBlock) flush();
      for (const child of node.childNodes) {
        walk(child);
      }
      if (isBlock) flush();
    };

    walk(rootEl);
    flush();
    return lines;
  }

  function matchCustomElementBinding(baseName, rawLabel) {
    if (isOrchestratorText(baseName) || isOrchestratorText(rawLabel)) {
      return null;
    }
    for (const [symKey, matchers] of dynamicRegistry.customMatchers.entries()) {
      for (const matcher of matchers) {
        try {
          const hit =
            typeof matcher === 'function'
              ? !!matcher(baseName, rawLabel)
              : matcher.test(baseName) || matcher.test(rawLabel);
          if (hit) return ELEMENT_BY_SYMBOL.get(symKey) || null;
        } catch {}
      }
    }
    return null;
  }

  // 判断某谷歌非元素模型是否在经典模型白名单内（3.8 Flash 放在元素表下面）
  function isAllowedClassicGoogleModel(baseName, shortName) {
    if (isOrchestratorText(baseName) || isOrchestratorText(shortName)) return false;
    const whitelist = Array.isArray(CONFIG.classicModelWhitelist) ? CONFIG.classicModelWhitelist : ['3.8 flash'];
    if (whitelist.length === 0) return false;
    const haystack = `${baseName} ${shortName}`.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
    return whitelist.some((w) => haystack.includes(String(w).toLowerCase().replace(/-/g, ' ').trim()));
  }

  // 为经典模型生成唯一归一化分组 key（避免 3.8 Flash 被拆成两个模块）
  function getClassicModelGroupKey(baseName, shortName = '') {
    const haystack = `${baseName} ${shortName}`.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
    const whitelist = Array.isArray(CONFIG.classicModelWhitelist) ? CONFIG.classicModelWhitelist : ['3.8 flash'];
    for (const w of whitelist) {
      const norm = String(w).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm && haystack.includes(norm)) {
        return norm.replace(/\s+/g, '-');
      }
    }
    return String(baseName || shortName || '').toLowerCase().replace(/^gemini\s+/i, '').replace(/\s+/g, '-').trim();
  }

  function buildGoogleClassicCardMeta(baseName, shortName) {
    const verMatch = `${baseName} ${shortName}`.match(/(\d+(?:\.\d+)?)/);
    const versionTag = verMatch ? verMatch[1] : '3.8';
    let label = shortName.replace(/^\d+(?:\.\d+)?\s*/, '').trim() || 'Flash';
    if (/flash[\s-]*lite/i.test(`${baseName} ${shortName}`)) label = 'Flash-Lite';
    else if (/flash/i.test(`${baseName} ${shortName}`)) label = 'Flash';
    else if (/pro/i.test(`${baseName} ${shortName}`)) label = 'Pro';
    const accent = '#38bdf8';
    return { versionTag, label, accent };
  }

  // 解析模型标签：记录 effortSource（'paren' 括号固定版 vs 'tail' 主菜单当前档位提示），区分级联模型与固定单版模型
  function parseModelLabel(rawLabel, subtitleHint = '') {
    const firstSplit = splitBadgesAndName(rawLabel);
    const cleaned = firstSplit.name;
    const badges = [...firstSplit.badges];
    let isUnavailable = firstSplit.isUnavailable;
    let baseName = cleaned;
    let effortKey = null;
    let effortSource = null;

    const isOrchestrator = isOrchestratorText(cleaned) || isOrchestratorText(subtitleHint);
    let orchestratorTier = null;
    let orchestratorId = null;
    let orchSubModelBaseName = null;
    let orchSubModelShortName = null;
    let orchSubVendor = 'Google';
    let orchSubAccent = '#a855f7';

    if (isOrchestrator) {
      orchestratorId = 'orch:main';
      baseName = 'Orchestrator';
      // 剥离前导 "Orchestrator" / "编排" 后递归解析底层模型与当前推理档位（如 "Orchestrator Gemini 4 Neon Extra High" 或 "Orchestrator Claude Opus 5.5 Medium"）
      let innerRaw = cleaned
        .replace(/^(?:orchestrator|编排器?|智能编排)[\s:：·/-]*/i, '')
        .replace(/^\(([^()]+)\)$/, '$1')
        .replace(/^（([^（）]+)）$/, '$1')
        .replace(/\s*\.\.\.\s*$/, '')
        .trim();
      if (!innerRaw && subtitleHint) {
        innerRaw = String(subtitleHint)
          .replace(/^(?:orchestrator|编排器?|智能编排)[\s:：·/-]*/i, '')
          .replace(/\s*\.\.\.\s*$/, '')
          .trim();
      }
      if (innerRaw && !isOrchestratorText(innerRaw)) {
        const innerParsed = parseModelLabel(innerRaw, '');
        if (innerParsed && innerParsed.baseName) {
          orchSubModelBaseName = innerParsed.baseName;
          orchSubModelShortName = getOrchestratorSubModelShortName(innerParsed.baseName);
          orchSubVendor = innerParsed.vendor || 'Google';
          orchSubAccent = getOrchestratorSubModelAccent(innerParsed.baseName, orchSubVendor);
          orchestratorTier = orchSubModelShortName;
          if (innerParsed.effortKey) {
            effortKey = innerParsed.effortKey;
            effortSource = innerParsed.effortSource || 'tail';
          }
        }
      }
      if (!orchestratorTier) {
        orchestratorTier = detectOrchestratorTier(`${cleaned} ${subtitleHint}`);
        if (orchestratorTier) {
          orchSubModelShortName = orchestratorTier;
          orchSubModelBaseName = /^(?:neon|argon|hydrogen|carbon)$/i.test(orchestratorTier)
            ? `${CONFIG.seriesLabel || 'Gemini 4'} ${orchestratorTier}`
            : orchestratorTier;
          orchSubVendor = /^claude|opus|sonnet/i.test(orchSubModelBaseName) ? 'Anthropic' : 'Google';
          orchSubAccent = getOrchestratorSubModelAccent(orchSubModelBaseName, orchSubVendor);
        }
      }
    } else {
      // 1. 扫描所有括号对（从右向左）
      const parenMatches = Array.from(cleaned.matchAll(/[（(]([^()（）]+)[）)]/g));
      for (let i = parenMatches.length - 1; i >= 0; i--) {
        const m = parenMatches[i];
        const candidate = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
        if (EFFORT_SYNONYMS.has(candidate)) {
          effortKey = EFFORT_SYNONYMS.get(candidate);
          effortSource = 'paren';
          baseName = (cleaned.slice(0, m.index) + ' ' + cleaned.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
          break;
        }
      }

      // 2. 尾部连字符/中点强度后缀，如 "Claude Sonnet 5.5 - High"
      if (!effortKey) {
        const dashMatch = cleaned.match(/^(.*?)\s+[-·/]\s*([A-Za-z\u4e00-\u9fff\s-]+)\s*$/);
        if (dashMatch) {
          const candidate = dashMatch[2].trim().toLowerCase().replace(/\s+/g, ' ');
          if (EFFORT_SYNONYMS.has(candidate)) {
            effortKey = EFFORT_SYNONYMS.get(candidate);
            effortSource = 'tail';
            baseName = dashMatch[1].trim();
          }
        }
      }

      // 3. 主菜单行尾空格强度词（如原版截图中的 "Gemini 4 Neon 中"、"Gemini 4 Hydrogen Extra"、"Claude Opus 5.5 中"）
      if (!effortKey) {
        const tailWordMatch = cleaned.match(
          /^(.*?)\s+(extra[\s-]+(?:high|高)|very\s+high|extra[\s-]+(?:low|低)|x-high|xhigh|x-low|xlow|extra|minimal|medium|med|low|high|max|maximum|fast|thinking|reasoning|adaptive|极低|超低|快速|低|中|中等|高|超高|极高|最高|极限|思考|深度思考|推理|自适应)$/i
        );
        if (tailWordMatch && tailWordMatch[1].trim().length >= 2) {
          const candidate = tailWordMatch[2].trim().toLowerCase().replace(/\s+/g, ' ');
          if (EFFORT_SYNONYMS.has(candidate)) {
            effortKey = EFFORT_SYNONYMS.get(candidate);
            effortSource = 'tail';
            baseName = tailWordMatch[1].trim();
          }
        }
      }

      // 4. 副标题行（独立短段或括号内）标注了强度词（不按空格拆英文描述句）
      if (!effortKey && subtitleHint) {
        const subClean = String(subtitleHint).trim().toLowerCase().replace(/\s+/g, ' ');
        if (EFFORT_SYNONYMS.has(subClean)) {
          effortKey = EFFORT_SYNONYMS.get(subClean);
          effortSource = 'sub';
        } else {
          const subParens = Array.from(subClean.matchAll(/[（(]([^()（）]+)[）)]/g));
          for (const m of subParens) {
            const cand = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
            if (EFFORT_SYNONYMS.has(cand)) {
              effortKey = EFFORT_SYNONYMS.get(cand);
              effortSource = 'sub';
              break;
            }
          }
          if (!effortKey) {
            for (const seg of subClean.split(/[·|/,，;；]+/)) {
              const part = seg.trim();
              if (part && EFFORT_SYNONYMS.has(part)) {
                effortKey = EFFORT_SYNONYMS.get(part);
                effortSource = 'sub';
                break;
              }
            }
          }
        }
      }

      const secondSplit = splitBadgesAndName(baseName);
      baseName = secondSplit.name;
      if (secondSplit.isUnavailable) isUnavailable = true;
      if (secondSplit.badges.length) badges.push(...secondSplit.badges);
    }

    let matchedElement = isOrchestrator ? null : matchCustomElementBinding(baseName, cleaned);
    let series = null;
    const isGoogleBrand =
      isOrchestrator ||
      /^(?:gemini|google)\b/i.test(baseName) ||
      /^(?:flash[\s-]*lite|3\.\d+\s*(?:pro|flash)|2\.\d+\s*(?:pro|flash))/i.test(baseName) ||
      !!matchedElement;

    const isGoogleOrPure = !isOrchestrator && (isGoogleBrand || ELEMENT_BY_EN.has(baseName.toLowerCase()));

    if (isGoogleOrPure) {
      const seriesMatch = baseName.match(/^(Gemini\s+\d+(?:\.\d+)?)/i);
      if (seriesMatch) series = seriesMatch[1].replace(/\s+/g, ' ');

      if (!matchedElement) {
        const lowBase = baseName.toLowerCase();
        if (ELEMENT_BY_EN.has(lowBase)) {
          matchedElement = ELEMENT_BY_EN.get(lowBase);
        } else {
          for (const enName of ELEMENT_EN_LIST) {
            const re = new RegExp(`(?:^|[\\s\\-_/])${enName}(?:$|[\\s\\-_/\\d])`, 'i');
            if (re.test(lowBase)) {
              matchedElement = ELEMENT_BY_EN.get(enName);
              break;
            }
          }
        }
      }

      if (matchedElement) {
        const prefixSeries = series || CONFIG.seriesLabel || 'Gemini 4';
        baseName = `${prefixSeries} ${matchedElement.en}`;
      } else if (isAllowedClassicGoogleModel(baseName, baseName)) {
        const cardMeta = buildGoogleClassicCardMeta(baseName, baseName);
        baseName = `Gemini ${cardMeta.versionTag} ${cardMeta.label}`;
      }
    }

    let vendor = 'Other';
    let vendorColor = '#94a3b8';
    let shortName = baseName;

    if (isOrchestrator) {
      vendor = orchSubVendor || 'Google';
      vendorColor = orchSubAccent || '#a855f7';
      shortName = orchSubModelShortName ? `Orchestrator (${orchSubModelShortName})` : 'Orchestrator';
    } else if (/^claude\b/i.test(baseName)) {
      vendor = 'Anthropic';
      vendorColor = '#d97757';
    } else if (/^(?:gpt|o1|o3|o4|chatgpt|openai)\b/i.test(baseName)) {
      vendor = 'OpenAI';
      vendorColor = '#10a37f';
    } else if (/^deepseek\b/i.test(baseName)) {
      vendor = 'DeepSeek';
      vendorColor = '#6366f1';
    } else if (/^grok\b/i.test(baseName)) {
      vendor = 'xAI';
      vendorColor = '#e2e8f0';
    } else if (/^(?:llama|meta)\b/i.test(baseName)) {
      vendor = 'Meta';
      vendorColor = '#3b82f6';
    } else if (/^qwen\b/i.test(baseName)) {
      vendor = 'Qwen';
      vendorColor = '#8b5cf6';
    } else if (isGoogleBrand || matchedElement) {
      vendor = 'Google';
      vendorColor = '#4c8bf5';
      const stripped = baseName.replace(/^Gemini\s+/i, '').trim();
      if (stripped) shortName = stripped;
    }

    const canonicalSource = isOrchestrator
      ? buildOrchestratorCanonicalKey(orchSubModelBaseName || orchestratorTier || cleaned, effortKey)
      : effortKey
        ? `${baseName} (${EFFORT_META[effortKey]?.en || effortKey})`
        : baseName || cleaned;

    return {
      rawLabel: cleaned,
      baseName,
      shortName,
      badges,
      isUnavailable,
      effortKey,
      effortSource,
      effortMeta: effortKey ? EFFORT_META[effortKey] : null,
      element: matchedElement,
      isOrchestrator,
      orchestratorTier,
      orchestratorId,
      orchSubModelBaseName,
      orchSubModelShortName,
      orchSubVendor,
      orchSubAccent,
      series,
      vendor,
      vendorColor,
      canonicalKey: normalizeKey(canonicalSource),
    };
  }

  function looksLikeUsageItem(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return /^(view\s+(?:model\s+)?usage|model\s+usage|usage|查看用量|查看模型用量|模型用量|用量|额度用量|查看额度)$/i.test(t);
  }

  function looksLikeModelName(text) {
    const t = String(text || '').trim();
    if (!t || t.length < 2 || t.length > 100) return false;
    if (looksLikeUsageItem(t)) return false;
    if (/^(模型|models?|add custom model|edit custom model|models?\s*&\s*usage|manage models?|settings?|添加自定义模型|编辑自定义模型|模型与用量|管理模型|设置|搜索|search)$/i.test(t)) {
      return false;
    }
    if (/\b(gemini|orchestrator|claude|gpt|deepseek|grok|llama|qwen|mistral|flash|pro|opus|sonnet|haiku|o1|o3|o4|hydrogen|helium|carbon|neon|argon|krypton)\b/i.test(t)) {
      return true;
    }
    if (isOrchestratorText(t)) return true;
    const parsed = parseModelLabel(t);
    return !!parsed.element;
  }

  function looksLikeActionItem(text) {
    const t = String(text || '').trim();
    if (looksLikeUsageItem(t)) return false;
    return /^(add custom model|edit custom model|models?\s*&\s*usage|manage models?|custom models?|添加自定义模型|编辑自定义模型|模型与用量|管理模型|自定义模型)$/i.test(t);
  }

  function findModelTriggerButton(target) {
    if (!target || !(target instanceof Element)) return null;
    if (target.closest(`#${HOST_ID}`)) return null;
    if (target.closest('pre, code, .monaco-editor, .xterm, [data-testid="conversation-row-sidebar"], [aria-label="Agent response"], [aria-label="智能体回复"], [aria-label="User message"], [aria-label="用户消息"]')) {
      return null;
    }

    const btn = target.closest('button, [role="button"], [role="combobox"]');
    if (!btn) return null;

    const aria = (btn.getAttribute('aria-label') || '').trim();
    const title = (btn.getAttribute('title') || '').trim();
    const labelStr = `${aria} ${title}`.trim();
    if (/^(?:select\s+model|choose\s+model|model\s+selection|选择模型)/i.test(aria) ||
        /^(?:select\s+model|choose\s+model|model\s+selection|选择模型)/i.test(title)) {
      return btn;
    }

    const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
    if (testId && /(model[-_]?(selector|picker|dropdown|trigger|button))/.test(testId)) {
      return btn;
    }

    const btnText = extractOptionLinesFromDom(btn).join(' ').replace(/\s+/g, ' ').trim();
    if (btnText.length > 0 && btnText.length <= 64) {
      const hasPopupSemantics =
        btn.hasAttribute('aria-haspopup') ||
        btn.hasAttribute('aria-expanded') ||
        btn.getAttribute('role') === 'combobox' ||
        btn.hasAttribute('aria-controls') ||
        !!btn.querySelector('svg');
      if (hasPopupSemantics && (looksLikeModelName(btnText) || /^(no model selected|未选择模型|select model|选择模型)$/i.test(btnText))) {
        if (btn.closest('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-floating-ui-portal]')) {
          return null;
        }
        return btn;
      }
    }

    if (/select model|选择模型/i.test(labelStr) && !btn.closest('[role="menu"], [role="listbox"]')) {
      return btn;
    }

    return null;
  }

  function extractCurrentModelFromButton(btn) {
    if (!btn) return '';
    const aria = (btn.getAttribute('aria-label') || '').trim();
    const m = aria.match(/(?:current|当前)\s*[:：]\s*(.+)$/i);
    if (m) {
      const parsed = parseModelLabel(m[1]);
      return parsed.canonicalKey || normalizeKey(m[1]);
    }
    const text = extractOptionLinesFromDom(btn).join(' ').replace(/\s+/g, ' ').trim();
    if (text && looksLikeModelName(text)) {
      const parsed = parseModelLabel(text);
      return parsed.canonicalKey || normalizeKey(text);
    }
    return '';
  }

  // 注入零闪烁隐身 CSS：保留真实屏幕坐标（不移去 -99999px），确保 Radix/Floating UI 二级子菜单与 View Usage 正常响应 hover/click
  function ensureCloakStyle() {
    if (state.cloakStyleEl && state.cloakStyleEl.isConnected) return;
    const style = document.createElement('style');
    style.id = CLOAK_STYLE_ID;
    style.textContent = `
      html[data-ag-periodic-cloaking="1"] [role="listbox"],
      html[data-ag-periodic-cloaking="1"] [role="menu"],
      html[data-ag-periodic-cloaking="1"] [data-radix-popper-content-wrapper],
      html[data-ag-periodic-cloaking="1"] [data-radix-menu-content],
      html[data-ag-periodic-cloaking="1"] [data-floating-ui-portal],
      html[data-ag-periodic-cloaking="1"] [data-side],
      html[data-ag-periodic-cloaking="1"] [data-popper-placement],
      [data-ag-periodic-hidden-menu="1"] {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: none !important;
        animation: none !important;
      }
      html[data-ag-periodic-probing="1"] [role="listbox"],
      html[data-ag-periodic-probing="1"] [role="menu"],
      html[data-ag-periodic-probing="1"] [data-radix-popper-content-wrapper],
      html[data-ag-periodic-probing="1"] [data-radix-menu-content],
      html[data-ag-periodic-probing="1"] [data-floating-ui-portal],
      html[data-ag-periodic-probing="1"] [data-side],
      html[data-ag-periodic-probing="1"] [data-popper-placement],
      html[data-ag-periodic-probing="1"] [data-ag-periodic-hidden-menu="1"] {
        opacity: 0 !important;
        pointer-events: auto !important;
        transition: none !important;
        animation: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    state.cloakStyleEl = style;
  }

  function isVisibleElement(el) {
    if (!el || !(el instanceof Element) || !el.isConnected) return false;
    if (
      el.getAttribute('data-ag-periodic-hidden-menu') === '1' ||
      document.documentElement.getAttribute('data-ag-periodic-cloaking') === '1' ||
      document.documentElement.getAttribute('data-ag-periodic-probing') === '1'
    ) {
      return true;
    }
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 20 && rect.height > 20;
  }

  // 检测某主菜单项是否为带有二级子菜单（推理档位或 Orchestrator 底层模型）的 SubTrigger
  function detectRowHasSubmenu(el, parsed, isUnavailable) {
    if (!el || isUnavailable) return false;
    // 括号固定单版（如 GPT-OSS 120B (Medium)）无二级子菜单，除非 DOM 明确声明 aria-haspopup="menu"
    const hasPopupAttr =
      el.getAttribute('aria-haspopup') === 'menu' ||
      el.hasAttribute('data-radix-menu-subtrigger') ||
      (el.hasAttribute('aria-expanded') && el.getAttribute('role') === 'menuitem');
    if (hasPopupAttr) return true;
    if (parsed.isOrchestrator) return false;
    if (parsed.effortSource === 'paren') return false;
    // 图中所有带二级菜单的模型在主行均带尾部无括号当前档位（如 "Gemini 4 Neon 中"、"Claude Opus 5.5 中"）
    if (parsed.effortSource === 'tail') return true;
    // 或在配置/缓存中已知具备二级子菜单
    const baseKey = String(parsed.baseName || '').toLowerCase();
    if (CONFIG.knownSubmenuEfforts && Array.isArray(CONFIG.knownSubmenuEfforts[baseKey])) {
      return true;
    }
    if (cachedSubmenuEfforts && Array.isArray(cachedSubmenuEfforts[baseKey])) {
      return true;
    }
    return false;
  }

  // 从原版主菜单容器中提取模型项、功能项与 View Usage 触发项
  function extractItemsFromMenu(menuEl, triggerBtn) {
    if (!menuEl || !(menuEl instanceof Element)) return { modelItems: [], actionItems: [], usageTriggerEl: null };

    const explicitRoleItems = Array.from(
      menuEl.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], [data-radix-collection-item]')
    );
    const rawCandidates = explicitRoleItems.length >= 2
      ? explicitRoleItems
      : Array.from(menuEl.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], button, li, [tabindex]'));

    const candidateSet = new Set(rawCandidates);
    const leafItems = rawCandidates.filter((el) => {
      if (el === menuEl || el === triggerBtn) return false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return false;
      for (const other of candidateSet) {
        if (other !== el && el.contains(other)) {
          const otherLines = extractOptionLinesFromDom(other);
          const otherFirstLine = otherLines[0] || '';
          if (looksLikeModelName(otherFirstLine) || looksLikeActionItem(otherFirstLine) || looksLikeUsageItem(otherFirstLine)) {
            return false;
          }
        }
      }
      return true;
    });

    const seenKeys = new Set();
    const modelItems = [];
    const actionItems = [];
    let usageTriggerEl = null;
    const currentFromBtn = extractCurrentModelFromButton(triggerBtn);

    const pushParsedItem = (parsed, subtitle, targetEl, extra = {}) => {
      if (!parsed) return;
      const dedupKey = extra.hasSubmenu ? `sub:${parsed.baseName.toLowerCase()}` : parsed.canonicalKey;
      if (seenKeys.has(dedupKey)) return;
      seenKeys.add(dedupKey);

      const isDisabled =
        !!parsed.isUnavailable ||
        !!extra.isUnavailable ||
        targetEl.hasAttribute('disabled') ||
        targetEl.getAttribute('aria-disabled') === 'true' ||
        targetEl.hasAttribute('data-disabled');

      const isSelected =
        !isDisabled &&
        (targetEl.getAttribute('aria-selected') === 'true' ||
          targetEl.getAttribute('aria-checked') === 'true' ||
          targetEl.getAttribute('aria-pressed') === 'true' ||
          targetEl.getAttribute('data-state') === 'checked' ||
          targetEl.getAttribute('data-state') === 'on' ||
          targetEl.getAttribute('data-selected') === 'true' ||
          (!!currentFromBtn && parsed.canonicalKey === currentFromBtn));

      modelItems.push({
        ...parsed,
        subtitle,
        disabled: isDisabled,
        unavailable: isDisabled,
        selected: isSelected,
        hasSubmenu: !!extra.hasSubmenu,
        viaSubmenu: !!extra.viaSubmenu,
        parentEl: extra.parentEl || targetEl,
        el: targetEl,
        source: 'native',
      });
    };

    for (const el of leafItems) {
      const lines = extractOptionLinesFromDom(el);
      if (!lines.length) continue;

      let primaryLine = lines[0] || '';
      const subtitle = lines.slice(1).join(' · ');

      if (looksLikeUsageItem(primaryLine) || looksLikeUsageItem(lines.join(' '))) {
        usageTriggerEl = el;
        continue;
      }

      if (looksLikeActionItem(primaryLine)) {
        actionItems.push({ label: primaryLine, el });
        continue;
      }

      // 检查单行内嵌多个档位/版本子按钮（兼容未来可能形态）
      const innerBtns = Array.from(
        el.querySelectorAll('button, [role="button"], [role="radio"], [role="option"], [role="menuitemradio"]')
      ).filter((b) => b !== el);

      const inlineOrchBtns = [];
      for (const b of innerBtns) {
        const bText = extractOptionLinesFromDom(b).join(' ').trim();
        const tier = bText && bText.length <= 24 ? detectOrchestratorTier(bText) : null;
        if (tier && !looksLikeModelName(bText.replace(/neon|argon|氖|氩/gi, '').trim())) {
          inlineOrchBtns.push({ btn: b, tier });
        }
      }
      if (inlineOrchBtns.length >= 2) {
        const skipSet = new Set(inlineOrchBtns.map((x) => x.btn));
        const headText = extractOptionLinesFromDom(el, skipSet).join(' ');
        if (isOrchestratorText(headText)) {
          for (const entry of inlineOrchBtns) {
            const parsed = parseModelLabel(`Orchestrator (${entry.tier})`, '');
            pushParsedItem(parsed, '', entry.btn, { hasSubmenu: false, viaSubmenu: false });
          }
          continue;
        }
      }

      const inlineEffortBtns = [];
      for (const b of innerBtns) {
        const bText = extractOptionLinesFromDom(b).join(' ').trim().toLowerCase().replace(/\s+/g, ' ');
        if (bText && EFFORT_SYNONYMS.has(bText)) {
          inlineEffortBtns.push({ btn: b, effortKey: EFFORT_SYNONYMS.get(bText) });
        }
      }
      if (inlineEffortBtns.length >= 2) {
        const skipSet = new Set(inlineEffortBtns.map((x) => x.btn));
        const headLines = extractOptionLinesFromDom(el, skipSet);
        const headPrimary = headLines[0] || '';
        const headSubtitle = headLines.slice(1).join(' · ');
        if (looksLikeModelName(headPrimary) && !isOrchestratorText(headPrimary) && !isOrchestratorText(headSubtitle)) {
          for (const entry of inlineEffortBtns) {
            const meta = EFFORT_META[entry.effortKey] || EFFORT_META.default;
            const parsed = parseModelLabel(`${headPrimary} (${meta.en})`, headSubtitle);
            pushParsedItem(parsed, headSubtitle, entry.btn, { hasSubmenu: false, viaSubmenu: false });
          }
          continue;
        }
      }

      if ((isOrchestratorText(primaryLine) || isOrchestratorText(subtitle)) && !detectOrchestratorTier(primaryLine)) {
        const subTier = detectOrchestratorTier(subtitle);
        if (subTier) primaryLine = `${primaryLine} (${subTier})`;
      }

      if (!looksLikeModelName(primaryLine) && !isOrchestratorText(subtitle)) continue;

      const parsed = parseModelLabel(primaryLine, subtitle);
      const isUnavail =
        parsed.isUnavailable ||
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('data-disabled') ||
        /\bunavailable\b|不可用/i.test(`${primaryLine} ${subtitle}`);
      const hasSubmenu = detectRowHasSubmenu(el, parsed, isUnavail);

      pushParsedItem(parsed, subtitle, el, {
        isUnavailable: isUnavail,
        hasSubmenu,
        viaSubmenu: hasSubmenu,
        parentEl: el,
      });
    }

    return { modelItems, actionItems, usageTriggerEl };
  }

  function findNativeModelMenu(triggerBtn, preExistingMenus) {
    for (const attr of ['aria-controls', 'aria-owns']) {
      const id = triggerBtn?.getAttribute(attr);
      if (id) {
        const controlled = document.getElementById(id);
        if (controlled && isVisibleElement(controlled)) {
          const extracted = extractItemsFromMenu(controlled, triggerBtn);
          if (extracted.modelItems.length >= 1) {
            return { menuEl: controlled, ...extracted };
          }
        }
      }
    }

    const selector = [
      '[role="listbox"]',
      '[role="menu"]',
      '[data-radix-popper-content-wrapper]',
      '[data-radix-menu-content]',
      '[data-floating-ui-portal]',
      '[data-state="open"]',
      '[role="dialog"]',
      '.context-view',
      '.monaco-list',
    ].join(', ');

    const candidates = Array.from(document.querySelectorAll(selector)).filter((el) => {
      if (el.closest(`#${HOST_ID}`)) return false;
      if (el.contains(triggerBtn)) return false;
      return isVisibleElement(el);
    });

    candidates.sort((a, b) => {
      const aNew = preExistingMenus.has(a) ? 0 : 1;
      const bNew = preExistingMenus.has(b) ? 0 : 1;
      if (aNew !== bNew) return bNew - aNew;
      return a.querySelectorAll('*').length - b.querySelectorAll('*').length;
    });

    let best = null;
    for (const el of candidates) {
      const extracted = extractItemsFromMenu(el, triggerBtn);
      if (extracted.modelItems.length >= 1) {
        if (!best || extracted.modelItems.length > best.modelItems.length) {
          best = { menuEl: el, ...extracted };
        }
      }
    }
    if (best) return best;

    const portals = Array.from(document.body.children).filter((el) => {
      if (el.id === HOST_ID || el.contains(triggerBtn)) return false;
      const st = getComputedStyle(el);
      return (st.position === 'fixed' || st.position === 'absolute' || Number(st.zIndex) >= 10) && isVisibleElement(el);
    });
    for (let i = portals.length - 1; i >= 0; i--) {
      const extracted = extractItemsFromMenu(portals[i], triggerBtn);
      if (extracted.modelItems.length >= 2) {
        return { menuEl: portals[i], ...extracted };
      }
    }

    return null;
  }

  // ============================================================================
  // 二级子菜单（推理档位 & View Usage 用量）实时解析与静默探测引擎
  // ============================================================================

  // 从二级档位子菜单 DOM 中提取该模型 100% 真实的档位选项列表
  function parseSubmenuEffortItems(subMenuEl) {
    if (!subMenuEl || !(subMenuEl instanceof Element)) return [];
    const candidates = Array.from(
      subMenuEl.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], [data-radix-collection-item], button, li')
    );
    const items = [];
    const seen = new Set();
    for (const el of candidates) {
      if (el === subMenuEl) continue;
      // 跳过包含其他候选子项的外层容器
      if (candidates.some((o) => o !== el && el.contains(o))) continue;
      const lines = extractOptionLinesFromDom(el);
      const rawText = (lines[0] || '').replace(/[✓✔]/g, '').trim();
      if (!rawText) continue;
      const low = rawText.toLowerCase().replace(/\s+/g, ' ');
      const effortKey = EFFORT_SYNONYMS.get(low);
      if (!effortKey || seen.has(effortKey)) continue;
      seen.add(effortKey);

      const isChecked =
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('aria-selected') === 'true' ||
        el.getAttribute('data-state') === 'checked' ||
        el.getAttribute('data-selected') === 'true' ||
        /[✓✔]/.test(el.textContent || '') ||
        !!el.querySelector('svg');

      items.push({
        effortKey,
        nativeLabel: rawText,
        checked: isChecked,
        el,
      });
    }
    return items;
  }

  // 从 Orchestrator 二级子菜单 DOM 中提取底层可选模型列表（如 Gemini 4 Neon / Gemini 4 Argon / Claude Opus 5.5 及未来新增模型）
  function parseOrchestratorSubmenuModels(subMenuEl) {
    if (!subMenuEl || !(subMenuEl instanceof Element)) return [];
    const candidates = Array.from(
      subMenuEl.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], [data-radix-collection-item], button, li')
    );
    const items = [];
    const seen = new Set();
    for (const el of candidates) {
      if (el === subMenuEl) continue;
      if (candidates.some((o) => o !== el && el.contains(o))) continue;
      const lines = extractOptionLinesFromDom(el);
      const rawText = (lines[0] || '').trim();
      if (!rawText) continue;
      if (looksLikeUsageItem(rawText) || isOrchestratorText(rawText)) continue;
      const lowClean = rawText.replace(/[✓✔]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (EFFORT_SYNONYMS.has(lowClean)) continue;
      if (!looksLikeModelName(rawText)) continue;

      const parsed = parseModelLabel(rawText, lines.slice(1).join(' · '));
      if (!parsed || !parsed.baseName || parsed.isOrchestrator) continue;

      const key = parsed.baseName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const hasLevel3 =
        el.getAttribute('aria-haspopup') === 'menu' ||
        el.hasAttribute('data-radix-menu-subtrigger') ||
        (el.hasAttribute('aria-expanded') && el.getAttribute('role') === 'menuitem') ||
        parsed.effortSource === 'tail';
      const isDisabled =
        !!parsed.isUnavailable ||
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.hasAttribute('data-disabled');
      const isChecked =
        !isDisabled &&
        (el.getAttribute('aria-checked') === 'true' ||
          el.getAttribute('aria-selected') === 'true' ||
          el.getAttribute('data-state') === 'checked');

      items.push({
        key,
        baseName: parsed.baseName,
        shortName: getOrchestratorSubModelShortName(parsed.baseName),
        vendor: parsed.vendor || 'Google',
        accent: getOrchestratorSubModelAccent(parsed.baseName, parsed.vendor || 'Google'),
        nativeLabel: rawText,
        currentEffortKey: parsed.effortKey || null,
        hasLevel3,
        disabled: isDisabled,
        checked: isChecked,
        el,
      });
    }
    return items;
  }

  // 解析 View Usage 二级弹窗文本为结构化额度池数组（同时支持多行、同行、单池紧凑行）
  function parseUsagePanelLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return [];
    const pools = [];
    let currentPool = null;
    let currentBucket = null; // 'weekly' | '5h' | 'pending'

    const ensurePool = (title) => {
      const cleanTitle = String(title || '').trim();
      if (!cleanTitle) return null;
      const poolId = cleanTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
      let found = pools.find((p) => p.poolId === poolId);
      if (!found) {
        found = {
          poolId,
          title: cleanTitle,
          weekly: null,
          fiveHour: null,
          _pendingPct: null,
          _pendingReset: '',
        };
        pools.push(found);
      }
      return found;
    };

    const parsePctFromLine = (line) => {
      // 必须明确带 left/remaining/剩余/used/已用 后缀或中文前缀，防止误抓普通文本中的任意百分号
      const m = line.match(/\b(\d{1,3}(?:\.\d+)?)\s*%\s*(?:(left|remaining|used)\b|(剩余|已用))|(剩余|已用)\s*(\d{1,3}(?:\.\d+)?)\s*%/i);
      if (!m) return null;
      let val = Number(m[1] !== undefined ? m[1] : m[5]);
      if (Number.isNaN(val)) return null;
      const suffix = m[2] || m[3] || m[4] || '';
      if (/^(used|已用)$/i.test(suffix)) {
        val = 100 - val;
      }
      return Math.max(0, Math.min(100, Math.round(val)));
    };

    const isResetLine = (line) => /(?:resets?\s+in\b|重置于|后重置|将于.*重置|距离重置|后恢复)/i.test(line);
    const isWeeklyKeyword = (line) => /(?:周额度|每周|周限额|周上限|\bweekly\b)/i.test(line);
    const isFiveHourKeyword = (line) => /(?:\b5\s*h\b|5\s*小时|5\s*hours?)/i.test(line);

    const assignPct = (pool, bucket, pct, resetText = '') => {
      if (!pool || pct === null) return;
      if (bucket === '5h') {
        pool.fiveHour = { pct, resetText: resetText || pool.fiveHour?.resetText || '' };
      } else if (bucket === 'weekly') {
        pool.weekly = { pct, resetText: resetText || pool.weekly?.resetText || '' };
      } else {
        pool._pendingPct = pct;
        if (resetText) pool._pendingReset = resetText;
      }
    };

    const attachReset = (pool, bucket, resetText) => {
      if (!pool || !resetText) return;
      if (bucket === '5h') {
        if (!pool.fiveHour) pool.fiveHour = { pct: null, resetText };
        else pool.fiveHour.resetText = resetText;
      } else if (bucket === 'weekly') {
        if (!pool.weekly) pool.weekly = { pct: null, resetText };
        else pool.weekly.resetText = resetText;
      } else if (pool._pendingPct !== null) {
        pool.weekly = { pct: pool._pendingPct, resetText };
        pool._pendingPct = null;
        pool._pendingReset = '';
      } else {
        pool._pendingReset = resetText;
      }
    };

    for (const raw of lines) {
      const line = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!line || line.length > 90) continue;
      if (/^(用量|usage|model\s*usage|view\s*usage|额度|额度用量)$/i.test(line)) continue;

      const pct = parsePctFromLine(line);
      const hasWeekly = isWeeklyKeyword(line);
      const has5h = isFiveHourKeyword(line);
      const hasReset = isResetLine(line);

      // 剥离百分比和 reset 后判断本行是否携带新的池标题（例如图 7 底部："Gemini 4 Argon 40% left"）
      const strippedTitle = line
        .replace(/(?:\b\d{1,3}(?:\.\d+)?\s*%\s*(?:(?:left|remaining|used)\b|剩余|已用)|(?:剩余|已用)\s*\d{1,3}(?:\.\d+)?\s*%)/gi, '')
        .replace(/(?:weekly\s+limit\s*,?\s*)?resets?\s+in\s+[^·|]+/gi, '')
        .trim();

      // 池标题必须是简洁短词（2~42 字、不含句子标点），彻底杜绝聊天段落混入
      const looksLikePoolHeader =
        strippedTitle.length >= 2 &&
        strippedTitle.length <= 42 &&
        !/[，。：；！？!?,;()（）`~]/.test(strippedTitle) &&
        !hasWeekly &&
        !has5h &&
        !hasReset &&
        /(?:gemini|claude|gpt|model|模型|argon|neon|hydrogen|carbon|flash|orchestrator|openai|anthropic|deepseek)/i.test(strippedTitle);

      if (looksLikePoolHeader) {
        if (currentPool && currentPool._pendingPct !== null && !currentPool.weekly) {
          currentPool.weekly = { pct: currentPool._pendingPct, resetText: currentPool._pendingReset || '' };
          currentPool._pendingPct = null;
        }
        currentPool = ensurePool(strippedTitle);
        currentBucket = 'pending';
        if (pct !== null) {
          assignPct(currentPool, 'pending', pct);
        }
        continue;
      }

      if (!currentPool) continue;

      if (has5h) {
        currentBucket = '5h';
        if (currentPool._pendingPct !== null && !currentPool.fiveHour) {
          currentPool.fiveHour = { pct: currentPool._pendingPct, resetText: hasReset ? line : (currentPool._pendingReset || '') };
          currentPool._pendingPct = null;
        }
        if (pct !== null) assignPct(currentPool, '5h', pct, hasReset ? line : '');
        else if (hasReset) attachReset(currentPool, '5h', line);
        continue;
      }

      if (hasWeekly) {
        currentBucket = 'weekly';
        if (currentPool._pendingPct !== null && !currentPool.weekly) {
          currentPool.weekly = { pct: currentPool._pendingPct, resetText: hasReset ? line : (currentPool._pendingReset || '') };
          currentPool._pendingPct = null;
        }
        if (pct !== null) assignPct(currentPool, 'weekly', pct, hasReset ? line : '');
        else if (hasReset) attachReset(currentPool, 'weekly', line);
        continue;
      }

      if (hasReset) {
        const cleanReset = line.replace(/(?:\b\d{1,3}(?:\.\d+)?\s*%\s*(?:(?:left|remaining|used)\b|剩余|已用)|(?:剩余|已用)\s*\d{1,3}(?:\.\d+)?\s*%)/gi, '').trim();
        if (pct !== null) assignPct(currentPool, currentBucket, pct, cleanReset);
        else attachReset(currentPool, currentBucket, cleanReset);
        continue;
      }

      if (pct !== null) {
        assignPct(currentPool, currentBucket, pct);
      }
    }

    if (currentPool && currentPool._pendingPct !== null && !currentPool.weekly) {
      currentPool.weekly = { pct: currentPool._pendingPct, resetText: currentPool._pendingReset || '' };
      currentPool._pendingPct = null;
    }

    return pools
      .map((p) => ({
        poolId: p.poolId,
        title: p.title,
        weekly: p.weekly && typeof p.weekly.pct === 'number' ? p.weekly : null,
        fiveHour: p.fiveHour && typeof p.fiveHour.pct === 'number' ? p.fiveHour : null,
      }))
      .filter((p) => p.weekly !== null || p.fiveHour !== null);
  }

  const NON_POPOVER_GUARD_SELECTOR =
    '[aria-label="Agent response"], [aria-label="智能体回复"], [aria-label="User message"], [aria-label="用户消息"], .monaco-editor, .xterm, textarea';

  // 严格校验容器是否为干净的紧凑浮层（绝对排除主页面根节点 #root、聊天记录、编辑器与包含主菜单的祖先）
  function isExcludedNonPopoverContainer(el, nativeMenuEl, maxTextLen = 1200) {
    if (!el || !(el instanceof Element) || !el.isConnected) return true;
    if (el === document.body || el === document.documentElement) return true;
    if (el.id === HOST_ID || el.id === 'root' || el.id === 'app' || el.closest(`#${HOST_ID}`)) return true;
    if (state.triggerBtn && el.contains(state.triggerBtn)) return true;
    if (nativeMenuEl && (el === nativeMenuEl || el.contains(nativeMenuEl))) return true;
    if (el.closest(NON_POPOVER_GUARD_SELECTOR)) return true;
    if (typeof el.querySelector === 'function' && el.querySelector(NON_POPOVER_GUARD_SELECTOR)) return true;
    const textLen = (el.textContent || '').length;
    if (textLen === 0 || textLen > maxTextLen) return true;
    return false;
  }

  // 通过文本节点精准定位刚弹出的 View Usage 紧凑浮层（不依赖 role 属性，同时 100% 跳过聊天窗口）
  function findUsagePopoverByText(nativeMenuEl, ignoredMenus = null) {
    const usageTextRe = /\b\d{1,3}(?:\.\d+)?\s*%\s*(?:(?:left|remaining|used)\b|剩余|已用)|(?:剩余|已用)\s*\d{1,3}(?:\.\d+)?\s*%/i;
    const hitEls = [];

    const visitNode = (node) => {
      if (!node) return;
      if (node.nodeType === 1) {
        const tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'PRE' || tag === 'CODE' || tag === 'TEXTAREA') return;
        if (node.id === HOST_ID) return;
        if (nativeMenuEl && node === nativeMenuEl) return;
        if (typeof node.matches === 'function' && node.matches(NON_POPOVER_GUARD_SELECTOR)) return;
        for (const ch of node.childNodes) visitNode(ch);
        return;
      }
      if (node.nodeType === 3) {
        const val = String(node.nodeValue || '');
        if (val.length <= 80 && usageTextRe.test(val) && node.parentNode && node.parentNode.nodeType === 1) {
          hitEls.push(node.parentNode);
        }
      }
    };

    if (typeof document.createTreeWalker === 'function' && typeof NodeFilter !== 'undefined') {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest(`#${HOST_ID}, pre, code, ${NON_POPOVER_GUARD_SELECTOR}`)) return NodeFilter.FILTER_REJECT;
          if (nativeMenuEl && nativeMenuEl.contains(p)) return NodeFilter.FILTER_REJECT;
          const val = String(node.nodeValue || '');
          return val.length <= 80 && usageTextRe.test(val) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      let n;
      while ((n = walker.nextNode())) {
        if (n.parentElement) hitEls.push(n.parentElement);
      }
    } else {
      visitNode(document.body);
    }

    let bestContainer = null;
    let bestPoolCount = 0;
    const visitedParents = new Set();

    for (const startEl of hitEls) {
      let cur = startEl;
      let candidate = null;
      let candidatePools = 0;
      for (let depth = 0; cur && depth < 12; depth++, cur = cur.parentNode) {
        if (cur.nodeType !== 1) break;
        if (isExcludedNonPopoverContainer(cur, nativeMenuEl, 1200)) break;
        if (ignoredMenus && ignoredMenus.has(cur)) continue;
        if (visitedParents.has(cur)) continue;
        const pools = parseUsagePanelLines(extractOptionLinesFromDom(cur));
        if (pools.length >= candidatePools && pools.length >= 1) {
          candidate = cur;
          candidatePools = pools.length;
        }
      }
      if (candidate) {
        visitedParents.add(candidate);
        if (candidatePools > bestPoolCount) {
          bestContainer = candidate;
          bestPoolCount = candidatePools;
        }
      }
    }
    return bestContainer;
  }

  // 查找当前页面中与 triggerRow 对应的已弹出二/三级子菜单（mode: 'effort' | 'orchestrator' | 'usage'，严格禁止误扫主界面与聊天区）
  function findActiveSubmenu(nativeMenuEl, triggerRow, mode, ignoredMenus = null) {
    const maxLen = mode === 'effort' ? 360 : mode === 'orchestrator' ? 680 : 1200;

    const matchesMode = (el) => {
      if (triggerRow && (el === triggerRow || el.contains(triggerRow))) return false;
      if (mode === 'effort') return parseSubmenuEffortItems(el).length >= 1;
      if (mode === 'orchestrator') return parseOrchestratorSubmenuModels(el).length >= 1;
      if (mode === 'usage') return parseUsagePanelLines(extractOptionLinesFromDom(el)).length >= 1;
      return false;
    };

    // 1. 优先通过标准 ARIA 关联 ID 查找（Radix / Base UI SubTrigger 打开时常写入 aria-controls）
    for (const attr of ['aria-controls', 'aria-owns']) {
      const id = triggerRow?.getAttribute(attr);
      if (id) {
        const ctrl = document.getElementById(id);
        if (ctrl && !isExcludedNonPopoverContainer(ctrl, nativeMenuEl, maxLen)) {
          if (matchesMode(ctrl)) return ctrl;
        }
      }
    }

    // 2. 扫描已知浮层/弹窗选择器（不再盲扫 document.body.children 中的 #root 主页面！）
    const selector = [
      '[role="menu"]',
      '[role="listbox"]',
      '[role="dialog"]',
      '[data-radix-menu-content]',
      '[data-radix-popper-content-wrapper]',
      '[data-floating-ui-portal]',
      '[data-side]',
      '[data-popper-placement]',
      '[data-state="open"]',
    ].join(', ');

    const candidateSet = new Set();
    for (const el of document.querySelectorAll(selector)) candidateSet.add(el);
    if (nativeMenuEl && nativeMenuEl.parentElement && nativeMenuEl.parentElement !== document.body) {
      for (const sib of nativeMenuEl.parentElement.children) candidateSet.add(sib);
    }

    const nodes = Array.from(candidateSet).filter((el) => {
      if (isExcludedNonPopoverContainer(el, nativeMenuEl, maxLen)) return false;
      if (ignoredMenus && ignoredMenus.has(el)) return false;
      if (nativeMenuEl && nativeMenuEl.contains(el)) return false;
      if (triggerRow && (el === triggerRow || el.contains(triggerRow))) return false;
      return true;
    });

    for (let i = nodes.length - 1; i >= 0; i--) {
      const el = nodes[i];
      if (matchesMode(el)) return el;
    }

    // 3. 对 View Usage 额外执行 TreeWalker 文本反查：哪怕浮层是无任何 role 的普通 div 也能精准命中，且 100% 跳过聊天区
    if (mode === 'usage') {
      const byText = findUsagePopoverByText(nativeMenuEl, ignoredMenus);
      if (byText) return byText;
    }

    // 4. 局部子浮层兜底（Tailwind absolute left-full 渲染在 triggerRow 内部或同级）
    if (triggerRow && triggerRow.isConnected) {
      const localCands = [
        ...Array.from(triggerRow.children || []),
        ...(triggerRow.parentElement ? Array.from(triggerRow.parentElement.children) : []),
      ];
      for (const el of localCands) {
        if (!el || el === triggerRow || el === nativeMenuEl) continue;
        if (isExcludedNonPopoverContainer(el, nativeMenuEl, maxLen)) continue;
        if (ignoredMenus && ignoredMenus.has(el)) continue;
        if (mode === 'effort') {
          if (parseSubmenuEffortItems(el).length >= 2) return el;
        } else if (mode === 'orchestrator') {
          if (parseOrchestratorSubmenuModels(el).length >= 1) return el;
        } else if (mode === 'usage') {
          if (parseUsagePanelLines(extractOptionLinesFromDom(el)).length >= 1) return el;
        }
      }
    }
    return null;
  }

  // 收集当前页面中所有属于原版二级子菜单的浮动容器，用于开启前快照防串台
  function snapshotExistingSubmenus(nativeMenuEl) {
    const set = new Set();
    const selector = '[role="menu"], [role="listbox"], [role="dialog"], [data-radix-menu-content], [data-radix-popper-content-wrapper], [data-floating-ui-portal], [data-side], [data-popper-placement]';
    for (const el of document.querySelectorAll(selector)) {
      if (!el || !el.isConnected) continue;
      if (el.closest(`#${HOST_ID}`)) continue;
      if (nativeMenuEl && (el === nativeMenuEl || el.contains(nativeMenuEl) || nativeMenuEl.contains(el))) continue;
      set.add(el);
    }
    return set;
  }

  // 找一个主菜单中没有二级菜单的行（如 Orchestrator 或 GPT-OSS），用于悬停重置关闭上一个展开的二级子菜单
  function findNeutralMenuRow() {
    const item = state.lastNativeModelItems.find((x) => !x.hasSubmenu && !x.unavailable && x.el && x.el.isConnected);
    return item ? item.el : null;
  }

  function dispatchHoverOpenSubmenu(triggerRow, useKeyboardFallback = false) {
    if (!triggerRow || !triggerRow.isConnected) return;
    const rect = triggerRow.getBoundingClientRect();
    const clientX = Math.max(1, rect.left + Math.min(24, rect.width / 2));
    const clientY = Math.max(1, rect.top + Math.min(14, rect.height / 2));
    const mouseOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY };
    const ptrOpts = { ...mouseOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true };

    const targets = [triggerRow];
    if (triggerRow.firstElementChild) targets.push(triggerRow.firstElementChild);

    try {
      for (const t of targets) {
        if (typeof PointerEvent === 'function') {
          t.dispatchEvent(new PointerEvent('pointerover', ptrOpts));
          t.dispatchEvent(new PointerEvent('pointerenter', { ...ptrOpts, bubbles: false, cancelable: false }));
        }
        t.dispatchEvent(new MouseEvent('mouseover', mouseOpts));
        t.dispatchEvent(new MouseEvent('mouseenter', { ...mouseOpts, bubbles: false, cancelable: false }));
        if (typeof PointerEvent === 'function') {
          t.dispatchEvent(new PointerEvent('pointermove', { ...ptrOpts, clientX: clientX + 3, clientY: clientY + 1 }));
        }
        t.dispatchEvent(new MouseEvent('mousemove', { ...mouseOpts, clientX: clientX + 3, clientY: clientY + 1 }));
      }
      if (useKeyboardFallback) {
        if (typeof triggerRow.focus === 'function') triggerRow.focus({ preventScroll: true });
        triggerRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }));
      }
    } catch {}
  }

  function dispatchQuietLeaveSubmenu(triggerRow, subMenuEl) {
    try {
      if (subMenuEl && subMenuEl.isConnected) {
        subMenuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true }));
      }
      if (triggerRow && triggerRow.isConnected) {
        if (typeof PointerEvent === 'function') {
          triggerRow.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', pointerId: 1 }));
          triggerRow.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse', pointerId: 1 }));
        }
        triggerRow.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        triggerRow.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
      }
    } catch {}
  }

  function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 等待二级子菜单出现（三段渐进触发：hover -> focus+ArrowRight -> usage 模式下补 click 展开，并严格防旧菜单串台）
  async function openAndWaitSubmenu(nativeMenuEl, triggerRow, mode, maxWaitMs = 300) {
    if (!triggerRow || !triggerRow.isConnected) return null;

    const ownCtrlId = triggerRow.getAttribute('aria-controls') || triggerRow.getAttribute('aria-owns');
    if (ownCtrlId && (triggerRow.getAttribute('aria-expanded') === 'true' || triggerRow.getAttribute('data-state') === 'open')) {
      const ownSub = findActiveSubmenu(nativeMenuEl, triggerRow, mode, null);
      if (ownSub) return ownSub;
    }

    const ignoredMenus = snapshotExistingSubmenus(nativeMenuEl);
    dispatchHoverOpenSubmenu(triggerRow, false);

    const start = Date.now();
    let kbdTried = false;
    let clickTried = false;
    while (Date.now() - start < maxWaitMs) {
      const sub = findActiveSubmenu(nativeMenuEl, triggerRow, mode, ignoredMenus);
      if (sub) return sub;
      const elapsed = Date.now() - start;
      if (!kbdTried && elapsed >= 90) {
        kbdTried = true;
        dispatchHoverOpenSubmenu(triggerRow, true);
      }
      // 对 View Usage 子菜单：若 hover + ArrowRight 220ms 后仍未展开，补一次安全点击 SubTrigger 展开
      if (mode === 'usage' && !clickTried && elapsed >= 220) {
        clickTried = true;
        dispatchRealClick(triggerRow);
      }
      await sleepMs(20);
    }
    if (triggerRow.getAttribute('aria-expanded') === 'true' || triggerRow.getAttribute('data-state') === 'open') {
      return findActiveSubmenu(nativeMenuEl, triggerRow, mode, null);
    }
    return findActiveSubmenu(nativeMenuEl, triggerRow, mode, ignoredMenus);
  }

  async function closeSubmenuAndWaitGone(triggerRow, subMenuEl) {
    dispatchQuietLeaveSubmenu(triggerRow, subMenuEl);
    const neutral = findNeutralMenuRow();
    if (neutral && neutral !== triggerRow) {
      dispatchHoverOpenSubmenu(neutral, false);
    }
    const start = Date.now();
    while (subMenuEl && subMenuEl.isConnected && Date.now() - start < 140) {
      await sleepMs(20);
    }
  }

  // ============================================================================
  // 额度池 -> 模型匹配与 SVG 单层 / 双层边框生成
  // ============================================================================

  function getQuotaForTarget({ baseName = '', vendor = 'Other', isOrchestrator = false, orchestratorTier = '' }) {
    const pools = state.usageData && Array.isArray(state.usageData.pools) ? state.usageData.pools : [];
    if (!pools.length) return null;

    const targetLow = `${baseName} ${orchestratorTier}`.toLowerCase();

    // 1. 精确模型专属池优先（例如 "Gemini 4 Argon" 池只匹配 Argon，不误套给 Neon/Hydrogen/Flash）
    for (const pool of pools) {
      const pLow = pool.title.toLowerCase();
      // 跳过通用聚合池（如 "Gemini 模型" / "Claude 和 GPT 模型"）
      const isGenericPool = /模型|models?$/i.test(pool.title.trim()) && !/\b(argon|neon|hydrogen|carbon|flash|opus|sonnet|gpt-oss)\b/i.test(pLow);
      if (isGenericPool) continue;
      for (const kw of ['argon', 'neon', 'hydrogen', 'carbon', '3.8 flash', 'opus', 'sonnet', 'gpt-oss']) {
        if (pLow.includes(kw) && targetLow.includes(kw)) {
          return pool;
        }
      }
    }

    // 2. 优先匹配第三方厂商通用聚合池（防止 Orchestrator 内的 Claude Opus 5.5 误套到 Gemini 池）
    if (vendor === 'Anthropic' || vendor === 'OpenAI' || /\bclaude\b|\bgpt\b|\bopus\b|\bsonnet\b/i.test(targetLow)) {
      const cgPool = pools.find((p) => /claude|gpt/i.test(p.title));
      if (cgPool) return cgPool;
    }

    // 3. 匹配 Gemini 系列通用聚合池
    if (vendor === 'Google' || isOrchestrator || /\bgemini\b|\bflash\b/i.test(targetLow)) {
      const geminiPool = pools.find((p) => /gemini/i.test(p.title) && !/\b(argon|neon|hydrogen|carbon)\b/i.test(p.title.toLowerCase()));
      if (geminiPool) return geminiPool;
    }

    return null;
  }

  function getQuotaForGroup(grp) {
    if (!grp || grp.unavailable) return null;
    if (grp.kind === 'orchestrator') {
      const activeSub =
        (Array.isArray(grp.subModels) &&
          (grp.subModels.find((sm) => sm.variants.some((v) => v.canonicalKey === state.activeModelKey)) ||
            grp.subModels.find((sm) => sm.key === grp.defaultSubModelKey) ||
            grp.subModels[0])) ||
        null;
      if (activeSub) {
        return getQuotaForTarget({
          baseName: activeSub.baseName,
          vendor: activeSub.vendor || 'Google',
          isOrchestrator: true,
          orchestratorTier: activeSub.shortName || '',
        });
      }
      return getQuotaForTarget({ baseName: 'Gemini', vendor: 'Google', isOrchestrator: true });
    }
    return getQuotaForTarget({
      baseName: grp.baseName || '',
      vendor: grp.vendor || (grp.kind === 'element' || grp.kind === 'google-classic' ? 'Google' : 'Other'),
      isOrchestrator: false,
    });
  }

  function getWeeklyStrokeColor(pct) {
    if (pct <= 5) return '#ef4444';
    if (pct <= 20) return '#f59e0b';
    return '#34d399'; // 翡翠绿（对应周额度外层边框）
  }

  function getFiveHourStrokeColor(pct) {
    if (pct <= 5) return '#f43f5e';
    if (pct <= 20) return '#fb923c';
    return '#38bdf8'; // 亮天蓝（对应 5h 额度内层边框）
  }

  // 生成从顶部正中（12点钟方向）顺时针绕满一整圈的圆角矩形 SVG 路径
  function buildClockwiseRoundedRectPath(x, y, w, h, r) {
    const cr = Math.max(0, Math.min(r, w / 2, h / 2));
    const mx = x + w / 2;
    const x2 = x + w;
    const y2 = y + h;
    return [
      `M ${mx.toFixed(2)} ${y.toFixed(2)}`,
      `L ${(x2 - cr).toFixed(2)} ${y.toFixed(2)}`,
      `A ${cr.toFixed(2)} ${cr.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${(y + cr).toFixed(2)}`,
      `L ${x2.toFixed(2)} ${(y2 - cr).toFixed(2)}`,
      `A ${cr.toFixed(2)} ${cr.toFixed(2)} 0 0 1 ${(x2 - cr).toFixed(2)} ${y2.toFixed(2)}`,
      `L ${(x + cr).toFixed(2)} ${y2.toFixed(2)}`,
      `A ${cr.toFixed(2)} ${cr.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${(y2 - cr).toFixed(2)}`,
      `L ${x.toFixed(2)} ${(y + cr).toFixed(2)}`,
      `A ${cr.toFixed(2)} ${cr.toFixed(2)} 0 0 1 ${(x + cr).toFixed(2)} ${y.toFixed(2)}`,
      `Z`,
    ].join(' ');
  }

  // 渲染模型额度进度边框 SVG：
  // - 额度满(100%)时整圈边框完全显现，额度用完(0%)时边框完全消失
  // - 同一个模型同时有每周和5小时两个额度池时，以内外两层边框同时展示（外层=周额度，内层=5h额度）
  // - 只有单个额度池（如 Gemini 4 Argon 只有周额度）时，仅展示单层外边框
  function renderQuotaBorderSvg(quota, width = 46, height = 46, radius = 7, kind = 'cell') {
    if (!quota) return '';
    const hasWeekly = quota.weekly && typeof quota.weekly.pct === 'number';
    const has5h = quota.fiveHour && typeof quota.fiveHour.pct === 'number';
    if (!hasWeekly && !has5h) return '';

    const outerPct = hasWeekly ? quota.weekly.pct : quota.fiveHour.pct;
    const outerColor = hasWeekly ? getWeeklyStrokeColor(outerPct) : getFiveHourStrokeColor(outerPct);
    const hasDual = hasWeekly && has5h;
    const innerPct = hasDual ? quota.fiveHour.pct : null;
    const innerColor = hasDual ? getFiveHourStrokeColor(innerPct) : '';

    const outerStrokeW = kind === 'pill' ? 1.65 : 1.9;
    const innerStrokeW = kind === 'pill' ? 1.4 : 1.6;
    const padOuter = outerStrokeW / 2 + 0.25;
    const padInner = padOuter + outerStrokeW / 2 + innerStrokeW / 2 + (kind === 'pill' ? 1.4 : 1.6);

    const outerPath = buildClockwiseRoundedRectPath(
      padOuter,
      padOuter,
      Math.max(4, width - padOuter * 2),
      Math.max(4, height - padOuter * 2),
      Math.max(1, radius - padOuter * 0.5)
    );

    const outerDash = outerPct >= 100 ? '100 0' : `${outerPct} ${100 - outerPct}`;
    const outerProgressSvg =
      outerPct > 0
        ? `<path class="quota-arc quota-arc-outer" d="${outerPath}" pathLength="100" fill="none" stroke="${outerColor}" stroke-width="${outerStrokeW}" stroke-linecap="round" stroke-dasharray="${outerDash}" />`
        : '';

    let innerProgressSvg = '';
    if (hasDual) {
      const innerPath = buildClockwiseRoundedRectPath(
        padInner,
        padInner,
        Math.max(4, width - padInner * 2),
        Math.max(4, height - padInner * 2),
        Math.max(1, radius - padInner * 0.7)
      );
      const innerDash = innerPct >= 100 ? '100 0' : `${innerPct} ${100 - innerPct}`;
      if (innerPct > 0) {
        innerProgressSvg = `<path class="quota-arc quota-arc-inner" d="${innerPath}" pathLength="100" fill="none" stroke="${innerColor}" stroke-width="${innerStrokeW}" stroke-linecap="round" stroke-dasharray="${innerDash}" />`;
      }
    }

    return `
      <svg
        class="quota-border-svg"
        data-quota-kind="${kind}"
        data-quota-dual="${hasDual ? '1' : '0'}"
        data-quota-outer="${outerPct}"
        data-quota-inner="${hasDual ? innerPct : ''}"
        data-quota-outer-color="${outerColor}"
        data-quota-inner-color="${innerColor}"
        data-quota-radius="${radius}"
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        ${outerProgressSvg}
        ${innerProgressSvg}
      </svg>
    `;
  }

  // 在真实渲染后按元素的实际宽高微调每个 SVG 的 viewBox 和路径，确保圆角与线宽 0 畸变
  function syncQuotaSvgGeometry() {
    if (!state.shadow) return;
    const svgs = state.shadow.querySelectorAll('.quota-border-svg');
    for (const svg of svgs) {
      const parent = svg.parentElement;
      if (!parent) continue;
      const w = parent.clientWidth || parent.offsetWidth;
      const h = parent.clientHeight || parent.offsetHeight;
      if (!w || !h || w < 10 || h < 10) continue;

      const kind = svg.getAttribute('data-quota-kind') || 'cell';
      const isDual = svg.getAttribute('data-quota-dual') === '1';
      const outerPct = Number(svg.getAttribute('data-quota-outer') || 0);
      const innerPct = isDual ? Number(svg.getAttribute('data-quota-inner') || 0) : null;
      const radius = kind === 'pill' ? h / 2 : Number(svg.getAttribute('data-quota-radius') || 7);

      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

      const outerStrokeW = kind === 'pill' ? 1.65 : 1.9;
      const innerStrokeW = kind === 'pill' ? 1.4 : 1.6;
      const padOuter = outerStrokeW / 2 + 0.25;
      const padInner = padOuter + outerStrokeW / 2 + innerStrokeW / 2 + (kind === 'pill' ? 1.4 : 1.6);

      const outerArc = svg.querySelector('.quota-arc-outer');
      if (outerArc && outerPct > 0) {
        outerArc.setAttribute(
          'd',
          buildClockwiseRoundedRectPath(
            padOuter,
            padOuter,
            Math.max(4, w - padOuter * 2),
            Math.max(4, h - padOuter * 2),
            Math.max(1, radius - padOuter * 0.5)
          )
        );
      }

      const innerArc = svg.querySelector('.quota-arc-inner');
      if (innerArc && isDual && innerPct > 0) {
        innerArc.setAttribute(
          'd',
          buildClockwiseRoundedRectPath(
            padInner,
            padInner,
            Math.max(4, w - padInner * 2),
            Math.max(4, h - padInner * 2),
            Math.max(1, radius - padInner * 0.7)
          )
        );
      }
    }
  }

  function formatQuotaInlineText(quota) {
    if (!quota) return '';
    const parts = [];
    if (quota.weekly && typeof quota.weekly.pct === 'number') {
      const c = formatCompactResetText(quota.weekly.resetText);
      const r = c ? ` (${c})` : '';
      parts.push(`周额度 ${quota.weekly.pct}%${r}`);
    }
    if (quota.fiveHour && typeof quota.fiveHour.pct === 'number') {
      const c = formatCompactResetText(quota.fiveHour.resetText);
      const r = c ? ` (${c})` : '';
      parts.push(`5h ${quota.fiveHour.pct}%${r}`);
    }
    return parts.join(' · ');
  }

  function formatQuotaResetSummary(quota) {
    if (!quota) return '';
    const parts = [];
    const w = formatCompactResetText(quota.weekly?.resetText);
    if (w) parts.push(`周 ${w}`);
    const f = formatCompactResetText(quota.fiveHour?.resetText);
    if (f) parts.push(`5h ${f}`);
    return parts.join(' · ');
  }

  function formatQuotaCompactText(quota) {
    if (!quota) return '';
    const stripArrow = (s) => formatCompactResetText(s).replace(/^⟳\s*/, '').trim();
    const parts = [];
    if (quota.weekly && typeof quota.weekly.pct === 'number') {
      const w = stripArrow(quota.weekly.resetText);
      parts.push(`周 ${quota.weekly.pct}%${w ? ` (${w})` : ''}`);
    }
    if (quota.fiveHour && typeof quota.fiveHour.pct === 'number') {
      const f = stripArrow(quota.fiveHour.resetText);
      parts.push(`5h ${quota.fiveHour.pct}%${f ? ` (${f})` : ''}`);
    }
    return parts.join(' · ');
  }

  function formatQuotaShortChips(quota) {
    if (!quota) return '';
    const chips = [];
    if (quota.weekly && typeof quota.weekly.pct === 'number') {
      const c = getWeeklyStrokeColor(quota.weekly.pct);
      chips.push(`<span class="quota-mini-chip" style="--qc:${c}">周 ${quota.weekly.pct}%</span>`);
    }
    if (quota.fiveHour && typeof quota.fiveHour.pct === 'number') {
      const c = getFiveHourStrokeColor(quota.fiveHour.pct);
      chips.push(`<span class="quota-mini-chip" style="--qc:${c}">5h ${quota.fiveHour.pct}%</span>`);
    }
    return chips.join('');
  }

  function formatCompactResetText(resetText) {
    const raw = String(resetText || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const enMatch = raw.match(/(?:resets?\s+in\s+|in\s+)([0-9]+\s*[dhms](?:\s+[0-9]+\s*[dhms])*)/i);
    if (enMatch) return `⟳ ${enMatch[1].replace(/\s+/g, ' ').trim()}`;
    const zhBefore = raw.match(/([0-9]+\s*(?:天|小时|分钟?|秒|日|h|d|m)(?:\s*[0-9]+\s*(?:天|小时|分钟?|秒|日|h|d|m))*)\s*后/i);
    if (zhBefore) return `⟳ ${zhBefore[1].replace(/\s+/g, '')}`;
    const cleaned = raw
      .replace(/^(?:weekly|5-hour|5h)\s*limit[,:：\s-]*/i, '')
      .replace(/^(?:resets?\s*(?:in|at)?|重置于|后重置)[:：\s-]*/i, '')
      .trim();
    return cleaned ? `⟳ ${cleaned}` : '';
  }

  function formatOrchTabLabel(subModel, totalCount) {
    const base = String(subModel?.baseName || '').trim();
    const shortName = String(subModel?.shortName || '').trim();
    if (!base) return shortName;
    const count = Number(totalCount) || 0;
    if (count <= 3) return base;
    if (count === 4) {
      const compact = base
        .replace(/^Gemini\s+(\d+(?:\.\d+)?)\s+/i, 'G$1 ')
        .replace(/^Claude\s+/i, '')
        .trim();
      return compact || shortName || base;
    }
    return shortName || base;
  }

  // ============================================================================
  // 构建模型分组（结合二级子菜单档位展开、禁用态识别、Orchestrator 合并、3.8 Flash 去重）
  // ============================================================================

  function getSubmenuEffortsForModel(baseName, currentEffortKey) {
    const key = String(baseName || '').toLowerCase();
    // 1. 优先使用实时探测缓存的该模型真实档位
    if (cachedSubmenuEfforts && Array.isArray(cachedSubmenuEfforts[key]) && cachedSubmenuEfforts[key].length >= 1) {
      return cachedSubmenuEfforts[key];
    }
    // 2. 其次使用配置中对齐原版截图的该模型真实档位
    if (CONFIG.knownSubmenuEfforts && Array.isArray(CONFIG.knownSubmenuEfforts[key]) && CONFIG.knownSubmenuEfforts[key].length >= 1) {
      return CONFIG.knownSubmenuEfforts[key];
    }
    // 3. 否则保守按当前识别到的档位 + 标准三档兜底（后台探测完成后立即覆写为实时值）
    const base = ['low', 'medium', 'high'];
    if (currentEffortKey && !base.includes(currentEffortKey)) base.push(currentEffortKey);
    return base;
  }

  function expandSubmenuVariants(parentItem, effortEntries, activeKey) {
    return effortEntries.map((entry) => {
      const ek = typeof entry === 'string' ? entry : entry.effortKey;
      const nativeLabel = typeof entry === 'object' && entry.nativeLabel ? entry.nativeLabel : null;
      const meta = EFFORT_META[ek] || EFFORT_META.default;
      const rawLabel = `${parentItem.baseName} (${nativeLabel || meta.en})`;
      const canonicalKey = normalizeKey(`${parentItem.baseName} (${meta.en})`);
      return {
        ...parentItem,
        rawLabel,
        effortKey: ek,
        effortMeta: meta,
        nativeSubLabel: nativeLabel || meta.zh,
        canonicalKey,
        viaSubmenu: true,
        parentEl: parentItem.parentEl || parentItem.el,
        el: parentItem.el,
        selected: canonicalKey === activeKey || (parentItem.selected && ek === parentItem.effortKey),
      };
    });
  }

  function buildOrchestratorSubModelsList(rawDescriptors, parentEl, activeKey, source = 'native') {
    const subModels = [];
    const seen = new Set();
    for (const desc of rawDescriptors || []) {
      if (!desc || !desc.baseName) continue;
      const baseName = String(desc.baseName).trim();
      const key = baseName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const vendor = desc.vendor || (/^claude\b/i.test(baseName) ? 'Anthropic' : /^(?:gpt|o1|o3|o4)\b/i.test(baseName) ? 'OpenAI' : 'Google');
      const shortName = desc.shortName || getOrchestratorSubModelShortName(baseName);
      const accent = desc.accent || getOrchestratorSubModelAccent(baseName, vendor);
      const hasLevel3 = desc.hasLevel3 !== false && Array.isArray(desc.efforts) && desc.efforts.length > 0;
      const effortEntries = hasLevel3
        ? desc.efforts
        : (desc.hasLevel3 ? getSubmenuEffortsForModel(baseName, null) : []);

      let variants;
      if (effortEntries.length > 0) {
        variants = effortEntries.map((entry) => {
          const ek = typeof entry === 'string' ? entry : entry.effortKey;
          const nativeSubLabel = typeof entry === 'object' && entry.nativeLabel ? entry.nativeLabel : null;
          const meta = EFFORT_META[ek] || EFFORT_META.default;
          const rawLabel = `Orchestrator · ${baseName} (${nativeSubLabel || meta.en})`;
          const canonicalKey = buildOrchestratorCanonicalKey(baseName, ek);
          return {
            rawLabel,
            baseName: 'Orchestrator',
            shortName: `Orchestrator · ${shortName}`,
            badges: [],
            effortKey: ek,
            effortMeta: meta,
            nativeSubLabel: nativeSubLabel || meta.en,
            element: null,
            isOrchestrator: true,
            orchestratorTier: shortName,
            orchestratorId: 'orch:main',
            orchSubModelKey: key,
            orchSubModelBaseName: baseName,
            orchSubModelShortName: shortName,
            orchSubModelNativeLabel: desc.nativeLabel || baseName,
            orchSubVendor: vendor,
            tierLabel: shortName,
            tierAccent: accent,
            vendor,
            vendorColor: accent,
            canonicalKey,
            subtitle: '',
            disabled: !!desc.disabled,
            unavailable: !!desc.disabled,
            viaSubmenu: false,
            viaOrchSubmenu: true,
            hasLevel3: true,
            selected: canonicalKey === activeKey,
            parentEl: parentEl || null,
            el: parentEl || null,
            source,
          };
        });
      } else {
        const rawLabel = `Orchestrator (${shortName})`;
        const canonicalKey = buildOrchestratorCanonicalKey(baseName, null);
        variants = [
          {
            rawLabel,
            baseName: 'Orchestrator',
            shortName: rawLabel,
            badges: [],
            effortKey: null,
            effortMeta: null,
            element: null,
            isOrchestrator: true,
            orchestratorTier: shortName,
            orchestratorId: 'orch:main',
            orchSubModelKey: key,
            orchSubModelBaseName: baseName,
            orchSubModelShortName: shortName,
            orchSubModelNativeLabel: desc.nativeLabel || baseName,
            orchSubVendor: vendor,
            tierLabel: shortName,
            tierAccent: accent,
            vendor,
            vendorColor: accent,
            canonicalKey,
            subtitle: '',
            disabled: !!desc.disabled,
            unavailable: !!desc.disabled,
            viaSubmenu: false,
            viaOrchSubmenu: !!parentEl,
            hasLevel3: false,
            selected: canonicalKey === activeKey,
            parentEl: parentEl || null,
            el: desc.el || parentEl || null,
            source,
          },
        ];
      }

      subModels.push({
        key,
        baseName,
        shortName,
        vendor,
        accent,
        nativeLabel: desc.nativeLabel || baseName,
        hasLevel3: variants.some((v) => v.hasLevel3),
        disabled: !!desc.disabled,
        efforts: variants.map((v) => v.effortKey).filter(Boolean),
        variants,
      });
    }
    return subModels;
  }

  function buildModelGroups(modelItems, actionItems, triggerBtn, usageTriggerEl = null) {
    state.lastNativeModelItems = modelItems || [];
    state.lastNativeActionItems = actionItems || [];
    if (usageTriggerEl !== undefined) state.usageTriggerEl = usageTriggerEl;

    const modelsBySymbol = new Map();
    const googleClassicMap = new Map();
    const orchLegacyVariantsMap = new Map();
    const otherMap = new Map();
    let activeKey = extractCurrentModelFromButton(triggerBtn);
    let detectedSeries = CONFIG.seriesLabel;
    let nativeOrchCount = 0;
    let nativeOrchSubmenuItem = null;

    for (const item of state.lastNativeModelItems) {
      if (item.selected && !item.unavailable) activeKey = item.canonicalKey;

      if (item.isOrchestrator) {
        nativeOrchCount++;
        if (item.hasSubmenu) {
          nativeOrchSubmenuItem = item;
          continue;
        }
        const subBase = item.orchSubModelBaseName || item.orchestratorTier || item.rawLabel;
        const subShort = item.orchSubModelShortName || item.orchestratorTier || getOrchestratorSubModelShortName(subBase);
        const tierKey = String(subBase).toLowerCase();
        const tierAccent = item.orchSubAccent || getOrchestratorSubModelAccent(subBase, item.vendor);
        if (!orchLegacyVariantsMap.has(tierKey)) {
          orchLegacyVariantsMap.set(tierKey, {
            ...item,
            effortKey: item.effortKey || null,
            effortMeta: item.effortMeta || null,
            viaSubmenu: false,
            viaOrchSubmenu: false,
            hasLevel3: false,
            orchestratorTier: subShort,
            orchestratorId: 'orch:main',
            orchSubModelKey: tierKey,
            orchSubModelBaseName: subBase,
            orchSubModelShortName: subShort,
            orchSubVendor: item.orchSubVendor || item.vendor || 'Google',
            tierLabel: subShort,
            tierAccent,
          });
        }
        continue;
      }

      // 若该行是原版二级子菜单触发器，按其真实（缓存/已知/待探测）档位列表展开为对应档位选项
      const expandedItems =
        item.hasSubmenu && !item.unavailable
          ? expandSubmenuVariants(item, getSubmenuEffortsForModel(item.baseName, item.effortKey), activeKey)
          : [item];

      if (item.element) {
        if (item.series) detectedSeries = item.series;
        const symKey = item.element.symbol.toLowerCase();
        if (!modelsBySymbol.has(symKey)) {
          modelsBySymbol.set(symKey, {
            kind: 'element',
            id: `el:${symKey}`,
            symbol: item.element.symbol,
            element: item.element,
            baseName: item.baseName,
            colorLabel: item.element.colorLabel || '主题色',
            source: 'native',
            hasSubmenu: !!item.hasSubmenu,
            unavailable: !!item.unavailable,
            parentEl: item.parentEl || item.el,
            variants: [],
          });
        }
        const grp = modelsBySymbol.get(symKey);
        if (!item.unavailable) grp.unavailable = false;
        if (item.hasSubmenu) {
          grp.hasSubmenu = true;
          grp.parentEl = item.parentEl || item.el;
        }
        for (const v of expandedItems) {
          if (!grp.variants.some((x) => x.canonicalKey === v.canonicalKey)) {
            grp.variants.push(v);
          }
        }
      } else if (item.vendor === 'Google') {
        if (CONFIG.integrateAllGoogleModels && isAllowedClassicGoogleModel(item.baseName, item.shortName)) {
          const gKey = getClassicModelGroupKey(item.baseName, item.shortName);
          if (!googleClassicMap.has(gKey)) {
            const cardMeta = buildGoogleClassicCardMeta(item.baseName, item.shortName);
            googleClassicMap.set(gKey, {
              kind: 'google-classic',
              id: `gm:${gKey}`,
              baseName: `Gemini ${cardMeta.versionTag} ${cardMeta.label}`,
              shortName: `${cardMeta.versionTag} ${cardMeta.label}`,
              versionTag: cardMeta.versionTag,
              cardLabel: cardMeta.label,
              colorLabel: '冰晶蓝',
              accent: cardMeta.accent,
              vendor: 'Google',
              vendorColor: cardMeta.accent,
              source: 'native',
              hasSubmenu: !!item.hasSubmenu,
              unavailable: !!item.unavailable,
              parentEl: item.parentEl || item.el,
              variants: [],
            });
          }
          const grp = googleClassicMap.get(gKey);
          for (const v of expandedItems) {
            if (!grp.variants.some((x) => x.canonicalKey === v.canonicalKey)) {
              grp.variants.push(v);
            }
          }
        }
      } else {
        const groupKey = item.baseName.toLowerCase();
        if (!otherMap.has(groupKey)) {
          otherMap.set(groupKey, {
            kind: 'other',
            id: `other:${groupKey}`,
            baseName: item.baseName,
            shortName: item.shortName,
            vendor: item.vendor,
            vendorColor: item.vendorColor,
            source: 'native',
            hasSubmenu: !!item.hasSubmenu,
            unavailable: !!item.unavailable,
            parentEl: item.parentEl || item.el,
            variants: [],
          });
        }
        const grp = otherMap.get(groupKey);
        for (const v of expandedItems) {
          if (!grp.variants.some((x) => x.canonicalKey === v.canonicalKey)) {
            grp.variants.push(v);
          }
        }
      }
    }

    // 同步元素元信息配色；仅当原版菜单完全未提及该保底元素时才补充保底（若原版明确标了 Unavailable，尊重不可用态）
    for (const g of CONFIG.guaranteedReleasedElements) {
      if (!g || !g.symbol) continue;
      const symKey = String(g.symbol).toLowerCase();
      const el = ELEMENT_BY_SYMBOL.get(symKey);
      if (!el) continue;
      const accent = g.accent || el.accent;
      const colorLabel = g.colorLabel || el.colorLabel || '主题色';
      const elWithColor = { ...el, accent, colorLabel };
      const standardBaseName = g.baseName || `${detectedSeries} ${el.en}`;

      if (modelsBySymbol.has(symKey)) {
        const existing = modelsBySymbol.get(symKey);
        existing.element = elWithColor;
        existing.colorLabel = colorLabel;
        existing.baseName = standardBaseName;
      } else if (state.lastNativeModelItems.length === 0) {
        // 仅当未捕获到原版菜单时保底显示
        const effortKeys = Array.isArray(g.efforts) && g.efforts.length ? g.efforts : ['low', 'medium', 'high'];
        const variants = effortKeys.map((ek) => {
          const meta = EFFORT_META[ek] || EFFORT_META.default;
          const rawLabel = `${standardBaseName} (${meta.en})`;
          const canonicalKey = normalizeKey(rawLabel);
          return {
            rawLabel,
            baseName: standardBaseName,
            shortName: standardBaseName,
            badges: [],
            effortKey: ek,
            effortMeta: meta,
            element: elWithColor,
            isOrchestrator: false,
            vendor: 'Google',
            vendorColor: accent,
            canonicalKey,
            subtitle: '',
            disabled: false,
            unavailable: false,
            viaSubmenu: true,
            selected: canonicalKey === activeKey,
            el: null,
            parentEl: null,
            source: 'guaranteed',
          };
        });
        modelsBySymbol.set(symKey, {
          kind: 'element',
          id: `el:${symKey}`,
          symbol: el.symbol,
          element: elWithColor,
          baseName: standardBaseName,
          colorLabel,
          source: 'guaranteed',
          hasSubmenu: true,
          unavailable: false,
          parentEl: null,
          variants,
        });
      }
    }

    // 3.8 Flash 归一化保底（原版捕获到则绝不重复）
    for (const gc of CONFIG.guaranteedClassicModels || []) {
      if (!gc || !gc.baseName) continue;
      const gKey = getClassicModelGroupKey(gc.baseName, gc.shortName || '');
      if (googleClassicMap.has(gKey)) continue;
      if (state.lastNativeModelItems.length > 0) continue;

      const effortKeys = Array.isArray(gc.efforts) && gc.efforts.length ? gc.efforts : ['low', 'medium', 'high'];
      const accent = gc.accent || '#38bdf8';
      const variants = effortKeys.map((ek) => {
        const meta = EFFORT_META[ek] || EFFORT_META.default;
        const rawLabel = `${gc.baseName} (${meta.en})`;
        const canonicalKey = normalizeKey(rawLabel);
        return {
          rawLabel,
          baseName: gc.baseName,
          shortName: gc.shortName || '3.8 Flash',
          badges: [],
          effortKey: ek,
          effortMeta: meta,
          element: null,
          isOrchestrator: false,
          vendor: 'Google',
          vendorColor: accent,
          canonicalKey,
          subtitle: '',
          disabled: false,
          viaSubmenu: true,
          selected: canonicalKey === activeKey,
          el: null,
          parentEl: null,
          source: 'guaranteed',
        };
      });
      googleClassicMap.set(gKey, {
        kind: 'google-classic',
        id: `gm:${gKey}`,
        baseName: gc.baseName,
        shortName: gc.shortName || '3.8 Flash',
        versionTag: gc.versionTag || '3.8',
        cardLabel: gc.cardLabel || 'Flash',
        colorLabel: '冰晶蓝',
        accent,
        vendor: 'Google',
        vendorColor: accent,
        source: 'guaranteed',
        hasSubmenu: true,
        unavailable: false,
        parentEl: null,
        variants,
      });
    }

    // Orchestrator 合并为唯一 1 个模块（自动适配新版 3 级菜单：底层模型 -> 推理档位，并兼容旧版扁平项）
    let orchSubModels = [];
    let orchHasSubmenu = false;
    let orchParentEl = null;
    let orchDefaultSubModelKey = '';

    if (nativeOrchSubmenuItem) {
      orchHasSubmenu = true;
      orchParentEl = nativeOrchSubmenuItem.parentEl || nativeOrchSubmenuItem.el;
      if (nativeOrchSubmenuItem.orchSubModelBaseName) {
        orchDefaultSubModelKey = nativeOrchSubmenuItem.orchSubModelBaseName.toLowerCase();
      }
      const initialDescriptors =
        Array.isArray(cachedOrchestratorModels) && cachedOrchestratorModels.length > 0
          ? cachedOrchestratorModels
          : Array.isArray(CONFIG.guaranteedOrchestratorModels) && CONFIG.guaranteedOrchestratorModels.length > 0
            ? CONFIG.guaranteedOrchestratorModels
            : [];
      orchSubModels = buildOrchestratorSubModelsList(initialDescriptors, orchParentEl, activeKey, 'native');
      // 如果主行显示了某未在缓存/默认表中的底层模型，也先纳入保底展示，待后台探测更新
      if (orchDefaultSubModelKey && !orchSubModels.some((sm) => sm.key === orchDefaultSubModelKey)) {
        const extraSub = buildOrchestratorSubModelsList(
          [
            {
              baseName: nativeOrchSubmenuItem.orchSubModelBaseName,
              shortName: nativeOrchSubmenuItem.orchSubModelShortName,
              vendor: nativeOrchSubmenuItem.orchSubVendor,
              accent: nativeOrchSubmenuItem.orchSubAccent,
              hasLevel3: true,
              efforts: getSubmenuEffortsForModel(nativeOrchSubmenuItem.orchSubModelBaseName, nativeOrchSubmenuItem.effortKey),
            },
          ],
          orchParentEl,
          activeKey,
          'native'
        );
        orchSubModels.push(...extraSub);
      }
    } else if (orchLegacyVariantsMap.size > 0) {
      const legacyOrder = { 'gemini 4 neon': 1, neon: 1, 'gemini 4 argon': 2, argon: 2, 'claude opus 5.5': 3 };
      const sortedLegacy = Array.from(orchLegacyVariantsMap.values()).sort((a, b) => {
        const oa = legacyOrder[String(a.orchSubModelKey || '').toLowerCase()] || 99;
        const ob = legacyOrder[String(b.orchSubModelKey || '').toLowerCase()] || 99;
        if (oa !== ob) return oa - ob;
        return String(a.tierLabel || a.rawLabel).localeCompare(String(b.tierLabel || b.rawLabel));
      });
      orchSubModels = sortedLegacy.map((v) => ({
        key: v.orchSubModelKey || v.canonicalKey,
        baseName: v.orchSubModelBaseName || v.tierLabel || v.rawLabel,
        shortName: v.orchSubModelShortName || v.tierLabel || v.rawLabel,
        vendor: v.orchSubVendor || 'Google',
        accent: v.tierAccent || '#a855f7',
        nativeLabel: v.rawLabel,
        hasLevel3: false,
        disabled: !!v.disabled,
        efforts: [],
        variants: [v],
      }));
    } else if (state.lastNativeModelItems.length === 0) {
      const fallbackDescriptors =
        Array.isArray(CONFIG.guaranteedOrchestratorModels) && CONFIG.guaranteedOrchestratorModels.length > 0
          ? CONFIG.guaranteedOrchestratorModels
          : (CONFIG.guaranteedOrchestratorTiers || []).map((t) => ({
              baseName: `${CONFIG.seriesLabel || 'Gemini 4'} ${t.tier}`,
              shortName: t.label || t.tier,
              vendor: 'Google',
              accent: t.accent,
              hasLevel3: true,
              efforts: t.tier === 'Neon' ? ['low', 'medium', 'high', 'extra'] : ['low', 'medium', 'high'],
            }));
      orchSubModels = buildOrchestratorSubModelsList(fallbackDescriptors, null, activeKey, 'guaranteed');
    }

    const orchVariants = orchSubModels.flatMap((sm) => sm.variants);
    const orchHasEffort = orchSubModels.some((sm) => sm.hasLevel3 && sm.efforts.length > 0);
    if (!orchDefaultSubModelKey && orchSubModels.length > 0) {
      orchDefaultSubModelKey = orchSubModels[0].key;
    }

    const orchestratorModels = orchVariants.length
      ? [
          {
            kind: 'orchestrator',
            id: 'orch:main',
            hasSubmenu: orchHasSubmenu,
            hasEffort: orchHasEffort,
            baseName: 'Orchestrator',
            shortName: 'Orchestrator',
            cardTag: 'Orchestrator',
            colorLabel: '编排紫',
            accent: '#a855f7',
            vendor: 'Google',
            vendorColor: '#a855f7',
            parentEl: orchParentEl,
            defaultSubModelKey: orchDefaultSubModelKey,
            source: nativeOrchCount > 0 ? 'native' : 'guaranteed',
            subModels: orchSubModels,
            variants: orchVariants,
          },
        ]
      : [];

    // 动态 API 接入的模型
    for (const [symKey, reg] of dynamicRegistry.elementModels.entries()) {
      const el = ELEMENT_BY_SYMBOL.get(symKey);
      if (!el) continue;
      const customAccent = reg.accent || el.accent;
      const elWithAccent = { ...el, accent: customAccent };
      const variants = (reg.variants || []).map((v) => {
        const effKey = v.effort ? (EFFORT_SYNONYMS.get(String(v.effort).toLowerCase()) || null) : null;
        const effMeta = effKey ? (EFFORT_META[effKey] || EFFORT_META.default) : null;
        const rawLabel = v.rawLabel || (effMeta ? `${reg.baseName} (${effMeta.en})` : reg.baseName);
        return {
          rawLabel,
          baseName: reg.baseName,
          shortName: reg.baseName,
          badges: v.badges || ['API'],
          effortKey: effKey,
          effortMeta: effMeta,
          element: elWithAccent,
          isOrchestrator: false,
          viaSubmenu: false,
          vendor: 'Google',
          vendorColor: customAccent,
          canonicalKey: normalizeKey(rawLabel),
          subtitle: v.subtitle || '',
          disabled: !!v.disabled,
          selected: !!v.selected,
          el: null,
          source: 'api',
          customOnSelect: typeof v.onSelect === 'function' ? v.onSelect : reg.onSelect,
          customPayload: v.payload,
        };
      });

      if (variants.length > 0 && !modelsBySymbol.has(symKey)) {
        modelsBySymbol.set(symKey, {
          kind: 'element',
          id: `el:${symKey}`,
          symbol: el.symbol,
          element: elWithAccent,
          baseName: reg.baseName,
          colorLabel: reg.colorLabel || el.colorLabel || '主题色',
          source: 'api',
          hasSubmenu: false,
          unavailable: false,
          variants,
        });
      }
    }

    const sortVariants = (list) =>
      list.sort((a, b) => {
        const oa = a.effortMeta ? a.effortMeta.order : 3.5;
        const ob = b.effortMeta ? b.effortMeta.order : 3.5;
        if (oa !== ob) return oa - ob;
        return a.rawLabel.localeCompare(b.rawLabel);
      });

    for (const grp of modelsBySymbol.values()) sortVariants(grp.variants);

    const googleClassicModels = Array.from(googleClassicMap.values()).map((grp) => {
      sortVariants(grp.variants);
      return grp;
    });

    const otherModels = Array.from(otherMap.values())
      .map((grp) => {
        sortVariants(grp.variants);
        return grp;
      })
      .sort((a, b) => a.baseName.localeCompare(b.baseName));

    state.modelsBySymbol = modelsBySymbol;
    state.googleClassicModels = googleClassicModels;
    state.orchestratorModels = orchestratorModels;
    state.otherModels = otherModels;
    state.actionItems = state.lastNativeActionItems;
    state.activeModelKey = activeKey;
    state.detectedSeries = detectedSeries;
  }

  // 后台静默探测 View Usage 实时用量与各模型二级子菜单的真实推理档位
  async function probeUsageAndSubmenusInBackground(onlyUsage = false) {
    if (!state.open || !state.nativeMenuEl || !state.nativeMenuEl.isConnected) return;
    const token = ++state.probeToken;
    state.probingUsage = true;
    if (!onlyUsage) state.probingSubmenus = true;
    document.documentElement.setAttribute('data-ag-periodic-probing', '1');

    const nativeMenu = state.nativeMenuEl;
    try {
      // 第 1 步：优先探测 View Usage 实时额度
      if (state.usageTriggerEl && state.usageTriggerEl.isConnected && token === state.probeToken && state.open) {
        const usageSub = await openAndWaitSubmenu(nativeMenu, state.usageTriggerEl, 'usage', 640);
        if (usageSub && token === state.probeToken && state.open) {
          const lines = extractOptionLinesFromDom(usageSub);
          const pools = parseUsagePanelLines(lines);
          if (pools.length > 0) {
            state.usageData = {
              pools,
              updatedAt: Date.now(),
            };
            cachedUsageSnapshot = state.usageData;
            safeSaveJson(STORAGE_USAGE_CACHE_KEY, state.usageData);
            refreshQuotaBordersAndPanels();
          }
          await closeSubmenuAndWaitGone(state.usageTriggerEl, usageSub);
        }
      }
      state.probingUsage = false;
      if (state.showingUsagePanel && state.open) updateCenterStageOnly();

      if (onlyUsage || token !== state.probeToken || !state.open) return;

      // 第 2 步：依次静默探测每个带二级子菜单的模型行，实时同步 100% 真实的推理档位
      const subGroups = [
        ...Array.from(state.modelsBySymbol.values()),
        ...state.googleClassicModels,
        ...state.otherModels,
      ].filter((g) => g && g.hasSubmenu && !g.unavailable && g.parentEl && g.parentEl.isConnected);

      let anyEffortChanged = false;
      const prevActiveKey = state.activeModelKey;
      for (const grp of subGroups) {
        if (token !== state.probeToken || !state.open || !nativeMenu.isConnected) break;
        const subEl = await openAndWaitSubmenu(nativeMenu, grp.parentEl, 'effort', 260);
        if (subEl && token === state.probeToken && state.open) {
          const parsedEfforts = parseSubmenuEffortItems(subEl);
          if (parsedEfforts.length >= 1) {
            const key = grp.baseName.toLowerCase();
            const effortKeys = parsedEfforts.map((x) => x.effortKey);
            const prevKeys = grp.variants.map((v) => v.effortKey);
            cachedSubmenuEfforts[key] = effortKeys;

            const baseItem = grp.variants[0] || {
              baseName: grp.baseName,
              shortName: grp.shortName || grp.baseName,
              element: grp.element || null,
              isOrchestrator: false,
              vendor: grp.vendor || 'Google',
              vendorColor: grp.vendorColor || '#4c8bf5',
              badges: [],
              subtitle: '',
              disabled: false,
              unavailable: false,
              parentEl: grp.parentEl,
              el: grp.parentEl,
              source: 'native',
            };

            const nextVariants = expandSubmenuVariants(baseItem, parsedEfforts, state.activeModelKey);
            const isActiveGroup = isGroupActive(grp);
            if (isActiveGroup) {
              const checkedOne = parsedEfforts.find((x) => x.checked);
              if (checkedOne) {
                const ck = normalizeKey(`${grp.baseName} (${(EFFORT_META[checkedOne.effortKey] || EFFORT_META.default).en})`);
                state.activeModelKey = ck;
                for (const nv of nextVariants) nv.selected = nv.canonicalKey === ck;
              }
            }

            grp.variants = nextVariants;
            if (JSON.stringify(prevKeys) !== JSON.stringify(effortKeys)) {
              anyEffortChanged = true;
            }
          }
          await closeSubmenuAndWaitGone(grp.parentEl, subEl);
        }
      }

      if (Object.keys(cachedSubmenuEfforts).length) {
        safeSaveJson(STORAGE_SUBMENU_EFFORTS_KEY, cachedSubmenuEfforts);
      }

      // 第 3 步：静默探测 Orchestrator 二级底层模型列表及各模型三级推理档位子菜单
      for (const orchGrp of state.orchestratorModels) {
        if (token !== state.probeToken || !state.open || !nativeMenu.isConnected) break;
        if (!orchGrp || !orchGrp.hasSubmenu || !orchGrp.parentEl || !orchGrp.parentEl.isConnected) continue;

        const sub2 = await openAndWaitSubmenu(nativeMenu, orchGrp.parentEl, 'orchestrator', 420);
        if (sub2 && token === state.probeToken && state.open) {
          const parsedModels = parseOrchestratorSubmenuModels(sub2);
          if (parsedModels.length >= 1) {
            const probedDescriptors = [];
            for (const pm of parsedModels) {
              if (token !== state.probeToken || !state.open || !nativeMenu.isConnected) break;
              let effortEntries = [];
              if (pm.hasLevel3 && pm.el && pm.el.isConnected) {
                const sub3 = await openAndWaitSubmenu(nativeMenu, pm.el, 'effort', 320);
                if (sub3 && token === state.probeToken && state.open) {
                  const parsedL3 = parseSubmenuEffortItems(sub3);
                  if (parsedL3.length >= 1) {
                    effortEntries = parsedL3;
                    const checkedOne = parsedL3.find((x) => x.checked);
                    if (checkedOne && isGroupActive(orchGrp)) {
                      state.activeModelKey = buildOrchestratorCanonicalKey(pm.baseName, checkedOne.effortKey);
                    }
                  }
                  dispatchQuietLeaveSubmenu(pm.el, sub3);
                  await sleepMs(45);
                }
              }
              if (pm.hasLevel3 && !effortEntries.length) {
                effortEntries = getSubmenuEffortsForModel(pm.baseName, pm.currentEffortKey);
              }
              probedDescriptors.push({
                baseName: pm.baseName,
                shortName: pm.shortName,
                vendor: pm.vendor,
                accent: pm.accent,
                nativeLabel: pm.nativeLabel,
                hasLevel3: pm.hasLevel3,
                disabled: pm.disabled,
                efforts: effortEntries.map((x) => (typeof x === 'string' ? x : x.effortKey)),
                _richEfforts: effortEntries,
              });
            }

            if (probedDescriptors.length >= 1 && token === state.probeToken && state.open) {
              const prevSig = JSON.stringify(
                (orchGrp.subModels || []).map((sm) => [sm.key, sm.efforts])
              );
              const richDescriptors = probedDescriptors.map((d) => ({
                ...d,
                efforts: d._richEfforts && d._richEfforts.length ? d._richEfforts : d.efforts,
              }));
              const nextSubModels = buildOrchestratorSubModelsList(richDescriptors, orchGrp.parentEl, state.activeModelKey, 'native');
              orchGrp.subModels = nextSubModels;
              orchGrp.variants = nextSubModels.flatMap((sm) => sm.variants);
              orchGrp.hasEffort = nextSubModels.some((sm) => sm.hasLevel3 && sm.efforts.length > 0);
              if (
                state.selectedOrchSubModelKey &&
                !nextSubModels.some((sm) => sm.key === state.selectedOrchSubModelKey)
              ) {
                state.selectedOrchSubModelKey = nextSubModels[0]?.key || '';
              }

              cachedOrchestratorModels = probedDescriptors.map(({ _richEfforts, ...rest }) => rest);
              safeSaveJson(STORAGE_ORCHESTRATOR_SUBMENU_KEY, cachedOrchestratorModels);

              const nextSig = JSON.stringify(nextSubModels.map((sm) => [sm.key, sm.efforts]));
              if (prevSig !== nextSig) {
                anyEffortChanged = true;
              }
            }
          }
          await closeSubmenuAndWaitGone(orchGrp.parentEl, sub2);
        }
      }

      if ((anyEffortChanged || state.activeModelKey !== prevActiveKey) && token === state.probeToken && state.open) {
        refreshQuotaBordersAndPanels();
      }
    } finally {
      if (token === state.probeToken) {
        state.probingUsage = false;
        state.probingSubmenus = false;
        if (nativeMenu) nativeMenu.style.pointerEvents = '';
        document.documentElement.removeAttribute('data-ag-periodic-probing');
      }
    }
  }

  // ============================================================================
  // 真实点击派发 & 两步级联切换（支持一级直选 + 二级档位子菜单精准点击）
  // ============================================================================

  function dispatchRealClick(el) {
    if (!el || !el.isConnected) return false;
    state.bypassNextClick = true;
    try {
      const rect = el.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        button: 0,
        buttons: 1,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      if (typeof PointerEvent === 'function') {
        el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', pointerId: 1, isPrimary: true }));
      }
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      if (typeof PointerEvent === 'function') {
        el.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0, pointerType: 'mouse', pointerId: 1, isPrimary: true }));
      }
      el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
      el.click();
      return true;
    } finally {
      setTimeout(() => {
        state.bypassNextClick = false;
      }, 60);
    }
  }

  // 在原版主菜单项列表中查找最匹配 variant 的 DOM 元素（严格隔离 Orchestrator 与普通元素模型）
  function findBestMatchingMenuElement(modelItems, variant) {
    if (!Array.isArray(modelItems) || !modelItems.length || !variant) return null;

    if (variant.isOrchestrator) {
      if (variant.viaOrchSubmenu) {
        const subRow = modelItems.find((item) => item.isOrchestrator && item.hasSubmenu);
        if (subRow && subRow.el) return subRow.el;
      }
      const orchExact = modelItems.find(
        (item) => item.isOrchestrator && item.canonicalKey === variant.canonicalKey
      );
      if (orchExact && orchExact.el) return orchExact.el;

      if (variant.orchestratorTier) {
        const tierLow = variant.orchestratorTier.toLowerCase();
        const sameTier = modelItems.find(
          (item) =>
            item.isOrchestrator &&
            (String(item.orchestratorTier || '').toLowerCase() === tierLow ||
              item.rawLabel.toLowerCase().includes(tierLow))
        );
        return sameTier && sameTier.el ? sameTier.el : null;
      }

      const anyOrch = modelItems.find((item) => item.isOrchestrator);
      return anyOrch && anyOrch.el ? anyOrch.el : null;
    }

    const nonOrchItems = modelItems.filter((item) => !item.isOrchestrator && !item.unavailable);

    // 1. 精确 canonicalKey 匹配
    const exact = nonOrchItems.find((item) => item.canonicalKey === variant.canonicalKey);
    if (exact && exact.el) return exact.el;

    // 2. 同 baseName + 同 effortKey 匹配
    const baseLow = String(variant.baseName || '').toLowerCase();
    const sameBaseAndEffort = nonOrchItems.find(
      (item) => item.baseName.toLowerCase() === baseLow && item.effortKey === variant.effortKey
    );
    if (sameBaseAndEffort && sameBaseAndEffort.el) return sameBaseAndEffort.el;

    // 3. 同 baseName（用于级联主菜单父行匹配）
    const sameBaseAny = nonOrchItems.find((item) => item.baseName.toLowerCase() === baseLow);
    if (sameBaseAny && sameBaseAny.el) return sameBaseAny.el;

    // 4. 同元素符号匹配
    if (variant.element) {
      const sym = variant.element.symbol;
      const sameEl = nonOrchItems.find((item) => item.element && item.element.symbol === sym);
      if (sameEl && sameEl.el) return sameEl.el;
    }

    return null;
  }

  // 在原版主菜单上执行“打开二级子菜单 -> 精准点击目标档位项”两步切换
  async function executeSubmenuSelection(nativeMenu, parentRow, variant) {
    if (!parentRow || !parentRow.isConnected) return false;
    ensureCloakStyle();
    document.documentElement.setAttribute('data-ag-periodic-cloaking', '1');
    document.documentElement.setAttribute('data-ag-periodic-probing', '1');

    const cleanupCloak = () => {
      if (nativeMenu) {
        nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
        nativeMenu.style.pointerEvents = '';
      }
      document.documentElement.removeAttribute('data-ag-periodic-probing');
      document.documentElement.removeAttribute('data-ag-periodic-cloaking');
    };

    const subMenuEl = await openAndWaitSubmenu(nativeMenu, parentRow, 'effort', 650);
    if (!subMenuEl) {
      dispatchRealClick(parentRow);
      setTimeout(cleanupCloak, 90);
      return true;
    }

    const subItems = parseSubmenuEffortItems(subMenuEl);
    let targetOpt = subItems.find((x) => x.effortKey === variant.effortKey);
    if (!targetOpt && variant.nativeSubLabel) {
      const nl = variant.nativeSubLabel.toLowerCase();
      targetOpt = subItems.find((x) => x.nativeLabel.toLowerCase() === nl);
    }
    if (!targetOpt && subItems.length) {
      targetOpt = subItems[0];
    }

    if (targetOpt && targetOpt.el && targetOpt.el.isConnected) {
      dispatchRealClick(targetOpt.el);
      setTimeout(cleanupCloak, 90);
      return true;
    }

    cleanupCloak();
    return false;
  }

  // 在原版主菜单上执行 Orchestrator 三步级联切换：“一级 Orchestrator -> 二级底层模型 -> 三级推理档位”
  async function executeOrchestratorSelection(nativeMenu, orchRow, variant) {
    if (!orchRow || !orchRow.isConnected) return false;
    ensureCloakStyle();
    document.documentElement.setAttribute('data-ag-periodic-cloaking', '1');
    document.documentElement.setAttribute('data-ag-periodic-probing', '1');

    const cleanupCloak = () => {
      if (nativeMenu) {
        nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
        nativeMenu.style.pointerEvents = '';
      }
      document.documentElement.removeAttribute('data-ag-periodic-probing');
      document.documentElement.removeAttribute('data-ag-periodic-cloaking');
    };

    const sub2El = await openAndWaitSubmenu(nativeMenu, orchRow, 'orchestrator', 700);
    if (!sub2El) {
      dispatchRealClick(orchRow);
      setTimeout(cleanupCloak, 90);
      return true;
    }

    const subModels = parseOrchestratorSubmenuModels(sub2El);
    const wantBase = String(variant.orchSubModelBaseName || '').toLowerCase();
    const wantShort = String(variant.orchSubModelShortName || variant.orchestratorTier || '').toLowerCase();
    const wantNative = String(variant.orchSubModelNativeLabel || '').toLowerCase();

    let targetModel = subModels.find((m) => m.key === wantBase);
    if (!targetModel && wantNative) {
      targetModel = subModels.find((m) => m.nativeLabel.toLowerCase() === wantNative);
    }
    if (!targetModel && wantShort) {
      targetModel = subModels.find(
        (m) => m.shortName.toLowerCase() === wantShort || m.baseName.toLowerCase().includes(wantShort)
      );
    }
    if (!targetModel && subModels.length) {
      targetModel = subModels[0];
    }

    if (!targetModel || !targetModel.el || !targetModel.el.isConnected) {
      cleanupCloak();
      return false;
    }

    if (!targetModel.hasLevel3 || !variant.effortKey) {
      dispatchRealClick(targetModel.el);
      setTimeout(cleanupCloak, 90);
      return true;
    }

    const sub3El = await openAndWaitSubmenu(nativeMenu, targetModel.el, 'effort', 650);
    if (!sub3El) {
      dispatchRealClick(targetModel.el);
      setTimeout(cleanupCloak, 90);
      return true;
    }

    const effortItems = parseSubmenuEffortItems(sub3El);
    let targetOpt = effortItems.find((x) => x.effortKey === variant.effortKey);
    if (!targetOpt && variant.nativeSubLabel) {
      const nl = variant.nativeSubLabel.toLowerCase();
      targetOpt = effortItems.find((x) => x.nativeLabel.toLowerCase() === nl);
    }
    if (!targetOpt && effortItems.length) {
      targetOpt = effortItems[0];
    }

    if (targetOpt && targetOpt.el && targetOpt.el.isConnected) {
      dispatchRealClick(targetOpt.el);
      setTimeout(cleanupCloak, 90);
      return true;
    }

    cleanupCloak();
    return false;
  }

  function reopenAndSelectVariant(variant, triggerBtn) {
    if (!triggerBtn || !triggerBtn.isConnected) return;
    ensureCloakStyle();
    document.documentElement.setAttribute('data-ag-periodic-cloaking', '1');
    const preMenus = new Set(document.querySelectorAll('[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content], [data-floating-ui-portal]'));
    state.bypassNextClick = true;
    triggerBtn.click();
    setTimeout(() => {
      state.bypassNextClick = false;
    }, 30);

    const start = Date.now();
    const tick = () => {
      const found = findNativeModelMenu(triggerBtn, preMenus);
      if (found) {
        found.menuEl.setAttribute('data-ag-periodic-hidden-menu', '1');
        const targetEl = findBestMatchingMenuElement(found.modelItems, variant);
        if (targetEl) {
          if (variant.viaOrchSubmenu) {
            executeOrchestratorSelection(found.menuEl, targetEl, variant);
          } else if (variant.viaSubmenu) {
            executeSubmenuSelection(found.menuEl, targetEl, variant);
          } else {
            found.menuEl.style.pointerEvents = 'auto';
            dispatchRealClick(targetEl);
            setTimeout(() => {
              found.menuEl.removeAttribute('data-ag-periodic-hidden-menu');
              found.menuEl.style.pointerEvents = '';
              document.documentElement.removeAttribute('data-ag-periodic-cloaking');
            }, 80);
          }
          return;
        }
      }
      if (Date.now() - start < 500) {
        requestAnimationFrame(tick);
      } else {
        document.documentElement.removeAttribute('data-ag-periodic-cloaking');
      }
    };
    requestAnimationFrame(tick);
  }

  function commitModelVariant(variant) {
    if (!variant || variant.disabled || variant.unavailable) return;

    // 立即中止任何进行中的后台探测，优先执行用户的真实切换
    state.probeToken++;
    document.documentElement.removeAttribute('data-ag-periodic-probing');

    if (variant.source === 'api' && typeof variant.customOnSelect === 'function') {
      const ctx = {
        symbol: variant.element ? variant.element.symbol : null,
        baseName: variant.baseName,
        effort: variant.effortKey,
        rawLabel: variant.rawLabel,
        payload: variant.customPayload,
        triggerBtn: state.triggerBtn,
        close: () => closeModal({ dismissNativeMenu: true }),
      };
      state.activeModelKey = variant.canonicalKey;
      closeModal({ dismissNativeMenu: true });
      try {
        variant.customOnSelect(variant, ctx);
      } catch (err) {
        console.error('[PeriodicModelPicker] API onSelect 回调异常:', err);
      }
      return;
    }

    const triggerBtn = state.triggerBtn;
    const nativeMenu = state.nativeMenuEl;
    let targetEl = variant.viaOrchSubmenu || variant.viaSubmenu ? (variant.parentEl || variant.el) : variant.el;
    if ((!targetEl || !targetEl.isConnected) && state.lastNativeModelItems.length) {
      targetEl = findBestMatchingMenuElement(state.lastNativeModelItems, variant);
    }

    closeModal({ dismissNativeMenu: false });

    if (targetEl && targetEl.isConnected) {
      if (variant.viaOrchSubmenu) {
        executeOrchestratorSelection(nativeMenu, targetEl, variant);
      } else if (variant.viaSubmenu) {
        executeSubmenuSelection(nativeMenu, targetEl, variant);
      } else {
        if (nativeMenu) nativeMenu.style.pointerEvents = 'auto';
        dispatchRealClick(targetEl);
        setTimeout(() => {
          if (nativeMenu) {
            nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
            nativeMenu.style.pointerEvents = '';
          }
          document.documentElement.removeAttribute('data-ag-periodic-cloaking');
        }, 90);
      }
    } else {
      if (nativeMenu) {
        nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
        nativeMenu.style.pointerEvents = '';
      }
      reopenAndSelectVariant(variant, triggerBtn);
    }
  }

  function commitActionItem(action) {
    if (!action || !action.el) return;
    state.probeToken++;
    document.documentElement.removeAttribute('data-ag-periodic-probing');
    const nativeMenu = state.nativeMenuEl;
    const targetEl = action.el;
    closeModal({ dismissNativeMenu: false });
    if (targetEl.isConnected) {
      if (nativeMenu) nativeMenu.style.pointerEvents = 'auto';
      dispatchRealClick(targetEl);
      setTimeout(() => {
        if (nativeMenu) {
          nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
          nativeMenu.style.pointerEvents = '';
        }
        document.documentElement.removeAttribute('data-ag-periodic-cloaking');
      }, 90);
    }
  }

  function switchToNativeList() {
    state.probeToken++;
    document.documentElement.removeAttribute('data-ag-periodic-probing');
    const nativeMenu = state.nativeMenuEl;
    const triggerBtn = state.triggerBtn;
    closeModal({ dismissNativeMenu: false });
    document.documentElement.removeAttribute('data-ag-periodic-cloaking');
    if (nativeMenu && nativeMenu.isConnected) {
      nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
      nativeMenu.style.pointerEvents = '';
    } else if (triggerBtn && triggerBtn.isConnected) {
      state.bypassNextClick = true;
      triggerBtn.click();
      setTimeout(() => {
        state.bypassNextClick = false;
      }, 80);
    }
  }

  function dismissNativeMenuIfOpen() {
    state.probeToken++;
    const nativeMenu = state.nativeMenuEl;
    const triggerBtn = state.triggerBtn;
    document.documentElement.removeAttribute('data-ag-periodic-cloaking');
    document.documentElement.removeAttribute('data-ag-periodic-probing');
    if (nativeMenu) {
      nativeMenu.removeAttribute('data-ag-periodic-hidden-menu');
      nativeMenu.style.pointerEvents = '';
      if (nativeMenu.isConnected) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
        setTimeout(() => {
          if (nativeMenu.isConnected && isVisibleElement(nativeMenu) && triggerBtn && triggerBtn.isConnected) {
            state.bypassNextClick = true;
            triggerBtn.click();
            setTimeout(() => {
              state.bypassNextClick = false;
            }, 60);
          }
        }, 40);
      }
    }
  }

  function closeModal({ dismissNativeMenu = true } = {}) {
    state.probeToken++;
    document.documentElement.removeAttribute('data-ag-periodic-probing');
    if (state.captureCleanup) {
      state.captureCleanup();
      state.captureCleanup = null;
    }
    state.open = false;
    state.skeletonMounted = false;
    state.capturing = false;
    state.probingUsage = false;
    state.probingSubmenus = false;
    state.selectedGroup = null;
    state.selectedOrchSubModelKey = '';
    state.virtualElement = null;
    state.virtualPickedEffort = null;
    state.virtualFeedback = '';
    state.showingUsagePanel = false;
    state.hoveredInfo = null;

    if (state.hostEl && state.hostEl.isConnected) {
      state.hostEl.remove();
    }
    state.hostEl = null;
    state.shadow = null;

    if (dismissNativeMenu) {
      dismissNativeMenuIfOpen();
    }
    state.nativeMenuEl = null;
    state.nativeMenuHidden = false;
    state.usageTriggerEl = null;
  }

  function getActiveModelSummary() {
    if (!state.activeModelKey) return null;
    for (const grp of state.modelsBySymbol.values()) {
      for (const v of grp.variants) {
        if (v.canonicalKey === state.activeModelKey) {
          return {
            name: `${grp.element.symbol} · ${grp.element.en}`,
            effort: v.effortMeta ? `${v.effortMeta.zh} (${v.effortMeta.en})` : '',
            accent: grp.element.accent,
          };
        }
      }
    }
    for (const grp of state.googleClassicModels) {
      for (const v of grp.variants) {
        if (v.canonicalKey === state.activeModelKey) {
          return {
            name: grp.baseName,
            effort: v.effortMeta ? `${v.effortMeta.zh} (${v.effortMeta.en})` : '',
            accent: grp.accent,
          };
        }
      }
    }
    for (const grp of state.orchestratorModels) {
      for (const v of grp.variants) {
        if (v.canonicalKey === state.activeModelKey) {
          const subLabel = v.orchSubModelShortName || v.orchestratorTier || v.tierLabel || '';
          const effLabel = v.effortMeta ? `${v.effortMeta.zh} (${v.effortMeta.en})` : '';
          return {
            name: subLabel ? `${grp.baseName} · ${subLabel}` : grp.baseName,
            effort: effLabel,
            accent: v.tierAccent || grp.accent,
          };
        }
      }
    }
    for (const grp of state.otherModels) {
      for (const v of grp.variants) {
        if (v.canonicalKey === state.activeModelKey) {
          return {
            name: grp.shortName,
            effort: v.effortMeta ? `${v.effortMeta.zh} (${v.effortMeta.en})` : '',
            accent: grp.vendorColor,
          };
        }
      }
    }
    return null;
  }

  function isGroupActive(grp) {
    if (!grp || !state.activeModelKey || grp.unavailable) return false;
    return grp.variants.some((v) => v.canonicalKey === state.activeModelKey);
  }

  function getVirtualEffortsList() {
    const keys = Array.isArray(CONFIG.virtualSlotDefaults?.efforts) && CONFIG.virtualSlotDefaults.efforts.length
      ? CONFIG.virtualSlotDefaults.efforts
      : ['low', 'medium', 'high', 'extra'];
    return keys.map((k) => EFFORT_META[String(k).toLowerCase()] || EFFORT_META.default);
  }

  function handleVirtualEffortPreview(el, effortMeta) {
    const symKey = el.symbol.toLowerCase();
    const soonMeta = dynamicRegistry.comingSoonMap.get(symKey) || null;
    state.virtualPickedEffort = effortMeta.key;

    let handledByHook = false;
    const payload = {
      slotId: `element:${el.symbol}`,
      element: el,
      status: soonMeta ? 'coming-soon' : 'virtual',
      effort: effortMeta.key,
      effortMeta,
      proposedModelName: `${state.detectedSeries} ${el.en} (${effortMeta.en})`,
    };

    for (const hook of dynamicRegistry.virtualHooks) {
      try {
        const res = hook(payload);
        if (res === true || (res && res.handled)) {
          handledByHook = true;
          if (res && typeof res.message === 'string') {
            state.virtualFeedback = res.message;
          }
        }
      } catch (err) {
        console.error('[PeriodicModelPicker] virtualHook 异常:', err);
      }
    }

    if (!handledByHook) {
      state.virtualFeedback = `虚拟预览：${el.symbol} · ${effortMeta.zh} (${effortMeta.en})（未上线，未改动实际模型）`;
    }
    updateCenterStageOnly();
  }

  function toggleComingSoonForElement(el) {
    if (!el) return;
    const symKey = el.symbol.toLowerCase();
    if (dynamicRegistry.comingSoonMap.has(symKey)) {
      dynamicRegistry.comingSoonMap.delete(symKey);
      savePersistedComingSoonDelta(symKey, null);
      state.virtualFeedback = `已取消 ${el.symbol}（${el.zh}）的即将发布标记，恢复为虚拟槽位`;
    } else {
      const meta = {
        symbol: el.symbol,
        codename: el.en,
        zhName: `${el.zh} · 关注中`,
        note: '已手动标为即将发布 · 等待真实模型上线后自动亮起',
        accent: el.accent,
        userPinned: true,
      };
      dynamicRegistry.comingSoonMap.set(symKey, meta);
      savePersistedComingSoonDelta(symKey, meta);
      state.virtualFeedback = `已将 ${el.symbol}（${el.zh}）标为即将发布（已持久化保存）`;
    }
    syncSingleElementCellAppearance(el);
    syncModalInteractiveState();
  }

  // ============================================================================
  // Shadow DOM 样式与渲染
  // ============================================================================

  function buildStyles(isLight) {
    const vars = isLight
      ? `
        --bg-backdrop: rgba(15, 23, 42, 0.32);
        --bg-panel: rgba(248, 250, 252, 0.96);
        --bg-cell: #eef2f7;
        --bg-cell-hover: #e2e8f0;
        --bg-placeholder: rgba(226, 232, 240, 0.65);
        --bg-pill: #ffffff;
        --bg-pill-hover: #f1f5f9;
        --bg-effort-card: #ffffff;
        --bg-virtual-card: rgba(241, 245, 249, 0.95);
        --border-panel: rgba(15, 23, 42, 0.12);
        --border-cell: rgba(15, 23, 42, 0.08);
        --border-pill: rgba(15, 23, 42, 0.14);
        --text-primary: #0f172a;
        --text-secondary: #475569;
        --text-muted: #94a3b8;
        --text-cell-dim: #64748b;
        --shadow-panel: 0 24px 70px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06);
      `
      : `
        --bg-backdrop: rgba(5, 7, 11, 0.64);
        --bg-panel: rgba(20, 22, 28, 0.96);
        --bg-cell: rgba(34, 38, 47, 0.88);
        --bg-cell-hover: rgba(46, 52, 65, 0.96);
        --bg-placeholder: rgba(26, 29, 36, 0.65);
        --bg-pill: rgba(32, 36, 44, 0.92);
        --bg-pill-hover: rgba(44, 49, 61, 0.98);
        --bg-effort-card: rgba(28, 32, 42, 0.95);
        --bg-virtual-card: rgba(24, 28, 37, 0.93);
        --border-panel: rgba(255, 255, 255, 0.10);
        --border-cell: rgba(255, 255, 255, 0.065);
        --border-pill: rgba(255, 255, 255, 0.11);
        --text-primary: #f1f5f9;
        --text-secondary: #94a3b8;
        --text-muted: #64748b;
        --text-cell-dim: #8b94a5;
        --shadow-panel: 0 28px 80px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
      `;

    const hasGmRow = state.googleClassicModels.length > 0 || state.orchestratorModels.length > 0;
    const gridRows = hasGmRow
      ? '16px repeat(7, clamp(42px, 4.9vw, 48px)) 7px clamp(38px, 4.4vw, 44px) clamp(38px, 4.4vw, 44px) 7px clamp(42px, 4.8vw, 47px)'
      : '16px repeat(7, clamp(43px, 5vw, 49px)) 8px clamp(39px, 4.5vw, 45px) clamp(39px, 4.5vw, 45px)';
    const compactGridRows = hasGmRow
      ? '14px repeat(7, clamp(35px, 4.7vh, 43px)) 5px clamp(33px, 4.3vh, 40px) clamp(33px, 4.3vh, 40px) 5px clamp(36px, 4.6vh, 43px)'
      : '14px repeat(7, clamp(36px, 4.9vh, 45px)) 6px clamp(34px, 4.5vh, 41px) clamp(34px, 4.5vh, 41px)';

    return `
      :host {
        all: initial;
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        color-scheme: ${isLight ? 'light' : 'dark'};
        ${vars}
      }

      * { box-sizing: border-box; }

      .backdrop {
        position: fixed;
        inset: 0;
        background: var(--bg-backdrop);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        animation: agFadeIn 130ms ease-out;
      }

      .backdrop.no-anim, .panel.no-anim { animation: none !important; }

      @keyframes agFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes agPanelIn {
        from { opacity: 0; transform: translateY(8px) scale(0.99); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes agPulseRing {
        0%, 100% { opacity: 0.55; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.18); }
      }

      .panel {
        width: min(1050px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        overflow: auto;
        background: var(--bg-panel);
        border: 1px solid var(--border-panel);
        border-radius: 18px;
        box-shadow: var(--shadow-panel);
        padding: 15px 18px 13px;
        color: var(--text-primary);
        animation: agPanelIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .panel::-webkit-scrollbar { width: 6px; height: 6px; }
      .panel::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.25); border-radius: 99px; }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .header-left { display: flex; align-items: center; gap: 9px; }
      .sparkle { width: 20px; height: 20px; flex-shrink: 0; color: #7da8ff; filter: drop-shadow(0 0 8px rgba(125, 168, 255, 0.45)); }
      .title { font-size: 15px; font-weight: 600; letter-spacing: 0.01em; color: var(--text-primary); }
      .subtitle { font-size: 12px; color: var(--text-muted); margin-left: 2px; }
      .header-actions { display: flex; align-items: center; gap: 6px; }

      .ghost-btn {
        appearance: none;
        border: 1px solid var(--border-pill);
        background: transparent;
        color: var(--text-secondary);
        font-size: 11.5px;
        padding: 4px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .ghost-btn:hover, .ghost-btn.active {
        color: var(--text-primary);
        background: var(--bg-pill-hover);
        border-color: rgba(52, 211, 153, 0.48);
      }

      .close-btn {
        appearance: none;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: background 120ms ease, color 120ms ease;
      }

      .close-btn:hover { background: var(--bg-pill-hover); color: var(--text-primary); }

      .ptable-scroll { overflow-x: auto; padding-bottom: 2px; }

      .ptable {
        display: grid;
        grid-template-columns: 20px repeat(18, minmax(32px, 1fr));
        grid-template-rows: ${gridRows};
        gap: 3px;
        min-width: 650px;
        padding: 4px 5px 6px 2px;
        align-items: stretch;
        user-select: none;
      }

      .col-label { display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
      .row-label { display: flex; align-items: center; justify-content: flex-end; padding-right: 4px; font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
      .row-label.gm { color: #38bdf8; font-weight: 600; }

      /* SVG 额度边框层（外圈周额度 + 内圈5小时额度；满=全显，用完=消失） */
      .quota-border-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
        z-index: 3;
      }

      .quota-arc {
        transition: stroke-dasharray 260ms ease, stroke 200ms ease;
      }

      .quota-arc-outer {
        filter: drop-shadow(0 0 2.5px rgba(52, 211, 153, 0.55));
      }

      .quota-arc-inner {
        filter: drop-shadow(0 0 2.2px rgba(56, 189, 248, 0.55));
      }

      /* 中央黄金信息区 */
      .center-stage {
        grid-column: 4 / 14;
        grid-row: 2 / 5;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 6px 14px;
        border-radius: 14px;
        position: relative;
        overflow: hidden;
      }

      .center-stage.picking {
        background: var(--bg-effort-card);
        border: 1px solid var(--stage-accent-border, var(--border-pill));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 28px rgba(0, 0, 0, 0.24);
        padding: 8px 12px;
        justify-content: space-between;
      }

      .center-stage.virtual {
        background:
          repeating-linear-gradient(-45deg, transparent, transparent 7px, rgba(148, 163, 184, 0.03) 7px, rgba(148, 163, 184, 0.03) 10px),
          var(--bg-virtual-card);
        border: 1px dashed var(--stage-accent-border, rgba(148, 163, 184, 0.42));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.2);
        padding: 8px 12px;
        justify-content: space-between;
      }

      .hero-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .hero-title-group { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .hero-title { font-size: 23px; font-weight: 600; letter-spacing: -0.02em; color: var(--text-primary); line-height: 1.1; }

      .active-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--text-secondary);
        background: var(--bg-pill);
        border: 1px solid var(--border-pill);
        padding: 2px 9px;
        border-radius: 999px;
      }

      .active-chip-dot {
        width: 6.5px;
        height: 6.5px;
        border-radius: 99px;
        background: var(--chip-color, #4c8bf5);
        box-shadow: 0 0 7px var(--chip-color, #4c8bf5);
      }

      .orch-tier-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 99px;
        margin-right: 4px;
        vertical-align: middle;
        flex-shrink: 0;
        background: var(--tier-color, #a855f7);
        box-shadow: 0 0 6px var(--tier-color, #a855f7);
      }

      .orch-model-tabs {
        display: grid;
        grid-template-columns: repeat(var(--orch-tab-cols, 4), minmax(0, 1fr));
        gap: 5px;
        margin: 1px 0;
        overflow: visible;
      }

      .orch-model-tab {
        appearance: none;
        width: 100%;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border: 1px solid var(--border-pill);
        background: var(--bg-pill);
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: 500;
        line-height: 1.2;
        padding: 3px 6px;
        border-radius: 999px;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        overflow: hidden;
        transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
      }

      .orch-model-tab:hover {
        color: var(--text-primary);
        border-color: var(--tab-accent, #a855f7);
        background: var(--tab-accent-bg, rgba(168, 85, 247, 0.14));
      }

      .orch-model-tab.active {
        color: var(--text-primary);
        font-weight: 600;
        border-color: var(--tab-accent, #a855f7);
        background: var(--tab-accent-bg, rgba(168, 85, 247, 0.2));
        box-shadow: 0 0 0 1px var(--tab-accent, #a855f7);
      }

      .orch-tab-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .orch-tab-count {
        flex-shrink: 0;
        font-size: 9.5px;
        opacity: 0.78;
      }

      .center-stage.picking.orch-stage {
        padding: 6px 10px;
        gap: 3px;
      }

      .center-stage.picking.orch-stage .effort-symbol-badge {
        width: 26px;
        height: 26px;
        font-size: 11.5px;
        border-radius: 7px;
      }

      .center-stage.picking.orch-stage .effort-model-name {
        font-size: 12.5px;
      }

      .center-stage.picking.orch-stage .effort-model-sub {
        font-size: 10px;
        margin-top: 0;
        line-height: 1.15;
      }

      .center-stage.orch-stage .effort-grid {
        margin: 1px 0;
        gap: 5px;
      }

      .center-stage.orch-stage .effort-btn {
        padding: 3.5px 7px;
        gap: 1px;
      }

      .center-stage.picking.orch-stage .effort-footer {
        font-size: 9.5px;
        line-height: 1.15;
      }

      .legend-row {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-top: 6px;
        font-size: 10.5px;
        color: var(--text-secondary);
        flex-wrap: wrap;
      }

      .legend-item { display: inline-flex; align-items: center; gap: 5px; }
      .legend-dot-released { width: 7px; height: 7px; border-radius: 99px; background: #5b9bff; box-shadow: 0 0 6px rgba(91, 155, 255, 0.7); }
      .legend-dot-soon { width: 8px; height: 8px; border-radius: 99px; border: 1.5px dashed #f59e0b; }
      .legend-box-weekly { width: 9px; height: 9px; border-radius: 2.5px; border: 1.8px solid #34d399; box-shadow: 0 0 4px rgba(52, 211, 153, 0.5); }
      .legend-box-5h { width: 9px; height: 9px; border-radius: 2.5px; border: 1.8px solid #38bdf8; box-shadow: 0 0 4px rgba(56, 189, 248, 0.5); }

      .preview-line {
        margin-top: 6px;
        min-height: 18px;
        font-size: 11px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .preview-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview-badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 99px; flex-shrink: 0; }
      .preview-badge.released { background: rgba(76, 139, 245, 0.16); color: #7db0ff; border: 1px solid rgba(76, 139, 245, 0.35); }
      .preview-badge.soon { background: rgba(245, 158, 11, 0.14); color: #fbbf24; border: 1px dashed rgba(245, 158, 11, 0.5); }
      .preview-badge.virtual { background: rgba(148, 163, 184, 0.14); color: #cbd5e1; border: 1px dashed rgba(148, 163, 184, 0.45); }
      .preview-badge.unavail { background: rgba(100, 116, 139, 0.16); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.35); }

      .quota-mini-chip {
        display: inline-flex;
        align-items: center;
        font-size: 9.5px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 999px;
        color: var(--qc, #34d399);
        background: rgba(15, 23, 42, 0.38);
        border: 1px solid var(--qc, #34d399);
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }

      /* 中央用量详情面板 */
      .center-stage.picking.usage-stage {
        padding: 6px 10px;
        gap: 4px;
      }

      .center-stage.picking.usage-stage .effort-symbol-badge {
        width: 24px;
        height: 24px;
        font-size: 11px;
        border-radius: 7px;
      }

      .center-stage.picking.usage-stage .effort-model-name {
        font-size: 12.5px;
      }

      .usage-header-hint {
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .center-stage.picking.usage-stage .effort-footer {
        font-size: 9.5px;
        line-height: 1.15;
      }

      .usage-grid {
        display: grid;
        grid-template-columns: repeat(var(--usage-cols, 2), minmax(0, 1fr));
        gap: 6px;
        margin: 0;
        flex: 1 1 auto;
        min-height: 0;
        overflow: visible;
      }

      .usage-grid.usage-grid-many {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
      }

      .usage-grid.usage-grid-4 {
        gap: 4px;
      }
      .usage-grid.usage-grid-4 .usage-card {
        padding: 4px 6px;
        gap: 3px;
      }
      .usage-grid.usage-grid-4 .usage-row-top {
        gap: 2px;
        font-size: 9.5px;
      }
      .usage-grid.usage-grid-4 .usage-reset-inline {
        font-size: 8.5px;
        margin-right: 1px;
      }

      .usage-card {
        background: var(--bg-pill);
        border: 1px solid var(--border-pill);
        border-radius: 8px;
        padding: 5px 8px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        min-width: 0;
        overflow: hidden;
      }

      .usage-card-title {
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .usage-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .usage-row-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px;
        font-size: 10px;
        line-height: 1.15;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
        min-width: 0;
      }

      .usage-metric-label {
        flex-shrink: 0;
      }

      .usage-reset-inline {
        font-size: 9px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1 1 auto;
        text-align: right;
        margin-right: 2px;
      }

      .usage-pct {
        flex-shrink: 0;
        font-weight: 600;
      }

      .usage-bar-track {
        height: 4px;
        border-radius: 99px;
        background: rgba(148, 163, 184, 0.16);
        overflow: hidden;
      }

      .usage-bar-fill {
        height: 100%;
        border-radius: 99px;
        transition: width 240ms ease;
      }

      /* 推力 / 思考强度选择面板 & 虚拟选择窗口头部 */
      .effort-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .effort-model-info { display: flex; align-items: center; gap: 9px; min-width: 0; }

      .effort-symbol-badge {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        line-height: 1;
        flex-shrink: 0;
        border: 1px solid var(--stage-accent, #4c8bf5);
        background: var(--stage-accent-bg, rgba(76, 139, 245, 0.18));
        color: var(--text-primary);
      }

      .effort-symbol-badge.virtual { border-style: dashed; }
      .effort-symbol-num { font-size: 8px; font-weight: 500; opacity: 0.82; margin-bottom: 1px; }
      .effort-title-wrap { min-width: 0; }
      .effort-title-line { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: nowrap; }
      .effort-model-name { font-size: 13.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .effort-model-sub { font-size: 10.5px; color: var(--text-secondary); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .stage-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }

      .effort-back-btn {
        appearance: none;
        border: 1px solid var(--border-pill);
        background: transparent;
        color: var(--text-secondary);
        font-size: 10.5px;
        padding: 3px 8px;
        border-radius: 7px;
        cursor: pointer;
        flex-shrink: 0;
        font-family: inherit;
      }

      .effort-back-btn:hover { color: var(--text-primary); background: var(--bg-pill-hover); }
      .effort-back-btn.pinned { border-color: rgba(245, 158, 11, 0.55); color: #fbbf24; background: rgba(245, 158, 11, 0.12); }

      .effort-grid { display: flex; align-items: stretch; gap: 6px; margin: 5px 0 3px; overflow: visible; padding-bottom: 0; }

      .effort-btn {
        flex: 1 1 0;
        min-width: 0;
        appearance: none;
        border: 1px solid var(--border-pill);
        background: var(--bg-pill);
        color: var(--text-primary);
        border-radius: 9px;
        padding: 4.5px 6px;
        text-align: left;
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 2px;
        font-family: inherit;
        position: relative;
      }

      .effort-btn:hover:not(:disabled) {
        border-color: var(--stage-accent, #4c8bf5);
        background: var(--stage-accent-bg, rgba(76, 139, 245, 0.14));
        transform: translateY(-1px);
      }

      .effort-btn.current {
        border-color: var(--stage-accent, #4c8bf5);
        background: var(--stage-accent-bg, rgba(76, 139, 245, 0.18));
        box-shadow: 0 0 0 1px var(--stage-accent, #4c8bf5);
      }

      .effort-btn.virtual-opt { border-style: dashed; background: rgba(148, 163, 184, 0.06); }
      .effort-btn.virtual-opt.picked { border-style: solid; border-color: var(--stage-accent, #94a3b8); background: var(--stage-accent-bg, rgba(148, 163, 184, 0.18)); }
      .effort-btn:disabled { opacity: 0.45; cursor: not-allowed; }

      .effort-btn-top { display: flex; align-items: center; justify-content: space-between; gap: 3px; }
      .effort-btn-labels { display: inline-flex; align-items: baseline; min-width: 0; white-space: nowrap; overflow: hidden; }
      .effort-name { font-size: 11.5px; font-weight: 600; color: var(--text-primary); }
      .effort-en { font-size: 8.5px; color: var(--text-muted); margin-left: 2px; font-weight: 500; }
      .effort-kbd { font-size: 9px; color: var(--text-muted); border: 1px solid var(--border-pill); border-radius: 4px; padding: 0 3.5px; line-height: 14px; }

      .effort-bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 10px; }
      .effort-bar { width: 3px; border-radius: 1px; background: rgba(148, 163, 184, 0.26); }
      .effort-bar.lit { background: var(--stage-accent, #4c8bf5); }
      .effort-desc { font-size: 10px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .effort-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 10px; color: var(--text-muted); }
      .effort-footer-msg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .effort-footer-msg.highlight { color: #93c5fd; }

      /* 化学元素单元格 */
      .el-cell {
        appearance: none;
        position: relative;
        border-radius: 7px;
        border: 1px solid var(--border-cell);
        background: var(--bg-cell);
        color: var(--text-cell-dim);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4px 3px;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease, color 120ms ease;
        font-family: inherit;
        outline: none;
      }

      .el-cell.idle:hover { background: var(--bg-cell-hover); color: var(--text-primary); border-color: rgba(148, 163, 184, 0.35); transform: translateY(-1px) scale(1.03); z-index: 2; }
      .el-cell.idle.virtual-selected { color: var(--text-primary); background: rgba(148, 163, 184, 0.16); border: 1.5px dashed rgba(203, 213, 225, 0.85); box-shadow: 0 0 14px rgba(148, 163, 184, 0.28); transform: translateY(-1px) scale(1.04); z-index: 4; }

      .el-num { position: absolute; top: 5px; left: 5.5px; font-size: 7.5px; line-height: 1; opacity: 0.7; font-variant-numeric: tabular-nums; z-index: 1; }
      .el-sym { font-size: clamp(11.5px, 1.3vw, 13.5px); font-weight: 700; line-height: 1; margin-top: 4px; letter-spacing: -0.01em; z-index: 1; }
      .el-subname { font-size: 6.2px; line-height: 1; margin-top: 2px; opacity: 0.92; letter-spacing: -0.02em; max-width: 96%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 1; }

      .el-placeholder { border-radius: 7px; border: 1px solid var(--border-cell); background: var(--bg-placeholder); color: var(--text-muted); font-size: 9.5px; display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }

      /* 已发布可用模型元素 */
      .el-cell.released {
        color: var(--text-primary);
        background: var(--el-bg);
        border: 1.5px solid var(--el-border);
        box-shadow: 0 0 12px var(--el-glow), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }

      /* 当接入实时额度边框时，隐藏原生固定实线边框，完全由 SVG 额度边框决定边框显隐（用完时边框彻底消失） */
      .el-cell.released.has-quota {
        border-color: transparent;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .el-cell.released .el-num { opacity: 0.9; }
      .el-cell.released:hover { transform: translateY(-2px) scale(1.05); z-index: 4; box-shadow: 0 6px 20px var(--el-glow-strong); }
      .el-cell.released.active { background: var(--el-bg-active, var(--el-bg)); box-shadow: 0 0 18px var(--el-glow-strong); z-index: 3; }
      .el-cell.released.selected { transform: translateY(-2px) scale(1.05); box-shadow: 0 0 0 1.5px #ffffff, 0 8px 24px var(--el-glow-strong); z-index: 5; }

      /* 暂不可用（Unavailable）元素，如当前灰显的 Gemini 4 Carbon */
      .el-cell.unavailable {
        color: var(--text-muted);
        background: rgba(51, 65, 85, 0.25);
        border: 1px dashed rgba(148, 163, 184, 0.26);
        opacity: 0.62;
        cursor: not-allowed;
      }

      .el-dot { position: absolute; top: 5.5px; right: 5.5px; width: 5px; height: 5px; border-radius: 99px; background: var(--el-accent); box-shadow: 0 0 6px var(--el-accent); z-index: 2; }
      .el-cell.has-dual-quota .el-num { top: 6.8px; left: 7px; font-size: 7px; }
      .el-cell.has-dual-quota .el-dot { top: 7px; right: 7px; width: 4.5px; height: 4.5px; }
      .el-cell.released.active .el-dot { background: #ffffff; box-shadow: 0 0 7px #ffffff; }

      /* 即将发布元素 */
      .el-cell.coming-soon {
        color: var(--text-primary);
        border: 1.5px dashed var(--el-soon-border);
        background: repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--el-soon-stripe) 4px, var(--el-soon-stripe) 6px), var(--el-soon-bg);
      }
      .el-cell.coming-soon .el-sym { opacity: 0.94; }
      .el-cell.coming-soon:hover, .el-cell.coming-soon.virtual-selected { transform: translateY(-1px) scale(1.04); z-index: 4; border-color: var(--el-accent); box-shadow: 0 4px 16px var(--el-glow); }
      .el-soon-ring { position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; border-radius: 99px; border: 1.4px solid var(--el-accent); animation: agPulseRing 2.4s ease-in-out infinite; }

      /* 周期表下方扩展行（唯一 1 个 3.8 Flash + 唯一 1 个合并后的 Orchestrator 模块） */
      .gm-strip { grid-row: 13; grid-column: 5 / 20; display: flex; align-items: stretch; gap: 8px; overflow: visible; padding: 1px 0; }
      .gm-row-tag { grid-row: 13; grid-column: 2 / 5; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #7dd3fc; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.24); border-radius: 7px; padding: 0 6px; white-space: nowrap; }

      .gm-cell {
        appearance: none;
        position: relative;
        min-width: 132px;
        flex: 0 1 auto;
        border-radius: 7px;
        padding: 5px 15px 5px 12px;
        cursor: pointer;
        color: var(--text-primary);
        background: var(--el-bg);
        border: 1.5px solid var(--el-border);
        box-shadow: 0 0 12px var(--el-glow), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
        font-family: inherit;
        outline: none;
      }

      .gm-cell.has-quota {
        border-color: transparent;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .gm-cell:hover { transform: translateY(-1.5px); box-shadow: 0 5px 16px var(--el-glow-strong); }
      .gm-cell.active { box-shadow: 0 0 14px var(--el-glow-strong); }
      .gm-cell.selected { box-shadow: 0 0 0 1.5px #ffffff, 0 6px 18px var(--el-glow-strong); }

      .gm-ver { font-size: 8.5px; opacity: 0.86; line-height: 1; margin-bottom: 2px; font-variant-numeric: tabular-nums; white-space: nowrap; z-index: 1; }
      .gm-name { font-size: 12px; font-weight: 600; line-height: 1.1; white-space: nowrap; z-index: 1; }

      /* 底部其他厂商模型区域（同步支持双层/单层额度边框） */
      .other-section { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-panel); display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .other-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1 1 auto; }
      .other-label { font-size: 11.5px; color: var(--text-muted); margin-right: 4px; white-space: nowrap; }

      .other-pill {
        appearance: none;
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid var(--border-pill);
        background: var(--bg-pill);
        color: var(--text-primary);
        font-size: 11.5px;
        padding: 5.5px 12px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
        font-family: inherit;
      }

      .other-pill.has-quota {
        border-color: transparent;
      }

      .other-pill:hover { background: var(--bg-pill-hover); transform: translateY(-1px); }
      .other-pill.active { box-shadow: 0 0 10px rgba(76, 139, 245, 0.35); }
      .other-pill.selected { box-shadow: 0 0 0 1.5px #ffffff; }

      .pill-dot { width: 6px; height: 6px; border-radius: 99px; background: var(--pill-color, #94a3b8); flex-shrink: 0; z-index: 1; }
      .pill-count { font-size: 10px; color: var(--text-muted); padding-left: 2px; z-index: 1; }
      .other-empty { font-size: 11.5px; color: var(--text-muted); }
      .other-actions { display: flex; align-items: center; gap: 6px; }

      @media (max-height: 760px) {
        .backdrop { padding: 10px; }
        .panel { padding: 11px 14px 10px; border-radius: 14px; }
        .header { margin-bottom: 5px; }
        .ptable { grid-template-rows: ${compactGridRows}; gap: 2.5px; padding: 2px 4px 4px 2px; }
        .center-stage.picking.usage-stage { padding: 4px 9px; gap: 2.5px; }
        .center-stage.picking.usage-stage .effort-symbol-badge { width: 22px; height: 22px; font-size: 10.5px; }
        .usage-card { padding: 3.5px 7px; gap: 2.5px; }
        .center-stage.picking.orch-stage { padding: 4px 9px; gap: 2px; }
        .center-stage.picking.orch-stage .effort-symbol-badge { width: 24px; height: 24px; font-size: 11px; }
        .orch-model-tab { padding: 2px 5px; font-size: 10.5px; }
        .center-stage.orch-stage .effort-btn { padding: 2.5px 6px; }
        .other-section { margin-top: 7px; padding-top: 7px; }
      }
    `;
  }

  // 渲染中央黄金区：用量详情态 / 已发布模型档位选择态 / 虚拟元素态 / 总览态
  function renderCenterStageHtml() {
    let availableElementCount = 0;
    for (const grp of state.modelsBySymbol.values()) {
      if (!grp.unavailable) availableElementCount++;
    }
    const releasedGoogleCount =
      availableElementCount + state.googleClassicModels.length + state.orchestratorModels.length;
    let comingSoonCount = 0;
    for (const symKey of dynamicRegistry.comingSoonMap.keys()) {
      if (!state.modelsBySymbol.has(symKey)) comingSoonCount++;
    }

    // 模式 0：用量详情总览面板（完整整合原版 View Usage 全部额度池数据）
    if (state.showingUsagePanel) {
      const pools = state.usageData && Array.isArray(state.usageData.pools) ? state.usageData.pools : [];
      const compactMetricLabels = pools.length >= 4;
      const cardsHtml = pools.length
        ? pools
            .map((pool) => {
              const rows = [];
              if (pool.weekly && typeof pool.weekly.pct === 'number') {
                const c = getWeeklyStrokeColor(pool.weekly.pct);
                const compactReset = formatCompactResetText(pool.weekly.resetText);
                rows.push(`
                  <div class="usage-row">
                    <div class="usage-row-top">
                      <span class="usage-metric-label">${compactMetricLabels ? '周' : '外框 · 周'}</span>
                      ${compactReset ? `<span class="usage-reset-inline" title="${escHtml(pool.weekly.resetText)}">${escHtml(compactReset)}</span>` : ''}
                      <strong class="usage-pct" style="color:${c}">${pool.weekly.pct}%</strong>
                    </div>
                    <div class="usage-bar-track"><div class="usage-bar-fill" style="width:${pool.weekly.pct}%;background:${c}"></div></div>
                  </div>
                `);
              }
              if (pool.fiveHour && typeof pool.fiveHour.pct === 'number') {
                const c = getFiveHourStrokeColor(pool.fiveHour.pct);
                const compactReset = formatCompactResetText(pool.fiveHour.resetText);
                rows.push(`
                  <div class="usage-row">
                    <div class="usage-row-top">
                      <span class="usage-metric-label">${compactMetricLabels ? '5h' : '内框 · 5h'}</span>
                      ${compactReset ? `<span class="usage-reset-inline" title="${escHtml(pool.fiveHour.resetText)}">${escHtml(compactReset)}</span>` : ''}
                      <strong class="usage-pct" style="color:${c}">${pool.fiveHour.pct}%</strong>
                    </div>
                    <div class="usage-bar-track"><div class="usage-bar-fill" style="width:${pool.fiveHour.pct}%;background:${c}"></div></div>
                  </div>
                `);
              }
              return `
                <div class="usage-card">
                  <div class="usage-card-title">${escHtml(pool.title)}</div>
                  ${rows.join('')}
                </div>
              `;
            })
            .join('')
        : `<div style="font-size:11.5px;color:var(--text-secondary);padding:12px 4px;">${state.probingUsage ? '正在从原版 View Usage 实时读取额度...' : '暂未读取到额度数据，请点击右上角「刷新用量」重试'}</div>`;

      const timeStr = state.usageData?.updatedAt
        ? new Date(state.usageData.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })
        : '';
      const usageCols = Math.min(Math.max(pools.length, 1), 4);
      const usageGridClass = pools.length > 4 ? 'usage-grid-many' : pools.length === 4 ? 'usage-grid-4' : '';

      return `
        <div
          class="center-stage picking usage-stage"
          style="--stage-accent:#34d399;--stage-accent-bg:rgba(52,211,153,0.14);--stage-accent-border:rgba(52,211,153,0.42);"
        >
          <div class="effort-header">
            <div class="effort-model-info">
              <div class="effort-symbol-badge">
                <span class="effort-symbol-num">USE</span>
                <span>%</span>
              </div>
              <div class="effort-title-wrap">
                <div class="effort-title-line">
                  <span class="effort-model-name">实时额度用量</span>
                  <span class="usage-header-hint">外框周额度 · 内框5h · 满额全显</span>
                </div>
              </div>
            </div>
            <div class="stage-actions">
              <button type="button" class="effort-back-btn" data-action="refresh-usage">${state.probingUsage ? '读取中...' : '↻ 刷新用量'}</button>
              <button type="button" class="effort-back-btn" data-action="back-overview">← 返回</button>
            </div>
          </div>
          <div class="usage-grid ${usageGridClass}" style="--usage-cols:${usageCols}">${cardsHtml}</div>
          <div class="effort-footer">
            <span>${timeStr ? `最近同步：${timeStr} · ` : ''}已同步到元素表边框</span>
            <span>Esc 返回</span>
          </div>
        </div>
      `;
    }

    // 模式 1：用户点选了已发布可用模型（H/Ne/Ar、3.8 Flash、Orchestrator、或底部其他厂商模型）
    if (state.selectedGroup) {
      const grp = state.selectedGroup;

      // 1A：合并后的 Orchestrator 模块（支持新版 3 级结构：底层模型 Tab + 推理档位卡片；兼容旧版无档位直选）
      if (grp.kind === 'orchestrator') {
        const subModels = Array.isArray(grp.subModels) && grp.subModels.length ? grp.subModels : [];
        const hasMultiEffort = subModels.some((sm) => sm.hasLevel3 && sm.variants.length > 0);

        if (hasMultiEffort) {
          const activeSub =
            subModels.find((sm) => sm.key === state.selectedOrchSubModelKey) ||
            subModels.find((sm) => sm.variants.some((v) => v.canonicalKey === state.activeModelKey)) ||
            subModels.find((sm) => sm.key === grp.defaultSubModelKey) ||
            subModels[0];
          const stageAccent = (activeSub && activeSub.accent) || grp.accent || '#a855f7';
          const activeQuota = activeSub
            ? getQuotaForTarget({
                baseName: activeSub.baseName,
                vendor: activeSub.vendor || 'Google',
                isOrchestrator: true,
                orchestratorTier: activeSub.shortName || '',
              })
            : null;
          const quotaChipsHtml = formatQuotaShortChips(activeQuota);

          const orchTabCols = Math.min(Math.max(subModels.length, 1), 6);
          const modelTabsHtml = subModels
            .map((sm) => {
              const isTabSelected = activeSub && sm.key === activeSub.key;
              const isTabRunning = sm.variants.some((v) => v.canonicalKey === state.activeModelKey);
              const smAccent = sm.accent || '#a855f7';
              const countHint = sm.efforts.length > 0 ? `${sm.efforts.length}档` : '直选';
              const tabLabel = formatOrchTabLabel(sm, subModels.length);
              return `
                <button
                  type="button"
                  class="orch-model-tab ${isTabSelected ? 'active' : ''}"
                  style="--tab-accent:${smAccent};--tab-accent-bg:${hexToRgba(smAccent, 0.16)};"
                  data-orch-submodel="${escHtml(sm.key)}"
                  title="${escHtml(sm.baseName)}（${escHtml(countHint)}）"
                >
                  <span class="orch-tier-dot" style="--tier-color:${smAccent};margin-right:0"></span>
                  <span class="orch-tab-label">${escHtml(tabLabel)}</span>
                  <span class="orch-tab-count">${isTabRunning ? '✓' : escHtml(countHint)}</span>
                </button>
              `;
            })
            .join('');

          const activeVariants = activeSub ? activeSub.variants : [];
          const effortButtons = activeVariants
            .map((v, idx) => {
              const meta = v.effortMeta || null;
              const isCurrent = v.canonicalKey === state.activeModelKey;
              const barsHtml = meta
                ? `<span class="effort-bars" aria-hidden="true">${[1, 2, 3, 4]
                    .map((lvl) => {
                      const h = 3 + lvl * 1.7;
                      const lit = lvl <= meta.bars ? 'lit' : '';
                      return `<span class="effort-bar ${lit}" style="height:${h}px"></span>`;
                    })
                    .join('')}</span>`
                : '';
              const nameZh = meta ? meta.zh : '标准版';
              const nameEn = meta && meta.zh !== meta.en ? meta.en : (meta ? '' : 'Direct');
              const descText = isCurrent ? '✓ 当前使用' : (meta ? meta.desc : '直接切换');
              return `
                <button
                  type="button"
                  class="effort-btn ${isCurrent ? 'current' : ''}"
                  data-orch-submodel-key="${escHtml(activeSub.key)}"
                  data-orch-variant-idx="${idx}"
                  ${v.disabled ? 'disabled' : ''}
                  title="${escHtml(v.rawLabel)}"
                >
                  <div class="effort-btn-top">
                    <div class="effort-btn-labels">
                      <span class="effort-name">${escHtml(nameZh)}</span>
                      ${nameEn ? `<span class="effort-en">${escHtml(nameEn)}</span>` : ''}
                    </div>
                    <span class="effort-kbd">${idx + 1}</span>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px;">
                    <span class="effort-desc">${escHtml(descText)}</span>
                    ${barsHtml}
                  </div>
                </button>
              `;
            })
            .join('');

          const resetInfo = formatQuotaResetSummary(activeQuota);
          const subSummary = activeSub
            ? `${activeSub.baseName} · ${activeVariants.length}档${resetInfo ? ' · ' + resetInfo : ''}`
            : `共 ${subModels.length} 个底层模型`;
          const subTitle = activeSub
            ? `${activeSub.baseName} · 共 ${activeVariants.length} 档${activeQuota ? ' · ' + formatQuotaInlineText(activeQuota) : ''}`
            : subSummary;

          return `
            <div
              class="center-stage picking orch-stage"
              style="--stage-accent:${stageAccent};--stage-accent-bg:${hexToRgba(stageAccent, 0.16)};--stage-accent-border:${hexToRgba(stageAccent, 0.45)};"
            >
              <div class="effort-header">
                <div class="effort-model-info">
                  <div class="effort-symbol-badge">
                    <span class="effort-symbol-num">OR</span>
                    <span>Or</span>
                  </div>
                  <div class="effort-title-wrap">
                    <div class="effort-title-line">
                      <span class="effort-model-name">Orchestrator</span>
                      ${quotaChipsHtml}
                    </div>
                    <div class="effort-model-sub" title="${escHtml(subTitle)}">${escHtml(subSummary)}</div>
                  </div>
                </div>
                <div class="stage-actions">
                  <button type="button" class="effort-back-btn" data-action="back-overview">← 返回</button>
                </div>
              </div>
              <div class="orch-model-tabs" style="--orch-tab-cols:${orchTabCols}" role="tablist" aria-label="Orchestrator 底层模型">${modelTabsHtml}</div>
              <div class="effort-grid">${effortButtons}</div>
              <div class="effort-footer">
                <span>←/→ 切底层模型 · 数字键 1-${activeVariants.length} 快选档位</span>
                <span>Esc 返回</span>
              </div>
            </div>
          `;
        }

        // 兼容旧版无三级档位的扁平 Orchestrator
        const accent = grp.accent || '#a855f7';
        const tierButtons = grp.variants
          .map((v, idx) => {
            const isCurrent = v.canonicalKey === state.activeModelKey;
            const tierName = v.orchSubModelShortName || v.orchestratorTier || v.tierLabel || v.rawLabel;
            const tierColor = v.tierAccent || getOrchestratorSubModelAccent(v.orchSubModelBaseName || tierName, v.orchSubVendor);
            const tierQuota = getQuotaForTarget({
              baseName: v.orchSubModelBaseName || `Gemini 4 ${tierName}`,
              vendor: v.orchSubVendor || 'Google',
              isOrchestrator: true,
              orchestratorTier: tierName,
            });
            const quotaBrief = tierQuota
              ? [
                  tierQuota.weekly ? `周 ${tierQuota.weekly.pct}%` : '',
                  tierQuota.fiveHour ? `5h ${tierQuota.fiveHour.pct}%` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '';
            const descText = isCurrent
              ? `✓ 当前使用${quotaBrief ? ' · ' + quotaBrief : ''}`
              : quotaBrief
                ? `直接切换 · ${quotaBrief}`
                : '直接切换';
            return `
              <button
                type="button"
                class="effort-btn ${isCurrent ? 'current' : ''}"
                style="--stage-accent:${tierColor};--stage-accent-bg:${hexToRgba(tierColor, 0.16)};"
                data-variant-idx="${idx}"
                ${v.disabled ? 'disabled' : ''}
                title="${escHtml(v.rawLabel)}${quotaBrief ? ' · ' + escHtml(quotaBrief) : ''}"
              >
                <div class="effort-btn-top">
                  <div class="effort-btn-labels">
                    <span class="orch-tier-dot" style="--tier-color:${tierColor}"></span>
                    <span class="effort-name">${escHtml(tierName)}</span>
                  </div>
                  <span class="effort-kbd">${idx + 1}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px;">
                  <span class="effort-desc">${escHtml(descText)}</span>
                </div>
              </button>
            `;
          })
          .join('');

        return `
          <div
            class="center-stage picking"
            style="--stage-accent:${accent};--stage-accent-bg:${hexToRgba(accent, 0.16)};--stage-accent-border:${hexToRgba(accent, 0.45)};"
          >
            <div class="effort-header">
              <div class="effort-model-info">
                <div class="effort-symbol-badge">
                  <span class="effort-symbol-num">OR</span>
                  <span>Or</span>
                </div>
                <div class="effort-title-wrap">
                  <div class="effort-title-line">
                    <span class="effort-model-name">Orchestrator</span>
                  </div>
                  <div class="effort-model-sub">请选择版本（共 ${grp.variants.length} 项 · 直接切换）</div>
                </div>
              </div>
              <div class="stage-actions">
                <button type="button" class="effort-back-btn" data-action="back-overview">← 返回</button>
              </div>
            </div>
            <div class="effort-grid">${tierButtons}</div>
            <div class="effort-footer">
              <span>点击直接切换 · 按数字键 1-${grp.variants.length} 快选</span>
              <span>Esc 返回</span>
            </div>
          </div>
        `;
      }

      // 1B：常规模型（元素表模型、3.8 Flash、底部其他厂商模型）
      const accent = grp.kind === 'element' ? grp.element.accent : (grp.accent || grp.vendorColor);
      const numText =
        grp.kind === 'element'
          ? String(grp.element.number)
          : grp.kind === 'google-classic'
            ? grp.versionTag
            : grp.vendor.slice(0, 3).toUpperCase();
      const symText =
        grp.kind === 'element'
          ? grp.element.symbol
          : grp.kind === 'google-classic'
            ? grp.cardLabel.slice(0, 2)
            : grp.shortName.slice(0, 2).toUpperCase();
      const titleText =
        grp.kind === 'element'
          ? `${grp.baseName}（${grp.element.zh}）`
          : `${grp.baseName}`;
      const quota = getQuotaForGroup(grp);
      const quotaChipsHtml = formatQuotaShortChips(quota);
      const sourceBadge = grp.source === 'api' ? `<span class="preview-badge released">API 接入</span>` : '';
      const hasAnyEffort = grp.variants.some((v) => !!v.effortMeta);
      const resetInfo = formatQuotaResetSummary(quota);
      const subText =
        grp.variants.length > 1
          ? (hasAnyEffort
              ? `共 ${grp.variants.length} 档${resetInfo ? ' · ' + resetInfo : ' · 点选下方档位立即切换'}`
              : `共 ${grp.variants.length} 项版本${resetInfo ? ' · ' + resetInfo : ''}`)
          : hasAnyEffort
            ? `固定档位（${grp.variants[0].effortMeta.zh}）${resetInfo ? ' · ' + resetInfo : ' · 点击立即切换'}`
            : `单一版本${resetInfo ? ' · ' + resetInfo : ' · 点击立即切换'}`;
      const subTitle = quota ? `${subText} · ${formatQuotaInlineText(quota)}` : subText;

      const effortButtons = grp.variants
        .map((v, idx) => {
          const meta = v.effortMeta || null;
          const isCurrent = v.canonicalKey === state.activeModelKey;
          const barsHtml = meta
            ? `<span class="effort-bars" aria-hidden="true">${[1, 2, 3, 4]
                .map((lvl) => {
                  const h = 3 + lvl * 1.7;
                  const lit = lvl <= meta.bars ? 'lit' : '';
                  return `<span class="effort-bar ${lit}" style="height:${h}px"></span>`;
                })
                .join('')}</span>`
            : '';

          const nameZh = meta ? meta.zh : '标准版';
          const nameEn = meta && meta.zh !== meta.en ? meta.en : (meta ? '' : 'Standard');
          const descText = isCurrent ? '✓ 当前使用' : (meta ? meta.desc : '直接切换');

          return `
            <button
              type="button"
              class="effort-btn ${isCurrent ? 'current' : ''}"
              data-variant-idx="${idx}"
              ${v.disabled ? 'disabled' : ''}
              title="${escHtml(v.rawLabel)}${v.subtitle ? ' · ' + escHtml(v.subtitle) : ''}"
            >
              <div class="effort-btn-top">
                <div class="effort-btn-labels">
                  <span class="effort-name">${escHtml(nameZh)}</span>
                  ${nameEn ? `<span class="effort-en">${escHtml(nameEn)}</span>` : ''}
                </div>
                <span class="effort-kbd">${idx + 1}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px;">
                <span class="effort-desc">${escHtml(descText)}</span>
                ${barsHtml}
              </div>
            </button>
          `;
        })
        .join('');

      const footerHint =
        grp.variants.length > 1
          ? `点击档位立即切换 · 按数字键 1-${grp.variants.length} 快选`
          : '点击立即切换 · 按数字键 1 确认';

      return `
        <div
          class="center-stage picking"
          style="--stage-accent:${accent};--stage-accent-bg:${hexToRgba(accent, 0.16)};--stage-accent-border:${hexToRgba(accent, 0.45)};"
        >
          <div class="effort-header">
            <div class="effort-model-info">
              <div class="effort-symbol-badge">
                <span class="effort-symbol-num">${escHtml(numText)}</span>
                <span>${escHtml(symText)}</span>
              </div>
              <div class="effort-title-wrap">
                <div class="effort-title-line">
                  <span class="effort-model-name">${escHtml(titleText)}</span>
                  ${quotaChipsHtml}
                  ${sourceBadge}
                </div>
                <div class="effort-model-sub" title="${escHtml(subTitle)}">${escHtml(subText)}</div>
              </div>
            </div>
            <div class="stage-actions">
              <button type="button" class="effort-back-btn" data-action="back-overview">← 返回</button>
            </div>
          </div>
          <div class="effort-grid">${effortButtons}</div>
          <div class="effort-footer">
            <span>${escHtml(footerHint)}</span>
            <span>Esc 返回</span>
          </div>
        </div>
      `;
    }

    // 模式 2：点选未发布元素 -> 虚拟选择窗口
    if (state.virtualElement) {
      const el = state.virtualElement;
      const symKey = el.symbol.toLowerCase();
      const soonMeta = dynamicRegistry.comingSoonMap.get(symKey) || null;
      const accent = (soonMeta && soonMeta.accent) || el.accent || '#94a3b8';
      const statusBadgeHtml = soonMeta
        ? `<span class="preview-badge soon">即将发布</span>`
        : `<span class="preview-badge virtual">虚拟槽位</span>`;
      const proposedTitle = `${(soonMeta && soonMeta.codename) || el.en}（${el.zh}）`;
      const subText = soonMeta
        ? (soonMeta.note || `${el.groupZh} · 即将发布，上线后自动亮起`)
        : `${el.groupZh} · 暂未发布，上线同名模型自动激活`;

      const virtualEfforts = getVirtualEffortsList();
      const effortButtons = virtualEfforts
        .map((meta, idx) => {
          const picked = state.virtualPickedEffort === meta.key;
          const barsHtml = [1, 2, 3, 4]
            .map((lvl) => {
              const h = 3 + lvl * 1.7;
              const lit = lvl <= meta.bars ? 'lit' : '';
              return `<span class="effort-bar ${lit}" style="height:${h}px"></span>`;
            })
            .join('');
          return `
            <button
              type="button"
              class="effort-btn virtual-opt ${picked ? 'picked' : ''}"
              data-virtual-effort="${escHtml(meta.key)}"
              title="虚拟槽位思考强度预览：${escHtml(proposedTitle)} (${escHtml(meta.en)})"
            >
              <div class="effort-btn-top">
                <div class="effort-btn-labels">
                  <span class="effort-name">${escHtml(meta.zh)}</span>
                  ${meta.zh !== meta.en ? `<span class="effort-en">${escHtml(meta.en)}</span>` : ''}
                </div>
                <span class="effort-kbd">${idx + 1}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px;">
                <span class="effort-desc">${picked ? '◌ 虚拟已选' : escHtml(meta.desc)}</span>
                <span class="effort-bars" aria-hidden="true">${barsHtml}</span>
              </div>
            </button>
          `;
        })
        .join('');

      const footerLeft = state.virtualFeedback
        ? `<span class="effort-footer-msg highlight">${escHtml(state.virtualFeedback)}</span>`
        : `<span class="effort-footer-msg">接口就绪 <code>element:${escHtml(el.symbol)}</code> · 上线自动激活或通过 API 挂载</span>`;

      return `
        <div
          class="center-stage virtual"
          style="--stage-accent:${accent};--stage-accent-bg:${hexToRgba(accent, 0.15)};--stage-accent-border:${hexToRgba(accent, 0.5)};"
        >
          <div class="effort-header">
            <div class="effort-model-info">
              <div class="effort-symbol-badge virtual">
                <span class="effort-symbol-num">${el.number}</span>
                <span>${escHtml(el.symbol)}</span>
              </div>
              <div class="effort-title-wrap">
                <div class="effort-title-line">
                  <span class="effort-model-name">${escHtml(proposedTitle)}</span>
                  ${statusBadgeHtml}
                </div>
                <div class="effort-model-sub">${escHtml(subText)}</div>
              </div>
            </div>
            <div class="stage-actions">
              <button type="button" class="effort-back-btn ${soonMeta ? 'pinned' : ''}" data-action="toggle-soon">${soonMeta ? '★ 已标即将' : '☆ 即将发布'}</button>
              <button type="button" class="effort-back-btn" data-action="back-overview">← 返回</button>
            </div>
          </div>
          <div class="effort-grid">${effortButtons}</div>
          <div class="effort-footer">
            ${footerLeft}
            <span style="flex-shrink:0">Esc 返回</span>
          </div>
        </div>
      `;
    }

    // 模式 3：周期表总览态（表头简洁，不罗列 5 个模型胶囊，展示实时额度边框图例与悬浮详情）
    const activeSummary = getActiveModelSummary();
    const activeChipHtml = activeSummary
      ? `
        <span class="active-chip" style="--chip-color:${activeSummary.accent}">
          <span class="active-chip-dot"></span>
          <span>当前：${escHtml(activeSummary.name)}${activeSummary.effort ? ' · ' + escHtml(activeSummary.effort) : ''}</span>
        </span>
      `
      : '';

    let previewHtml = `<span class="preview-text" style="opacity:0.78">点击彩色亮起元素格选择档位；边框长短表示剩余额度（满=全显，空=消失）</span>`;
    const focusInfo = state.hoveredInfo;
    if (focusInfo) {
      if (focusInfo.type === 'released') {
        const q = getQuotaForGroup(focusInfo.group);
        const qText = formatQuotaCompactText(q);
        const qFull = formatQuotaInlineText(q);
        const effortsText = focusInfo.group.variants
          .map((v) => (v.effortMeta ? v.effortMeta.zh : '标准'))
          .join(' / ');
        const fullTitle = `${focusInfo.element.number} ${focusInfo.element.symbol} · ${focusInfo.group.baseName} · 档位：${effortsText}${qFull ? ' · ' + qFull : ''}`;
        previewHtml = `
          <span class="preview-badge released">${escHtml(focusInfo.group.colorLabel || '可用')}</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>${focusInfo.element.number} ${escHtml(focusInfo.element.symbol)}</strong> · ${escHtml(focusInfo.group.baseName)} · ${focusInfo.group.variants.length}档${qText ? ' · ' + escHtml(qText) : ''}</span>
        `;
      } else if (focusInfo.type === 'unavailable') {
        const fullTitle = `${focusInfo.element.number} ${focusInfo.element.symbol} · ${focusInfo.group.baseName}（当前账号不可用 / Unavailable）`;
        previewHtml = `
          <span class="preview-badge unavail">暂不可用</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>${focusInfo.element.number} ${escHtml(focusInfo.element.symbol)}</strong> · ${escHtml(focusInfo.group.baseName)}（当前账号不可用）</span>
        `;
      } else if (focusInfo.type === 'gm') {
        const q = getQuotaForGroup(focusInfo.group);
        const qText = formatQuotaCompactText(q);
        const qFull = formatQuotaInlineText(q);
        const effortsText = focusInfo.group.variants
          .map((v) => (v.effortMeta ? v.effortMeta.zh : '标准'))
          .join(' / ');
        const fullTitle = `${focusInfo.group.baseName} · 档位：${effortsText}${qFull ? ' · ' + qFull : ''}`;
        previewHtml = `
          <span class="preview-badge released">经典模型</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>${escHtml(focusInfo.group.baseName)}</strong> · ${focusInfo.group.variants.length}档${qText ? ' · ' + escHtml(qText) : ''}</span>
        `;
      } else if (focusInfo.type === 'orchestrator') {
        const subList = Array.isArray(focusInfo.group.subModels) && focusInfo.group.subModels.length
          ? focusInfo.group.subModels
          : null;
        const tiersText = subList
          ? subList.map((sm) => sm.shortName || sm.baseName).join('/')
          : focusInfo.group.variants.map((v) => v.orchestratorTier || v.tierLabel || v.rawLabel).join('/');
        const q = getQuotaForGroup(focusInfo.group);
        const qBrief = q
          ? [
              q.weekly && typeof q.weekly.pct === 'number' ? `周 ${q.weekly.pct}%` : '',
              q.fiveHour && typeof q.fiveHour.pct === 'number' ? `5h ${q.fiveHour.pct}%` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : '';
        const qFull = formatQuotaInlineText(q);
        const modeHint = focusInfo.group.hasEffort ? '含多档推理' : '直接切换';
        const fullTitle = `Orchestrator · 底层模型：${tiersText}（${modeHint}）${qFull ? ' · ' + qFull : ''}`;
        previewHtml = `
          <span class="preview-badge released">编排模型</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>Orchestrator</strong> (${escHtml(tiersText)})${qBrief ? ' · ' + escHtml(qBrief) : ''}</span>
        `;
      } else if (focusInfo.type === 'other') {
        const q = getQuotaForGroup(focusInfo.group);
        const qText = formatQuotaCompactText(q);
        const qFull = formatQuotaInlineText(q);
        const effortsText = focusInfo.group.variants
          .map((v) => (v.effortMeta ? v.effortMeta.zh : '标准'))
          .join(' / ');
        const fullTitle = `${focusInfo.group.baseName} · 档位：${effortsText}${qFull ? ' · ' + qFull : ''}`;
        previewHtml = `
          <span class="preview-badge released">${escHtml(focusInfo.group.vendor)}</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>${escHtml(focusInfo.group.baseName)}</strong> · ${focusInfo.group.variants.length}档${qText ? ' · ' + escHtml(qText) : ''}</span>
        `;
      } else if (focusInfo.type === 'soon') {
        const fullTitle = `${focusInfo.element.number} ${focusInfo.element.symbol} · ${focusInfo.soon.codename || focusInfo.element.en}（${focusInfo.soon.zhName || focusInfo.element.zh}） · 点击打开预留虚拟窗口`;
        previewHtml = `
          <span class="preview-badge soon">即将发布</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>${focusInfo.element.number} ${escHtml(focusInfo.element.symbol)}</strong> · ${escHtml(focusInfo.soon.codename || focusInfo.element.en)}（${escHtml(focusInfo.element.zh)}）· 点击预览槽位</span>
        `;
      } else if (focusInfo.type === 'virtual') {
        const fullTitle = `${focusInfo.element.number} ${focusInfo.element.symbol} · ${focusInfo.element.en}（${focusInfo.element.zh} · ${focusInfo.element.groupZh}） · 点击打开虚拟选择窗口`;
        previewHtml = `
          <span class="preview-badge virtual">虚拟槽位</span>
          <span class="preview-text" title="${escHtml(fullTitle)}"><strong>${focusInfo.element.number} ${escHtml(focusInfo.element.symbol)}</strong> · ${escHtml(focusInfo.element.en)}（${escHtml(focusInfo.element.zh)} · ${focusInfo.element.groupZh}）· 点击预览</span>
        `;
      }
    }

    return `
      <div class="center-stage">
        <div class="hero-top">
          <div class="hero-title-group">
            <div class="hero-title">${escHtml(state.detectedSeries)}</div>
            ${activeChipHtml}
          </div>
        </div>
        <div class="legend-row">
          <span class="legend-item">
            <span class="legend-dot-released"></span>
            <span>${releasedGoogleCount} 个可用</span>
          </span>
          <span class="legend-item">
            <span class="legend-dot-soon"></span>
            <span>${comingSoonCount} 个即将发布</span>
          </span>
          <span class="legend-item" title="外层边框长度代表每周额度剩余比例，满为整圈，用完消失">
            <span class="legend-box-weekly"></span>
            <span>外框=周额度</span>
          </span>
          <span class="legend-item" title="双池模型内层边框长度代表5小时额度剩余比例（单池模型仅显示外框）">
            <span class="legend-box-5h"></span>
            <span>内框=5h额度</span>
          </span>
        </div>
        <div class="preview-line">${previewHtml}</div>
      </div>
    `;
  }

  // 渲染元素周期表下方行（仅放置 1 个 3.8 Flash 模块 + 1 个合并后的 Orchestrator 模块，带实时额度边框）
  function renderGoogleClassicRowHtml() {
    if (!state.googleClassicModels.length && !state.orchestratorModels.length) return '';

    const classicCardsHtml = state.googleClassicModels
      .map((grp) => {
        const active = isGroupActive(grp);
        const selected = state.selectedGroup && state.selectedGroup.id === grp.id;
        const accent = grp.accent || '#38bdf8';
        const quota = getQuotaForGroup(grp);
        const quotaSvg = renderQuotaBorderSvg(quota, 136, 44, 7, 'card');
        const hasQuotaClass = quotaSvg ? 'has-quota' : '';
        const qTitle = quota ? ` · ${formatQuotaInlineText(quota)}` : '';
        const styleVars = `--el-accent:${accent};--el-bg:${hexToRgba(accent, 0.2)};--el-border:${hexToRgba(accent, 0.68)};--el-glow:${hexToRgba(accent, 0.22)};--el-glow-strong:${hexToRgba(accent, 0.42)};`;
        const countText = grp.variants.length > 1 ? ` · ${grp.variants.length}档` : '';
        return `
          <button
            type="button"
            class="gm-cell ${hasQuotaClass} ${active ? 'active' : ''} ${selected ? 'selected' : ''}"
            style="${styleVars}"
            data-gm-id="${escHtml(grp.id)}"
            title="${escHtml(grp.baseName)}${escHtml(qTitle)}"
          >
            ${quotaSvg}
            <span class="el-dot"></span>
            <span class="gm-ver">Gemini ${escHtml(grp.versionTag)}${escHtml(countText)}</span>
            <span class="gm-name">${escHtml(grp.versionTag)} ${escHtml(grp.cardLabel)}</span>
          </button>
        `;
      })
      .join('');

    const orchCardsHtml = state.orchestratorModels
      .map((grp) => {
        const active = isGroupActive(grp);
        const selected = state.selectedGroup && state.selectedGroup.id === grp.id;
        const activeVariant = grp.variants.find((v) => v.canonicalKey === state.activeModelKey);
        const accent = (activeVariant && activeVariant.tierAccent) || grp.accent || '#a855f7';
        const quota = getQuotaForGroup(grp);
        const quotaSvg = renderQuotaBorderSvg(quota, 136, 44, 7, 'card');
        const hasQuotaClass = quotaSvg ? 'has-quota' : '';
        const qTitle = quota ? ` · ${formatQuotaInlineText(quota)}` : '';
        const styleVars = `--el-accent:${accent};--el-bg:${hexToRgba(accent, 0.2)};--el-border:${hexToRgba(accent, 0.68)};--el-glow:${hexToRgba(accent, 0.22)};--el-glow-strong:${hexToRgba(accent, 0.42)};`;
        const subList = Array.isArray(grp.subModels) && grp.subModels.length ? grp.subModels : null;
        const tiersSummary = subList
          ? subList.map((sm) => sm.shortName || sm.baseName).join(' · ')
          : grp.variants.map((v) => v.orchestratorTier || v.tierLabel || v.rawLabel).join(' · ');
        const activeEffortHint = activeVariant && activeVariant.effortMeta ? ` · ${activeVariant.effortMeta.zh}` : '';
        const subLine = activeVariant
          ? `当前：${activeVariant.orchSubModelShortName || activeVariant.orchestratorTier || activeVariant.tierLabel}${activeEffortHint}`
          : tiersSummary || 'Neon · Argon · Opus 5.5';
        const modeTitleHint = grp.hasEffort ? '含推理档位' : '直接切换';
        return `
          <button
            type="button"
            class="gm-cell ${hasQuotaClass} ${active ? 'active' : ''} ${selected ? 'selected' : ''}"
            style="${styleVars}"
            data-orch-id="${escHtml(grp.id)}"
            title="Orchestrator（${escHtml(tiersSummary)} · ${modeTitleHint}）${escHtml(qTitle)}"
          >
            ${quotaSvg}
            <span class="el-dot"></span>
            <span class="gm-ver">${escHtml(subLine)}</span>
            <span class="gm-name">Orchestrator</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="row-label gm" style="grid-row:13;grid-column:1">Gm</div>
      <div class="gm-row-tag" title="元素表下方模型（3.8 Flash 与 Orchestrator）">表外模型</div>
      <div class="gm-strip">${classicCardsHtml}${orchCardsHtml}</div>
    `;
  }

  // 生成单个元素单元格 HTML（含单层/双层实时额度进度边框 & 暂不可用态）
  function renderElementCellHtml(el) {
    const symKey = el.symbol.toLowerCase();
    const releasedGroup = state.modelsBySymbol.get(symKey);
    const soonMeta = !releasedGroup ? dynamicRegistry.comingSoonMap.get(symKey) : null;
    const isVirtualSelected = state.virtualElement && state.virtualElement.symbol === el.symbol;

    const gridRow = el.row + 1;
    const gridCol = el.col + 1;

    const classes = ['el-cell'];
    let styleVars = `grid-row:${gridRow};grid-column:${gridCol};`;
    let indicatorHtml = '';
    let subnameHtml = '';
    let quotaSvgHtml = '';
    let titleAttr = `${el.number} ${el.symbol} · ${el.en} (${el.zh}) — 点击打开虚拟选择窗口`;
    let dataState = 'idle';

    if (releasedGroup && releasedGroup.unavailable) {
      classes.push('unavailable');
      dataState = 'unavailable';
      subnameHtml = `<span class="el-subname">暂不可用</span>`;
      titleAttr = `${releasedGroup.baseName} (${el.zh}) — 当前暂不可用 (Unavailable)`;
    } else if (releasedGroup) {
      classes.push('released');
      dataState = 'released';
      const accent = releasedGroup.element.accent || el.accent;
      const colorLabel = releasedGroup.colorLabel || el.colorLabel || '';
      const quota = getQuotaForGroup(releasedGroup);
      quotaSvgHtml = renderQuotaBorderSvg(quota, 46, 46, 7, 'cell');
      if (quotaSvgHtml) {
        classes.push('has-quota');
        if (quota && quota.weekly && quota.fiveHour) classes.push('has-dual-quota');
      }
      if (isGroupActive(releasedGroup)) classes.push('active');
      if (state.selectedGroup && state.selectedGroup.id === releasedGroup.id) classes.push('selected');
      styleVars += `--el-accent:${accent};--el-bg:${hexToRgba(accent, 0.22)};--el-bg-active:${hexToRgba(accent, 0.30)};--el-border:${hexToRgba(accent, 0.78)};--el-glow:${hexToRgba(accent, 0.26)};--el-glow-strong:${hexToRgba(accent, 0.48)};`;
      indicatorHtml = `<span class="el-dot"></span>`;
      subnameHtml = `<span class="el-subname" style="color:${accent};filter:brightness(1.32)">${escHtml(el.en)}</span>`;
      const qTitle = quota ? ` · ${formatQuotaInlineText(quota)}` : '';
      titleAttr = `${releasedGroup.baseName} (${el.zh} · ${colorLabel}) — ${releasedGroup.variants.length} 档可选${qTitle}`;
    } else if (soonMeta) {
      classes.push('coming-soon');
      dataState = 'soon';
      if (isVirtualSelected) classes.push('virtual-selected');
      const accent = soonMeta.accent || el.accent;
      styleVars += `--el-accent:${accent};--el-soon-border:${hexToRgba(accent, 0.72)};--el-soon-bg:${hexToRgba(accent, 0.08)};--el-soon-stripe:${hexToRgba(accent, 0.08)};--el-glow:${hexToRgba(accent, 0.25)};`;
      indicatorHtml = `<span class="el-soon-ring"></span>`;
      titleAttr = `${soonMeta.codename || el.en} (${el.zh}) — ${soonMeta.note || '即将发布'}`;
    } else {
      classes.push('idle');
      if (isVirtualSelected) classes.push('virtual-selected');
    }

    return `
      <button
        type="button"
        class="${classes.join(' ')}"
        style="${styleVars}"
        data-symbol="${escHtml(el.symbol)}"
        data-state="${dataState}"
        title="${escHtml(titleAttr)}"
      >
        ${quotaSvgHtml}
        <span class="el-num">${el.number}</span>
        ${indicatorHtml}
        <span class="el-sym">${escHtml(el.symbol)}</span>
        ${subnameHtml}
      </button>
    `;
  }

  function renderOtherPillsHtml() {
    if (state.otherModels.length === 0) {
      return `<span class="other-empty">当前列表无其他厂商模型</span>`;
    }
    return state.otherModels
      .map((grp) => {
        const active = isGroupActive(grp);
        const selected = state.selectedGroup && state.selectedGroup.id === grp.id;
        const quota = getQuotaForGroup(grp);
        const quotaSvg = renderQuotaBorderSvg(quota, 150, 30, 15, 'pill');
        const hasQuotaClass = quotaSvg ? 'has-quota' : '';
        const qTitle = quota ? ` · ${formatQuotaInlineText(quota)}` : '';
        const activeVariant = grp.variants.find((v) => v.canonicalKey === state.activeModelKey);
        const singleEffortMeta = grp.variants.length === 1 ? grp.variants[0].effortMeta : null;
        const suffix =
          activeVariant && activeVariant.effortMeta
            ? `· ${activeVariant.effortMeta.zh}`
            : grp.variants.length > 1
              ? `· ${grp.variants.length}档`
              : singleEffortMeta
                ? `· ${singleEffortMeta.zh}`
                : '';
        const suffixHtml = suffix ? `<span class="pill-count">${escHtml(suffix)}</span>` : '';
        return `
          <button
            type="button"
            class="other-pill ${hasQuotaClass} ${active ? 'active' : ''} ${selected ? 'selected' : ''}"
            style="--pill-color:${grp.vendorColor}"
            data-other-id="${escHtml(grp.id)}"
            title="${escHtml(grp.baseName)}${grp.vendor !== 'Other' ? ' (' + escHtml(grp.vendor) + ')' : ''}${escHtml(qTitle)}"
          >
            ${quotaSvg}
            <span class="pill-dot"></span>
            <span style="z-index:1">${escHtml(grp.shortName)}</span>
            ${suffixHtml}
          </button>
        `;
      })
      .join('');
  }

  // 首次挂载完整弹窗骨架
  function mountModalSkeleton() {
    if (!state.shadow) return;

    const colHeaders = Array.from({ length: 18 }, (_, i) => {
      const c = i + 1;
      return `<div class="col-label" style="grid-row:1;grid-column:${c + 1}">${c}</div>`;
    }).join('');

    const rowLabels = [
      ...Array.from({ length: 7 }, (_, i) => `<div class="row-label" style="grid-row:${i + 2};grid-column:1">${i + 1}</div>`),
      `<div class="row-label" style="grid-row:10;grid-column:1">Ln</div>`,
      `<div class="row-label" style="grid-row:11;grid-column:1">An</div>`,
    ].join('');

    const placeholders = `
      <div class="el-placeholder" style="grid-row:7;grid-column:4">57-71</div>
      <div class="el-placeholder" style="grid-row:8;grid-column:4">89-103</div>
    `;

    const cellsHtml = ELEMENTS.map((el) => renderElementCellHtml(el)).join('');

    const actionBtnsHtml = state.actionItems
      .map(
        (act, idx) => `
          <button type="button" class="ghost-btn" data-native-action="${idx}">${escHtml(act.label)}</button>
        `
      )
      .join('');

    state.shadow.innerHTML = `
      <style>${buildStyles(state.isLightTheme)}</style>
      <div class="backdrop" data-action="backdrop">
        <div class="panel" role="dialog" aria-modal="true" aria-label="${escHtml(CONFIG.title)}">
          <div class="header">
            <div class="header-left">
              <svg class="sparkle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2L14.55 9.45L22 12L14.55 14.55L12 22L9.45 14.55L2 12L9.45 9.45L12 2Z"/>
              </svg>
              <span class="title">${escHtml(CONFIG.title)}</span>
              <span class="subtitle">${escHtml(CONFIG.subtitle)}</span>
            </div>
            <div class="header-actions">
              <button type="button" class="ghost-btn ${state.showingUsagePanel ? 'active' : ''}" data-action="toggle-usage" title="查看所有模型额度用量（同步映射为元素表内外双层边框）">用量详情</button>
              <button type="button" class="ghost-btn" data-action="native-list" title="切换回 Antigravity 原版下拉列表（按住 Shift 点击按钮也可直接打开原版）">原版列表</button>
              <button type="button" class="close-btn" data-action="close" aria-label="关闭">×</button>
            </div>
          </div>

          <div class="ptable-scroll">
            <div class="ptable">
              ${colHeaders}
              ${rowLabels}
              ${renderCenterStageHtml()}
              ${placeholders}
              ${cellsHtml}
              ${renderGoogleClassicRowHtml()}
            </div>
          </div>

          <div class="other-section">
            <div class="other-left">
              <span class="other-label">Other models · 其他厂商</span>
              ${renderOtherPillsHtml()}
            </div>
            <div class="other-actions">
              ${actionBtnsHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    state.skeletonMounted = true;
    requestAnimationFrame(() => syncQuotaSvgGeometry());
    setTimeout(() => {
      if (!state.shadow) return;
      state.shadow.querySelector('.backdrop')?.classList.add('no-anim');
      state.shadow.querySelector('.panel')?.classList.add('no-anim');
      syncQuotaSvgGeometry();
    }, 170);
  }

  function syncSingleElementCellAppearance(el) {
    if (!state.shadow || !el) return;
    const oldCell = state.shadow.querySelector(`.el-cell[data-symbol="${el.symbol}"]`);
    if (!oldCell) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderElementCellHtml(el).trim();
    const newCell = tmp.firstElementChild;
    if (newCell) oldCell.replaceWith(newCell);
  }

  function updateCenterStageOnly() {
    if (!state.shadow) return;
    const oldStage = state.shadow.querySelector('.center-stage');
    if (!oldStage) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderCenterStageHtml().trim();
    const nextStage = tmp.firstElementChild;
    if (nextStage) {
      oldStage.replaceWith(nextStage);
    }
    const usageBtn = state.shadow.querySelector('[data-action="toggle-usage"]');
    if (usageBtn) usageBtn.classList.toggle('active', !!state.showingUsagePanel);
  }

  // 当后台静默探测到新的实时用量或真实档位时，无闪烁局部更新有模型的所有单元格/卡片/胶囊边框与中央面板
  function refreshQuotaBordersAndPanels() {
    if (!state.shadow || !state.skeletonMounted) return;

    for (const symKey of state.modelsBySymbol.keys()) {
      const el = ELEMENT_BY_SYMBOL.get(symKey);
      if (el) syncSingleElementCellAppearance(el);
    }

    // 局部刷新表外模型行（3.8 Flash + Orchestrator）
    const gmStrip = state.shadow.querySelector('.gm-strip');
    if (gmStrip) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderGoogleClassicRowHtml();
      const nextStrip = tmp.querySelector('.gm-strip');
      if (nextStrip) gmStrip.replaceWith(nextStrip);
    }

    // 局部刷新底部 Other models 胶囊
    const otherLeft = state.shadow.querySelector('.other-left');
    if (otherLeft) {
      otherLeft.innerHTML = `<span class="other-label">Other models · 其他厂商</span>${renderOtherPillsHtml()}`;
    }

    updateCenterStageOnly();
    requestAnimationFrame(() => syncQuotaSvgGeometry());
  }

  function syncModalInteractiveState() {
    if (!state.shadow || !state.skeletonMounted) {
      mountModalSkeleton();
      return;
    }

    const selId = state.selectedGroup ? state.selectedGroup.id : '';
    const virtSym = state.virtualElement ? state.virtualElement.symbol : '';

    for (const cell of state.shadow.querySelectorAll('.el-cell[data-symbol]')) {
      const sym = cell.dataset.symbol || '';
      const symKey = sym.toLowerCase();
      cell.classList.toggle('selected', selId === `el:${symKey}`);
      cell.classList.toggle('virtual-selected', virtSym === sym);
    }

    for (const gmCell of state.shadow.querySelectorAll('.gm-cell[data-gm-id]')) {
      gmCell.classList.toggle('selected', gmCell.dataset.gmId === selId);
    }

    for (const orchCell of state.shadow.querySelectorAll('.gm-cell[data-orch-id]')) {
      orchCell.classList.toggle('selected', orchCell.dataset.orchId === selId);
    }

    for (const pill of state.shadow.querySelectorAll('.other-pill[data-other-id]')) {
      pill.classList.toggle('selected', pill.dataset.otherId === selId);
    }

    updateCenterStageOnly();
  }

  function attachShadowEvents(host, shadow) {
    for (const evtName of ['pointerdown', 'mousedown', 'focusin', 'click']) {
      host.addEventListener(evtName, (e) => {
        e.stopPropagation();
      });
    }

    shadow.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      if (target.dataset.action === 'backdrop') {
        closeModal({ dismissNativeMenu: true });
        return;
      }

      const actionBtn = target.closest('[data-action]');
      if (actionBtn) {
        const act = actionBtn.dataset.action;
        if (act === 'close') {
          closeModal({ dismissNativeMenu: true });
          return;
        }
        if (act === 'native-list') {
          switchToNativeList();
          return;
        }
        if (act === 'toggle-usage') {
          state.showingUsagePanel = !state.showingUsagePanel;
          if (state.showingUsagePanel) {
            state.selectedGroup = null;
            state.virtualElement = null;
            state.virtualPickedEffort = null;
            state.virtualFeedback = '';
          }
          syncModalInteractiveState();
          return;
        }
        if (act === 'refresh-usage') {
          probeUsageAndSubmenusInBackground(true);
          updateCenterStageOnly();
          return;
        }
        if (act === 'back-overview') {
          state.selectedGroup = null;
          state.virtualElement = null;
          state.virtualPickedEffort = null;
          state.virtualFeedback = '';
          state.showingUsagePanel = false;
          syncModalInteractiveState();
          return;
        }
        if (act === 'toggle-soon' && state.virtualElement) {
          toggleComingSoonForElement(state.virtualElement);
          return;
        }
      }

      const nativeActBtn = target.closest('[data-native-action]');
      if (nativeActBtn) {
        const idx = Number(nativeActBtn.dataset.nativeAction);
        commitActionItem(state.actionItems[idx]);
        return;
      }

      const orchSubTab = target.closest('[data-orch-submodel]');
      if (orchSubTab && state.selectedGroup && state.selectedGroup.kind === 'orchestrator') {
        const subKey = orchSubTab.dataset.orchSubmodel || '';
        const sm = (state.selectedGroup.subModels || []).find((x) => x.key === subKey);
        if (sm && !sm.disabled) {
          if (!sm.hasLevel3 && sm.variants.length === 1) {
            commitModelVariant(sm.variants[0]);
            return;
          }
          state.selectedOrchSubModelKey = sm.key;
          updateCenterStageOnly();
        }
        return;
      }

      const orchEffortBtn = target.closest('[data-orch-variant-idx]');
      if (orchEffortBtn && state.selectedGroup && state.selectedGroup.kind === 'orchestrator') {
        const subKey = orchEffortBtn.dataset.orchSubmodelKey || state.selectedOrchSubModelKey;
        const idx = Number(orchEffortBtn.dataset.orchVariantIdx);
        const sm = (state.selectedGroup.subModels || []).find((x) => x.key === subKey);
        const variant = sm ? sm.variants[idx] : null;
        if (variant && !variant.disabled) {
          commitModelVariant(variant);
        }
        return;
      }

      const effortBtn = target.closest('[data-variant-idx]');
      if (effortBtn && state.selectedGroup) {
        const idx = Number(effortBtn.dataset.variantIdx);
        const variant = state.selectedGroup.variants[idx];
        if (variant && !variant.disabled) {
          commitModelVariant(variant);
        }
        return;
      }

      const virtualEffortBtn = target.closest('[data-virtual-effort]');
      if (virtualEffortBtn && state.virtualElement) {
        const effKey = virtualEffortBtn.dataset.virtualEffort;
        const meta = EFFORT_META[effKey] || EFFORT_META.default;
        handleVirtualEffortPreview(state.virtualElement, meta);
        return;
      }

      const cell = target.closest('.el-cell[data-symbol]');
      if (cell) {
        const symKey = (cell.dataset.symbol || '').toLowerCase();
        const cellState = cell.dataset.state;
        const el = ELEMENT_BY_SYMBOL.get(symKey);
        if (!el || cellState === 'unavailable') return;

        state.showingUsagePanel = false;
        if (cellState === 'released') {
          const grp = state.modelsBySymbol.get(symKey);
          if (!grp || grp.unavailable) return;
          state.selectedGroup = grp;
          state.virtualElement = null;
          state.virtualPickedEffort = null;
          state.virtualFeedback = '';
          syncModalInteractiveState();
          return;
        }

        state.selectedGroup = null;
        state.virtualElement = el;
        state.virtualPickedEffort = null;
        state.virtualFeedback = '';
        syncModalInteractiveState();
        return;
      }

      const gmCell = target.closest('.gm-cell[data-gm-id]');
      if (gmCell) {
        const id = gmCell.dataset.gmId;
        const grp = state.googleClassicModels.find((g) => g.id === id);
        if (!grp) return;
        state.showingUsagePanel = false;
        state.selectedGroup = grp;
        state.virtualElement = null;
        state.virtualPickedEffort = null;
        state.virtualFeedback = '';
        syncModalInteractiveState();
        return;
      }

      const orchCell = target.closest('.gm-cell[data-orch-id]');
      if (orchCell) {
        const id = orchCell.dataset.orchId;
        const grp = state.orchestratorModels.find((g) => g.id === id);
        if (!grp) return;
        state.showingUsagePanel = false;
        state.selectedGroup = grp;
        const subModels = Array.isArray(grp.subModels) ? grp.subModels : [];
        const activeSub =
          subModels.find((sm) => sm.variants.some((v) => v.canonicalKey === state.activeModelKey)) ||
          subModels.find((sm) => sm.key === grp.defaultSubModelKey) ||
          subModels[0];
        state.selectedOrchSubModelKey = activeSub ? activeSub.key : '';
        state.virtualElement = null;
        state.virtualPickedEffort = null;
        state.virtualFeedback = '';
        syncModalInteractiveState();
        return;
      }

      const otherPill = target.closest('.other-pill[data-other-id]');
      if (otherPill) {
        const id = otherPill.dataset.otherId;
        const grp = state.otherModels.find((g) => g.id === id);
        if (!grp) return;
        state.showingUsagePanel = false;
        state.selectedGroup = grp;
        state.virtualElement = null;
        state.virtualPickedEffort = null;
        state.virtualFeedback = '';
        syncModalInteractiveState();
      }
    });

    shadow.addEventListener('mouseover', (e) => {
      if (state.selectedGroup || state.virtualElement || state.showingUsagePanel) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const gmCell = target.closest('.gm-cell[data-gm-id]');
      if (gmCell) {
        const grp = state.googleClassicModels.find((g) => g.id === gmCell.dataset.gmId);
        if (grp) {
          state.hoveredInfo = { type: 'gm', group: grp };
          updateCenterStageOnly();
        }
        return;
      }

      const orchCell = target.closest('.gm-cell[data-orch-id]');
      if (orchCell) {
        const grp = state.orchestratorModels.find((g) => g.id === orchCell.dataset.orchId);
        if (grp) {
          state.hoveredInfo = { type: 'orchestrator', group: grp };
          updateCenterStageOnly();
        }
        return;
      }

      const otherPill = target.closest('.other-pill[data-other-id]');
      if (otherPill) {
        const grp = state.otherModels.find((g) => g.id === otherPill.dataset.otherId);
        if (grp) {
          state.hoveredInfo = { type: 'other', group: grp };
          updateCenterStageOnly();
        }
        return;
      }

      const cell = target.closest('.el-cell[data-symbol]');
      if (!cell) return;
      const symKey = (cell.dataset.symbol || '').toLowerCase();
      const cellState = cell.dataset.state;
      const el = ELEMENT_BY_SYMBOL.get(symKey);
      if (!el) return;

      if (cellState === 'released') {
        state.hoveredInfo = { type: 'released', element: el, group: state.modelsBySymbol.get(symKey) };
        updateCenterStageOnly();
      } else if (cellState === 'unavailable') {
        state.hoveredInfo = { type: 'unavailable', element: el, group: state.modelsBySymbol.get(symKey) };
        updateCenterStageOnly();
      } else if (cellState === 'soon') {
        state.hoveredInfo = { type: 'soon', element: el, soon: dynamicRegistry.comingSoonMap.get(symKey) || {} };
        updateCenterStageOnly();
      } else {
        state.hoveredInfo = { type: 'virtual', element: el };
        updateCenterStageOnly();
      }
    });

    shadow.addEventListener('mouseout', (e) => {
      if (state.selectedGroup || state.virtualElement || state.showingUsagePanel || !state.hoveredInfo) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const fromInteractive = target.closest('.el-cell[data-symbol], .gm-cell[data-gm-id], .gm-cell[data-orch-id], .other-pill[data-other-id]');
      if (!fromInteractive) return;
      const related = e.relatedTarget instanceof Element
        ? e.relatedTarget.closest('.el-cell[data-symbol], .gm-cell[data-gm-id], .gm-cell[data-orch-id], .other-pill[data-other-id]')
        : null;
      if (!related) {
        state.hoveredInfo = null;
        updateCenterStageOnly();
      }
    });
  }

  function openModal() {
    state.isLightTheme = detectLightTheme();
    if (state.hostEl && state.hostEl.isConnected) {
      state.hostEl.remove();
    }
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    state.hostEl = host;
    state.shadow = shadow;
    state.open = true;
    state.openedAt = Date.now();
    state.skeletonMounted = false;
    state.selectedGroup = null;
    state.selectedOrchSubModelKey = '';
    state.virtualElement = null;
    state.virtualPickedEffort = null;
    state.virtualFeedback = '';
    state.showingUsagePanel = false;
    state.hoveredInfo = null;

    attachShadowEvents(host, shadow);
    mountModalSkeleton();
    document.documentElement.appendChild(host);

    // 弹窗打开后立即异步静默探测 View Usage 实时额度及全部模型二级推理档位
    probeUsageAndSubmenusInBackground(false);
  }

  function startCaptureNativeMenu(triggerBtn) {
    if (state.capturing) {
      if (typeof state.extendCaptureDeadline === 'function') state.extendCaptureDeadline();
      return;
    }
    ensureCloakStyle();
    document.documentElement.setAttribute('data-ag-periodic-cloaking', '1');
    state.capturing = true;
    state.triggerBtn = triggerBtn;

    const preExistingMenus = new Set(
      document.querySelectorAll('[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content], [data-floating-ui-portal], [role="dialog"]')
    );

    let settled = false;
    let cloakedMenu = null;
    let rafId = 0;
    let timeoutId = 0;
    let settleTimer = 0;
    let mo = null;

    const cleanup = () => {
      if (mo) {
        mo.disconnect();
        mo = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = 0;
      }
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = 0;
      }
      state.capturing = false;
      state.extendCaptureDeadline = null;
    };
    state.captureCleanup = cleanup;

    const finalizeCapture = (menuEl) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!menuEl || !menuEl.isConnected) {
        document.documentElement.removeAttribute('data-ag-periodic-cloaking');
        return;
      }
      const latest = extractItemsFromMenu(menuEl, triggerBtn);
      if (latest.modelItems.length < 1) {
        menuEl.removeAttribute('data-ag-periodic-hidden-menu');
        document.documentElement.removeAttribute('data-ag-periodic-cloaking');
        return;
      }
      menuEl.setAttribute('data-ag-periodic-hidden-menu', '1');
      document.documentElement.removeAttribute('data-ag-periodic-cloaking');
      state.nativeMenuEl = menuEl;
      state.nativeMenuHidden = true;
      buildModelGroups(latest.modelItems, latest.actionItems, triggerBtn, latest.usageTriggerEl);
      openModal();
    };

    const tryCapture = () => {
      if (settled) return;
      const found = findNativeModelMenu(triggerBtn, preExistingMenus);
      if (found && found.modelItems.length >= 1) {
        if (!cloakedMenu) {
          cloakedMenu = found.menuEl;
          cloakedMenu.setAttribute('data-ag-periodic-hidden-menu', '1');
          settleTimer = setTimeout(() => finalizeCapture(cloakedMenu), 20);
        } else if (found.menuEl !== cloakedMenu && found.modelItems.length > extractItemsFromMenu(cloakedMenu, triggerBtn).modelItems.length) {
          cloakedMenu.removeAttribute('data-ag-periodic-hidden-menu');
          cloakedMenu = found.menuEl;
          cloakedMenu.setAttribute('data-ag-periodic-hidden-menu', '1');
        }
      }
    };

    mo = new MutationObserver(() => {
      tryCapture();
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'data-state', 'aria-hidden'],
    });

    const loop = () => {
      if (settled) return;
      tryCapture();
      if (!settled) rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    const scheduleTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!settled) {
          if (cloakedMenu) finalizeCapture(cloakedMenu);
          else {
            settled = true;
            cleanup();
            document.documentElement.removeAttribute('data-ag-periodic-cloaking');
          }
        }
      }, 450);
    };
    state.extendCaptureDeadline = scheduleTimeout;
    scheduleTimeout();
  }

  function onDocumentPointerDownCapture(e) {
    if (state.open) {
      if (e.target instanceof Element && e.target.closest(`#${HOST_ID}`)) {
        e.stopImmediatePropagation();
      }
      return;
    }
    if (state.bypassNextClick) return;
    if (e.button !== 0 || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof Element && e.target.closest(`#${HOST_ID}`)) return;

    const triggerBtn = findModelTriggerButton(e.target);
    if (!triggerBtn) return;

    const alreadyExpanded = triggerBtn.getAttribute('aria-expanded') === 'true' || triggerBtn.getAttribute('data-state') === 'open';
    if (alreadyExpanded) return;

    startCaptureNativeMenu(triggerBtn);
  }

  function onDocumentClickCapture(e) {
    if (state.bypassNextClick) return;
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof Element && e.target.closest(`#${HOST_ID}`)) return;

    const triggerBtn = findModelTriggerButton(e.target);
    if (!triggerBtn) return;

    if (state.open) {
      if (Date.now() - state.openedAt < 300) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      closeModal({ dismissNativeMenu: true });
      return;
    }

    if (state.capturing) {
      if (typeof state.extendCaptureDeadline === 'function') state.extendCaptureDeadline();
      return;
    }

    const alreadyExpanded = triggerBtn.getAttribute('aria-expanded') === 'true' || triggerBtn.getAttribute('data-state') === 'open';
    if (alreadyExpanded) return;

    startCaptureNativeMenu(triggerBtn);
  }

  function onDocumentKeyDown(e) {
    if (!state.open) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (state.selectedGroup || state.virtualElement || state.showingUsagePanel) {
        state.selectedGroup = null;
        state.selectedOrchSubModelKey = '';
        state.virtualElement = null;
        state.virtualPickedEffort = null;
        state.virtualFeedback = '';
        state.showingUsagePanel = false;
        syncModalInteractiveState();
      } else {
        closeModal({ dismissNativeMenu: true });
      }
      return;
    }

    if (
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
      state.selectedGroup &&
      state.selectedGroup.kind === 'orchestrator' &&
      Array.isArray(state.selectedGroup.subModels) &&
      state.selectedGroup.subModels.length > 1
    ) {
      e.preventDefault();
      e.stopPropagation();
      const subs = state.selectedGroup.subModels;
      const curIdx = Math.max(0, subs.findIndex((sm) => sm.key === state.selectedOrchSubModelKey));
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextSub = subs[(curIdx + delta + subs.length) % subs.length];
      if (nextSub) {
        state.selectedOrchSubModelKey = nextSub.key;
        updateCenterStageOnly();
      }
      return;
    }

    if (/^[1-9]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      if (state.selectedGroup) {
        let variant = null;
        if (
          state.selectedGroup.kind === 'orchestrator' &&
          Array.isArray(state.selectedGroup.subModels) &&
          state.selectedGroup.subModels.some((sm) => sm.hasLevel3)
        ) {
          const activeSub =
            state.selectedGroup.subModels.find((sm) => sm.key === state.selectedOrchSubModelKey) ||
            state.selectedGroup.subModels[0];
          variant = activeSub ? activeSub.variants[idx] : null;
        } else {
          variant = state.selectedGroup.variants[idx];
        }
        if (variant && !variant.disabled) {
          e.preventDefault();
          e.stopPropagation();
          commitModelVariant(variant);
        }
      } else if (state.virtualElement) {
        const list = getVirtualEffortsList();
        if (list[idx]) {
          e.preventDefault();
          e.stopPropagation();
          handleVirtualEffortPreview(state.virtualElement, list[idx]);
        }
      }
    }
  }

  function onDocumentMouseOrFocusShield(e) {
    if (!state.open) return;
    if (e.target instanceof Element && e.target.closest(`#${HOST_ID}`)) {
      e.stopImmediatePropagation();
    }
  }

  document.addEventListener('pointerdown', onDocumentPointerDownCapture, true);
  document.addEventListener('click', onDocumentClickCapture, true);
  document.addEventListener('keydown', onDocumentKeyDown, true);
  document.addEventListener('mousedown', onDocumentMouseOrFocusShield, true);
  document.addEventListener('focusin', onDocumentMouseOrFocusShield, true);

  // 对外预留标准接口
  const publicApi = {
    version: MODULE_VERSION,

    registerElementModel(symbol, descriptor) {
      const el = ELEMENT_BY_SYMBOL.get(String(symbol || '').toLowerCase());
      if (!el || !descriptor || typeof descriptor !== 'object') {
        throw new Error(`无效的元素符号或模型描述对象：${symbol}`);
      }
      const symKey = el.symbol.toLowerCase();
      const baseName = descriptor.baseName || `${state.detectedSeries} ${el.en}`;
      const rawVariants = Array.isArray(descriptor.variants) && descriptor.variants.length
        ? descriptor.variants
        : [{ effort: 'default', rawLabel: baseName }];

      dynamicRegistry.elementModels.set(symKey, {
        symbol: el.symbol,
        baseName,
        colorLabel: descriptor.colorLabel || el.colorLabel || '主题色',
        accent: descriptor.accent || el.accent,
        variants: rawVariants,
        onSelect: typeof descriptor.onSelect === 'function' ? descriptor.onSelect : null,
      });

      if (state.open) {
        buildModelGroups(state.lastNativeModelItems, state.lastNativeActionItems, state.triggerBtn);
        if (state.virtualElement && state.virtualElement.symbol.toLowerCase() === symKey) {
          state.virtualElement = null;
          state.selectedGroup = state.modelsBySymbol.get(symKey) || null;
        }
        syncSingleElementCellAppearance(el);
        syncModalInteractiveState();
      }
      return { slotId: `element:${el.symbol}`, registered: true };
    },

    unregisterElementModel(symbol) {
      const symKey = String(symbol || '').toLowerCase();
      const el = ELEMENT_BY_SYMBOL.get(symKey);
      const existed = dynamicRegistry.elementModels.delete(symKey);
      if (existed && state.open) {
        buildModelGroups(state.lastNativeModelItems, state.lastNativeActionItems, state.triggerBtn);
        if (state.selectedGroup && state.selectedGroup.id === `el:${symKey}`) {
          state.selectedGroup = null;
        }
        if (el) syncSingleElementCellAppearance(el);
        syncModalInteractiveState();
      }
      return existed;
    },

    registerMatcher(symbol, patternOrFn) {
      const ok = registerMatcherInternal(symbol, patternOrFn);
      if (ok && state.open) {
        buildModelGroups(state.lastNativeModelItems, state.lastNativeActionItems, state.triggerBtn);
        mountModalSkeleton();
      }
      return ok;
    },

    setComingSoon(symbol, metaOrNull, persist = true) {
      const el = ELEMENT_BY_SYMBOL.get(String(symbol || '').toLowerCase());
      if (!el) return false;
      const symKey = el.symbol.toLowerCase();
      if (!metaOrNull) {
        dynamicRegistry.comingSoonMap.delete(symKey);
        if (persist) savePersistedComingSoonDelta(symKey, null);
      } else {
        const entry = {
          symbol: el.symbol,
          codename: metaOrNull.codename || el.en,
          zhName: metaOrNull.zhName || el.zh,
          note: metaOrNull.note || '即将发布 · 上线后自动亮起',
          accent: metaOrNull.accent || el.accent,
        };
        dynamicRegistry.comingSoonMap.set(symKey, entry);
        if (persist) savePersistedComingSoonDelta(symKey, entry);
      }
      if (state.open) {
        syncSingleElementCellAppearance(el);
        syncModalInteractiveState();
      }
      return true;
    },

    registerVirtualHook(fn) {
      if (typeof fn !== 'function') return () => {};
      dynamicRegistry.virtualHooks.add(fn);
      return () => dynamicRegistry.virtualHooks.delete(fn);
    },

    refreshUsage() {
      return probeUsageAndSubmenusInBackground(true);
    },

    getRegistrySnapshot() {
      return {
        version: MODULE_VERSION,
        activeModelKey: state.activeModelKey,
        usage: state.usageData,
        elements: ELEMENTS.map((el) => {
          const symKey = el.symbol.toLowerCase();
          const released = state.modelsBySymbol.get(symKey);
          const soon = !released ? dynamicRegistry.comingSoonMap.get(symKey) : null;
          return {
            slotId: `element:${el.symbol}`,
            number: el.number,
            symbol: el.symbol,
            en: el.en,
            zh: el.zh,
            colorLabel: released ? released.colorLabel : el.colorLabel,
            accent: released ? released.element.accent : el.accent,
            status: released ? (released.unavailable ? 'unavailable' : 'released') : soon ? 'coming-soon' : 'virtual',
            source: released ? released.source : null,
            hasSubmenu: released ? !!released.hasSubmenu : false,
            variants: released ? released.variants.map((v) => v.rawLabel) : [],
            efforts: released ? released.variants.map((v) => v.effortKey) : [],
            quota: released && !released.unavailable ? getQuotaForGroup(released) : null,
          };
        }),
        googleClassicModels: state.googleClassicModels.map((g) => ({
          id: g.id,
          baseName: g.baseName,
          variants: g.variants.map((v) => v.rawLabel),
          efforts: g.variants.map((v) => v.effortKey),
          quota: getQuotaForGroup(g),
        })),
        orchestratorModels: state.orchestratorModels.map((g) => ({
          id: g.id,
          hasSubmenu: !!g.hasSubmenu,
          hasEffort: !!g.hasEffort,
          baseName: g.baseName,
          subModels: (g.subModels || []).map((sm) => ({
            baseName: sm.baseName,
            shortName: sm.shortName,
            vendor: sm.vendor,
            hasLevel3: !!sm.hasLevel3,
            efforts: sm.efforts || [],
            quota: getQuotaForTarget({
              baseName: sm.baseName,
              vendor: sm.vendor || 'Google',
              isOrchestrator: true,
              orchestratorTier: sm.shortName || '',
            }),
          })),
          tiers: (g.subModels || []).map((sm) => sm.shortName || sm.baseName),
          variants: g.variants.map((v) => v.rawLabel),
          quota: getQuotaForGroup(g),
        })),
        otherVendorModels: state.otherModels.map((g) => ({
          id: g.id,
          vendor: g.vendor,
          baseName: g.baseName,
          hasSubmenu: !!g.hasSubmenu,
          variants: g.variants.map((v) => v.rawLabel),
          efforts: g.variants.map((v) => v.effortKey),
          quota: getQuotaForGroup(g),
        })),
      };
    },

    refresh() {
      if (!state.open) return;
      buildModelGroups(state.lastNativeModelItems, state.lastNativeActionItems, state.triggerBtn);
      mountModalSkeleton();
    },
  };

  window.__ANTIGRAVITY_PERIODIC_API__ = publicApi;

  const periodicCleanup = () => {
    closeModal({ dismissNativeMenu: false });
    document.removeEventListener('pointerdown', onDocumentPointerDownCapture, true);
    document.removeEventListener('click', onDocumentClickCapture, true);
    document.removeEventListener('keydown', onDocumentKeyDown, true);
    document.removeEventListener('mousedown', onDocumentMouseOrFocusShield, true);
    document.removeEventListener('focusin', onDocumentMouseOrFocusShield, true);
    document.documentElement.removeAttribute('data-ag-periodic-cloaking');
    document.documentElement.removeAttribute('data-ag-periodic-probing');
    if (state.cloakStyleEl && state.cloakStyleEl.isConnected) {
      state.cloakStyleEl.remove();
    }
    state.cloakStyleEl = null;
  };

  window.__agPeriodicPickerVersion = MODULE_VERSION;
  window.__agPeriodicPickerBuild = MODULE_BUILD;
  // 将旧版清理钩子置为空函数，防止后台未重启的旧版监视器误卸监听器
  window.__agPeriodicPickerCleanup = () => {};
  window.__agPeriodicPickerCleanupV21 = () => {};
  window.__agPeriodicPickerCleanupV30 = periodicCleanup;
})();
