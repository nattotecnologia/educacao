const crypto = require('crypto');
const fs = require('fs');

const ALGORITHM = 'aes-256-gcm';
const ITERATIONS = 10000;
const KEY_LENGTH = 32;

function loadEnv() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });
  return env;
}

const env = loadEnv();
const masterKey = Buffer.from(env.ENCRYPTION_MASTER_KEY, 'hex');

function deriveKey(salt) {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

function decrypt(encryptedData) {
  try {
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const key = deriveKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return "ERROR: " + error.message;
  }
}

const dbKey = "b8052e11881811b1bf01edfb3a3f0434176b44a1b1f4bc2fd4915069e8164f4e518a102a0f3d61964924ccf9d860322fde866a827486d8bd05921e45918b8ae5:4ee0c6219e59b30501baeb526901afcc:37a72713fa006f42f926ff6ba300d5b4:dde50b066ab912a89b640b050479b4a68ea102a7a07726e071ec84fe62d63a7bf946f31f3eff541591e24d53cd178bfadadff45b4797c2f41bb923b7c08355a7ba2ebedca23ab37d82";

console.log("Decrypted key status:", decrypt(dbKey) ? "SUCCESS" : "FAIL");
