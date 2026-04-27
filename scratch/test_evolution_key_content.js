const crypto = require('crypto');
const masterKey = '47a6b9c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8';

function decrypt(encryptedData) { 
  try { 
    if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':'); 
    const salt = Buffer.from(saltHex, 'hex'); 
    const iv = Buffer.from(ivHex, 'hex'); 
    const tag = Buffer.from(tagHex, 'hex'); 
    const key = crypto.pbkdf2Sync(Buffer.from(masterKey, 'hex'), salt, 10000, 32, 'sha512'); 
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); 
    decipher.setAuthTag(tag); 
    let decrypted = decipher.update(encrypted, 'hex', 'utf8'); 
    decrypted += decipher.final('utf8'); 
    return decrypted; 
  } catch(e) { 
    return 'ERROR: ' + e.message; 
  } 
} 

console.log('Evolution Key Decrypted:', decrypt('685d8c7fad9f3645ceeadc957c8a64d0b24ecfbbb33d559dc83234108f050381677c54514e4d8b4a7fbac27e127bcc1fd5a5d7944bc5d83fd5c91c60b14d90a7:cf3390be804b6beba8265157dd502093:461fd05f082310d67a5eff2be80d7489:a85d35d8f48c0bdd61293480c94fd5b1581d63d3f9f88416d80037f8fee29fa7253faff9d52be82a41f0fcd24cd75f764da4c542e527b1a307ec197286e29009e7a4561da8c136a602'));
