import {fileURLToPath} from 'node:url';
import {configureLauncher,MenuCancelled} from '../src/codex-launcher.mjs';

try {
    const settings=await configureLauncher({preferencesPath:fileURLToPath(new URL('../src/local/codex-launcher.json',import.meta.url))});
    process.env.XXT_CODEX_MODEL=settings.model;
    process.env.XXT_CODEX_REASONING=settings.reasoningEffort;
    console.log('正在启动本地连接服务…');
    await import('../src/bridge.mjs');
}catch(error){
    console.error(error.message);
    process.exitCode=error instanceof MenuCancelled?130:1;
}
