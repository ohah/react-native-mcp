/**
 * readline 기반 인터랙티브 프롬프트
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input, output });
  }
  return rl;
}

export function closeRL(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

export async function select<T>(
  question: string,
  items: T[],
  labelFn: (item: T) => string
): Promise<T> {
  const r = getRL();
  console.log();
  console.log(question);
  for (const [i, item] of items.entries()) {
    console.log(`  ${i + 1}. ${labelFn(item)}`);
  }

  while (true) {
    const answer = await r.question(`> `);
    const num = parseInt(answer.trim(), 10);
    if (num >= 1 && num <= items.length) {
      const chosen = items[num - 1];
      if (chosen !== undefined) return chosen;
    }
    console.log(`  Please enter a number between 1 and ${items.length}`);
  }
}
