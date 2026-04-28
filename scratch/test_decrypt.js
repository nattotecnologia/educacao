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

// Chave obtida do banco anteriormente
const dbKey = "8a1da73d79679e5b11e27837d743dbb27d2ddf180124089e78790992589e1082581c459b3335883b457084af7efe4937b532f843e371e7f4dd7d69dda03bfec7:43e4ccf538d287e7334f69e1574bce0b:37d219266d5bc38c57b4087d15ec9db7:5bf560408a6b4312956358839ee3cb991e165adf3d4cb9428183b9b919047274d152f912d7e5995eedd4f8129b974018f9df21fcbc85eca6751c195704196001d73bc8a54a061a0ae0c1d27517b3ed8ae8eb68899b7a216c6c854f877e3824e455769030143a464fa970a4b71cd119e4b0a4dc7497dc542f145cab3cb90ce00393ca935485a14d947cae1f5c6e999fcfcbc49d369bcafd75aa695f3b7a069dd5ab63b768ab95717bf01bd0b45bbc1996d92ac9fe3b619ea8b63790055b570c0fef23b4f1d33751452fd37c8621b40fefcb986f26d44daeb9fc16be6545fc2b186510f2649b487bea81c90a73b94ee7ca50d39dd669e055330d602d59c600b85a4d5314e34482390b36d19c382ba747e3cf44a0be6f95461ae17bbdeebf734bd5a6cf25cb488e37fa168fefa292bbf858996c68bae4d42484a575b4db4623aff9c8b3a87866811820b966f2eff3cdf7867b23c765e7";

console.log("Decrypted key:", decrypt(dbKey));
