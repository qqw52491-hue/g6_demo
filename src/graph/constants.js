// --- 架构 V2: 语义分层 (Semantic Layering) ---
// 底层只认这些抽象层级，不再关心具体业务名
export const LAYERS = {
    TOP_MOST: 100,      // 系统级覆盖（如 Loading, Error）
    INTERACTION: 80,    // 强交互（如 Tooltip, Focus）
    HIGHLIGHT: 60,      // 视觉强调（如 Search Result, Path Trace）
    SELECTION: 40,      // 常规选中
    DECORATION: 20,     // 装饰性（如 Neighbor, Badge）
    BASE: 0
};

// --- 全局主题配置 (Global Theme Configuration) ---
// 这里的配置是为了向下兼容 (Backward Compatibility)
// 推荐做法：在业务层使用 StateManager 动态注册样式
export const THEME = {
    // --- 遗留的系统预设 (Legacy Presets) ---
    // 为了保证现有 Demo 正常运行暂时保留，
    // 最终目标是将这些全部移入业务代码或者独立的 Theme.js 文件

    dimmed: {
        layer: 10,
        style: { opacity: 0.2, fill: '#E5E7EB', stroke: '#E5E7EB', shadowBlur: 0 }
    },
    hidden: {
        layer: LAYERS.TOP_MOST,
        style: { opacity: 0, stroke: 'transparent' }
    },
    // critical: 已移除，由业务层动态定义1

    highlight: {
        layer: LAYERS.HIGHLIGHT,
        style: { stroke: '#00D1FF', lineWidth: 4, shadowColor: '#00D1FF', shadowBlur: 10, opacity: 1 }
    },
    highlight_source: {
        layer: LAYERS.HIGHLIGHT + 5,
        style: { fill: '#10B981', stroke: '#059669', lineWidth: 6, shadowColor: '#10B981', shadowBlur: 20, opacity: 1 }
    },
    highlight_target: {
        layer: LAYERS.HIGHLIGHT + 5,
        style: { fill: '#F59E0B', stroke: '#D97706', lineWidth: 6, shadowColor: '#F59E0B', shadowBlur: 20, opacity: 1 }
    },
    path_active: {
        layer: LAYERS.HIGHLIGHT - 5,
        style: { stroke: '#EC4899', lineWidth: 4, shadowColor: '#EC4899', shadowBlur: 10, opacity: 1 }
    },
    selected: {
        layer: LAYERS.SELECTION,
        style: { stroke: '#00D1FF', lineWidth: 4, shadowColor: '#00D1FF', shadowBlur: 10, opacity: 1 }
    },

    // --- 测试用状态 ---
    test_red: {
        layer: 50,
        style: { fill: '#FF0000', stroke: '#880000', lineWidth: 3, opacity: 1 }
    },
    test_green: {
        layer: 50,
        style: { fill: '#00FF00', stroke: '#008800', lineWidth: 3, opacity: 1 }
    },
    test_blue: {
        layer: 50,
        style: { fill: '#0000FF', stroke: '#000088', lineWidth: 3, opacity: 1 }
    },

    default: {
        layer: LAYERS.BASE,
        style: {}
    }
};

// --- 自动生成 PRIORITY 字典 ---
export const PRIORITY = Object.keys(THEME).reduce((acc, key) => {
    acc[key] = THEME[key].layer;
    return acc;
}, {});

// --- 自动生成全局默认样式字典 ---
export const GLOBAL_STATE_STYLES = Object.keys(THEME).reduce((acc, key) => {
    acc[key] = THEME[key].style;
    return acc;
}, {});

// --- 属性混合策略定义 (Blending Strategy) ---
export const BLEND_MODES = {
    // 1. 几何尺寸类 -> 取最大值
    r: (prev, curr) => Math.max(prev, curr),
    width: (prev, curr) => Math.max(prev, curr),
    height: (prev, curr) => Math.max(prev, curr),
    lineWidth: (prev, curr) => Math.max(prev, curr),

    // 2. 透明度 -> 智能混合 (Spotlight vs Overlay)
    opacity: (prev, curr) => curr === 1 ? 1 : prev * curr,
    fillOpacity: (prev, curr) => curr === 1 ? 1 : prev * curr,
    strokeOpacity: (prev, curr) => curr === 1 ? 1 : prev * curr,

    // 3. 阴影 -> 累加
    shadowBlur: (prev, curr) => prev + curr,
    shadowOffsetX: (prev, curr) => prev + curr,
    shadowOffsetY: (prev, curr) => prev + curr,

    // 4. 位移 -> 累加
    x: (prev, curr) => prev + curr,
    y: (prev, curr) => prev + curr,
};

// --- 动态定义的样式存储 (The Dynamic Registry) ---
// 为了让 StyleResolver 能直接访问动态样式，我们把它放在全局单例里
// StateManager 负责写，StyleResolver 负责读
export const DYNAMIC_STATE_STYLES = new Map();
