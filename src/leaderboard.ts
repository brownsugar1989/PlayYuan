import { STORAGE_API_URL } from './storage-config';

export interface LeaderboardResult {
  bestScore: number;
}

async function readResult(response: Response): Promise<LeaderboardResult> {
  const body = await response.json().catch(() => ({})) as { bestScore?: number; error?: string };
  if (!response.ok || !Number.isSafeInteger(body.bestScore) || (body.bestScore ?? -1) < 0) {
    throw new Error(body.error || '無法讀取此遊戲的最高分。');
  }
  return { bestScore: body.bestScore! };
}

export async function getBestScore(gameId: string): Promise<number> {
  const response = await fetch(`${STORAGE_API_URL}/games/${gameId}/leaderboard`);
  return (await readResult(response)).bestScore;
}

export async function submitScore(gameId: string, score: number): Promise<number> {
  const response = await fetch(`${STORAGE_API_URL}/games/${gameId}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  });
  return (await readResult(response)).bestScore;
}
