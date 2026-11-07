#!/usr/bin/env node
// Gera o hash scrypt de uma senha lida da entrada padrão (sem eco no terminal).
// Uso: node scripts/hash-senha.mjs   (digite a senha e Enter)  →  imprime scrypt$...
import { randomBytes, scrypt } from "node:crypto";

const N = 1 << 15, r = 8, p = 1, KEYLEN = 64;

async function readSecret() {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const c of stdin) chunks.push(c);
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  }
  stderr.write("Senha (mín. 12 caracteres): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  return new Promise((resolve) => {
    stdin.on("data", (ch) => {
      if (ch === "\r" || ch === "\n") { stdin.setRawMode(false); stdin.pause(); stderr.write("\n"); resolve(value); }
      else if (ch === "\u0003") process.exit(130);
      else if (ch === "\u007f") value = value.slice(0, -1);
      else value += ch;
    });
  });
}

const senha = await readSecret();
if (senha.length < 12) { console.error("Senha curta demais (mínimo 12)."); process.exit(1); }
const salt = randomBytes(16);
scrypt(senha, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => {
  if (err) { console.error(err.message); process.exit(1); }
  process.stdout.write(["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$") + "\n");
});
