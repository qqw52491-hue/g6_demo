import G6 from '@antv/g6';
import { resolveStyle } from './StyleResolver';

export function registerCustomNode() {
    G6.registerNode('priority-node', {
        // 自定义 draw: 绘制我们的圆形和标签
        draw(cfg, group) {
            // 基础圆形
            const r = cfg.size ? (Array.isArray(cfg.size) ? cfg.size[0] / 2 : cfg.size / 2) : 20;
            const style = { ...cfg.defaultStyle, ...cfg.style };

            const keyShape = group.addShape('circle', {
                attrs: {
                    x: 0,
                    y: 0,
                    r: r,
                    ...style
                },
                name: 'key-shape',
                draggable: true,
            });

            // 标签 (可选)
            if (cfg.label) {
                group.addShape('text', {
                    attrs: {
                        x: 0,
                        y: 0,
                        textAlign: 'center',
                        textBaseline: 'middle',
                        text: cfg.label,
                        // 默认黑色，后续通过 StateManager 覆盖
                        fill: (cfg.labelCfg && cfg.labelCfg.style && cfg.labelCfg.style.fill) || '#000',
                        fontSize: 12,
                    },
                    name: 'center-label',
                    draggable: true
                });
            }

            return keyShape;
        },

        // 关键修改：不再覆盖 update！
        // 使用 afterUpdate 在父类完成位置更新后，应用我们的样式状态。
        afterUpdate(cfg, item) {
            const group = item.getContainer();
            const keyShape = group.find(element => element.get('name') === 'key-shape');

            if (!keyShape) return;

            // 1. 解析样式
            const defaultStyle = cfg.defaultStyle || { fill: '#C6E5FF', stroke: '#5B8FF9', lineWidth: 1 };
            const stateStyles = cfg.stateStyles || {};
            const activeStates = cfg.activeStates || [];

            const finalStyle = resolveStyle(defaultStyle, stateStyles, activeStates);

            // 2. 应用样式
            // 在 Force 布局中，推荐使用 attr 而非 animate，以保持高性能和同步
            keyShape.attr(finalStyle);

            // 3. 更新 Label 样式
            const labelShape = group.find(element => element.get('name') === 'center-label');
            if (labelShape && finalStyle.labelCfg && finalStyle.labelCfg.style) {
                labelShape.attr(finalStyle.labelCfg.style);
            }
        }
    }, 'single-node'); // 继承 single-node，复用其交互和位置逻辑

    // --- 注册 Priority Edge ---
    G6.registerEdge('priority-edge', {
        // 关键修改：Edge 完全继承 'line' 的 draw 和 update
        // 我们只在 afterUpdate 里“染色”

        afterUpdate(cfg, item) {
            const group = item.getContainer();
            // line 类型的 keyShape 名字通常叫 'key-shape' (G6 约定)
            const keyShape = group.find(element => element.get('name') === 'key-shape');

            if (!keyShape) return;

            // 注意：此时 G6 父类已经帮我们把线连好了 (Path 计算完毕)
            // 我们只需要负责颜色、粗细等样式

            const defaultStyle = cfg.defaultStyle || { stroke: '#e2e2e2', lineWidth: 2 };
            const stateStyles = cfg.stateStyles || {};
            const activeStates = cfg.activeStates || [];

            const finalStyle = resolveStyle(defaultStyle, stateStyles, activeStates);

            // 立即应用样式
            keyShape.attr(finalStyle);
        }
    }, 'line'); // 继承 line，复用 Path 计算逻辑
}
