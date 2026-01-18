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
// 每一项包含了：
// 1. layer: 决定覆盖层级
// 2. style: 决定视觉样式 (作为全图默认值)
export const THEME = {
    hidden: {
        layer: LAYERS.TOP_MOST,
        style: { opacity: 0, stroke: 'transparent' } // 完全隐藏
    },
    critical: {
        layer: LAYERS.TOP_MOST - 10,
        style: {
            fill: '#EF4444', stroke: '#7F1D1D', shadowColor: '#EF4444', shadowBlur: 15,
            labelCfg: { style: { fill: '#fff', fontWeight: 'bold' } }
        }
    },
    disabled: {
        layer: LAYERS.INTERACTION,
        style: { opacity: 0.3, fill: '#555', cursor: 'not-allowed' }
    },
    highlight: {
        layer: LAYERS.HIGHLIGHT,
        style: { stroke: '#00D1FF', lineWidth: 4, shadowColor: '#00D1FF', shadowBlur: 10 }
    },
    highlight_source: {
        layer: LAYERS.HIGHLIGHT + 5,
        style: { fill: '#10B981', stroke: '#059669', lineWidth: 6, shadowColor: '#10B981', shadowBlur: 20 }
    },
    highlight_target: {
        layer: LAYERS.HIGHLIGHT + 5,
        style: { fill: '#F59E0B', stroke: '#D97706', lineWidth: 6, shadowColor: '#F59E0B', shadowBlur: 20 }
    },
    path_active: {
        layer: LAYERS.HIGHLIGHT - 5,
        style: { stroke: '#EC4899', lineWidth: 4, shadowColor: '#EC4899', shadowBlur: 10 }
    },
    selected: {
        layer: LAYERS.SELECTION,
        style: { stroke: '#00D1FF', lineWidth: 4, shadowColor: '#00D1FF', shadowBlur: 10 }
    },
    related: {
        layer: LAYERS.DECORATION,
        style: { stroke: '#A855F7', lineWidth: 4, lineDash: [5, 5] }
    },
    hover: {
        layer: LAYERS.DECORATION - 5,
        style: { stroke: '#999', cursor: 'pointer' }
    },
    default: {
        layer: LAYERS.BASE,
        style: {}
    }
};

// --- 向下兼容导出 (Derived Exports for Compatibility) ---

// 1. 自动生成 PRIORITY 字典 { critical: 90, ... }
export const PRIORITY = Object.keys(THEME).reduce((acc, key) => {
    acc[key] = THEME[key].layer;
    return acc;
}, {});

// 2. 自动生成全局默认样式字典 { critical: {...}, ... }
// 这样在 G6Demo 里就不用手写 commonStateStyles 了
export const GLOBAL_STATE_STYLES = Object.keys(THEME).reduce((acc, key) => {
    acc[key] = THEME[key].style;
    return acc;
}, {});

// --- 属性混合策略定义 (Blending Strategy) ---
// 任何未在此表中定义的属性，默认走 "覆盖 (Overwrite)" 逻辑。

export const BLEND_MODES = {
    // 1. 几何尺寸类 -> 取最大值 (Math.max)
    // 保证"更显眼"的特征不被"普通"特征掩盖
    r: (prev, curr) => Math.max(prev, curr),           // 半径
    width: (prev, curr) => Math.max(prev, curr),       // 宽
    height: (prev, curr) => Math.max(prev, curr),      // 高
    lineWidth: (prev, curr) => Math.max(prev, curr),   // 边框粗细

    // 2. 透明度/可见性 -> 乘法 (Multiply)
    // 任何一个状态想让它变淡，它就必须变淡。0 * N = 0 (彻底隐藏)
    opacity: (prev, curr) => prev * curr,
    fillOpacity: (prev, curr) => prev * curr,
    strokeOpacity: (prev, curr) => prev * curr,

    // 3. 阴影/发光效果 -> 累加 (Sum)
    // 多个状态叠加时，光晕应该更强
    shadowBlur: (prev, curr) => prev + curr,
    shadowOffsetX: (prev, curr) => prev + curr,
    shadowOffsetY: (prev, curr) => prev + curr,

    // 4. Transform/Offset -> 累加 (Sum)
    x: (prev, curr) => prev + curr, // 相对位移（注意：通常不建议用样式改 x/y，除非是相对微调）
    y: (prev, curr) => prev + curr,

    // --- 以下属性属于“覆盖型”，不需要写在这里，默认就是覆盖 ---
    // fill (填充色): 红色 + 蓝色 = ? 很难定义，通常直接取优先级高的。
    // stroke (边框色)
    // shadowColor (阴影色)
    // lineDash (虚线样式)
    // cursor (鼠标手势)
    // fontFamily / fontSize (字体)
};
