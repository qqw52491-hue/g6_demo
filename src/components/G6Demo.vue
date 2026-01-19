<template>
  <div class="page-wrapper">
    <!-- Header -->
    <header class="header">
      <h1>Antigravity Graph Engine</h1>
      <p>Business State Derivation Demo (业务状态派生演示)</p>
    </header>

    <div class="main-content">
      <!-- Controls Sidebar -->
      <aside class="sidebar glass-panel">
        <h2>Business Simulator (业务模拟)</h2>

        <!-- Scenario 1: Metric Monitoring -->
        <div class="control-section">
          <h3>Scenario 1: Metric Derived State</h3>
          <p class="desc">If CPU > 80%, Node enters <strong>CRITICAL</strong> state.</p>

          <div class="slider-group">
            <label>Node 1 CPU: {{ businessData.node1.cpu }}%</label>
            <input type="range" v-model.number="businessData.node1.cpu" min="0" max="100">
          </div>
          <div class="slider-group">
            <label>Node 2 CPU: {{ businessData.node2.cpu }}%</label>
            <input type="range" v-model.number="businessData.node2.cpu" min="0" max="100">
          </div>
        </div>

        <!-- Scenario 2: Topology Selection -->
        <div class="control-section">
          <h3>Scenario 2: Relation Derived State</h3>
          <p class="desc">Selecting a node automatically marks neighbors as <strong>RELATED</strong>.</p>
          <div class="button-group">
            <button :class="{ active: businessData.selectedId === 'node1' }" @click="selectNode('node1')">
              Select Node 1
            </button>
            <button :class="{ active: businessData.selectedId === 'node2' }" @click="selectNode('node2')">
              Select Node 2
            </button>
          </div>
          <div style="margin-top:8px;">
            <button @click="selectNode(null)">Clear Selection</button>
          </div>
        </div>

        <!-- Scenario 3: Global Mode -->
        <div class="control-section">
          <h3>Scenario 3: Global Override (With Inheritance)</h3>
          <p class="desc">Maintenance Mode applies to <strong>ALL</strong>, including new nodes.</p>
          <button :class="{ active: businessData.isMaintenance }"
            @click="businessData.isMaintenance = !businessData.isMaintenance">
            Toggle Maintenance
          </button>
          <div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
            <p class="desc">Add a new node to see it inherit global state:</p>
            <button @click="addNewNode">Add Random Node</button>
          </div>
        </div>

        <!-- Scenario 4: Path Animation -->
        <div class="control-section">
          <h3>Scenario 4: Complex Animation</h3>
          <p class="desc">Trace path from Node 1 to Node 2 (Simulated)</p>
          <button @click="playTrace">Play Path Trace</button>
          <div style="margin-top:8px;">
            <button @click="undoAnimation">Undo Last Animation</button>
          </div>
        </div>

        <div class="state-monitor">
          <h4>Active Derived States (实时派生状态)</h4>
          <div class="monitor-item">
            <strong>Node 1:</strong>
            <span class="state-list">
              {{ formatStates(derivedStates.node1) }}
            </span>
          </div>
          <div class="monitor-item">
            <strong>Node 2:</strong>
            <span class="state-list">
              {{ formatStates(derivedStates.node2) }}
            </span>
          </div>
        </div>
      </aside>

      <!-- Graph Area -->
      <div class="canvas-wrapper glass-panel">
        <div ref="mountNode" class="g6-mount"></div>
        <div class="overlay-hint">
          <strong>Visual Rules (视觉规则):</strong><br>
          Critical (90) > Disabled (80) > Selected (40) > Related (30)<br>
          <span style="color:#ef4444">Critical: Red</span> |
          <span style="color:#888">Disabled: Fade</span> |
          <span style="color:#00D1FF">Selected: Cyan</span> |
          <span style="color:#A855F7">Related: Purple Border</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, watch } from 'vue';
import G6 from '@antv/g6';
import { StateManager } from '../graph/StateManager';
import { registerCustomNode } from '../graph/registerNode';
import { AnimationSequencer } from '../graph/AnimationSequencer';
import { GLOBAL_STATE_STYLES } from '../graph/constants'; // Import global theme

// --- Data & State ---
const mountNode = ref(null);
//创建对象
const stateManager = new StateManager();
let graph = null;
let sequencer = null; // Store sequencer instance

// The "Single Source of Truth" for Business Data
// 所有的业务数据都在这里，我们不直接操作 G6 的样式
const businessData = reactive({
  node1: { cpu: 20 },
  node2: { cpu: 20 },
  startNode: null, // For pathfinding
  endNode: null,
  activePathReasonId: null // To track the current animation for undoing
});

// For viewing in the UI only
const derivedStates = reactive({});

const formatStates = (states) => states && states.length ? states.join(', ') : 'Default';

// --- Business Logic Integration (The Brain) ---

// --- Graph Data Generation ---
const generateRandomGraph = (count = 20) => {
  const nodes = [];
  const edges = [];
  const width = mountNode.value.clientWidth;
  const height = mountNode.value.clientHeight;

  for (let i = 0; i < count; i++) {
    const id = `node${i}`;
    nodes.push({
      id,
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 100) + 50,
      label: `N${i}`,
      defaultStyle: { fill: '#232323', stroke: '#444', lineWidth: 2, opacity: 1 },
      stateStyles: GLOBAL_STATE_STYLES,
      activeStates: []
    });
  }

  // Randomly connect
  nodes.forEach((node, i) => {
    if (i === nodes.length - 1) return;
    // Connect to next 1-2 nodes
    const targets = [nodes[i + 1]];
    if (Math.random() > 0.5 && i + 2 < nodes.length) targets.push(nodes[i + 2]);
    if (Math.random() > 0.8 && i + 5 < nodes.length) targets.push(nodes[i + 5]); // Long jump

    targets.forEach(target => {
      const edgeId = `edge-${node.id}-${target.id}`;
      edges.push({
        id: edgeId,
        source: node.id,
        target: target.id,
        type: 'priority-edge',
        style: { stroke: '#444', lineWidth: 2 },
        stateStyles: GLOBAL_STATE_STYLES
      });
    });
  });

  return { nodes, edges };
};

// --- Initial Data ---
const initialData = { nodes: [], edges: [] }; // start empty, fill in mounted

// Removed commonStateStyles as it is replaced by GLOBAL_STATE_STYLES from constants.js

const handleNodeClick = (id) => {
  // Left Click: Toggle Source
  if (businessData.startNode === id) {
    businessData.startNode = null;
  } else {
    businessData.startNode = id;
  }
  checkPath();
};

const handleNodeContextMenu = (id, evt) => {
  evt.preventDefault(); // Block browser menu
  // Right Click: Toggle Target
  if (businessData.endNode === id) {
    businessData.endNode = null;
  } else {
    businessData.endNode = id;
  }
  checkPath();
};

const findPath = (sourceId, targetId) => {
  // Simple BFS for demo
  const queue = [[sourceId]];
  const visited = new Set([sourceId]);
  const edgesMap = {}; // Map target -> edgeId used to reach it

  // Build adjacency list for lookup
  const adj = {};
  const edgeLookup = {}; // key: "source-target" -> edgeId
  graph.getEdges().forEach(edge => {
    const s = edge.getSource().getID();
    const t = edge.getTarget().getID();
    if (!adj[s]) adj[s] = [];
    if (!adj[t]) adj[t] = []; // Undirected for visual simplicity? Or directed? Let's assume Directed in G6 but BFS undirected for find
    adj[s].push(t);
    // adj[t].push(s); // Uncomment for undirected
    edgeLookup[`${s}-${t}`] = edge.getID();
  });

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === targetId) return path;

    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const newPath = [...path, neighbor];
        queue.push(newPath);
      }
    }
  }
  return null;
};

const checkPath = async () => {
  // Undo previous if exists
  if (businessData.activePathReasonId) {
    sequencer.undoLast(); // Or keep multiple paths? Let's keep one for clarity
    businessData.activePathReasonId = null;
  }

  if (businessData.startNode && businessData.endNode) {
    const pathNodes = findPath(businessData.startNode, businessData.endNode);
    if (pathNodes) {
      console.log("Path found:", pathNodes);
      // Find edges between path nodes
      const pathEdges = [];
      for (let i = 0; i < pathNodes.length - 1; i++) {
        // G6 findEdge is handy
        const edge = graph.findEdge(pathNodes[i], pathNodes[i + 1]);
        if (edge) pathEdges.push(edge.getID());
      }

      await sequencer.playPathTrace(pathNodes, pathEdges);
      // We need to know the reasonId generated by sequencer if we want to track it precisely
      // For now sequencer.undoLast() is enough since it pops the stack.
    } else {
      console.log("No path found");
    }
  }
};

const syncNodeState = (nodeId) => {
  const states = stateManager.getActiveStates(nodeId);
  derivedStates[nodeId] = states; // Update Vue UI

  if (graph) {
    const item = graph.findById(nodeId);
    if (item) {
      graph.updateItem(item, {
        activeStates: states
      });
    }
  }
}

// "Auto-Derivation" Engine (自动派生引擎)
// Watch business data changes -> Calculate Reasons -> Update StateManager
watch(businessData, (newData) => {
  // 1. Derive CPU States (Rule: CPU > 80 is Critical)
  const allIds = graph ? graph.getNodes().map(n => n.getID()) : [];

  // Just simulation for the first 2 nodes for sliders
  ['node0', 'node1'].forEach(nodeId => {
    // ... same cpu logic
  });

  // 2. Selection states (mapped to Start/End)
  allIds.forEach(id => {
    stateManager.removeReason(id, 'highlight_source', 'user_selection');
    stateManager.removeReason(id, 'highlight_target', 'user_selection');
  });

  if (newData.startNode) stateManager.addReason(newData.startNode, 'highlight_source', 'user_selection');
  if (newData.endNode) stateManager.addReason(newData.endNode, 'highlight_target', 'user_selection');

  // 3. Derive Global Maintenance State (Using NEW Global API)
  if (newData.isMaintenance) {
    stateManager.addGlobalReason('disabled', 'global_maintenance');
  } else {
    stateManager.removeGlobalReason('disabled', 'global_maintenance');
  }

  // --- Sync to UI & G6 ---
  // Note: We sync ALL nodes here. 
  // Optimization: StateManager could return "dirty nodes" but for <5000 nodes, loop is fine.
  allNodes.forEach(syncNodeState);

}, { deep: true, flush: 'post' });


// --- Initialization ---

onMounted(() => {
  registerCustomNode();

  const width = mountNode.value.clientWidth;
  const height = mountNode.value.clientHeight;

  graph = new G6.Graph({
    container: mountNode.value,
    width,
    height,
    modes: { default: ['drag-node', 'drag-canvas'] },
    defaultNode: { type: 'priority-node', size: 60 },
  });

  // Removed commonStateStyles locally as it is moved up

  const data = generateRandomGraph(20);

  graph.data(data);
  graph.render();

  sequencer = new AnimationSequencer(graph, stateManager); // Init sequencer

  // Click listener
  graph.on('node:click', (evt) => {
    const { item } = evt;
    handleNodeClick(item.getModel().id);
  });

  graph.on('node:contextmenu', (evt) => {
    const { item } = evt;
    handleNodeContextMenu(item.getModel().id, evt);
  });

  window.addEventListener('resize', () => {
    if (!graph || graph.get('destroyed')) return;
    if (!mountNode.value) return;
    graph.changeSize(mountNode.value.clientWidth, mountNode.value.clientHeight);
  });

  // Trigger initial derivation
  // (In Vue 3 watch immediate could also work, but simple assignment triggers it too)
});

// --- Animation Actions ---
const playTrace = async () => {
  // Mock a path: Node 1 -> [Edge 1] -> Node 2
  const nodes = ['node1', 'node2'];
  const edges = ['edge1'];
  await sequencer.playPathTrace(nodes, edges);
};

const undoAnimation = () => {
  sequencer.undoLast();
};

const addNewNode = () => {
  if (!graph) return;
  const width = mountNode.value.clientWidth;
  const height = mountNode.value.clientHeight;

  const id = `new-node-${Date.now()}`;
  const model = {
    id,
    x: Math.random() * (width - 100) + 50,
    y: Math.random() * (height - 100) + 50,
    label: `New`,
    defaultStyle: { fill: '#232323', stroke: '#444', lineWidth: 2, opacity: 1 },
    stateStyles: GLOBAL_STATE_STYLES,
    activeStates: []
  };

  graph.addItem('node', model);

  // Critical: Immediately sync state to inherit global reasons (like 'disabled')
  // This proves that new nodes are "born" with the correct global state.
  syncNodeState(id);
  console.log(`Added node ${id}, synced state.`);
};

</script>

<style scoped>
/* Reset & Base */
:root {
  font-family: 'Inter', sans-serif;
  background-color: #000;
  color: #fff;
}

.page-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: radial-gradient(circle at top right, #1a1a2e, #000000);
  padding: 24px;
  box-sizing: border-box;
}

.header {
  margin-bottom: 24px;
}

.header h1 {
  margin: 0;
  font-weight: 800;
  background: linear-gradient(90deg, #fff, #888);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  margin: 4px 0 0;
  color: #666;
  font-size: 0.9rem;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 24px;
  overflow: hidden;
}

/* Glass Panel */
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

/* Sidebar */
.sidebar {
  width: 340px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.sidebar h2 {
  font-size: 1.1rem;
  margin-top: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.control-section {
  background: rgba(0, 0, 0, 0.2);
  padding: 16px;
  border-radius: 8px;
}

.control-section h3 {
  font-size: 0.85rem;
  color: #aaa;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.desc {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.4;
}

.slider-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.slider-group label {
  font-size: 0.8rem;
  color: #ccc;
  margin-bottom: 4px;
}

input[type=range] {
  width: 100%;
  accent-color: #3B82F6;
}

.button-group {
  display: flex;
  gap: 8px;
}

button {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
}

button:hover {
  background: rgba(255, 255, 255, 0.1);
}

button.active {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
}

/* Monitor */
.state-monitor {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.monitor-item {
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}

.state-list {
  color: #fff;
  font-family: monospace;
}

/* Canvas */
.canvas-wrapper {
  flex: 1;
  position: relative;
  background: radial-gradient(circle at center, #111, #000);
}

.g6-mount {
  width: 100%;
  height: 100%;
}

.overlay-hint {
  position: absolute;
  bottom: 16px;
  right: 16px;
  color: #555;
  font-size: 0.8rem;
  pointer-events: none;
  text-align: right;
  line-height: 1.5;
}
</style>
