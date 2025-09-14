import { spawn } from 'child_process';
import { setTimeout as setNodeTimeout, clearTimeout as clearNodeTimeout } from 'node:timers';

export type PythonModuleInfo = {
  present: boolean;
  version?: string | null;
  file?: string | null;
  error?: string;
};

export type PythonEnvInfo = {
  ok: boolean;
  error?: string;
  python?: {
    executable: string;
    version: string;
  };
  sys_path?: string[];
  site_packages?: string[];
  modules?: Record<string, PythonModuleInfo>;
};

function buildInspectorCode(): string {
  return [
    'import sys, json, site, importlib',
    'def mod_info(name):',
    '  try:',
    '    m = importlib.import_module(name)',
    "    ver = getattr(m, '__version__', None)",
    "    path = getattr(m, '__file__', None)",
    '    return {"present": True, "version": ver, "file": path}',
    '  except Exception as e:',
    '    return {"present": False, "error": str(e)}',
    'info = {}',
    'info["python"] = {"executable": sys.executable, "version": sys.version}',
    'info["sys_path"] = list(sys.path)',
    'try:',
    '  sps = site.getsitepackages()',
    'except Exception as e:',
    '  sps = []',
    'info["site_packages"] = sps',
    'info["modules"] = {',
    "  'gguf': mod_info('gguf'),",
    "  'transformers': mod_info('transformers'),",
    "  'tokenizers': mod_info('tokenizers'),",
    "  'accelerate': mod_info('accelerate'),",
    '}',
    'print(json.dumps(info))'
  ].join('\n');
}

export async function inspectPythonEnv(pythonBin?: string, timeoutMs = 8000): Promise<PythonEnvInfo> {
  const bin = pythonBin || process.env.PYTHON_BIN || '/Users/sydneybach/miniconda3/bin/python';
  return new Promise((resolve) => {
    try {
      const code = buildInspectorCode();
      const proc = spawn(bin, ['-c', code], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const to = setNodeTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (e) { void e; }
        resolve({ ok: false, error: `Timed out after ${timeoutMs}ms` });
      }, timeoutMs);
      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.stderr.on('data', (d) => { err += d.toString(); });
      proc.on('error', (e) => {
        clearNodeTimeout(to);
        resolve({ ok: false, error: e.message });
      });
      proc.on('close', () => {
        clearNodeTimeout(to);
        if (!out) {
          resolve({ ok: false, error: err || 'No output from python' });
          return;
        }
        try {
          const j = JSON.parse(out);
          resolve({ ok: true, ...j });
        } catch (e: any) {
          resolve({ ok: false, error: `Failed to parse JSON: ${e?.message || String(e)}; raw=${out.slice(0, 400)}` });
        }
      });
    } catch (e: any) {
      resolve({ ok: false, error: e?.message || String(e) });
    }
  });
}
