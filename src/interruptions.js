/* Dismiss only the named Star assistant, using its own top-right icon. */
(() => {
    const D = XxtCodexDom;
    const excluded = '.TiMu,#coursetree,[data-xxt-codex-panel],script,style';
    const attempts = new WeakMap();
    const clean = value => String(value || '').replace(/\s+/g, '');
    function target(doc) {
        const titles = [...doc.querySelectorAll('h1,h2,h3,h4,p,span,strong,div')].filter(el =>
            el.children.length < 7 && !el.closest(excluded) && D.visible(el) && /^(?:[⭐🌟★☆])?星小讲$/u.test(clean(D.text(el))));
        const found = new Map();
        for (const title of titles) {
            for (let scope = title.parentElement, depth = 0; scope && scope !== doc.body && depth < 10; scope = scope.parentElement, depth++) {
                if (scope.closest(excluded)) break;
                const box = scope.getBoundingClientRect();
                if (box.width < 200 || box.height < 160 || !/查看历史消息|历史消息|解读图片|不懂就问/.test(clean(D.text(scope)))) continue;
                const controls = new Set();
                for (const el of scope.querySelectorAll('button,a,[role="button"],[onclick],[tabindex],img,svg,i,[class*="close"],[class*="Close"],[class*="power"],[class*="Power"]')) {
                    if (!D.enabled(el) || el.closest(excluded)) continue;
                    let control = el.closest('button,a,[role="button"],[onclick],[tabindex]') || el;
                    if (!scope.contains(control)) continue;
                    if (control === el && el.matches('img,svg,i')) {
                        for (let parent = el.parentElement, level = 0; parent && parent !== scope && level < 3; parent = parent.parentElement, level++) {
                            if (doc.defaultView.getComputedStyle(parent).cursor === 'pointer') { control = parent; break; }
                        }
                    }
                    const rect = control.getBoundingClientRect();
                    // Relative to the identified panel, not absolute screenshot coordinates.
                    if (rect.width < 8 || rect.height < 8 || rect.width > 100 || rect.height > 100 ||
                        rect.left < box.left + box.width * 0.65 || rect.right > box.right + 4 ||
                        rect.top < box.top - 4 || rect.bottom > box.top + Math.min(140, box.height * 0.32)) continue;
                    const metadata = [control.id, control.getAttribute('class'), control.getAttribute('aria-label'), control.title,
                        ...[...control.querySelectorAll('img,svg,use,i')].flatMap(icon => [icon.getAttribute('class'), icon.getAttribute('alt'), icon.getAttribute('src'), icon.getAttribute('href')])].join(' ');
                    const label = clean(D.text(control));
                    const named = /close|power|shutdown|exit|关闭|收起|结束/i.test(metadata) || /^(关闭|收起|结束|×|✕|✖|⏻)$/.test(label);
                    const icon = control.matches('img,svg,i') || !!control.querySelector('img,svg,i');
                    if (named || (icon && label.length < 3)) controls.add(control);
                }
                // Discard an inner icon when its clickable wrapper is also a candidate.
                const choices = [...controls].filter(el => ![...controls].some(other => other !== el && other.contains(el)));
                if (choices.length > 1) return null;
                if (choices.length === 1) { found.set(choices[0], { button: choices[0], panel: scope }); break; }
            }
        }
        return D.unique([...found.values()]);
    }
    function dismiss(win) {
        const seen = new Set(), dismissed = [];
        function visit(current, depth = 0) {
            if (!current || depth > 8 || seen.has(current)) return;
            seen.add(current);
            try {
                const hit = target(current.document);
                if (hit && Date.now() - (attempts.get(hit.button) ?? -Infinity) >= 2000) {
                    attempts.set(hit.button, Date.now());
                    if (typeof hit.button.click === 'function') hit.button.click();
                    else hit.button.dispatchEvent(new current.MouseEvent('click', { bubbles: true, cancelable: true }));
                    dismissed.push(hit);
                }
                for (const frame of current.document.querySelectorAll('iframe')) if (D.visible(frame)) visit(frame.contentWindow, depth + 1);
            } catch { /* A separately injected active frame handles its own origin. */ }
        }
        visit(win);
        for (let parent = win, depth = 0; parent !== parent.parent && depth < 8; depth++) { parent = parent.parent; visit(parent); }
        return dismissed;
    }
    globalThis.XxtCodexInterruptions = { target, dismiss };
})();
