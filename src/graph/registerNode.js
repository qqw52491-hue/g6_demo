import G6 from '@antv/g6';
import { resolveStyle } from './StyleResolver';

/**
 * 核心样式应用函数
 * @param {Object} model - 节点/边的数据模型 (全量数据)
 * @param {Object} group - 图形分组 Group
 */
function applyVisuals(model, group) {
    if (!model || !group) return;

    // 1. 找到关键图形 (KeyShape)
    let keyShape = group.find(element => element.get('name') === 'key-shape');

    // 【关键修复】如果是继承的 Edge，可能没有显式命名的 key-shape
    // G6 内置 Edge 的主图形通常叫 'edge-shape'，或者我们直接取第一个子图形作为回退
    if (!keyShape) {
        keyShape = group.find(element => element.get('name') === 'edge-shape');
    }
    // 最后的保底：取第一个 child (通常这就够了)
    if (!keyShape && group.getCount() > 0) {
        keyShape = group.getChildByIndex(0);
    }

    if (!keyShape) {
        // console.warn('registerNode: key-shape not found for', model.id);
        return;
    }

    // 2. 提取样式配置
    // 【关键修复】必须包含所有可能产生副作用的属性默认值 (Reset Base)
    // 否则当状态移除后，opacity/shadow 等属性会残留
    const BASE_STYLE = {
        fill: '#C6E5FF',
        stroke: '#5B8FF9',
        lineWidth: 1,
        opacity: 1,           // 必须显式重置
        shadowBlur: 0,        // 必须显式重置
        shadowColor: undefined // 清空阴影色
    };

    // 如果 model 里没有 savedDefaultStyle，就合并一个
    const userDefault = model.defaultStyle || {};
    //结合之前得合成真正得自定义样式
    const defaultStyle = { ...BASE_STYLE, ...userDefault };

    //这个是状态样式
    const stateStyles = model.stateStyles || {};
    //这个是活跃得样式字符串数组其实是
    const activeStates = model.activeStates || [];

    // 3. 计算最终样式
    // resolveStyle 会处理优先级、混合模式等复杂逻辑
    const finalStyle = resolveStyle(defaultStyle, stateStyles, activeStates, model.statePriorities);

    // 4. 立即生效 (Attributes Update)
    // 使用 attr 而非 animate，以确保高性能和位置同步
    keyShape.attr(finalStyle);

    // 5. 特殊处理：如果有 Label，也要同步更新样式 (可选)
    const labelShape = group.find(element => element.get('name') === 'center-label');
    if (labelShape && finalStyle.labelCfg && finalStyle.labelCfg.style) {
        labelShape.attr(finalStyle.labelCfg.style);
    }

    // Debug Log: Uncomment to verify updates
    // if (activeStates.length > 0) {
    //    console.log(`[Update] ${model.id} states:`, activeStates, 'style:', finalStyle);
    // }
}

export function registerCustomNode() {
    // --- 1. 注册 Priority Node ---
    G6.registerNode('priority-node', {
        // 自定义 draw: 负责创建图形结构 (几何)
        draw(cfg, group) {
            const r = cfg.size ? (Array.isArray(cfg.size) ? cfg.size[0] / 2 : cfg.size / 2) : 20;
            // 初始样式，虽然会被 applyVisuals 覆盖，但设一个初始值是好习惯
            const style = { ...cfg.defaultStyle, ...cfg.style };

            const keyShape = group.addShape('circle', {
                attrs: {
                    x: 0,
                    y: 0,
                    r: r,
                    ...style // 基础几何样式
                },
                name: 'key-shape',
                draggable: true,
            });

            if (cfg.label) {
                group.addShape('text', {
                    attrs: {
                        x: 0,
                        y: 0,
                        textAlign: 'center',
                        textBaseline: 'middle',
                        text: cfg.label,
                        fill: '#000',
                        fontSize: 12,
                    },
                    name: 'center-label',
                    draggable: true
                });
            }

            return keyShape;
        },

        // Hook: 绘制完成后立即应用“状态样式”
        afterDraw(cfg, group) {
            // 在 draw 阶段，cfg 就是全量数据
            applyVisuals(cfg, group);
        },

        // Hook: 更新完成后立即重算“状态样式”
        // 注意：位置更新(x,y) 已经由父类完成
        afterUpdate(cfg, item) {
            const group = item.getContainer();
            // 在 update 阶段，必须从 item.getModel() 拿全量数据，cfg 可能是增量
            const model = item.getModel();
            applyVisuals(model, group);
        }
    }, 'single-node'); // 继承 single-node

    // --- 2. 注册 Priority Edge ---
    G6.registerEdge('priority-edge', {
        // 这里的策略是：完全不写 draw 和 update
        // 全部交给父类 'line' 去处理 Path 计算和连线逻辑

        // Hook: 绘制完成后
        afterDraw(cfg, group) {
            // 给 Edge 一个也是可以看见的默认色，防止初始化在黑底上隐身
            if (!cfg.defaultStyle) cfg.defaultStyle = { stroke: '#999', lineWidth: 2 };
            applyVisuals(cfg, group);
        },

        // Hook: 更新完成后
        afterUpdate(cfg, item) {
            const model = item.getModel();
            if (!model.defaultStyle) model.defaultStyle = { stroke: '#999', lineWidth: 2 };

            const group = item.getContainer();
            applyVisuals(model, group);
        }
    }, 'line'); // 继承 line
}
