/* Recover the current Chaoxing player's error through its visible route controls. */
(() => {
    const D = XxtCodexDom;
    function player(video) {
        const root = video?.closest('.video-js') || video?.parentElement;
        return root?.querySelectorAll('video').length === 1 ? root : null;
    }
    function errorPanel(root) {
        const panels = [...root.querySelectorAll('.vjs-error-display,.ans-vjserrdisplay')].filter(el =>
            D.visible(el) && el.getAttribute('aria-hidden') !== 'true' &&
            /播放终止|无法播放媒体|您可以尝试其他线路/.test(D.text(el)));
        return D.unique(panels.filter(el => !panels.some(parent => parent !== el && parent.contains(el))));
    }
    function route(panel, name) {
        return D.unique([...panel.querySelectorAll('input[type="radio"][name="ans-vjserrdisplay-opt"]')].filter(input =>
            D.text(input.closest('label')).replace(/\s/g, '') === name));
    }
    function create({ now = Date.now, waitMs = 8000 } = {}) {
        let states = new WeakMap();
        return {
            reset() { states = new WeakMap(); },
            active(video) { return !!states.get(player(video))?.waiting; },
            step(video, context, guard) {
                const root = player(video);
                if (!root) return null;
                const panel = errorPanel(root);
                let state = states.get(root);
                if (state?.context !== context) state = null;
                if (!panel && !state?.waiting) return null;
                if (!state) { state = { context, tried: new Set(), waiting: false }; states.set(root, state); }
                guard();
                if (state.waiting) {
                    // An error can coexist with paused=false and readyState=4.
                    // Only a cleared panel plus actual clock progress proves recovery.
                    if (!panel && !video.error && !video.paused && video.readyState >= 2 &&
                        Number(video.currentTime) > state.time + 0.05) {
                        states.delete(root);
                        return { recovered: true, message: `${state.name}线路已恢复播放` };
                    }
                    if (!panel && Number(video.currentTime) < state.time) state.time = Number(video.currentTime);
                    if (now() - state.at < waitMs) return { waiting: true,
                        resume: !panel && video.readyState >= 2 && video.paused,
                        message: `已选择${state.name}，正在等待视频恢复播放…` };
                    if (!panel) return { failed: true, message: `${state.name}切换后视频仍未恢复，未找到可见的备用线路按钮` };
                }
                for (const name of ['公网1', '公网2']) {
                    if (state.tried.has(name)) continue;
                    const input = panel && route(panel, name);
                    // A selected disabled route is the failed current route.
                    state.tried.add(name);
                    if (!input || !D.enabled(input)) continue;
                    guard();
                    state.name = name; state.time = Number(video.currentTime || 0); state.at = now(); state.waiting = true;
                    input.click();
                    return { waiting: true, clicked: name, message: `视频播放出错，已选择${name}，等待恢复…` };
                }
                return { failed: true, message: '视频公网1/公网2线路均未恢复或不可用' };
            }
        };
    }
    globalThis.XxtVideoLines = { create };
})();
