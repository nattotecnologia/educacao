const crypto = require('crypto');
const masterKey = '47a6b9c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8';

function encrypt(text) {
  const salt = crypto.randomBytes(64);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(Buffer.from(masterKey, 'hex'), salt, 10000, 32, 'sha512');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

const aiKey = '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';
console.log('Encrypted OpenRouter Key:', encrypt(aiKey));
