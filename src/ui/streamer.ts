/**
 * Write a token to stdout without a newline, for streaming output.
 */
export function writeToken(token: string): void {
  process.stdout.write(token);
}

/**
 * End a streaming block with a newline.
 */
export function endStream(): void {
  process.stdout.write('\n');
}
