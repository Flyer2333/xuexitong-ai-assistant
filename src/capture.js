/* Inline verified question images in the screenshot clone so html2canvas cannot silently omit them. */
(() => {
    const D = XxtCodexDom;
    async function bounded(promise, milliseconds, message, guard = () => {}) {
        let timer, monitor;
        try {
            guard();
            return await Promise.race([promise, new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error(message)), milliseconds);
                monitor = setInterval(() => { try { guard(); } catch (error) { reject(error); } }, 250);
            })]);
        } finally { clearTimeout(timer); clearInterval(monitor); }
    }
    function raster(image, doc) {
        if (!image.complete || !image.naturalWidth || !image.naturalHeight) throw new Error('图片尚未加载');
        const scale = Math.min(1, 4096 / image.naturalWidth, 4096 / image.naturalHeight);
        const canvas = doc.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    }
    async function decode(data, doc) {
        const image = doc.createElement('img'); image.src = data;
        await Promise.race([image.decode(), D.delay(8000).then(() => { throw new Error('图片解码超时'); })]);
        return raster(image, doc);
    }
    function gmImage(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url: url.href, anonymous: true, responseType: 'arraybuffer', timeout: 8000,
                onload(response) {
                    const mime = response.responseHeaders?.match(/^content-type:\s*([^;\r\n]+)/im)?.[1] || '';
                    if (response.status !== 200 || !/^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(mime) || !response.response?.byteLength || response.response.byteLength > 8 * 1024 * 1024) {
                        reject(new Error('题目图片响应无效')); return;
                    }
                    const reader = new FileReader(); reader.onerror = () => reject(new Error('图片读取失败'));
                    reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob([response.response], { type: mime }));
                }, onerror: () => reject(new Error('题目图片下载失败')), ontimeout: () => reject(new Error('题目图片下载超时')) });
        });
    }
    async function inline(image, doc, guard) {
        guard();
        const source = D.imageSource(image);
        if (!source) throw new Error('题目图片没有可用地址');
        const url = new URL(source, doc.baseURI);
        if (url.href === (image.currentSrc || image.src)) { try { return raster(image, doc); } catch {} }
        if (/^data:image\//i.test(source)) return decode(source, doc);
        if (!['https:', 'blob:'].includes(url.protocol)) throw new Error('题目图片地址无法读取');
        let data;
        try {
            const response = await doc.defaultView.fetch(url.href, { credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
            const blob = await response.blob();
            if (!response.ok || !/^image\//.test(blob.type) || !blob.size || blob.size > 8 * 1024 * 1024) throw new Error('图片响应无效');
            data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        } catch {
            guard();
            if (url.protocol !== 'https:' || !/(^|\.)chaoxing\.com$/i.test(url.hostname) || typeof GM_xmlhttpRequest !== 'function') throw new Error('题目图片无法完整读取，请检查截图预览');
            data = await gmImage(url);
        }
        guard(); return decode(data, doc);
    }
    async function capture(element, { guard = () => {}, backgroundColor = '#ffffff', ignoreElements = () => false } = {}) {
        const doc = element.ownerDocument, deadline = Date.now() + 30000;
        const check = () => { guard(); if (Date.now() > deadline) throw new Error('题目图片准备超时'); };
        const images = [...element.querySelectorAll('img')], prepared = new Map(), sources = new Map();
        if (images.length > 40) throw new Error('单题图片过多，无法生成完整截图');
        for (let index = 0; index < images.length; index++) {
            check(); const image = images[index]; if (!D.visible(image)) continue;
            const source = D.imageSource(image);
            if (!sources.has(source)) sources.set(source, await inline(image, doc, check));
            check(); prepared.set(index, sources.get(source));
        }
        const rect = element.getBoundingClientRect();
        const scale = Math.min(1.5, 4096 / Math.max(1, rect.width), 8192 / Math.max(1, rect.height), Math.sqrt(12000000 / Math.max(1, rect.width * rect.height)));
        if (scale < 0.5) throw new Error('题目过长，无法生成清晰完整的截图');
        check();
        const canvas = await bounded(html2canvas(element, { backgroundColor, scale, useCORS: true, logging: false, ignoreElements,
            async onclone(cloneDoc, cloneElement) {
                const cloned = [...cloneElement.querySelectorAll('img')];
                for (const [index, data] of prepared) {
                    check(); const image = cloned[index];
                    if (!image) throw new Error('题目截图结构已变化');
                    image.removeAttribute('srcset'); image.removeAttribute('sizes'); image.loading = 'eager'; image.src = data;
                    await image.decode();
                }
            } }), 20000, '题目截图生成超时，已停止本轮提交', check);
        check(); const data = canvas.toDataURL('image/png');
        if (data.length > 4 * 1024 * 1024) throw new Error('题目截图超过大小限制，请检查截图预览');
        return data;
    }
    const readyFonts = (doc, guard) => bounded(doc.fonts.ready, 8000, '题目字体加载超时，请刷新课程页后重试', guard);
    globalThis.XxtQuestionCapture = { capture, readyFonts, bounded };
})();
