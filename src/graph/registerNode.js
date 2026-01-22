import G6 from '@antv/g6';
import { resolveStyle } from './StyleResolver';

/**
 * 核心样式应用函数
 * @param {Object} model - 节点/边的数据模型
 * @param {Object} group - 图形分组 Group
 */
function applyVisuals(model, group) {
    if (!model || !group) return;

    // --- 1. 统一基准样式 (Global Base) ---
    // 这是所有节点的“出厂设置”，绝对干净，防止之前的样式残留
    const GLOBAL_DEFAULT_STYLE = {
        fill: '#C6E5FF',
        stroke: '#5B8FF9',
        lineWidth: 1,
        opacity: 1,
        shadowBlur: 0,
        shadowColor: undefined,
        cursor: 'pointer'
    };

    // 允许节点自定义颜色
    const userOverrides = {};
    if (model.style && model.style.fill) userOverrides.fill = model.style.fill;

    const defaultStyle = { ...GLOBAL_DEFAULT_STYLE, ...userOverrides };

    // --- 2. 恢复从 Model 获取状态 (Revert to Model Dependancy) ---
    // 为了保证动画生效，必须依赖 model.activeStates，
    // 因为 AnimationSequencer 是通过 updateItem 把状态推送到 model 里的。
    const activeStates = model.activeStates || [];

    // 状态样式定义
    const stateStyles = model.stateStyles || {};


    // --- 3. 找到 KeyShape ---
    let keyShape = null;
    const isValidKeyShape = (shape) => {
        if (!shape) return false;
        const type = shape.get('type');
        return type !== 'text' && type !== 'dom' && type !== 'gui';
    };

    // 策略 A: 精确按名称
    const namedKey = group.find(element => element.get('name') === 'key-shape');
    if (isValidKeyShape(namedKey)) keyShape = namedKey;
    else {
        const namedEdge = group.find(element => element.get('name') === 'edge-shape');
        if (isValidKeyShape(namedEdge)) keyShape = namedEdge;
    }

    // 策略 B: 泛化查找
    if (!keyShape) {
        const children = group.getChildren();
        if (children && children.length > 0) {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (isValidKeyShape(child)) {
                    keyShape = child;
                    break;
                }
            }
        }
    }

    if (!keyShape) return;


    // --- 4. 计算最终样式 (Stacking) ---
    const finalStyle = resolveStyle(defaultStyle, stateStyles, activeStates, model.statePriorities);

    // --- Debug Log for Node-0 ---
    if (model.id === '0' || model.id === 'node-0') { // 假设ID是1或node-1，您可以根据实际修改
        console.group(`[Render Debug] ${model.id}`);
        console.log('1. Base Style:', JSON.stringify(defaultStyle));
        console.log('2. Active States:', activeStates);
        console.log('3. Final Style (lineWidth):', finalStyle.lineWidth);
        console.log('4. Final Style (Full):', finalStyle);
        console.groupEnd();
    }

    // --- 5. 应用样式到 KeyShape ---
    keyShape.attr(finalStyle);


    // --- 6. Label 强制重置 (The Clean-up) ---
    // 【终极方案】使用透明色强制清除描边
    const labelShape = group.find(element => element.get('name') === 'center-label');
    if (labelShape) {
        const BASE_LABEL_STYLE = {
            fill: '#000',
            stroke: 'rgba(0,0,0,0)', // 终极必杀：用透明色代替 null
            lineWidth: 0,            // 必须强制归零

            // 【关键补充】防止阴影残留导致的“伪粗体”
            shadowBlur: 0,
            shadowColor: null,
            shadowOffsetX: 0,
            shadowOffsetY: 0,

            fontSize: 12,
            fontWeight: 'normal',
            opacity: 1,
            cursor: 'pointer'
        };

        const userLabelStyle = model.labelCfg ? model.labelCfg.style : {};
        const stateLabelStyle = (finalStyle.labelCfg && finalStyle.labelCfg.style) ? finalStyle.labelCfg.style : {};

        const finalLabelStyle = {
            ...BASE_LABEL_STYLE,
            ...userLabelStyle,
            ...stateLabelStyle
        };

        // --- Debug Log for Node-0 Label ---
        if (model.id === '0' || model.id === 'node-0') {
            // 打印全量属性，不进行筛选，彻底对比
            console.log(`[Label Debug Full] ${model.id} Final Style:`, JSON.parse(JSON.stringify(finalLabelStyle)));
        }

        labelShape.attr(finalLabelStyle);
    }
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
        // Hook: 更新完成后立即重算“状态样式”
        // 注意：位置更新(x,y) 已经由父类完成
        afterUpdate(cfg, item) {
            const group = item.getContainer();
            // 在 update 阶段，必须从 item.getModel() 拿全量数据，cfg 可能是增量
            const model = item.getModel();
            applyVisuals(model, group);
        },

        // 【关键修复】重写 update 方法，防止 fallback 到 single-node 时产生"幽灵 Label"
        update(cfg, item) {
            const group = item.getContainer();
            const model = item.getModel(); // 获取全量数据

            // 1. 更新样式 (这是核心)
            applyVisuals(model, group);

            // 2. 更新 Label 文字 (如果文字变了)
            if (cfg.label !== undefined) {
                const labelShape = group.find(element => element.get('name') === 'center-label');
                if (labelShape) {
                    labelShape.attr('text', cfg.label);
                }
            }

            return true; // 告诉 G6 我们已经处理完更新了
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
