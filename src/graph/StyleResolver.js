import { PRIORITY, BLEND_MODES } from './constants';

/**
 * 根据激活的状态和优先级配置，计算节点的最终样式。
 * 
 * @param {Object} defaultStyle - 节点的默认样式。
 * @param {Object} stateStyles - 状态名到样式对象的映射。
 * @param {string[]} activeStates - 当前激活的状态名列表。
 * @returns {Object} 计算后的最终样式对象。
 */
export function resolveStyle(defaultStyle, stateStyles, activeStates) {
    // 按优先级排序状态：低 -> 高
    // 这确保高优先级的样式会覆盖低优先级的样式（除非定义了混合模式）
    const sortedStates = [...activeStates].sort((a, b) => {
        return (PRIORITY[a] || 0) - (PRIORITY[b] || 0);
    });

    // 深拷贝还是浅拷贝？对于 G6 的样式属性，浅拷贝通常足够了
    let finalStyle = { ...defaultStyle };

    sortedStates.forEach(state => {
        const styleLayer = stateStyles[state];
        if (!styleLayer) return;

        for (const key in styleLayer) {
            const mode = BLEND_MODES[key];
            const currentValue = finalStyle[key];
            const newValue = styleLayer[key];

            // 如果存在混合模式且有前一个值，则应用混合函数
            // 否则，默认为覆盖
            if (mode && currentValue !== undefined) {
                finalStyle[key] = mode(currentValue, newValue);
            } else {
                finalStyle[key] = newValue;
            }
        }
    });

    return finalStyle;
}
