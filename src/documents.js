/* File preview adapters. Opening a preview does not itself prove platform task completion. */
(() => {
    const D = XxtCodexDom;
    const excluded = '#coursetree,.TiMu,[data-xxt-codex-panel],nav,header';
    // Observed nested Chaoxing reader: PDF module -> #panView -> pan-yz /screen/v2/file_… .
    function screenReader(value, base) {
        try {
            const url = new URL(value, base);
            return /(^|\.)chaoxing\.com$/.test(url.hostname) &&
                /^(?:\/mooc-ans\/screen\/file\/?|\/screen\/v2\/file_[^/]+)$/.test(url.pathname);
        } catch { return false; }
    }
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
            (fileType(el.getAttribute('src') || el.getAttribute('data')) || screenReader(el.getAttribute('src'), doc.baseURI) ||
                /application\/(?:pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml)/i.test(el.getAttribute('type') || '')));
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
    function readerDocument(doc) {
        return screenReader(doc.location.href) || /\/ananas\/modules\/(?:pdf|doc|document)\//i.test(doc.location.pathname);
    }
    function localScroll(doc, progress, scope) {
        const root = scope || doc;
        const targets = new Set(root.querySelectorAll('#viewerContainer,.pdfViewer,.mCustomScrollBox,[role="document"],.doc-preview'));
        if (root.nodeType === 1) targets.add(root);
        // Never move the course page or its catalogue scrollbar.
        if (readerDocument(doc)) {
            targets.add(doc.scrollingElement);
            for (const el of doc.querySelectorAll('div,main,section')) {
                if (el.clientHeight > 100 && /auto|scroll/.test(doc.defaultView.getComputedStyle(el).overflowY)) targets.add(el);
            }
        }
        let count = 0, bottom = true, extent = 0;
        for (const el of targets) {
            if (!el || !D.visible(el) || el.clientHeight < 1 ||
                (el.scrollHeight <= el.clientHeight + 2 && el !== doc.scrollingElement) || el.closest(excluded)) continue;
            el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight) * progress;
            count++; extent += el.scrollHeight;
            bottom = bottom && el.scrollHeight - el.clientHeight - el.scrollTop <= 2;
        }
        return { count, bottom, extent, unavailable: 0 };
    }
    const scrollRequests = new Map();
    const scrollChannel = 'xxt-codex-document-scroll-1';
    function trustedOrigin(origin) {
        try { return /(^|\.)chaoxing\.com$/.test(new URL(origin).hostname); } catch { return false; }
    }
    function readerAncestor(source) {
        let parent = window;
        for (let depth = 0; depth < 6 && parent !== parent.parent; depth++) {
            parent = parent.parent;
            if (parent === source) return true;
        }
        return false;
    }
    window.addEventListener('message', event => {
        const data = event.data;
        if (!trustedOrigin(event.origin) || data?.source !== scrollChannel) return;
        if (data.type === 'result') {
            const pending = scrollRequests.get(data.id);
            if (pending && pending.source === event.source && typeof data.bottom === 'boolean' &&
                Number.isSafeInteger(data.count) && data.count >= 0 && Number.isFinite(data.extent)) {
                pending.resolve({ count: data.count, bottom: data.bottom, extent: data.extent, unavailable: data.unavailable ? 1 : 0 });
            }
        } else if (data.type === 'scroll' && readerAncestor(event.source) &&
            screenReader(location.href) && typeof data.id === 'string' && Number.isFinite(data.progress) && data.progress >= 0 && data.progress <= 1) {
            const rest = typeof GM_getValue === 'function' && GM_getValue('xxt-quiet-enabled', true) && XxtCodexCore.quietHoursAt();
            if (rest || document.visibilityState === 'hidden') return;
            const result = localScroll(document, data.progress);
            event.source.postMessage({ source: scrollChannel, type: 'result', id: data.id, ...result }, event.origin);
        }
    });
    function crossScroll(frame, progress) {
        const id = crypto.randomUUID();
        return new Promise(resolve => {
            const finish = result => { clearTimeout(timer); scrollRequests.delete(id); resolve(result); };
            const timer = setTimeout(() => finish({ count: 0, bottom: false, extent: 0, unavailable: 1 }), 1200);
            scrollRequests.set(id, { source: frame.contentWindow, resolve: finish });
            // Only a visible, recognized document iframe is addressed, never arbitrary site frames.
            frame.contentWindow.postMessage({ source: scrollChannel, type: 'scroll', id, progress }, '*');
        });
    }
    async function scroll(doc, progress, scope, assertCurrent = () => {}, depth = 0) {
        assertCurrent();
        if (depth > 6) return { count: 0, bottom: false, extent: 0, unavailable: 1 };
        progress = Math.max(0, Math.min(1, progress));
        const result = localScroll(doc, progress, scope);
        const children = viewers(doc).filter(frame => frame.tagName === 'IFRAME' && (!scope || scope === frame || scope.contains(frame)));
        if (readerDocument(doc)) {
            // A short wrapper is not proof that an unknown embedded document reached its end.
            for (const frame of doc.querySelectorAll('iframe')) {
                if (D.visible(frame) && !children.includes(frame) && (!scope || scope === frame || scope.contains(frame))) result.unavailable++;
            }
        }
        for (const frame of children) {
            assertCurrent();
            let child;
            try { child = frame.contentDocument; } catch {}
            const next = child ? await scroll(child, progress, undefined, assertCurrent, depth + 1) : await crossScroll(frame, progress);
            assertCurrent();
            result.count += next.count; result.extent += next.extent;
            result.bottom = result.bottom && next.bottom; result.unavailable += next.unavailable;
        }
        return result;
    }
    async function open(entry, win, assertCurrent) {
        if (entry.inline) {
            const close = closeButton(entry.element);
            return { inline: true, root: entry.element, close: () => { if (close && D.enabled(close)) close.click(); } };
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
                    return { inline: !close, root: added[0], closed: close ? () => !D.visible(added[0]) : undefined,
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
