import { PRIORITY, BLEND_MODES, DYNAMIC_STATE_STYLES } from './constants';

/**
 * 根据激活的状态和优先级配置，计算节点的最终样式。
 * 
 * @param {Object} defaultStyle - 节点的默认样式。
 * @param {Object} stateStyles - 状态名到样式对象的映射。
 * @param {string[]} activeStates - 当前激活的状态名列表。
 * @returns {Object} 计算后的最终样式对象。
 */
export function resolveStyle(defaultStyle, stateStyles, activeStates, priorityMap) {
    // 按优先级排序状态：低 -> 高
    // 这确保高优先级的样式会覆盖低优先级的样式（除非定义了混合模式）
    // 4. 支持动态优先级 (Dynamic Priorities)
    // 优先使用传入的 priorityMap (Model上的)，其次使用全局注册表(Dynamic Registry)，最后是全局常量
    const getPriority = (state) => {
        if (priorityMap && priorityMap[state] !== undefined) return priorityMap[state];

        // Check dynamic registry
        if (DYNAMIC_STATE_STYLES.has(state)) {
            const config = DYNAMIC_STATE_STYLES.get(state);
            if (config && config.layer !== undefined) return config.layer;
        }

        return PRIORITY[state] || 0;
    };

    const sortedStates = [...activeStates].sort((a, b) => {
        return getPriority(a) - getPriority(b);
    });

    // 深拷贝还是浅拷贝？对于 G6 的样式属性，浅拷贝通常足够了
    let finalStyle = { ...defaultStyle };

    sortedStates.forEach(state => {
        //获取具体的样式
        // 优先从节点自身的 stateStyles 找
        // 如果找不到，去 DYNAMIC_STATE_STYLES 找
        let styleLayer = stateStyles ? stateStyles[state] : null;

        if (!styleLayer && DYNAMIC_STATE_STYLES.has(state)) {
            const config = DYNAMIC_STATE_STYLES.get(state);
            if (config && config.style) styleLayer = config.style;
        }

        if (!styleLayer) return;
        if (!styleLayer) return;
        //遍历样式具体的属性
        for (const key in styleLayer) {
            //具体上下文获取
            //具体方法
            const mode = BLEND_MODES[key];
            //默认属性获取
            const currentValue = finalStyle[key];
            //当前属性获取需要叠加的属性 
            const newValue = styleLayer[key];

            // 如果存在混合模式且有前一个值，则应用混合函数
            // 否则，默认为覆盖
            if (mode && currentValue !== undefined) {
                //叠加
                finalStyle[key] = mode(currentValue, newValue);
            } else {
                finalStyle[key] = newValue;
            }
        }
    });

    return finalStyle;
}
