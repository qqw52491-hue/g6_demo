import G6 from '@antv/g6';
import { resolveStyle } from './StyleResolver';

export function registerCustomNode() {
    G6.registerNode('priority-node', {
        // 我们继承内置的 'circle' 节点以保持简单
        // 但我们通过 'update' 方法重写了对状态变化的响应逻辑

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
                        fill: '#000',
                        fontSize: 12,
                    },
                    name: 'center-label',
                    draggable: true
                });
            }

            return keyShape;
        },

        update(cfg, item) {
            const group = item.getContainer();
            const keyShape = group.find(element => element.get('name') === 'key-shape');

            // 1. 解析样式
            // 我们期望 'activeStates' 和 'stateStyles' 存在于节点数据 (cfg) 中
            const defaultStyle = cfg.defaultStyle || { fill: '#C6E5FF', stroke: '#5B8FF9', lineWidth: 1 };
            const stateStyles = cfg.stateStyles || {};
            const activeStates = cfg.activeStates || []; // 例如 ['hover', 'selected', 'dimmed']

            // 使用我们自定义的解析逻辑
            const finalStyle = resolveStyle(defaultStyle, stateStyles, activeStates);

            // 2. 应用样式
            // 我们对过渡进行动画处理以获得更好的用户体验
            keyShape.animate(finalStyle, {
                duration: 300,
                easing: 'easeCubic',
            });

            // 如果需要，更新标签 (为了简洁省略)
        }
    }, 'single-node'); // 继承 single-node 以确保其他行为按需工作

    // --- 新增：注册 Priority Edge ---
    G6.registerEdge('priority-edge', {
        // 关键修复：完全删除 draw 方法！
        // 让 G6 内置的 'line' 帮我们处理 path 计算、位置更新、Ref 机制。
        // 我们只负责 "update" 里的样式计算。

        update(cfg, item) {
            const group = item.getContainer();
            // "line" 类型的 keyShape 名字通常叫 'key-shape' (G6 约定)
            const keyShape = group.find(element => element.get('name') === 'key-shape');

            if (!keyShape) return; // 防御代码

            const defaultStyle = cfg.defaultStyle || { stroke: '#333', lineWidth: 2 };
            const stateStyles = cfg.stateStyles || {};
            const activeStates = cfg.activeStates || [];

            const finalStyle = resolveStyle(defaultStyle, stateStyles, activeStates);

            // 边通常只涉及 stroke, lineWidth, opacity, shadow...
            keyShape.animate(finalStyle, {
                duration: 300,
                easing: 'easeCubic',
            });
        }
    }, 'line'); // 继承 line
}
