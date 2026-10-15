/* File preview adapters. Opening a preview does not itself prove platform task completion. */
(() => {
    const D = XxtCodexDom;
    const excluded = '#coursetree,.TiMu,[data-xxt-codex-panel],nav,header';
    function fileType(value) {
        let decoded = String(value || '');
        try { decoded = decodeURIComponent(decoded); } catch {}
        if (/\.pdf(?:$|[\s?#)&])|\/(?:pdf)\/|[?&](?:type|filetype|ext)=pdf(?:&|$)/i.test(decoded)) return 'pdf';
        if (/\.docx?(?:$|[\s?#)&])|\/(?:doc|office|document)\/|[?&](?:type|filetype|ext)=docx?(?:&|$)/i.test(decoded)) return 'word';
        return null;
    }
    function safeUrl(value, doc) {
        try { const url = new URL(value, doc.baseURI); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
    }
    function identity(element, label, url) {
        const stableId = element.getAttribute('data-objectid') || element.getAttribute('data-fileid') || element.getAttribute('data-jobid');
        return stableId || `${label}/${url || element.getAttribute('onclick') || element.id || ''}`;
    }
    function viewers(doc) {
        return [...doc.querySelectorAll('iframe,embed,object')].filter(el => D.visible(el) && !el.closest(excluded) &&
            (fileType(el.getAttribute('src') || el.getAttribute('data')) || /application\/(?:pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml)/i.test(el.getAttribute('type') || '')));
    }
    function find(doc) {
        const found = new Map();
        const elements = [...doc.querySelectorAll('a,button,[role="button"],[onclick],.file-name,.attach-name,.attachment-name,[data-file-name]')];
        for (const el of elements) {
            if (!D.enabled(el) || el.closest(excluded) || el.hasAttribute('download')) continue;
            const label = (el.getAttribute('data-file-name') || el.getAttribute('title') || D.text(el)).trim();
            if (label.length > 200) continue;
            const href = safeUrl(el.getAttribute('href') || el.getAttribute('data-url'), doc);
            const type = fileType(label) || fileType(href);
            if (!type) continue;
            const control = el.closest('a,button,[role="button"],[onclick]') || el;
            const id = identity(control, label, href);
            if (![...found.values()].some(entry => entry.element === control)) found.set(id, { id, element: control, label: label || `${type} 文件`, url: href, type });
        }
        if (found.size) return [...found.values()];
        const embedded = viewers(doc).map(el => ({ id: identity(el, el.title || '文件预览', el.getAttribute('src') || el.getAttribute('data')),
            element: el, label: el.title || '文件预览', type: fileType(el.src || el.data) || 'pdf', inline: true }));
        if (embedded.length) return embedded;
        const selfType = fileType(doc.location.href);
        if (selfType && /\/ananas\/modules\/(?:pdf|doc|document)\//i.test(doc.location.pathname) && doc.body)
            return [{ id: `viewer:${doc.location.href}`, element: doc.body, label: '文献文件预览', type: selfType, inline: true }];
        return [];
    }
    function closeButton(viewer) {
        let scope = viewer.matches('[role="dialog"],.layui-layer,.popDiv,.popContent,.modal') ? viewer : viewer.parentElement;
        for (let depth = 0; scope && scope !== viewer.ownerDocument.body && depth < 8; depth++, scope = scope.parentElement) {
            const choices = [...scope.querySelectorAll('button,a,[role="button"],[onclick],[class*="close"],[class*="Close"],[aria-label],[title]')]
                .filter(el => D.enabled(el) && (/^(?:关闭|关闭预览|返回|×|✕|✖)$/i.test(el.getAttribute('aria-label') || el.title || D.text(el)) ||
                    /(?:^|\s)[\w-]*close[\w-]*(?:\s|$)/i.test(el.className || '')));
            const unique = [...new Set(choices.map(el => el.closest('button,a,[role="button"],[onclick]') || el))];
            if (unique.length === 1) return unique[0];
            if (unique.length > 1) return null;
        }
        return null;
    }
    function openedViews(doc) {
        const candidates = [...viewers(doc), ...[...doc.querySelectorAll('[role="dialog"],.layui-layer,.popDiv,.popContent,.modal')]
            .filter(el => D.visible(el) && !el.closest(excluded) && closeButton(el) &&
                (el.querySelector('iframe,embed,object,canvas,.pdfViewer') || fileType(D.text(el)) || /(?:文件|文档|文献).*预览/.test(D.text(el))))];
        return [...new Set(candidates)].filter(el => !candidates.some(parent => parent !== el && parent.contains(el)));
    }
    function scroll(doc, progress, depth = 0) {
        if (depth > 6) return;
        const targets = new Set([doc.scrollingElement, ...doc.querySelectorAll('#viewerContainer,.pdfViewer,.mCustomScrollBox,.mCSB_container,[role="document"],.doc-preview')]);
        for (const el of targets) {
            if (!el || !D.visible(el) || el.scrollHeight <= el.clientHeight) continue;
            el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight) * Math.max(0, Math.min(1, progress));
        }
        for (const frame of viewers(doc)) {
            if (frame.tagName !== 'IFRAME') continue;
            try { if (frame.contentDocument) scroll(frame.contentDocument, progress, depth + 1); } catch {}
        }
    }
    async function open(entry, win, assertCurrent) {
        if (entry.inline) {
            const close = closeButton(entry.element);
            return { inline: true, close: () => { if (close && D.enabled(close)) close.click(); } };
        }
        const doc = entry.element.ownerDocument;
        const before = new Set(openedViews(doc));
        const popups = [];
        const restorers = [];
        let target = win;
        // Observe native window.open while preserving the site's click handler and return value.
        for (let depth = 0; target && depth < 8; depth++) {
            try {
                const current = target, original = current.open;
                const wrapped = function (...args) {
                    const popup = original.apply(this, args);
                    const url = safeUrl(args[0], doc);
                    if (popup && popup !== current && popup !== win.top && (fileType(url) || url === entry.url)) popups.push(popup);
                    return popup;
                };
                current.open = wrapped;
                restorers.push(() => { if (current.open === wrapped) current.open = original; });
            } catch {}
            if (target === target.parent) break;
            target = target.parent;
        }
        const preventNavigation = event => { if (entry.url) event.preventDefault(); };
        entry.element.addEventListener('click', preventNavigation);
        try {
            assertCurrent();
            entry.element.click();
            const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
                assertCurrent();
                if (popups.length > 1) throw new Error('出现多个文件预览，已暂停，请核对打开的文件');
                const popup = popups[0];
                if (popup) return { closed: () => popup.closed, close: () => { if (!popup.closed) popup.close(); } };
                const added = openedViews(doc).filter(viewer => !before.has(viewer));
                if (added.length === 1) {
                    const close = closeButton(added[0]);
                    return { inline: !close, closed: close ? () => !D.visible(added[0]) : undefined,
                        close: () => { if (close && D.enabled(close)) close.click(); } };
                }
                if (added.length > 1 || popups.length > 1) throw new Error('出现多个文件预览，已暂停，请核对打开的文件');
                // Ordinary file links use the extension's closeable tab handle.
                if (entry.url && GM_getValue('xxt-document-open-mode', 'modal') === 'tab' && Date.now() >= deadline - 7000) {
                    if (typeof GM_openInTab !== 'function') throw new Error('油猴缺少打开文件权限，请安装最新 ZIP');
                    const tab = GM_openInTab(entry.url, { active: true, setParent: true });
                    if (!tab?.close) throw new Error('未能打开可关闭的文件预览');
                    return { closed: () => tab.closed, close: () => tab.close() };
                }
                await D.delay(100);
            }
            throw new Error('文件已点击，但没有识别到可关闭的预览，请核对文献阅读页');
        } catch (error) {
            for (const popup of popups) { try { if (!popup.closed) popup.close(); } catch {} }
            throw error;
        } finally {
            entry.element.removeEventListener('click', preventNavigation);
            restorers.reverse().forEach(restore => restore());
        }
    }
    globalThis.XxtCodexDocuments = { fileType, find, viewers, closeButton, openedViews, scroll, open };
})();
