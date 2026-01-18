export class StateManager {
    constructor() {
        // 数据结构: nodeId -> { stateName -> Set<reasonId> }
        this.nodeStateMap = new Map();
        // 全局理由: stateName -> Set<reasonId>
        // 这些状态会自动应用到所有节点上
        this.globalReasons = new Map();
    }

    /**
   * 为节点的一个特定状态添加“理由”。
   * 只要该状态至少有一个理由，它就被认为是激活的。
   */
    addReason(nodeId, state, reason) {
        if (!this.nodeStateMap.has(nodeId)) {
            this.nodeStateMap.set(nodeId, {});
        }
        const nodeState = this.nodeStateMap.get(nodeId);

        if (!nodeState[state]) {
            nodeState[state] = new Set();
        }
        nodeState[state].add(reason);
    }

    /**
   * 移除节点特定状态的一个“理由”。
   * 如果理由集合变空，该状态就不再激活。
   */
    removeReason(nodeId, state, reason) {
        const nodeState = this.nodeStateMap.get(nodeId);
        if (!nodeState || !nodeState[state]) return;

        nodeState[state].delete(reason);

        // 清理空状态，保持 activeStates 列表整洁
        if (nodeState[state].size === 0) {
            delete nodeState[state];
        }
    }

    /**
     * 添加一个全局理由。所有节点都会立即拥有此状态。
     */
    addGlobalReason(state, reason) {
        if (!this.globalReasons.has(state)) {
            this.globalReasons.set(state, new Set());
        }
        this.globalReasons.get(state).add(reason);
        // 注意：这里通常需要触发全图刷新，或者由外部去驱动 refresh
    }

    /**
     * 移除全局理由。
     */
    removeGlobalReason(state, reason) {
        if (!this.globalReasons.has(state)) return;

        const reasons = this.globalReasons.get(state);
        reasons.delete(reason);

        if (reasons.size === 0) {
            this.globalReasons.delete(state);
        }
    }

    /**
     * 返回当前激活的所有状态列表（即理由数 > 0 的状态）。
     * 自动合并节点私有状态和全局状态。
     */
    getActiveStates(nodeId) {
        const activeStates = new Set();

        // 1. 收集全局状态
        for (const [state, reasons] of this.globalReasons.entries()) {
            if (reasons.size > 0) activeStates.add(state);
        }

        // 2. 收集节点私有状态
        const nodeState = this.nodeStateMap.get(nodeId);
        if (nodeState) {
            for (const state in nodeState) {
                if (nodeState[state].size > 0) {
                    activeStates.add(state);
                }
            }
        }

        return Array.from(activeStates);
    }

    /**
   * 标准清理方法，用于节点移除或需要完全重置时
   */
    clearNode(nodeId) {
        this.nodeStateMap.delete(nodeId);
    }

    clearAll() {
        this.nodeStateMap.clear();
        this.globalReasons.clear();
    }
}
