<script setup>
import { onMounted, ref } from 'vue';
import G6 from '@antv/g6';
import { registerCustomNode } from '../graph/registerNode';
import { StateManager } from '../graph/StateManager';
import { AnimationSequencer } from '../graph/AnimationSequencer';
import { GLOBAL_STATE_STYLES } from '../graph/constants'; // <--- 关键引入

defineProps({
  msg: String,
})

const graphContainer = ref(null);
const graphInstance = ref(null);
const stateManager = ref(null);
const sequencer = ref(null);

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
});

// --- Actions ---

const demoSpotlight = () => {
    // 演示：聚光灯模式 (Spotlight)
    // 场景：全局变暗，只有 Node-1 和 Node-4 亮起
    
    // A. 清理之前可能存在的状态 (可选，看交互需求)
    stateManager.value.clearAll();

    const reason = 'demo_spotlight';

    // B. 全局压暗 (Dimmed - Opacity 0.2)
    stateManager.value.addGlobalReason('dimmed', reason);

    // C. 主角高亮 (Highlight - Opacity 1.0)
    // 根据我们的智能混合算法，1.0 会无视 0.2，强制亮起
    ['node-1', 'node-4', 'edge-0-4'].forEach(id => {
        stateManager.value.addReason(id, 'highlight', reason);
    });

    // D. 刷新所有节点和边
    refreshAll();
};

const demoPathTrace = async () => {
    // 演示：路径流光动画
    stateManager.value.clearAll();
    refreshAll();

    const pathNodes = ['node-0', 'node-4', 'node-5'];
    const pathEdges = ['edge-0-4', 'edge-4-5'];

    await sequencer.value.playPathTrace(pathNodes, pathEdges);
};

const demoError = () => {
    // 演示：层级覆盖 (Error > Selected)
    const reason = 'demo_error';
    
    // 先选中 Node-2
    stateManager.value.addReason('node-2', 'selected', reason);
    
    // 0.5秒后，系统报错 (Should turn Red)
    setTimeout(() => {
        stateManager.value.addReason('node-2', 'critical', reason);
        refreshAll();
    }, 500);
    
    refreshAll();
};

// --- 同级叠加实验 ---
// 针对 node-0 进行 R/G/B 的开关操作
const toggleState = (color, isActive) => {
    console.log(`[Vue] Toggle ${color}: ${isActive}`);

    if (!stateManager.value) {
        console.error('[Vue] StateManager not initialized!');
        return;
    }

    const reason = 'manual_stack_test';
    const stateName = `test_${color}`; // test_red, test_green, test_blue
    
    if (isActive) {
        stateManager.value.addReason('node-0', stateName, reason);
    } else {
        stateManager.value.removeReason('node-0', stateName, reason);
    }
    
    // Check if reason was added
    const active = stateManager.value.getActiveStates('node-0');
    console.log('[Vue] Node-0 Active States:', active);

    refreshAll();
};

const reset = () => {
    console.log('[Vue] Reset');
    stateManager.value.clearAll();
    refreshAll();
};

const refreshAll = () => {
    console.log('[Vue] Refreshing Graph...');
    if (!graphInstance.value) return;

    const ids = [
        ...graphInstance.value.getNodes().map(n => n.getID()),
        ...graphInstance.value.getEdges().map(e => e.getID())
    ];
    sequencer.value.refreshGraph(ids);
};

</script>

<template>
  <div class="g6-container">
    <div class="toolbar">
        <button @click="reset">重置 (Reset)</button>
        <button @click="demoSpotlight">🔦 聚光灯 (Spotlight)</button>
        <button @click="demoPathTrace">🌊 路径流光 (Trace)</button>
        <button @click="demoError">🚨 错误覆盖 (Error)</button>
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
.stack-test-panel h4 { margin-top: 0; }
.color-controls { display: flex; gap: 20px; }
.control-group { display: flex; gap: 5px; align-items: center; }
.hint { font-size: 12px; color: #666; margin-bottom: 0; }

.toolbar {
    margin-bottom: 20px;
    display: flex;
    gap: 10px;
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
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border-radius: 8px;
    overflow: hidden;
}
</style>
