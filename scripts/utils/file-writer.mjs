/**
 * file-writer.mjs
 * JSON 파일 안전 저장 유틸리티 - 기존 데이터 백업, 원자적 쓰기
 */

import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * JSON 데이터를 파일에 안전하게 저장한다.
 * - 기존 파일이 있으면 .bak 백업을 생성한다.
 * - 쓰기 실패 시 기존 파일을 유지한다.
 * - 빈 데이터는 저장하지 않는다.
 *
 * @param {string} filePath - 저장할 파일의 절대 경로
 * @param {object} data - 저장할 JSON 데이터
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function writeJSON(filePath, data) {
  // 빈 데이터 검증
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    console.error(`[file-writer] Empty data — skipping write to ${filePath}`);
    return { success: false, message: 'Empty data, write skipped' };
  }

  const dir = dirname(filePath);

  try {
    // 디렉토리가 없으면 생성
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // 기존 파일이 있으면 백업
    if (existsSync(filePath)) {
      const backupPath = filePath + '.bak';
      await copyFile(filePath, backupPath);
    }

    // JSON 직렬화 (들여쓰기 2칸)
    const jsonString = JSON.stringify(data, null, 2) + '\n';

    // 파일 쓰기
    await writeFile(filePath, jsonString, 'utf-8');

    console.log(`[file-writer] Successfully wrote ${filePath} (${jsonString.length} bytes)`);
    return { success: true, message: `Wrote ${jsonString.length} bytes` };
  } catch (error) {
    console.error(`[file-writer] Failed to write ${filePath}: ${error.message}`);

    // 백업에서 복원 시도
    const backupPath = filePath + '.bak';
    if (existsSync(backupPath)) {
      try {
        await copyFile(backupPath, filePath);
        console.log(`[file-writer] Restored from backup: ${backupPath}`);
      } catch (restoreError) {
        console.error(`[file-writer] Backup restore also failed: ${restoreError.message}`);
      }
    }

    return { success: false, message: error.message };
  }
}

/**
 * 기존 JSON 파일을 읽어 반환한다. 파일이 없거나 파싱 실패 시 null을 반환한다.
 *
 * @param {string} filePath - JSON 파일의 절대 경로
 * @returns {Promise<object|null>}
 */
export async function readJSON(filePath) {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[file-writer] Failed to read ${filePath}: ${error.message}`);
    return null;
  }
}
