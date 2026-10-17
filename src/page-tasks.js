/* Inventory all rendered assets, not just the first querySelector match.
 * Ext-generated IDs are not identities: the live two-video page repeats them.
 */
(() => {
    const D = XxtCodexDom, F = XxtCodexDocuments;
    const ownIcons = container => [...container.querySelectorAll('.ans-job-icon')].filter(el => el.closest('.ans-attach-ct') === container);
    function complete(container) {
        return !!container && (container.classList.contains('ans-job-finished') ||
            ownIcons(container).some(el => el.getAttribute('aria-label') === '任务点已完成'));
    }
    function scan(root) {
        const videos = [], documents = [], questions = [], markers = [], loading = [];
        function visit(win, path, owner = null, skipDocuments = false, depth = 0) {
            if (depth > 7) return;
            let doc;
            try { doc = win.document; if (!doc?.body) return; } catch { return; }
            const files = skipDocuments ? [] : F.find(doc);
            for (const entry of files) documents.push({ id: `document:${path}/${entry.id}`, entry, win,
                root: entry.element.tagName === 'IFRAME' ? entry.element.contentWindow : win });
            for (const [index, video] of [...doc.querySelectorAll('video')].filter(D.visible).entries()) {
                videos.push({ id: `video:${path}/${owner?.getAttribute('jobid') || owner?.getAttribute('objectid') || index}`,
                    video, win, root: win, container: owner?.closest('.ans-attach-ct') || video.closest('.ans-attach-ct') });
            }
            if (D.extract(doc).some(entry => D.visible(entry.element)) || D.readResult(doc)) questions.push({ id: `check:${path}`, win, root: win, frame: owner });
            for (const wrapper of doc.querySelectorAll('.ans-attach-ct')) {
                const icon = ownIcons(wrapper)[0];
                // Folded required tasks still block completion; a hidden container is
                // not evidence that its task has been finished.
                if (!icon) continue;
                const frame = wrapper.querySelector('iframe');
                const kind = /video/.test(frame?.getAttribute('src') || '') ? 'video' :
                    /work|quiz|exam/.test(frame?.getAttribute('src') || '') ? 'check' :
                    /pdf|doc|read|screen/.test(frame?.getAttribute('src') || '') ? 'document' : 'unknown';
                markers.push({ element: wrapper, kind, done: complete(wrapper), label: icon.getAttribute('aria-label') || '任务点' });
            }
            for (const [index, frame] of [...doc.querySelectorAll('iframe')].filter(D.visible).entries()) {
                if (frame.closest('[data-xxt-codex-panel]')) continue;
                const childPath = `${path}/${index}`, before = videos.length;
                const src = frame.getAttribute('src') || '';
                visit(frame.contentWindow, childPath, frame, skipDocuments || files.some(entry => entry.element === frame || entry.element.contains(frame)), depth + 1);
                if (/\/modules\/video\//.test(src) && videos.length === before) videos.push({
                    id: `video:${childPath}/${frame.getAttribute('jobid') || frame.getAttribute('objectid') || 'waiting'}`,
                    video: null, win: frame.contentWindow, root: frame.contentWindow, container: frame.closest('.ans-attach-ct') });
                try {
                    if (/\/knowledge\/cards/.test(src) && (!frame.contentDocument?.body || frame.contentDocument.readyState === 'loading')) loading.push(frame);
                } catch {}
            }
        }
        visit(root, 'root');
        return { videos, documents, questions, markers, loading,
            signature: JSON.stringify([videos.map(x => x.id), documents.map(x => x.id), questions.map(x => x.id), markers.map(x => x.kind)]) };
    }
    function steps(doc) {
        const list = [...doc.querySelectorAll('li[cardid][id^="dct"]')].filter(D.visible);
        let index = 0;
        try { index = Number(new URL(doc.querySelector('#iframe')?.getAttribute('src'), doc.baseURI).searchParams.get('num')) || 0; } catch {}
        return { items: list.map((element, i) => ({ element, id: element.getAttribute('cardid') || String(i), index: i, label: element.title || D.text(element) })), index };
    }
    globalThis.XxtPageTasks = { scan, complete, steps };
})();
