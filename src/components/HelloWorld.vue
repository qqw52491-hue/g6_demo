<script setup>
import { onMounted, ref, shallowRef } from 'vue';
import G6 from '@antv/g6';
import { registerCustomNode } from '../graph/registerNode';
import { StateManager } from '../graph/StateManager';
import { AnimationSequencer } from '../graph/AnimationSequencer';
import { GLOBAL_STATE_STYLES } from '../graph/constants'; // <--- 关键引入

defineProps({
    msg: String,
})

const graphContainer = ref(null);
// 优化：使用 shallowRef 来存储非响应式的复杂对象
// 避免 Vue 深度代理 G6 实例，提升性能且防止潜在 Bug
const graphInstance = shallowRef(null);
const stateManager = shallowRef(null);
const sequencer = shallowRef(null);

// 模拟数据
const MOCK_DATA = {
    nodes: Array.from({ length: 8 }).map((_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`,
        x: 100 + (i % 3) * 150,
        y: 100 + Math.floor(i / 3) * 150,
    })),
    edges: [
        { source: 'node-0', target: 'node-1', id: 'edge-0-1' },
        { source: 'node-1', target: 'node-2', id: 'edge-1-2' },
        { source: 'node-2', target: 'node-3', id: 'edge-2-3' },
        { source: 'node-0', target: 'node-4', id: 'edge-0-4' },
        { source: 'node-4', target: 'node-5', id: 'edge-4-5' },
    ]
};

onMounted(() => {
    if (!graphContainer.value) return;

    // 1. 注册我们自定义的 Priority Node/Edge
    registerCustomNode();

    // 2. 初始化图实例
    const graph = new G6.Graph({
        container: graphContainer.value,
        width: 800,
        height: 500,
        modes: {
            default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
        },
        defaultNode: {
            type: 'priority-node',
            size: 50,
            stateStyles: GLOBAL_STATE_STYLES, // <--- 关键：注入系统样式表！
        },
        defaultEdge: {
            type: 'priority-edge',
            stateStyles: GLOBAL_STATE_STYLES, // <--- 关键：Edge 也要注入
            style: {
                stroke: '#e2e2e2',
                lineWidth: 2,
            }
        },
        layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 150,
        }
    });

    graph.data(MOCK_DATA);
    graph.render();

    graphInstance.value = graph;

    // 3. 初始化状态管理系统
    stateManager.value = new StateManager();
    sequencer.value = new AnimationSequencer(graph, stateManager.value);
    // 3. 演示：提前预设业务状态 (Pre-set Business States)
    // 模拟：在应用初始化时加载了一套“皮肤配置”
    stateManager.value.registerState('boss_mode', {
        layer: 99,
        style: {
            fill: 'url(#gradient-gold)', // 甚至支持渐变（需要 G6 定义 defs，这里先用纯色替代）
            fill: '#F59E0B',
            stroke: '#78350F',
            lineWidth: 8,
            shadowColor: '#F59E0B',
            shadowBlur: 30,
            opacity: 1,
            labelCfg: { style: { fill: '#78350F', fontSize: 14, fontWeight: '800' } }
        }
    });
});

// --- Actions ---

const demoBoss = () => {
    // 演示：使用预设的 'boss_mode'
    // 此时不需要再传样式配置，直接用名字即可！
    const isBoss = stateManager.value.getActiveStates('node-3').includes('boss_mode');

    // 只需一行代码，样式自动应用
    if (!isBoss) {
        stateManager.value.addReason('node-3', 'boss_mode', 'user_promote');
    } else {
        stateManager.value.removeReason('node-3', 'boss_mode', 'user_promote');
    }
    refreshAll();
};

const demoSpotlight = () => {
    // A. 清理之前可能存在的状态 (可选，看交互需求)
    // stateManager.value.clearAll();

    //设置样式原因
    const reason = 'demo_spotlight';

    // B. 全局压暗 (Dimmed - Opacity 0.2)
    stateManager.value.addGlobalReason('dimmed', reason);

    // C. 主角高亮 (Highlight - Opacity 1.0)
    // 根据我们的智能混合算法，1.0 会无视 0.2，强制亮起
    ['node-1', 'node-4'].forEach(id => {
        stateManager.value.addReason(id, 'highlight', reason);
    });

    refreshAll();
};

const cancelSpotlight = () => {
    const reason = 'demo_spotlight';

    // 1. 移除全局压暗
    stateManager.value.removeGlobalReason('dimmed', reason);

    // 2. 移除节点高亮
    ['node-1', 'node-4'].forEach(id => {
        stateManager.value.removeReason(id, 'highlight', reason);
    });

    refreshAll();
    console.log('[Vue] Canceling Spotlight... and refresh');
};

const demoPathTrace = async () => {
    // 演示：路径流光动画
    // stateManager.value.clearAll();
    refreshAll();

    const pathNodes = ['node-0', 'node-4', 'node-5'];
    const pathEdges = ['edge-0-4', 'edge-4-5'];

    await sequencer.value.playPathTrace(pathNodes, pathEdges);
};

const cancelTrace = () => {
    // 撤销上一次的动画操作
    if (sequencer.value) {
        sequencer.value.undoLast();
    }
};

const demoError = () => {
    // 演示：层级覆盖 (Error > Selected)
    // 演示：业务层定义“错误状态”，不再依赖 constants.js
    // 这样 constants.js 只需定义 LAYERS 常量即可
    stateManager.value.addReason('node-4', 'critical', 'demo_error', {
        layer: 90, // 或使用 LAYERS.TOP_MOST - 10
        style: {
            fill: '#EF4444',
            stroke: '#7F1D1D',
            shadowColor: '#EF4444',
            shadowBlur: 15,
            labelCfg: { style: { fill: '#fff', fontWeight: 'bold' } }
        }
    });
    refreshAll();
};

// --- 同级叠加实验 ---
// 针对 node-0 进行 R/G/B 的开关操作
const toggleState = (color, isActive, customConfig = null) => {
    console.log(`[Vue] Toggle ${color}: ${isActive}`);

    if (!stateManager.value) {
        console.error('[Vue] StateManager not initialized!');
        return;
    }

    const reason = 'manual_stack_test';
    const stateName = `test_${color}`;

    if (isActive) {
        // 支持传入动态配置 (layer, style)
        stateManager.value.addReason('node-0', stateName, reason, customConfig);
    } else {
        stateManager.value.removeReason('node-0', stateName, reason);
    }

    // Check if reason was added
    const active = stateManager.value.getActiveStates('node-0');
    console.log('[Vue] Node-0 Active States:', active);

    refreshAll();
};

const demoCustom = () => {
    // 演示：完全不需要在 constants.js 定义
    // 直接在这里定义样式和优先级！
    const isPurple = stateManager.value.getActiveStates('node-0').includes('test_custom_purple');

    toggleState('custom_purple', !isPurple, {
        layer: 100, // 优先级极高，甚至盖过 Error (90)
        style: {
            fill: '#8B5CF6', // 紫色
            stroke: '#FBBF24', // 金边 
            lineWidth: 5,
            opacity: 1, // 同样穿透聚光灯
            shadowBlur: 20,
            shadowColor: '#8B5CF6'
        }
    });
};

const reset = () => {
    console.log('[Vue] Reset');
    stateManager.value.clearAll();
    refreshAll();
};

const refreshAll = () => {
    console.log('[Vue] Refreshing Graph...');
    if (!graphInstance.value || !sequencer.value) return;

    // 暴力刷新：获取画布上所有的 节点 和 边
    // 确保任何角落的状态变更都能被渲染
    const allItems = [
        ...graphInstance.value.getNodes().map(n => n.getID()),
        ...graphInstance.value.getEdges().map(e => e.getID())
    ];

    console.log(allItems);
    console.log(allItems);
    sequencer.value.refreshGraph(allItems);
};

const addNewNode = () => {
    if (!graphInstance.value) return;

    const id = `new-node-${Date.now()}`;
    const model = {
        id,
        label: 'New',
        x: Math.random() * 800,
        y: Math.random() * 500,
        stateStyles: GLOBAL_STATE_STYLES, // Important!
    };

    graphInstance.value.addItem('node', model);

    // Check if we have global reasons (like dimmed) active
    // If so, we must sync this new node immediately
    // sequencer.refreshGraph is smart enough to check global states
    sequencer.value.refreshGraph([id]);

    console.log(`[Vue] Added ${id}`);
};

</script>

<template>
    <div class="g6-container">
        <div class="toolbar">
            <button @click="reset">重置 (Reset)</button>
            <button @click="demoSpotlight">🔦 聚光灯 (Spotlight)</button>
            <button @click="cancelSpotlight">🚫 关灯 (Off)</button>
            <div class="divider"></div>
            <button @click="demoPathTrace">🌊 路径流光 (Trace)</button>
            <button @click="cancelTrace">↩️ 清除轨迹 (Undo)</button>
            <div class="divider"></div>
            <button @click="demoError">🚨 错误覆盖 (Error)</button>
            <div class="divider"></div>
            <button @click="addNewNode">➕ 新增节点 (Test Global)</button>
        </div>

        <!-- 新增：同级叠加测试区 -->
        <div class="stack-test-panel">
            <h4>🎨 同级叠加测试 (Layer: 50) - 操作对象: Node 0</h4>
            <div class="color-controls">
                <div class="control-group">
                    <span style="color:red">RED:</span>
                    <button @click="toggleState('red', true)">+ 加红</button>
                    <button @click="toggleState('red', false)">- 删红</button>
                </div>
                <div class="control-group">
                    <span style="color:green">GREEN:</span>
                    <button @click="toggleState('green', true)">+ 加绿</button>
                    <button @click="toggleState('green', false)">- 删绿</button>
                </div>
                <div class="control-group">
                    <span style="color:blue">BLUE:</span>
                    <button @click="toggleState('blue', true)">+ 加蓝</button>
                    <button @click="toggleState('blue', false)">- 删蓝</button>
                </div>
                <div class="control-group" style="padding-left: 20px; border-left: 1px solid #ddd;">
                    <span style="color:#8B5CF6; font-weight:bold;">CUSTOM:</span>
                    <button @click="demoCustom">🔮 动态定义 (Layer 100)</button>
                </div>
                <div class="control-group" style="padding-left: 20px; border-left: 1px solid #ddd;">
                    <span style="color:#F59E0B; font-weight:bold;">BOSS:</span>
                    <button @click="demoBoss">👑 预设模式 (node-3)</button>
                </div>
            </div>
            <p class="hint">规则：同级状态下，JS对象遍历顺序通常遵循添加顺序。后加的属性会覆盖前面的。</p>
        </div>

        <div ref="graphContainer" class="canvas-wrapper"></div>
    </div>
</template>

<style scoped>
.g6-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stack-test-panel {
    border: 1px dashed #666;
    padding: 10px;
    margin-bottom: 20px;
    border-radius: 6px;
    background: #f9f9f9;
    color: #333;
}

.stack-test-panel h4 {
    margin-top: 0;
}

.color-controls {
    display: flex;
    gap: 20px;
}

.control-group {
    display: flex;
    gap: 5px;
    align-items: center;
}

.hint {
    font-size: 12px;
    color: #666;
    margin-bottom: 0;
}

.toolbar {
    margin-bottom: 20px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    /*防止按钮过多换行*/
}

.divider {
    width: 1px;
    background-color: #ccc;
    margin: 0 5px;
}

button {
    padding: 8px 16px;
    background: #f0f0f0;
    border: 1px solid #ccc;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
}

button:hover {
    background: #e0e0e0;
    transform: translateY(-1px);
}

.canvas-wrapper {
    width: 800px;
    height: 500px;
    border: 1px solid #eee;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    overflow: hidden;
}
</style>
