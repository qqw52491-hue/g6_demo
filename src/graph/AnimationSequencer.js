export class AnimationSequencer {
    constructor(graph, stateManager) {
        this.graph = graph;
        this.stateManager = stateManager;
        this.timeline = []; // 存储每一次操作的清理函数（Undo Stack）
    }

    /**
     * 核心方法：执行一个路径高亮动画
     * @param {string[]} pathNodeIds - 路径上所有节点的 ID 列表（包括起点、终点和中间节点）
     * @param {string[]} edgeIds - 路径上所有边的 ID 列表
     */
    async playPathTrace(pathNodeIds, edgeIds) {
        // 1. 生成唯一的原因 ID
        const reasonId = `trace_${Date.now()}`;

        // 2. 只有起点和终点是特殊的，中间是普通的路径点
        const startId = pathNodeIds[0];
        const endId = pathNodeIds[pathNodeIds.length - 1];
        const middleIds = pathNodeIds.slice(1, pathNodeIds.length - 1);

        // 3. 控制对象 (用于中断动画)
        // 我们用一个对象而不是布尔值，利用引用的特性
        const control = { active: true };

        // 4. 定义撤销逻辑 (提前定义，为了能放入 timeline)
        const undo = () => {
            // A. 先停止后续动画
            control.active = false;

            // B. 清理己经加上去的样式
            const allItems = [...new Set([...pathNodeIds, ...(edgeIds || [])])];
            allItems.forEach(id => {
                if (!id) return;
                this.stateManager.removeReason(id, 'highlight_source', reasonId);
                this.stateManager.removeReason(id, 'highlight_target', reasonId);
                this.stateManager.removeReason(id, 'path_active', reasonId);
            });
            this.refreshGraph(allItems);
        };

        // 5. 立即推入撤销栈
        // 这样即使动画还在跑，用户点了撤销，也能找到这个 undo 函数并执行中断
        this.timeline.push({ id: reasonId, undo });

        // ----------------------------
        // 阶段 A: 即时响应 (变状态)
        // ----------------------------
        this.stateManager.addReason(startId, 'highlight_source', reasonId);
        this.refreshGraph([startId]);

        // ----------------------------
        // 阶段 B: 流光动画
        // ----------------------------
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // 1. 点亮第一条边
        if (edgeIds && edgeIds[0]) {
            await delay(300);
            if (!control.active) return; // 检查中断
            this.stateManager.addReason(edgeIds[0], 'path_active', reasonId);
            this.refreshGraph([edgeIds[0]]);
        }

        // 2. 循环点亮中间部分
        for (let i = 0; i < middleIds.length; i++) {
            const nodeId = middleIds[i];

            await delay(300);
            if (!control.active) return; // 检查中断
            this.stateManager.addReason(nodeId, 'path_active', reasonId);
            this.refreshGraph([nodeId]);

            const nextEdgeIndex = i + 1;
            if (edgeIds && edgeIds[nextEdgeIndex]) {
                await delay(300);
                if (!control.active) return; // 检查中断
                this.stateManager.addReason(edgeIds[nextEdgeIndex], 'path_active', reasonId);
                this.refreshGraph([edgeIds[nextEdgeIndex]]);
            }
        }

        // 3. 最后点亮终点
        await delay(300);
        if (!control.active) return; // 检查中断
        this.stateManager.addReason(endId, 'highlight_target', reasonId);
        this.refreshGraph([endId]);
    }

    /**
     * 辅助刷新：只更新脏节点
     */
    /**
     * 辅助刷新：只更新脏节点
     * 现在的逻辑非常干净：只通知 StateManager 应用状态，样式计算由 G6 内部的 StyleResolver 自动完成
     */
    refreshGraph(nodeIds) {
        if (!this.graph || !nodeIds) return;
        this.stateManager.applyStatesToGraph(this.graph, nodeIds);
    }

    /**
     * 便捷方法：刷新全图
     * 当涉及到 Global Reason 变更时，必须调用此方法
     */
    refreshAll() {
        if (!this.graph) return;
        const nodes = this.graph.getNodes().map(n => n.getID());
        const edges = this.graph.getEdges().map(e => e.getID());
        this.refreshGraph([...nodes, ...edges]);
    }

    /**
     * 撤销上一步动画/操作
     */
    undoLast() {
        const record = this.timeline.pop();
        if (record) {
            record.undo();
        }
    }
}
