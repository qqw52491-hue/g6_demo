# G6 图谱样式系统设计文档 (Style System Architecture)

本文档详细说明了本项目中使用的基于语义分层和状态叠加的样式系统。

## 1. 核心设计哲学 (Core Philosophy)

### 1.1 状态驱动 (State-Driven)
我们不直接修改节点的样式（如颜色、大小），而是通过管理节点的 **“状态” (State)** 来间接影响样式。
*   ❌ 错误：`node.update({ style: { fill: 'red' } })`
*   ✅ 正确：`stateManager.addReason(nodeId, 'critical', 'reason_id')`

### 1.2 理由追踪 (Reason Tracking)
为了解决多业务模块同时操作同一个节点导致的状态冲突，我们采用了 **Set<ReasonID>** 的机制。
*   数据结构：`State -> Set<ReasonID>`
*   优势：自动去重，无需维护引用计数。只要还有一个业务模块需要该状态（Reason 集合非空），状态就保持激活。

---

## 2. 混合模式与优先级 (Blending & Priority)

当一个节点同时激活多个状态时（如既被 Hover，又是搜索结果，全图还在变暗），最终样式通过 `resolveStyle` 计算得出。

### 2.1 优先级 (Priority)
在 `src/graph/constants.js` 中定义了 `THEME` 对象，其键值对的顺序决定了默认优先级。
*   **Layer 越高，话语权越重**。
*   例如：`highlight` (60) > `dimmed` (10)。

### 2.2 混合策略 (Blending Strategy)
我们定义了不同的属性如何叠加。特别注意以下特殊规则：

#### ⚠️ 关键规则：透明度 (Opacity) 的智能混合
为了在支持“图层叠加”的同时，也能支持“聚光灯 (Spotlight)”效果，我们对 `opacity` 采用了特殊算法：

```javascript
opacity: (prev, curr) => curr === 1 ? 1 : prev * curr
```

*   **规则 A (叠加模式)**：如果新状态的 `opacity` 是小数（如 0.5），则进行 **乘法叠加**。
    *   场景：`Base(1.0) * Dimmed(0.2) = 0.2` (变暗)
*   **规则 B (重置模式)**：如果新状态的 `opacity` 显式设为 **1.0**，则 **强制重置** 为不透明。
    *   场景：`Dimmed(0.2) + Highlight(1.0) = 1.0` (聚光灯效果：无视背景黑暗，强行亮起)

**👉 最佳实践：**
*   如果你只是想加个装饰（如 Grid 背景，或是 weak link），请用 `0.x`。
*   如果你想让某个元素在任何情况下都清晰可见（如 Selected, Highlight），请务必显式设置 `opacity: 1`。
*   **不要** 随便给普通状态设置 `opacity: 1`，否则它会清除底下所有的变暗效果。通常情况下，普通状态 **不要写** opacity 属性。

#### 其他属性混合
*   **尺寸 (r, width, lineWidth)**: 取 `Math.max`。保证节点至少展示为最大的那个尺寸。
*   **阴影 (shadow)**: `Sum` (累加)。多重状态时光晕更强。

---

## 3. 实战范例：聚光灯模式 (Spotlight Mode)

如何实现“全屏变暗，唯独选中节点高亮”？

```javascript
// 1. 全局添加 Dimmed 原因 (所有节点变暗 opacity: 0.2)
stateManager.addGlobalReason('dimmed', 'search_session');

// 2. 目标节点添加 Highlight 原因 (opacity: 1.0)
// 由于 Highlight 优先级(60) > Dimmed(10)，且满足 opacity === 1 的重置规则
// 目标节点将 "击穿" 黑暗，完全亮起。
targets.forEach(id => {
    stateManager.addReason(id, 'highlight', 'search_session');
});

// 3. 刷新视图
graph.paint();
```

## 4. 目录结构
*   `constants.js`: 定义所有状态的层级、默认样式和混合算法。
*   `StateManager.js`: 管理状态的增删查改 (CRUD)。
*   `StyleResolver.js`: 执行具体的计算逻辑 (Sort & Blend)。
*   `registerNode.js`: 将计算好的样式应用到 G6 图形上。

---

## 5. 开发最佳实践 (Development Workflow)

随着架构演进，我们不再推荐修改 `constants.js` 来定义业务状态。请遵循以下两种标准流程：

### 模式一：规范开发流程 (Registry Pattern)
**适用场景**：高频使用的稳定状态（如：错误、VIP用户、选中、运行中）。
**口诀**：先立规矩(Register)，再执行(Activate)。

1.  **定义皮肤 (Register)**
    *   通常在应用初始化 (`onMounted`) 或独立的 `theme.js` 中。
    *   利用 `registerState` 提前注入配置，支持“一次定义，到处使用”。
    ```javascript
    // 初始化时
    stateManager.value.registerState('vip_mode', {
        layer: 50,
        style: { fill: 'gold', stroke: 'black', lineWidth: 4 }
    });
    ```

2.  **触发状态 (Activate)**
    *   后续业务中只需引用状态名，无需关心具体样式。
    ```javascript
    stateManager.value.addReason(nodeId, 'vip_mode', 'backend_api');
    ```

3.  **状态解除 (Deactivate)**
    ```javascript
    stateManager.value.removeReason(nodeId, 'vip_mode', 'backend_api');
    ```

### 模式二：快速内联流程 (Inline Dynamic Pattern)
**适用场景**：一次性特效、临时引导、Debug 高亮。
**口诀**：不用打招呼，直接干。

1.  **直接应用 (Inline Apply)**
    *   在添加状态时，直接传入临时样式配置对象 `{ layer, style }`。
    ```javascript
    stateManager.value.addReason(nodeId, 'temp_highlight', 'tutorial_step_1', {
        layer: 99, // 甚至可以临时覆盖 Error
        style: { fill: 'pink', animate: true, opacity: 1 } 
    });
    ```

2.  **自动清理**
    *   移除时同上，只需移除理由，样式会自动回退。
    ```javascript
    stateManager.value.removeReason(nodeId, 'temp_highlight', 'tutorial_step_1');
    ```

### 🎈 特性：同级堆叠 (Temporal Stacking)
当两个状态配置了 **相同的 Layer** (优先级) 时，系统会自动启用 **“时序堆叠”** 逻辑：
1.  **后加覆盖先加**：先加红，再加蓝 -> 显示蓝。
2.  **撤销自动回退**：移除蓝 -> 自动变回红。
3.  **乱序撤销**：移除中间的绿 -> 视觉不变（依然是蓝），但底层队列已更新。

这使得你无需手写 Stack 逻辑即可实现复杂的覆盖回退效果。

---
**总结**：`constants.js` 只负责物理法则 (Layer/BlendMode)。业务样式请全部使用 **StateManager** 动态管理！
