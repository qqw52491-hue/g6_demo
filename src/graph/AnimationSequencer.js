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
        // 1. 生成唯一的原因 ID，用于后续撤销
        const reasonId = `trace_${Date.now()}`;

        // 2. 只有起点和终点是特殊的（Star/End），中间是普通的路径点(Path)
        const startId = pathNodeIds[0];
        const endId = pathNodeIds[pathNodeIds.length - 1];
        const middleIds = pathNodeIds.slice(1, pathNodeIds.length - 1);

        // ----------------------------
        // 阶段 A: 即时响应 (变状态)
        // ----------------------------

        // 起点：设为 HighLight (Source)
        this.stateManager.addReason(startId, 'highlight_source', reasonId);
        this.refreshGraph([startId]);

        // ----------------------------
        // 阶段 B: 流光动画 (逐步点亮边 -> 节点 -> 边)
        // ----------------------------

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // 1. 点亮第一条边（如果有）
        if (edgeIds && edgeIds[0]) {
            await delay(300);
            this.stateManager.addReason(edgeIds[0], 'path_active', reasonId);
            this.refreshGraph([edgeIds[0]]);
        }

        // 2. 循环点亮中间部分
        for (let i = 0; i < middleIds.length; i++) {
            const nodeId = middleIds[i];

            await delay(300);
            this.stateManager.addReason(nodeId, 'path_active', reasonId);
            this.refreshGraph([nodeId]);

            // 点亮下一条边
            const nextEdgeIndex = i + 1;
            if (edgeIds && edgeIds[nextEdgeIndex]) {
                await delay(300);
                this.stateManager.addReason(edgeIds[nextEdgeIndex], 'path_active', reasonId);
                this.refreshGraph([edgeIds[nextEdgeIndex]]);
            }
        }

        // 3. 最后点亮终点
        await delay(300);
        this.stateManager.addReason(endId, 'highlight_target', reasonId);
        this.refreshGraph([endId]);

        // ----------------------------
        // 阶段 C: 记录撤销逻辑 (Undo Logic)
        // ----------------------------
        const undo = () => {
            // 一键撤销：只需要移除这个 reasonId 下的所有状态
            // 不需要管当时是第几个节点亮了，只要 reasonId 一样，全部干掉

            // 这里需要 StateManager 支持批量移除，或者我们手动遍历
            // 包括所有节点和边
            const allItems = [...new Set([...pathNodeIds, ...(edgeIds || [])])];

            allItems.forEach(id => {
                if (!id) return;
                this.stateManager.removeReason(id, 'highlight_source', reasonId);
                this.stateManager.removeReason(id, 'highlight_target', reasonId);
                this.stateManager.removeReason(id, 'path_active', reasonId);
            });

            this.refreshGraph(allItems);
        };

        this.timeline.push({ id: reasonId, undo });
    }

    /**
     * 辅助刷新：只更新脏节点
     */
    refreshGraph(nodeIds) {
        if (!this.graph || !nodeIds) return;

        this.graph.setAutoPaint(false);

        // 1. 获取动态定义的状态 (运行时添加的 layer/style)
        const dynamicStyles = this.stateManager.getDynamicDefinitions();

        nodeIds.forEach(id => {
            const item = this.graph.findById(id);
            if (item) {
                const activeStates = this.stateManager.getActiveStates(id);
                const model = item.getModel();

                // 2. 合并样式表：全局/原有样式 + 动态样式
                // 注意：这里我们做浅合并。如果 dynamicStyles 很大，可能需要优化。
                // 但通常动态样式不会太多。
                const mergedStateStyles = {
                    ...model.stateStyles,
                    ...dynamicStyles
                };

                this.graph.updateItem(item, {
                    activeStates: activeStates,
                    stateStyles: mergedStateStyles // <--- 注入合并后的样式表
                });
            }
        });

        this.graph.paint();
        this.graph.setAutoPaint(true);
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
