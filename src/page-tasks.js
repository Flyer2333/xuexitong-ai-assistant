/* Inventory all rendered assets, not just the first querySelector match.
 * Ext-generated IDs are not identities: the live two-video page repeats them.
 */
(() => {
    const D = XxtCodexDom, F = XxtCodexDocuments;
    const ownIcons = container => [...container.querySelectorAll('.ans-job-icon')].filter(el => el.closest('.ans-attach-ct') === container);
    function taskPoint(element) {
        const container = element?.closest('.ans-attach-ct');
        return !container ? 'unknown' : ownIcons(container).length ? 'required' : 'optional';
    }
    function complete(container) {
        return !!container && (container.classList.contains('ans-job-finished') ||
            ownIcons(container).some(el => el.getAttribute('aria-label') === '任务点已完成'));
    }
    const mediaKind = media => media?.tagName === 'AUDIO' ? 'audio' : 'video';
    const mediaLabel = media => mediaKind(media) === 'audio' ? '音频' : '视频';
    function playable(doc) {
        return [...doc.querySelectorAll('video,audio')].filter(media => {
            if (media.tagName === 'VIDEO') return D.visible(media);
            // Chaoxing's audio tech element has no visible controls of its own.
            // Its video.js wrapper is visible; a second, empty audio element is not a task.
            const player = media.closest('.video-js');
            return (D.visible(media) || D.visible(player)) &&
                !!(media.currentSrc || media.getAttribute('src') || media.querySelector('source[src]') ||
                    (media.id === 'audio_html5_api' && player?.classList.contains('vjs-audio')));
        });
    }
    function scan(root) {
        const videos = [], documents = [], questions = [], markers = [], loading = [];
        function visit(win, path, owner = null, skipDocuments = false, depth = 0, inheritedContainer = null) {
            if (depth > 7) return;
            let doc;
            try { doc = win.document; if (!doc?.body) return; } catch { return; }
            const files = skipDocuments ? [] : F.find(doc);
            for (const found of files) { const entry = { ...found, taskPoint: taskPoint(found.element) }; documents.push({ id: `document:${path}/${entry.id}`, entry, win,
                root: entry.element.tagName === 'IFRAME' ? entry.element.contentWindow : win,
                container: entry.element.closest('.ans-attach-ct') || owner?.closest('.ans-attach-ct') || inheritedContainer }); }
            for (const [index, video] of playable(doc).entries()) {
                videos.push({ id: `${mediaKind(video)}:${path}/${owner?.getAttribute('jobid') || owner?.getAttribute('objectid') || index}`,
                    video, mediaKind: mediaKind(video), win, root: win, container: owner?.closest('.ans-attach-ct') || video.closest('.ans-attach-ct') || inheritedContainer });
            }
            const forms = D.extract(doc).filter(entry => D.visible(entry.element)).map(entry => entry.element);
            if (forms.length || D.readResult(doc)) questions.push({ id: `check:${path}`, win, root: win, frame: owner, forms,
                containers: [...new Set([...forms.map(form => form.closest('.ans-attach-ct')), inheritedContainer].filter(Boolean))] });
            for (const wrapper of doc.querySelectorAll('.ans-attach-ct')) {
                const icon = ownIcons(wrapper)[0];
                // Folded required tasks still block completion; a hidden container is
                // not evidence that its task has been finished.
                if (!icon) continue;
                const frame = wrapper.querySelector('iframe');
                const kind = /audio/.test(frame?.getAttribute('src') || '') || frame?.getAttribute('module') === 'insertaudio' ? 'audio' :
                    /video/.test(frame?.getAttribute('src') || '') ? 'video' :
                    /work|quiz|exam/.test(frame?.getAttribute('src') || '') ? 'check' :
                    /pdf|doc|read|screen/.test(frame?.getAttribute('src') || '') ? 'document' : 'unknown';
                markers.push({ element: wrapper, kind, done: complete(wrapper), label: icon.getAttribute('aria-label') || '任务点' });
            }
            for (const [index, frame] of [...doc.querySelectorAll('iframe')].filter(D.visible).entries()) {
                if (frame.closest('[data-xxt-codex-panel]')) continue;
                const childPath = `${path}/${index}`, before = videos.length;
                const src = frame.getAttribute('src') || '';
                visit(frame.contentWindow, childPath, frame, skipDocuments || files.some(entry => entry.element === frame || entry.element.contains(frame)), depth + 1,
                    frame.closest('.ans-attach-ct') || inheritedContainer);
                if (/\/modules\/(video|audio)\//.test(src) && videos.length === before) {
                    const kind = /\/modules\/audio\//.test(src) ? 'audio' : 'video';
                    videos.push({ id: `${kind}:${childPath}/${frame.getAttribute('jobid') || frame.getAttribute('objectid') || 'waiting'}`,
                        mediaKind: kind, video: null, win: frame.contentWindow, root: frame.contentWindow, container: frame.closest('.ans-attach-ct') });
                }
                try {
                    const taskFrame = /\/knowledge\/cards|\/modules\/work\/|\/api\/work(?:[/?]|$)|\/work\/(?:doHomeWorkNew|selectWorkQuestionYiPiYue)/.test(src);
                    const child = frame.contentDocument;
                    if (taskFrame && (!child?.body || child.readyState === 'loading' || child.URL === 'about:blank')) loading.push(frame);
                } catch {}
            }
        }
        visit(root, 'root');
        // A quiz may be inline or hosted behind a generic loader URL. Its
        // pending icon is the thing to complete by answering, not a knowledge
        // prerequisite. Attribute only to the form's own wrapper/frame.
        for (const marker of markers) if (marker.kind === 'unknown' && questions.some(question =>
            question.forms.some(form => form.closest('.ans-attach-ct') === marker.element) ||
            question.containers.includes(marker.element))) marker.kind = 'check';
        for (const marker of markers) if (marker.kind === 'unknown' && documents.some(asset =>
            asset.entry.element.closest('.ans-attach-ct') === marker.element)) marker.kind = 'document';
        return { videos, documents, questions, markers, loading,
            signature: JSON.stringify([videos.map(x => x.id), documents.map(x => x.id), questions.map(x => x.id), markers.map(x => x.kind)]) };
    }
    function steps(doc) {
        const list = [...doc.querySelectorAll('li[cardid][id^="dct"]')].filter(D.visible);
        let index = 0;
        try { index = Number(new URL(doc.querySelector('#iframe')?.getAttribute('src'), doc.baseURI).searchParams.get('num')) || 0; } catch {}
        return { items: list.map((element, i) => ({ element, id: element.getAttribute('cardid') || String(i), index: i, label: element.title || D.text(element) })), index };
    }
    function replayControl(video) {
        if (!video?.isConnected || !video.ended) return null;
        const root = video.closest('.video-js') || video.parentElement;
        if (root?.querySelectorAll('video').length !== 1) return null;
        // The live control is a button, not the big central play overlay.
        return [...(root?.querySelectorAll('button.vjs-play-control.vjs-ended') || [])].find(button =>
            D.visible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true' &&
            (button.title === '重播' || D.text(button).trim() === '重播')) || null;
    }
    globalThis.XxtPageTasks = { scan, complete, steps, replayControl, taskPoint, playable, mediaKind, mediaLabel };
})();
