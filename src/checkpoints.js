import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { saveSession } from './session.js';
const digest = text => createHash('sha256').update(text).digest('hex');

// File-tool checkpoints only. Shell side effects are deliberately not represented
// as reversible snapshots. The journal is saved before every mutation.
export class Checkpoints {
  constructor(session, save = saveSession) { this.session = session; this.save = save; }
  async file(relative) {
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Invalid checkpoint path.');
    const parts = relative.split(/[\\/]/);
    if (parts.some(p => !p || ['..', '.', '.git', '.oscode'].includes(p))) throw new Error('Invalid checkpoint path.');
    let current = await fs.realpath(this.session.root);
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw new Error('Checkpoint path changed or contains a symlink.');
      } catch (error) { if (!(error.code === 'ENOENT' && i === parts.length - 1)) throw error; }
    }
    return current;
  }
  async snapshot(file) {
    try {
      const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > 512 * 1024 || stat.nlink > 1) throw new Error('Checkpoint requires a regular file up to 512 KiB without hard links.');
        return { content: await handle.readFile('utf8'), mode: stat.mode & 0o777 };
      } finally { await handle.close(); }
    } catch (error) { if (error.code === 'ENOENT') return { content: null, mode: null }; throw error; }
  }
  async apply(absolute, before, after) {
    const relative = path.relative(this.session.root, absolute);
    const file = await this.file(relative);
    const snapshot = await this.snapshot(file);
    if (snapshot.content !== before) throw new Error('File changed before checkpoint. Read again.');
    const entry = { id: randomUUID(), path: relative, created: new Date().toISOString(), turnId: this.turnId || null,
      before, beforeMode: snapshot.mode, afterHash: digest(after), afterMode: before === null ? (0o666 & ~process.umask()) : snapshot.mode, state: 'prepared' };
    (this.session.checkpoints ||= []).push(entry);
    await this.save(this.session);
    // A save may yield to other writers. Check again immediately before mutation.
    const current = await this.snapshot(await this.file(relative));
    if (current.content !== before || current.mode !== snapshot.mode) { entry.state = 'abandoned'; await this.save(this.session); throw new Error('File changed while saving checkpoint.'); }
    const handle = await fs.open(file, before === null ? constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW : constants.O_WRONLY | constants.O_NOFOLLOW, entry.afterMode);
    try { await handle.truncate(0); await handle.writeFile(after); }
    finally { await handle.close(); }
    entry.state = 'applied';
    await this.save(this.session);
    return entry.id;
  }
  list() {
    const entries = this.session.checkpoints || [];
    if (!entries.length) return '체크포인트가 없습니다. 파일 도구 변경부터 기록됩니다. 셸 변경은 포함하지 않습니다.';
    return entries.map(e => `${e.id} · ${e.state} · ${e.before === null ? '생성' : '편집'} · ${e.path}`).join('\n');
  }
  async undo(id = 'latest') {
    const candidates = (this.session.checkpoints || []).filter(e => ['applied', 'prepared', 'undoing'].includes(e.state));
    const entry = id === 'latest' ? candidates.at(-1) : candidates.find(e => e.id === id);
    if (!entry) throw new Error('되돌릴 체크포인트가 없습니다.');
    if (typeof entry.afterHash !== 'string' || (entry.before !== null && typeof entry.before !== 'string')) throw new Error('Invalid checkpoint data.');
    const file = await this.file(entry.path);
    const current = await this.snapshot(file);
    // Recover an interrupted journal write after a completed undo, or a prepared
    // edit that never reached the filesystem. Never guess at a partial write.
    if (current.content === entry.before && current.mode === entry.beforeMode && ['prepared', 'undoing'].includes(entry.state)) {
      entry.state = 'undone'; await this.save(this.session); return `${entry.path}: 이미 편집 전 상태입니다.`;
    }
    if (current.content === null || digest(current.content) !== entry.afterHash || current.mode !== entry.afterMode) throw new Error(`복원 충돌: ${entry.path}에 이후 변경이 있습니다. 파일을 보존했습니다.`);
    entry.state = 'undoing';
    await this.save(this.session);
    const checked = await this.snapshot(await this.file(entry.path));
    if (checked.content !== current.content || checked.mode !== current.mode) throw new Error(`복원 충돌: ${entry.path}가 변경되었습니다.`);
    if (entry.before === null) await fs.unlink(file);
    else {
      const temporary = path.join(path.dirname(file), `.oscode-undo-${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporary, entry.before, { flag: 'wx', mode: 0o600 });
        await fs.chmod(temporary, entry.beforeMode);
        await fs.rename(temporary, file);
      } finally { await fs.rm(temporary, { force: true }); }
    }
    entry.state = 'undone'; entry.undoneAt = new Date().toISOString();
    (this.session.workspaceNotes ||= []).push(`User reverted oscode file change ${entry.id} in ${entry.path}. Re-read this file before relying on earlier tool results.`);
    await this.save(this.session);
    return `복원 완료: ${entry.path} (${entry.id})`;
  }
}
